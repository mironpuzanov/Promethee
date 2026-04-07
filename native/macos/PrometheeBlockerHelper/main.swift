import Foundation

// MARK: - Constants

let socketPath   = "/var/run/promethee-blocker.sock"
let hostsPath    = "/etc/hosts"
let beginMarker  = "# BEGIN PROMETHEE BLOCKER — do not edit"
let endMarker    = "# END PROMETHEE BLOCKER"

// Chrome/Arc/Edge/Brave all use the same managed-policy directory structure.
// Writing DnsOverHttpsMode=off here forces them to use the system resolver,
// which respects /etc/hosts.  Without this, Chromium-based browsers use
// DNS-over-HTTPS and bypass /etc/hosts entirely.
let chromePolicyDir  = "/Library/Managed Preferences/com.google.Chrome"
let chromePolicyFile = "\(chromePolicyDir)/com.google.Chrome.plist"
// Arc is Chromium-based but uses its own bundle ID for policies
let arcPolicyDir     = "/Library/Managed Preferences/company.thebrowser.Browser"
let arcPolicyFile    = "\(arcPolicyDir)/company.thebrowser.Browser.plist"
// Firefox uses a different mechanism — policies.json
let firefoxPolicyDir  = "/Library/Application Support/Mozilla/policies"
let firefoxPolicyFile = "\(firefoxPolicyDir)/policies.json"

// MARK: - /etc/hosts

func readHosts() throws -> String {
    return try String(contentsOfFile: hostsPath, encoding: .utf8)
}

func writeHosts(_ content: String) throws {
    try content.write(toFile: hostsPath, atomically: true, encoding: .utf8)
}

func flushDNSCache() {
    let flush = Process()
    flush.executableURL = URL(fileURLWithPath: "/usr/bin/dscacheutil")
    flush.arguments = ["-flushcache"]
    try? flush.run()
    flush.waitUntilExit()

    let hup = Process()
    hup.executableURL = URL(fileURLWithPath: "/usr/bin/killall")
    hup.arguments = ["-HUP", "mDNSResponder"]
    try? hup.run()
    hup.waitUntilExit()
}

func stripPrometheeBlock(_ content: String) -> String {
    var result: [String] = []
    var inBlock = false
    for line in content.components(separatedBy: "\n") {
        if line.hasPrefix(beginMarker) { inBlock = true; continue }
        if line.hasPrefix(endMarker)   { inBlock = false; continue }
        if !inBlock { result.append(line) }
    }
    while result.last == "" { result.removeLast() }
    return result.joined(separator: "\n") + "\n"
}

// DoH provider endpoints — blocking these forces browsers that already have DoH
// enabled to fall back to system DNS without requiring a browser restart.
let dohProviders: [String] = [
    "dns.google", "dns64.dns.google",
    "cloudflare-dns.com", "dns.cloudflare.com", "chrome.cloudflare-dns.com",
    "doh.opendns.com", "doh.familyshield.opendns.com",
    "dns.nextdns.io",
    "mozilla.cloudflare-dns.com",
]

func activateBlocker(domains: [String]) throws {
    // 1. Write /etc/hosts block (IPv4 + IPv6)
    // Also block DoH providers so browsers fall back to system DNS immediately,
    // even without a browser restart (belt-and-suspenders alongside the policy file).
    let current = try readHosts()
    let stripped = stripPrometheeBlock(current)
    var block = "\n\(beginMarker)\n"
    let allDomains = domains + dohProviders
    for domain in allDomains {
        let d = domain.trimmingCharacters(in: .whitespaces)
        if d.isEmpty { continue }
        block += "0.0.0.0 \(d)\n"
        block += "::0 \(d)\n"
    }
    block += "\(endMarker)\n"
    try writeHosts(stripped + block)
    flushDNSCache()

    // 2. Disable DNS-over-HTTPS in Chromium browsers so /etc/hosts is respected
    writeChromiumDoHPolicy(disable: true)
    writeFirefoxDoHPolicy(disable: true)
}

func deactivateBlocker() throws {
    // 1. Remove /etc/hosts block
    let current = try readHosts()
    try writeHosts(stripPrometheeBlock(current))
    flushDNSCache()

    // 2. Remove DoH policies — restore browser defaults
    writeChromiumDoHPolicy(disable: false)
    writeFirefoxDoHPolicy(disable: false)
}

// MARK: - Browser DoH policy

