import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'web', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

function iconSvg(size, textSize, radius = 0) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#2563eb" rx="${radius}"/>
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="${textSize}" font-weight="bold" fill="#ffffff">FY27</text>
</svg>`;
}

const sizes = [
  { name: 'icon-192x192.png', size: 192, text: 52, radius: 24 },
  { name: 'icon-512x512.png', size: 512, text: 140, radius: 64 },
  { name: 'maskable-icon-512x512.png', size: 512, text: 100, radius: 96 }
];

for (const s of sizes) {
  const input = Buffer.from(iconSvg(s.size, s.text, s.radius));
  await sharp(input).png().toFile(join(outDir, s.name));
  console.log('Created', s.name);
}
