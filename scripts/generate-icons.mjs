// Draws the Apogée app icons (static/*.png) with no dependency: a trajectory
// arc reaching its apex, the apex marked by a dot, on bottle green. The mark
// stays inside the central 60% so the 512px icon also works as "maskable".
// Run: node scripts/generate-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [0x2f, 0x62, 0x49]; // --c-fill (light)
const INK = [0xf4, 0xf7, 0xf3]; // --c-on-fill (light)
const ARC_ALPHA = 0.72;

// Geometry in unit square coordinates.
const APEX = { x: 0.5, y: 0.4 };
const HALF_SPAN = 0.25;
const DROP = 0.24; // how far the arc falls at its ends
const STROKE = 0.05;
const DOT_R = 0.072;

const arc = [];
for (let i = 0; i <= 256; i++) {
  const t = -1 + (2 * i) / 256;
  arc.push({ x: APEX.x + t * HALF_SPAN, y: APEX.y + DROP * t * t });
}

function distToSegment(px, py, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

function coverage(px, py) {
  if (Math.hypot(px - APEX.x, py - APEX.y) <= DOT_R) return 1;
  for (let i = 0; i < arc.length - 1; i++) {
    if (distToSegment(px, py, arc[i], arc[i + 1]) <= STROKE / 2) return ARC_ALPHA;
  }
  return 0;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const SS = 4; // 4x4 supersampling for anti-aliased edges
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3); // filter byte 0, then RGB
    for (let x = 0; x < size; x++) {
      let ink = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          ink += coverage((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
        }
      }
      ink /= SS * SS;
      for (let c = 0; c < 3; c++) {
        row[1 + x * 3 + c] = Math.round(BG[c] + (INK[c] - BG[c]) * ink);
      }
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB (opaque, full bleed)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

for (const [file, size] of [
  ['static/icon-192.png', 192],
  ['static/icon-512.png', 512],
  ['static/apple-touch-icon.png', 180]
]) {
  writeFileSync(file, png(size));
  console.log(`${file} ${size}x${size}`);
}
