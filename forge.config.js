const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const { AutoUnpackNativesPlugin } = require('@electron-forge/plugin-auto-unpack-natives');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load .env so APPLE_APP_PASSWORD etc. are available without passing them on the CLI
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (key && !process.env[key]) process.env[key] = value;
  });
}

const APP_BUNDLE_ID  = 'app.promethee';
const HELPER_ID      = 'app.promethee.blocker-helper';

function shellText(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function selectSigningIdentity() {
  if (process.env.APPLE_SIGNING_IDENTITY?.trim()) {
    return process.env.APPLE_SIGNING_IDENTITY.trim();
  }

  const identities = shellText('security find-identity -v -p codesigning');
  const preferredPatterns = [
    /"([^"]*Developer ID Application:[^"]*)"/,
    /"([^"]*Apple Development:[^"]*)"/,
  ];

  for (const pattern of preferredPatterns) {
    const match = identities.match(pattern);
    if (match?.[1]) return match[1];
  }

  return '-';
}

const SIGNING_IDENTITY = selectSigningIdentity();
const USE_REAL_SIGNING = SIGNING_IDENTITY !== '-';

console.log(`[forge] macOS signing identity: ${USE_REAL_SIGNING ? SIGNING_IDENTITY : 'ad-hoc (-)'}`);

// Returns true if the file is a Mach-O binary (native executable or .node addon).
// Checks the first 4 bytes for known Mach-O magic numbers.
function isMachO(filePath) {
  try {
    const buf = Buffer.alloc(4);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    const magic = buf.readUInt32BE(0);
    // 0xcafebabe = universal, 0xfeedface = 32-bit, 0xfeedfacf = 64-bit,
    // 0xcefaedfe / 0xcffaedfe = little-endian variants
    return magic === 0xcafebabe || magic === 0xfeedface || magic === 0xfeedfacf
      || magic === 0xcefaedfe || magic === 0xcffaedfe;
  } catch {
    return false;
  }
}

// Walk a directory and return all Mach-O files (executables + .node addons).
function findMachOFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && isMachO(full)) {
        results.push(full);
      }
    }
  };
  walk(dir);
  return results;
}

// Sign a single binary with hardened runtime + secure timestamp.
// Apple requires --timestamp on every Mach-O binary inside a notarized app,
// including inner native addons and helpers, not just the outer bundle.
function signBinary(binPath, { identity, identifier = null } = {}) {
  if (!fs.existsSync(binPath)) return;
  const args = [
    'codesign',
    '--sign', `"${identity}"`,
    '--options=runtime',
    '--timestamp',
    '--force',
  ];
  if (identifier) args.push('--identifier', `"${identifier}"`);
  args.push(`"${binPath}"`);
  execSync(args.join(' '), { stdio: 'pipe' });
}

