// Generates the placeholder app icons in public/ (a plain barbell glyph, no text).
// Run with: node src/pwa/make-icons.mjs   (no dependencies; replace the PNGs when DESIGN.md lands)
import { deflateSync, crc32 } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

// Placeholder colors from src/styles/tokens.css (--accent and --bg, light theme).
const BG = [0x1f, 0x4e, 0x5f];
const FG = [0xf4, 0xf4, 0xf2];

// Glyph as rounded rectangles in a 0..1 box: [x0, y0, x1, y1, radius].
const RECTS = [
  [0.17, 0.47, 0.83, 0.53, 0.02], // bar
  [0.26, 0.32, 0.33, 0.68, 0.025], // inner plates
  [0.67, 0.32, 0.74, 0.68, 0.025],
  [0.2, 0.385, 0.25, 0.615, 0.02], // outer plates
  [0.75, 0.385, 0.8, 0.615, 0.02],
];

function sdRoundRect(px, py, [x0, y0, x1, y1, r]) {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const hx = (x1 - x0) / 2 - r, hy = (y1 - y0) / 2 - r;
  const dx = Math.abs(px - cx) - hx, dy = Math.abs(py - cy) - hy;
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return outside + Math.min(Math.max(dx, dy), 0) - r;
}

function render(size, glyphScale) {
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x++) {
      // Map the pixel center into glyph space, scaled around the middle.
      const gx = ((x + 0.5) / size - 0.5) / glyphScale + 0.5;
      const gy = ((y + 0.5) / size - 0.5) / glyphScale + 0.5;
      const d = Math.min(...RECTS.map((r) => sdRoundRect(gx, gy, r)));
      const aa = 1 / (size * glyphScale); // one pixel in glyph units
      const cover = Math.min(1, Math.max(0, 0.5 - d / aa));
      const o = 1 + x * 4;
      for (let c = 0; c < 3; c++) row[o + c] = Math.round(BG[c] + (FG[c] - BG[c]) * cover);
      row[o + 3] = 255;
    }
    rows.push(row);
  }
  return png(size, Buffer.concat(rows));
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

function png(size, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = new URL('../../public/', import.meta.url);
mkdirSync(out, { recursive: true });
const icons = [
  ['pwa-192x192.png', 192, 1],
  ['pwa-512x512.png', 512, 1],
  ['maskable-512x512.png', 512, 0.72], // glyph inside the 80% safe zone
  ['apple-touch-icon-180x180.png', 180, 0.9],
  ['favicon-32x32.png', 32, 1.1],
];
for (const [name, size, scale] of icons) {
  writeFileSync(new URL(name, out), render(size, scale));
  console.log(`wrote public/${name}`);
}
