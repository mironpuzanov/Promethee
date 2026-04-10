import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      // Native + packages with native child binaries must not be bundled.
      // Bundling active-win breaks at runtime (bogus requires like mock-aws-s3 from Rollup/commonjs-plugin).
      external: ['keytar', 'better-sqlite3', 'active-win', 'posthog-node'],
    },
  },
});
