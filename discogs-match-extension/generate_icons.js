const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 calculation table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const typeAndData = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crcBuf]);
}

function createVinylIconPNG(size) {
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = makeChunk('IHDR', ihdrData);

  // Pixel data (RGBA)
  const scanlines = [];
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.46;
  const labelR = size * 0.18;
  const holeR = size * 0.05;

  for (let y = 0; y < size; y++) {
    const row = [0]; // Filter byte (0 = None)
    for (let x = 0; x < size; x++) {
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let r = 0, g = 0, b = 0, a = 0;

      if (dist <= outerR) {
        if (dist <= holeR) {
          // Center spindle hole (transparent or dark background)
          r = 17; g = 17; b = 17; a = 255;
        } else if (dist <= labelR) {
          // Discogs Gold Label (#F5C518)
          r = 245; g = 197; b = 24; a = 255;
        } else {
          // Vinyl Record Body (#1A1A1A) with concentric grooves
          const groove = Math.floor(dist) % 2 === 0;
          const val = groove ? 38 : 22;
          r = val; g = val; b = val; a = 255;
        }

        // Anti-aliasing outer edge
        if (dist > outerR - 1) {
          const edgeAlpha = Math.max(0, Math.min(1, outerR - dist));
          a = Math.round(255 * edgeAlpha);
        }
      }

      row.push(r, g, b, a);
    }
    scanlines.push(Buffer.from(row));
  }

  const rawData = Buffer.concat(scanlines);
  const compressedData = zlib.deflateSync(rawData);
  const idat = makeChunk('IDAT', compressedData);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

[16, 48, 128].forEach(size => {
  const pngBuf = createVinylIconPNG(size);
  const filePath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filePath, pngBuf);
  console.log(`Generated icon: ${filePath} (${pngBuf.length} bytes)`);
});
