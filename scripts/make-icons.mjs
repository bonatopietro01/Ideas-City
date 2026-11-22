// Genera favicon e icona Windows (.ico) da public/logo.svg
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";

const svg = readFileSync("public/logo.svg");
const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngs = await Promise.all(sizes.map((s) => sharp(svg, { density: 384 }).resize(s, s).png().toBuffer()));

// ICO con PNG incorporati
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
const dir = Buffer.alloc(16 * sizes.length);
let offset = 6 + dir.length;
sizes.forEach((s, i) => {
  const o = i * 16;
  dir.writeUInt8(s >= 256 ? 0 : s, o); dir.writeUInt8(s >= 256 ? 0 : s, o + 1);
  dir.writeUInt16LE(1, o + 4); dir.writeUInt16LE(32, o + 6);
  dir.writeUInt32LE(pngs[i].length, o + 8); dir.writeUInt32LE(offset, o + 12);
  offset += pngs[i].length;
});
const ico = Buffer.concat([header, dir, ...pngs]);
writeFileSync("src/app/favicon.ico", ico);
writeFileSync("scripts/aideacity.ico", ico);
writeFileSync("src/app/apple-icon.png", pngs[sizes.indexOf(256)]);
writeFileSync("scripts/preview-256.png", pngs[sizes.indexOf(256)]);
writeFileSync("scripts/preview-32.png", await sharp(pngs[sizes.indexOf(32)]).resize(128, 128, { kernel: "nearest" }).png().toBuffer());
console.log("icone generate");
