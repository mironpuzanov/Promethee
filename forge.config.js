const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP_BUNDLE_ID  = 'app.promethee';
const HELPER_ID      = 'app.promethee.blocker-helper';
// Use ad-hoc signing ('-') by default so the revoked Apple Dev cert never triggers
// the Gatekeeper "malware" dialog. Switch to a real identity via env var when notarizing.
const SIGNING_IDENTITY = process.env.APPLE_SIGNING_IDENTITY || '-';

module.exports = {
  hooks: {
    postPackage: async (forgeConfig, { platform, arch, outputPaths }) => {
      if (platform !== 'darwin') return;
      for (const appPath of outputPaths) {
        const appBundle = fs.readdirSync(appPath).find(f => f.endsWith('.app'));
        if (!appBundle) continue;
        const bundlePath = path.join(appPath, appBundle);

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

        try {
          execSync(
            `codesign --sign "${SIGNING_IDENTITY}" --identifier "${HELPER_ID}" --options runtime --force "${helperDest}"`,
            { stdio: 'pipe' }
          );
          console.log(`[forge] Embedded + signed helper in ${bundlePath}`);
        } catch (e) {
          console.warn(`[forge] Helper sign warning: ${e.message}`);
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
    extendInfo: {
      LSUIElement: false,
      NSHighResolutionCapable: true,
      CFBundleDisplayName: 'Promethee',
      CFBundleName: 'Promethee',
      CFBundleIdentifier: APP_BUNDLE_ID,
      NSScreenCaptureUsageDescription:
        'Promethee attaches a screen snapshot only when you choose it for the mentor chat.',
      // SMJobBless: declares which helper this app is allowed to install.
      // The requirement string uses ad-hoc identity for dev; swap in team cert for release.
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
        format: 'ULFO',
        name: 'Promethee',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
  ],
  plugins: [
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
