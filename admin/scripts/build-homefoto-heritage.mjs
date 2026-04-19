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
 * Stare skenirane stranice: ceo kadar (bez crop-a), blago oštrijenje i kontrast,
 * zatim skaliranje da stane u okvir (fit inside) za bolji prikaz na početnoj.
 */
async function processHeritage(inPath, outPath) {
  const img = sharp(inPath).rotate();

  const { width: w0, height: h0 } = await img.metadata();
  if (!w0 || !h0) throw new Error(`Nema dimenzija: ${inPath}`);

  // Prvo umereno smanjenje (zadržan odnos stranica), pa oštrenje na manjoj slici = manje uvećan šum
  const workLong = 1600;

  await img
    .resize(workLong, workLong, { fit: "inside", withoutEnlargement: true })
    .normalize()
    .linear(1.08, -12)
    .sharpen({
      sigma: 1.15,
      m1: 1,
      m2: 2.2,
      x1: 2,
      y2: 10,
      y3: 18,
    })
    .modulate({ brightness: 1.02, saturation: 1.05 })
    // Finalni okvir: cela slika vidljiva (nije cover/crop)
    .resize(1000, 680, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 86, effort: 5 })
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
