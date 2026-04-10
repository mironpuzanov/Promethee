/**
 * generate-dmg-background.mjs
 * Generates DMG installer background image (dark, with subtle arrow).
 * Output: scripts/dmg-background.png (540×380)
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const W = 540, H = 380;

// Dark background + subtle right-pointing arrow between app (135,175) and Applications (405,175)
const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#0C0A09"/>
  <line x1="224" y1="175" x2="310" y2="175"
        stroke="rgba(255,255,255,0.15)" stroke-width="1.5" stroke-linecap="round"/>
  <polyline points="302,168 312,175 302,182"
        fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"
        stroke-linejoin="round" stroke-linecap="round"/>
</svg>`;

const buf = await sharp(Buffer.from(svg)).resize(W, H).png().toBuffer();
fs.writeFileSync(path.join(__dirname, 'dmg-background.png'), buf);
console.log('✓ scripts/dmg-background.png');
