// Generate PWA PNG icons from scratch using pure Node.js (no dependencies).
// Creates minimal valid PNG files with a blue background and white "M" letter.
// Usage: node scripts/generate-pwa-icons.js

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '../src/client/public');

// Create a minimal 1x1 blue PNG and scale concept — for real icons,
// we'll create a simple canvas-less approach using raw PNG encoding.

function createPNG(size) {
  // Create an uncompressed PNG with a blue (#2563eb) background
  // This creates a valid PNG that iOS will accept

  const width = size;
  const height = size;

  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type (RGB)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const ihdr = createChunk('IHDR', ihdrData);

  // IDAT chunk - raw image data
  // Each row: filter byte (0) + RGB pixels
  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(rowSize * height);

  // Blue background: #2563eb = RGB(37, 99, 235)
  // White "M" area: approximate a centered M
  const mLeft = Math.floor(width * 0.2);
  const mRight = Math.floor(width * 0.8);
  const mTop = Math.floor(height * 0.2);
  const mBottom = Math.floor(height * 0.8);
  const strokeW = Math.max(Math.floor(width * 0.12), 2);
  const midX = Math.floor(width / 2);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // no filter

    for (let x = 0; x < width; x++) {
      const pixOffset = rowOffset + 1 + x * 3;

      // Check if pixel is part of the "M" letter
      const inBounds = x >= mLeft && x <= mRight && y >= mTop && y <= mBottom;
      let isM = false;

      if (inBounds) {
        // Left vertical stroke
        if (x >= mLeft && x < mLeft + strokeW) isM = true;
        // Right vertical stroke
        if (x > mRight - strokeW && x <= mRight) isM = true;
        // Left diagonal (top-left to center)
        const diagY1 = mTop + ((x - mLeft) / (midX - mLeft)) * (mBottom - mTop) * 0.5;
        if (x >= mLeft && x <= midX && Math.abs(y - diagY1) < strokeW * 0.7) isM = true;
        // Right diagonal (center to top-right)
        const diagY2 = mTop + ((mRight - x) / (mRight - midX)) * (mBottom - mTop) * 0.5;
        if (x >= midX && x <= mRight && Math.abs(y - diagY2) < strokeW * 0.7) isM = true;
      }

      if (isM) {
        rawData[pixOffset] = 255;     // R (white)
        rawData[pixOffset + 1] = 255; // G
        rawData[pixOffset + 2] = 255; // B
      } else {
        rawData[pixOffset] = 37;      // R (#2563eb)
        rawData[pixOffset + 1] = 99;  // G
        rawData[pixOffset + 2] = 235; // B
      }
    }
  }

  // Compress with deflate (store method - no compression for simplicity)
  const deflated = deflateStore(rawData);
  const idat = createChunk('IDAT', deflated);

  // IEND chunk
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function deflateStore(data) {
  // Zlib header (deflate, no compression)
  const blocks = [];
  const maxBlock = 65535;

  // Zlib header: CMF=0x78, FLG=0x01
  blocks.push(Buffer.from([0x78, 0x01]));

  let offset = 0;
  while (offset < data.length) {
    const remaining = data.length - offset;
    const blockSize = Math.min(remaining, maxBlock);
    const isLast = offset + blockSize >= data.length;

    const header = Buffer.alloc(5);
    header[0] = isLast ? 0x01 : 0x00;
    header.writeUInt16LE(blockSize, 1);
    header.writeUInt16LE(blockSize ^ 0xFFFF, 3);

    blocks.push(header);
    blocks.push(data.subarray(offset, offset + blockSize));
    offset += blockSize;
  }

  // Adler-32 checksum
  const adler = adler32(data);
  const adlerBuf = Buffer.alloc(4);
  adlerBuf.writeUInt32BE(adler, 0);
  blocks.push(adlerBuf);

  return Buffer.concat(blocks);
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function adler32(buf) {
  let a = 1, b = 0;
  for (let i = 0; i < buf.length; i++) {
    a = (a + buf[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

// Generate icons
const sizes = [
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

for (const { name, size } of sizes) {
  const png = createPNG(size);
  const outPath = resolve(outDir, name);
  writeFileSync(outPath, png);
  console.log(`Created ${outPath} (${size}x${size}, ${png.length} bytes)`);
}

console.log('Done! PWA icons generated.');
