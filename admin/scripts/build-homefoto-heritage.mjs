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

/**
 * Retuš starih skenova: sRGB, histogram, blagi gamma, bogatija boja, „čist” oštrina,
 * zatim izlaz za web — luksuzniji, uredniji ton bez agresivnog HDR izgleda.
 */
async function processHeritage(inPath, outPath) {
  const img = sharp(inPath).rotate();

  const { width: w0, height: h0 } = await img.metadata();
  if (!w0 || !h0) throw new Error(`Nema dimenzija: ${inPath}`);

  const workLong = 1800;

  await img
    .resize(workLong, workLong, { fit: "inside", withoutEnlargement: true })
    .toColorspace("srgb")
    .normalize()
    .gamma(1.045)
    .linear(1.06, -10)
    .modulate({ brightness: 1.035, saturation: 1.14 })
    .sharpen({
      sigma: 0.92,
      m1: 1,
      m2: 2.35,
      x1: 2,
      y2: 10,
      y3: 17,
    })
    .resize(1000, 680, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 90, effort: 6, smartSubsample: true })
    .toFile(outPath);
}

let i = 0;
for (const name of chosen) {
  i += 1;
  const inPath = join(inputDir, name);
  await processHeritage(inPath, join(outDir, `pocetna-${i}.webp`));
  console.log("→", `pocetna-${i}.webp`);
}

console.log("Gotovo:", outDir);
