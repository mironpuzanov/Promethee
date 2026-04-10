/**
 * generate-icons.mjs
 * Generates all app icons from the SVG source logo.
 * Run: node scripts/generate-icons.mjs
 */

import sharp from 'sharp';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, '../src/assets');
const LOGO_BLANC = path.join(ASSETS, 'logo-blanc.svg');
const LOGO_NOIR  = path.join(ASSETS, 'logo-noir.svg');

// App bg: #0C0A09, slightly lightened for icon legibility
const BG = { r: 18, g: 14, b: 10, alpha: 1 }; // #120E0A

async function generateAppIcon() {
  const SIZE = 1024;
  const LOGO_SIZE = Math.round(SIZE * 0.62);
  const OFFSET = Math.round((SIZE - LOGO_SIZE) / 2);

  const svgBuf = fs.readFileSync(LOGO_BLANC);

  const logoPng = await sharp(svgBuf)
    .resize(LOGO_SIZE, LOGO_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const flat = await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: BG } })
    .composite([{ input: logoPng, top: OFFSET, left: OFFSET }])
    .png()
    .toBuffer();

  // Bake rounded corners (macOS standard ~22.5% radius) so Cmd+Tab looks correct
  const R = Math.round(SIZE * 0.225); // 230px for 1024
  const mask = Buffer.from(
    `<svg width="${SIZE}" height="${SIZE}"><rect width="${SIZE}" height="${SIZE}" rx="${R}" ry="${R}" fill="white"/></svg>`
  );
  const icon1024 = await sharp(flat)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(ASSETS, 'icon.png'), icon1024);
  console.log('✓ icon.png (1024×1024)');

  // Build iconset
  const iconsetDir = path.join(ASSETS, 'icon.iconset');
  fs.mkdirSync(iconsetDir, { recursive: true });

  // iconutil only accepts these exact sizes (no 64x64)
  const sizes = [16, 32, 128, 256, 512];
  for (const s of sizes) {
    const buf = await sharp(icon1024).resize(s, s).png().toBuffer();
    fs.writeFileSync(path.join(iconsetDir, `icon_${s}x${s}.png`), buf);
    if (s < 512) {
      const buf2x = await sharp(icon1024).resize(s * 2, s * 2).png().toBuffer();
      fs.writeFileSync(path.join(iconsetDir, `icon_${s}x${s}@2x.png`), buf2x);
    }
  }
  // 512@2x = 1024px (the source)
  fs.writeFileSync(path.join(iconsetDir, 'icon_512x512@2x.png'), icon1024);
  console.log('✓ iconset (all sizes)');

  try {
    execSync(`iconutil -c icns "${iconsetDir}" -o "${path.join(ASSETS, 'icon.icns')}"`);
    console.log('✓ icon.icns');
  } catch (e) {
    console.warn('⚠ iconutil failed (may need to run outside sandbox) — existing icon.icns kept');
  }
}

async function generateTrayIcons() {
  const svgBuf = fs.readFileSync(LOGO_NOIR);
  // 22×22 pt canvas (Apple HIG max for menu bar), 20pt content — fills the bar properly
  const CANVAS_1X = 22, CANVAS_2X = 44;
  const LOGO_1X = 20, LOGO_2X = 40;

  const logo1x = await sharp(svgBuf)
    .resize(LOGO_1X, LOGO_1X, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const pad1x = Math.floor((CANVAS_1X - LOGO_1X) / 2);
  const t1x = await sharp({ create: { width: CANVAS_1X, height: CANVAS_1X, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: logo1x, top: pad1x, left: pad1x }])
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(ASSETS, 'tray-icon.png'), t1x);
  console.log(`✓ tray-icon.png (${CANVAS_1X}×${CANVAS_1X}, logo ${LOGO_1X}×${LOGO_1X})`);

  const logo2x = await sharp(svgBuf)
    .resize(LOGO_2X, LOGO_2X, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const pad2x = Math.floor((CANVAS_2X - LOGO_2X) / 2);
  const t2x = await sharp({ create: { width: CANVAS_2X, height: CANVAS_2X, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: logo2x, top: pad2x, left: pad2x }])
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(ASSETS, 'tray-icon@2x.png'), t2x);
  console.log(`✓ tray-icon@2x.png (${CANVAS_2X}×${CANVAS_2X}, logo ${LOGO_2X}×${LOGO_2X})`);
}

generateAppIcon()
  .then(generateTrayIcons)
  .then(() => console.log('\nAll icons generated.'))
  .catch(e => { console.error(e); process.exit(1); });
