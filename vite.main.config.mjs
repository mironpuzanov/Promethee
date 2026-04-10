import { defineConfig } from 'vite';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Load .env manually so env vars are available at Vite build time.
// This lets us bake secrets into the bundle for the packaged app.
function loadDotenv() {
  const envFile = resolve(process.cwd(), '.env');
  if (!existsSync(envFile)) return {};
  const out = {};
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

const dotenv = loadDotenv();
const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY || dotenv.POSTHOG_API_KEY || '';

export default defineConfig({
  define: {
    // Bake the key into the bundle — process.env.POSTHOG_API_KEY works in packaged app
    // even though .env isn't shipped with the app.
    'process.env.POSTHOG_API_KEY': JSON.stringify(POSTHOG_API_KEY),
  },
  build: {
    rollupOptions: {
      // Only true native modules (.node binaries) stay external.
      // posthog-node is pure JS — bundled so it's available inside the asar.
      external: ['keytar', 'better-sqlite3', 'active-win'],
    },
  },
});
