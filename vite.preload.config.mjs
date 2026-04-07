import { defineConfig } from 'vite';

/** Forge reloads renderer + preload on disk, but the Electron main process is NOT re-execed — new ipcMain.handle() code only runs after a full app quit + npm start. */
function warnIfMainStaleAfterPreloadRebuild() {
  return {
    name: 'promethee-warn-main-after-preload-rebuild',
    closeBundle() {
      if (process.env.NODE_ENV === 'production') return;
      console.log(
        '\n\x1b[33m[Promethee]\x1b[0m Preload rebuilt. If IPC handlers were added/changed in \x1b[1msrc/main\x1b[0m, quit Electron (Cmd+Q) and run \x1b[1mnpm start\x1b[0m so main picks them up.\n'
      );
    },
  };
}

// https://vitejs.dev/config
export default defineConfig({
  plugins: [warnIfMainStaleAfterPreloadRebuild()],
});