/// Writes (or removes) a managed policy that sets DnsOverHttpsMode=off for
/// Chrome and Arc (both Chromium-based, same policy key).
func writeChromiumDoHPolicy(disable: Bool) {
    for (dir, file) in [(chromePolicyDir, chromePolicyFile), (arcPolicyDir, arcPolicyFile)] {
        if disable {
            let plist: NSDictionary = ["DnsOverHttpsMode": "off"]
            do {
                try FileManager.default.createDirectory(atPath: dir,
                    withIntermediateDirectories: true, attributes: nil)
                plist.write(toFile: file, atomically: true)
                // Ensure readable by the browser process
                try FileManager.default.setAttributes(
                    [.posixPermissions: 0o644], ofItemAtPath: file)
            } catch {
                fputs("[blocker] chromium policy write error: \(error)\n", stderr)
            }
        } else {
            // Remove the policy file so we don't permanently override user prefs
            try? FileManager.default.removeItem(atPath: file)
            // Remove dir only if empty
            try? FileManager.default.removeItem(atPath: dir)
        }
    }
}

/// Writes (or removes) a Firefox policies.json that disables DoH.
func writeFirefoxDoHPolicy(disable: Bool) {
    if disable {
        let json = """
        {
          "policies": {
            "DNSOverHTTPS": { "Enabled": false, "Locked": true }
          }
        }
        """
        do {
            try FileManager.default.createDirectory(atPath: firefoxPolicyDir,
                withIntermediateDirectories: true, attributes: nil)
            try json.write(toFile: firefoxPolicyFile, atomically: true, encoding: .utf8)
        } catch {
            fputs("[blocker] firefox policy write error: \(error)\n", stderr)
        }
    } else {
        try? FileManager.default.removeItem(atPath: firefoxPolicyFile)
        try? FileManager.default.removeItem(atPath: firefoxPolicyDir)
    }
}

// MARK: - JSON helpers

func jsonResponse(ok: Bool, error: String? = nil) -> Data {
    var dict: [String: Any] = ["ok": ok]
    if let e = error { dict["error"] = e }
    return (try? JSONSerialization.data(withJSONObject: dict)) ?? Data("{\"ok\":false}".utf8)
}

// MARK: - Client handler

func handleClient(fd: Int32) {
    defer { close(fd) }
    var buffer = Data()
    var raw = [UInt8](repeating: 0, count: 4096)
    while true {
        let n = read(fd, &raw, 4096)
        if n <= 0 { break }
        buffer.append(contentsOf: raw[0..<n])
        if (try? JSONSerialization.jsonObject(with: buffer)) != nil { break }
    }
    guard !buffer.isEmpty,
          let json = try? JSONSerialization.jsonObject(with: buffer) as? [String: Any],
          let cmd  = json["cmd"] as? String else {
        let r = jsonResponse(ok: false, error: "invalid request")
        _ = r.withUnsafeBytes { write(fd, $0.baseAddress!, $0.count) }
        return
    }
    let resp: Data
    switch cmd {
    case "activate":
        let domains = json["domains"] as? [String] ?? []
        do    { try activateBlocker(domains: domains); resp = jsonResponse(ok: true) }
        catch { resp = jsonResponse(ok: false, error: error.localizedDescription) }
    case "deactivate":
        do    { try deactivateBlocker(); resp = jsonResponse(ok: true) }
        catch { resp = jsonResponse(ok: false, error: error.localizedDescription) }
    default:
        resp = jsonResponse(ok: false, error: "unknown command: \(cmd)")
    }
    _ = resp.withUnsafeBytes { write(fd, $0.baseAddress!, $0.count) }
}

// MARK: - Server

func runServer() {
    unlink(socketPath)
    let serverFd = socket(AF_UNIX, SOCK_STREAM, 0)
    guard serverFd >= 0 else { fputs("socket() failed\n", stderr); exit(1) }

    var addr = sockaddr_un()
    addr.sun_family = sa_family_t(AF_UNIX)
    _ = withUnsafeMutablePointer(to: &addr.sun_path) { ptr in
        ptr.withMemoryRebound(to: CChar.self, capacity: 104) { strlcpy($0, socketPath, 104) }
    }
    let bound = withUnsafePointer(to: &addr) { ptr in
        ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) {
            bind(serverFd, $0, socklen_t(MemoryLayout<sockaddr_un>.size))
        }
    }
    guard bound == 0 else { fputs("bind() failed: \(String(cString: strerror(errno)))\n", stderr); exit(1) }
    chmod(socketPath, 0o666)
    guard listen(serverFd, 10) == 0 else { fputs("listen() failed\n", stderr); exit(1) }
    fputs("PrometheeBlockerHelper listening on \(socketPath)\n", stderr)
    while true {
        let clientFd = accept(serverFd, nil, nil)
        if clientFd < 0 { continue }
        handleClient(fd: clientFd)
    }
}

runServer()
