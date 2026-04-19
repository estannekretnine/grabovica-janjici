/**
 * Čita JPG iz `homefoto/` (koren repozitorijuma) i pravi `admin/public/heritage/pocetna-1..4.webp`.
 * Redosled: leksikografski po imenu fajla (npr. 20260419_095955 … 20260419_100018).
 * Ponovo pokreni posle zamene slika u homefoto/: npm run build:homefoto --prefix admin
 */
import sharp from "sharp";
import { mkdirSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const inputDir = join(repoRoot, "homefoto");
const outDir = join(__dirname, "..", "public", "heritage");

mkdirSync(outDir, { recursive: true });

const files = readdirSync(inputDir)
  .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
  .sort();

if (files.length < 4) {
  console.error(`Očekivano bar 4 slike u ${inputDir}, nađeno: ${files.length}`);
  process.exit(1);
}

const chosen = files.slice(0, 4);
console.log("Ulaz:", chosen.join(", "));

let i = 0;
for (const name of chosen) {
  i += 1;
  const inPath = join(inputDir, name);
  await sharp(inPath)
    .rotate()
    .resize(900, 580, { fit: "cover", position: "centre" })
    .webp({ quality: 80, effort: 4 })
    .toFile(join(outDir, `pocetna-${i}.webp`));
  console.log("→", `pocetna-${i}.webp`);
}

console.log("Gotovo:", outDir);
