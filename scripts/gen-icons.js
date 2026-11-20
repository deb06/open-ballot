'use strict';

/* ==========================================================================
   Open Ballot — PWA icon generator
   ==========================================================================
   Draws the app mark at 192/512 px (plus a 180 px touch icon) with no
   dependencies: pixels are painted directly and encoded as PNG via zlib.

   Run:  node scripts/gen-icons.js
   Out:  public/icons/icon-<size>.png
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, '..', 'public', 'icons');
const SIZES = [180, 192, 512];

/* --------------------------------------------------------------------------
   PNG encoding
   -------------------------------------------------------------------------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* --------------------------------------------------------------------------
   Drawing helpers
   -------------------------------------------------------------------------- */

const clamp01 = (v) => Math.min(1, Math.max(0, v));

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/* Signed distance to a rounded rectangle centred on the canvas. */
function roundedRectDistance(x, y, w, h, radius) {
  const dx = Math.abs(x - w / 2) - (w / 2 - radius);
  const dy = Math.abs(y - h / 2) - (h / 2 - radius);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  const inside = Math.min(Math.max(dx, dy), 0);
  return outside + inside - radius;
}

/* Distance from a point to a line segment. */
function segmentDistance(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const wx = px - x1;
  const wy = py - y1;
  const len2 = vx * vx + vy * vy || 1;
  const t = clamp01((wx * vx + wy * vy) / len2);
  return Math.hypot(px - (x1 + vx * t), py - (y1 + vy * t));
}

/* --------------------------------------------------------------------------
   Paint one icon
   -------------------------------------------------------------------------- */

function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = size * 0.225;
  const top = [217, 164, 65];
  const bottom = [217, 164, 65];
  const stroke = size * 0.082;
  const check = [
    [size * 0.28, size * 0.53],
    [size * 0.43, size * 0.68],
    [size * 0.73, size * 0.34],
  ];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const px = x + 0.5;
      const py = y + 0.5;
      const d = roundedRectDistance(px, py, size, size, radius);
      const coverage = clamp01(0.5 - d); // 1 px feather

      if (coverage <= 0) {
        rgba[i + 3] = 0;
        continue;
      }

      const bg = mix(top, bottom, y / size);
      let colour = bg;

      const markDistance = Math.min(
        segmentDistance(px, py, check[0][0], check[0][1], check[1][0], check[1][1]),
        segmentDistance(px, py, check[1][0], check[1][1], check[2][0], check[2][1]),
      );
      const markCoverage = clamp01(stroke / 2 + 0.5 - markDistance);
      if (markCoverage > 0) colour = mix(bg, [255, 255, 255], markCoverage);

      rgba[i] = colour[0];
      rgba[i + 1] = colour[1];
      rgba[i + 2] = colour[2];
      rgba[i + 3] = Math.round(255 * coverage);
    }
  }

  return encodePng(size, size, rgba);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const file = path.join(OUT_DIR, `icon-${size}.png`);
  fs.writeFileSync(file, drawIcon(size));
  console.log(`wrote ${path.relative(process.cwd(), file)} (${size}x${size})`);
}
