/**
 * Generates WebP tiles for the public home “heritage” grid.
 * Replace files in public/heritage/ with real crops from the book when available.
 */
import sharp from "sharp";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "heritage");
mkdirSync(outDir, { recursive: true });

function xmlEscape(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

const lines = [
  "Kula Jankovića, 1861.",
  "Kuće Tome i Mijata Janjića",
  "Šćepan i Savo Janjić; Živko S. Janjić",
  "Janko i Miloš J. Janjić",
];

const c1 = ["#3d3428", "#1a1510"];
const c2 = ["#2a3530", "#121a18"];
const c3 = ["#352a30", "#1a1216"];
const c4 = ["#303528", "#141812"];
const palettes = [c1, c2, c3, c4];

let idx = 0;
for (const line of lines) {
  idx += 1;
  const [a, b] = palettes[idx - 1];
  const svg = `<svg width="900" height="580" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g${idx}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${a}"/>
      <stop offset="100%" stop-color="${b}"/>
    </linearGradient>
  </defs>
  <rect width="900" height="580" fill="url(#g${idx})"/>
  <text x="450" y="255" fill="#e8dcc8" font-family="Georgia,serif" font-size="26" text-anchor="middle">${xmlEscape(line)}</text>
  <text x="450" y="305" fill="#b09a7a" font-family="Georgia,serif" font-size="15" text-anchor="middle">Iz knjige „Bratstvo Janjić”</text>
</svg>`;
  await sharp(Buffer.from(svg)).webp({ quality: 78 }).toFile(join(outDir, `pocetna-${idx}.webp`));
}

console.log("Wrote", join(outDir, "pocetna-1.webp … pocetna-4.webp"));
