const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const { AutoUnpackNativesPlugin } = require('@electron-forge/plugin-auto-unpack-natives');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load .env so APPLE_APP_PASSWORD etc. are available without passing them on the CLI.
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

const APP_BUNDLE_ID = 'app.promethee';
const HELPER_ID     = 'app.promethee.blocker-helper';

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

// Returns true if the file starts with a known Mach-O magic number.
function isMachO(filePath) {
  try {
    const buf = Buffer.alloc(4);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    const magic = buf.readUInt32BE(0);
    return magic === 0xcafebabe || magic === 0xfeedface || magic === 0xfeedfacf
        || magic === 0xcefaedfe || magic === 0xcffaedfe;
  } catch {
    return false;
  }
}

// Walk a directory and return all Mach-O files.
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

// Sign a single Mach-O binary with hardened runtime + secure timestamp.
// Apple's notary service requires --timestamp on every binary inside a notarized app.
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

// afterCopy fires after the app source is copied into the staging dir,
// but BEFORE asarApp() creates the asar archive and BEFORE osxSign seals.
// buildPath = stagingPath/resources/app/ (the app source root being packed into asar)
// We inject native modules here so asar.unpack extracts them to app.asar.unpacked/.
async function afterCopyHook(buildPath, electronVersion, platform, arch, callback) {
  if (platform !== 'darwin') return callback();

  try {
    // ── 1. Inject native modules into buildPath/node_modules/ ────────────────
    // These get packed by asarApp(), then asar.unpack extracts them to
    // app.asar.unpacked/node_modules/ — which is where Electron's require() looks.
    const nativeMods = [
      'better-sqlite3',
      'active-win',
      'keytar',
      'node-gyp-build',
      'bindings',
      'file-uri-to-path',
    ];
    const dstModules = path.join(buildPath, 'node_modules');
    fs.mkdirSync(dstModules, { recursive: true });
    for (const mod of nativeMods) {
      const src = path.resolve(__dirname, 'node_modules', mod);
      const dst = path.join(dstModules, mod);
      if (!fs.existsSync(src)) continue;
      if (fs.existsSync(dst)) execSync(`rm -rf "${dst}"`, { stdio: 'pipe' });
      execSync(`cp -R "${src}" "${dst}"`, { stdio: 'pipe' });
      console.log(`[forge] Injected: ${mod}`);
    }

    callback();
  } catch (err) {
    callback(err);
  }
}

// afterComplete fires after osxSign seals the bundle (after move to final output).
// We add the blocker helper here and then re-seal the outer .app bundle so the
// helper is included in the final codesign seal that notarization verifies.
async function afterCompleteHook(finalPath, electronVersion, platform, arch, callback) {
  if (platform !== 'darwin') return callback();

  try {
    const appName = fs.readdirSync(finalPath).find(f => f.endsWith('.app'));
    if (!appName) return callback(new Error(`No .app found in ${finalPath}`));
    const appBundle = path.join(finalPath, appName);

    // ── Copy + sign the blocker helper ────────────────────────────────────────
    const helperSrc = path.resolve(__dirname, 'native/macos/PrometheeBlockerHelper', HELPER_ID);
    const plistSrc  = path.resolve(__dirname, 'native/macos/PrometheeBlockerHelper', `${HELPER_ID}.plist`);

    if (fs.existsSync(helperSrc)) {
      const launchServicesDir = path.join(appBundle, 'Contents', 'Library', 'LaunchServices');
      fs.mkdirSync(launchServicesDir, { recursive: true });
      const helperDest = path.join(launchServicesDir, HELPER_ID);
      fs.copyFileSync(helperSrc, helperDest);
      fs.chmodSync(helperDest, 0o755);
      if (fs.existsSync(plistSrc)) {
        fs.copyFileSync(plistSrc, path.join(launchServicesDir, `${HELPER_ID}.plist`));
      }
      if (USE_REAL_SIGNING) {
        // Sign the helper binary itself
        signBinary(helperDest, { identity: SIGNING_IDENTITY, identifier: HELPER_ID });
        console.log(`[forge] Signed blocker helper`);
        // Re-seal the outer .app to include the helper in the codesign seal.
        // Without this, notarization sees "file added" and rejects the submission.
        // Must pass --entitlements so osxSign's JIT entitlement is preserved;
        // bare codesign --force without --entitlements strips them, causing V8 to crash.
        const entitlementsPath = path.resolve(
          __dirname,
          'node_modules/@electron/osx-sign/entitlements/default.darwin.plist'
        );
        execSync(
          `codesign --sign "${SIGNING_IDENTITY}" --options=runtime --timestamp --force --entitlements "${entitlementsPath}" "${appBundle}"`,
          { stdio: 'pipe' }
        );
        console.log(`[forge] Re-sealed app bundle`);
      }
    } else {
      console.warn(`[forge] Blocker helper binary missing — run: bash native/macos/PrometheeBlockerHelper/build.sh`);
    }

    callback();
  } catch (err) {
    callback(err);
  }
}

module.exports = {
  packagerConfig: {
    asar: {
      // Unpack native module directories from the asar into app.asar.unpacked/.
      // afterCopy injects these into buildPath/node_modules/ before asarApp() runs,
      // so asar sees them and this unpack pattern correctly extracts them.
      unpack: 'node_modules/{better-sqlite3,active-win,keytar,node-gyp-build,bindings,file-uri-to-path}/**',
    },
    name: 'Promethee',
    executableName: 'Promethee',
    icon: 'src/assets/icon',
    appBundleId: APP_BUNDLE_ID,
    afterCopy: [afterCopyHook],
    afterComplete: [afterCompleteHook],
    osxSign: USE_REAL_SIGNING
      ? {
          identity: SIGNING_IDENTITY,
          hardenedRuntime: true,
          signatureFlags: 'library',
          ignore: [
            /\.lproj\//,
            /\.pak$/,
          ],
        }
      : undefined,
    // Notarization is handled manually in scripts/release.sh after the DMG is created.
    // Doing it here (before DMG creation) causes the staple ticket to invalidate the
    // codesign seal on the main binary when hdiutil copies the bundle into the DMG.
    osxNotarize: undefined,
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
        additionalDMGOptions: {
          window: { size: { width: 540, height: 380 } },
        },
        contents: [
          { x: 150, y: 180, type: 'file', path: `${process.cwd()}/out/Promethee-darwin-arm64/Promethee.app` },
          { x: 390, y: 180, type: 'link', path: '/Applications' },
        ],
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
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
