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

// Icons: app at x=135, Applications at x=405, y=215 (center)
// Arrow between ~x=200 and x=340, centered at y=175 (above label)
const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <!-- Light warm-white background -->
  <rect width="${W}" height="${H}" fill="#F0EDE8"/>

  <!-- Arrow shaft -->
  <line x1="205" y1="220" x2="326" y2="220"
        stroke="#9C9690" stroke-width="2" stroke-linecap="round"/>
  <!-- Arrowhead -->
  <polyline points="314,211 328,220 314,229"
        fill="none" stroke="#9C9690" stroke-width="2"
        stroke-linejoin="round" stroke-linecap="round"/>
</svg>`;

const buf = await sharp(Buffer.from(svg)).resize(W, H).png().toBuffer();
fs.writeFileSync(path.join(__dirname, 'dmg-background.png'), buf);
console.log('✓ scripts/dmg-background.png (light warm background, visible arrow)');