module.exports = {
  hooks: {
    postPackage: async (forgeConfig, { platform, arch, outputPaths }) => {
      if (platform !== 'darwin') return;
      for (const appPath of outputPaths) {
        const appBundle = fs.readdirSync(appPath).find(f => f.endsWith('.app'));
        if (!appBundle) continue;
        const bundlePath = path.join(appPath, appBundle);

        // ── 1. Copy native node_modules outside the asar ────────────────────
        // Electron's module resolver finds them here at runtime.
        const resourcesDir = path.join(bundlePath, 'Contents', 'Resources');
        const nativeMods = ['better-sqlite3', 'active-win', 'keytar', 'node-gyp-build', 'bindings', 'file-uri-to-path'];
        const nativeModsDst = path.join(resourcesDir, 'node_modules');
        fs.mkdirSync(nativeModsDst, { recursive: true });
        for (const mod of nativeMods) {
          const src = path.resolve(__dirname, 'node_modules', mod);
          const dst = path.join(nativeModsDst, mod);
          if (fs.existsSync(src)) {
            if (fs.existsSync(dst)) execSync(`rm -rf "${dst}"`, { stdio: 'pipe' });
            execSync(`cp -R "${src}" "${dst}"`, { stdio: 'pipe' });
            console.log(`[forge] Copied native module: ${mod}`);
          }
        }

        // ── 2. Pre-sign all Mach-O binaries in the copied native modules ─────
        // Must happen in postPackage (before Forge's osxSign pass).
        // Apple rejects the DMG if any Mach-O binary inside is unsigned or lacks
        // the hardened runtime, even if the outer app bundle is signed correctly.
        if (USE_REAL_SIGNING) {
          const bins = findMachOFiles(nativeModsDst);
          for (const bin of bins) {
            try {
              // Use a stable reverse-DNS identifier derived from the relative path
              const rel = path.relative(nativeModsDst, bin);
              const identifier = `${APP_BUNDLE_ID}.${rel.replace(/[/\\]/g, '.').replace(/\.node$/, '')}`;
              signBinary(bin, { identity: SIGNING_IDENTITY, identifier });
              console.log(`[forge] Pre-signed: ${rel}`);
            } catch (e) {
              console.warn(`[forge] Pre-sign warning for ${bin}: ${e.stderr?.toString() || e.message}`);
            }
          }
        }

        // ── 3. Embed and sign the blocker helper ─────────────────────────────
        const helperSrc = path.resolve(__dirname, 'native/macos/PrometheeBlockerHelper', HELPER_ID);
        const plistSrc  = path.resolve(__dirname, 'native/macos/PrometheeBlockerHelper', `${HELPER_ID}.plist`);

        if (!fs.existsSync(helperSrc)) {
          console.warn(`[forge] Blocker helper binary missing — run: bash native/macos/PrometheeBlockerHelper/build.sh`);
          continue;
        }

        const launchServicesDir = path.join(bundlePath, 'Contents', 'Library', 'LaunchServices');
        fs.mkdirSync(launchServicesDir, { recursive: true });

        const helperDest = path.join(launchServicesDir, HELPER_ID);
        fs.copyFileSync(helperSrc, helperDest);
        fs.chmodSync(helperDest, 0o755);

        if (fs.existsSync(plistSrc)) {
          fs.copyFileSync(plistSrc, path.join(launchServicesDir, `${HELPER_ID}.plist`));
        }

        if (USE_REAL_SIGNING) {
          try {
            signBinary(helperDest, { identity: SIGNING_IDENTITY, identifier: HELPER_ID });
            console.log(`[forge] Signed helper in ${bundlePath}`);
          } catch (e) {
            console.warn(`[forge] Helper sign warning: ${e.message}`);
          }
        }
      }
    },
  },
  packagerConfig: {
    asar: true,
    name: 'Promethee',
    executableName: 'Promethee',
    icon: 'src/assets/icon',
    appBundleId: APP_BUNDLE_ID,
    osxSign: USE_REAL_SIGNING
      ? {
          identity: SIGNING_IDENTITY,
          hardenedRuntime: true,
          signatureFlags: 'library',
        }
      : undefined,
    osxNotarize: USE_REAL_SIGNING
      ? {
          tool: 'notarytool',
          appleId: process.env.APPLE_ID || 'mironpuzanov@icloud.com',
          appleIdPassword: process.env.APPLE_APP_PASSWORD,
          teamId: process.env.APPLE_TEAM_ID || '69V9FN6864',
        }
      : undefined,
    extendInfo: {
      LSUIElement: false,
      NSHighResolutionCapable: true,
      CFBundleDisplayName: 'Promethee',
      CFBundleName: 'Promethee',
      CFBundleIdentifier: APP_BUNDLE_ID,
      NSScreenCaptureUsageDescription:
        'Promethee reads which app is in the foreground to track your focus time. No video is recorded.',
      NSAccessibilityUsageDescription:
        'Promethee uses Accessibility to read the active window title for app usage tracking.',
      SMPrivilegedExecutables: {
        [HELPER_ID]: `identifier "${HELPER_ID}"`,
      },
    },
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-dmg',
      config: {
        format: 'UDZO',
        name: 'Promethee',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    {
      name: '@electron-forge/plugin-vite',
      config: {
        build: [
          {
            entry: 'src/main/index.js',
            config: 'vite.main.config.mjs',
            target: 'main',
          },
          {
            entry: 'src/main/preload.js',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
        ],
        renderer: [
          {
            name: 'main_window',
            config: 'vite.renderer.config.mjs',
          },
        ],
      },
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
