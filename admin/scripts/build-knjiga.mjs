/**
 * Build "knjiga grabovica" — profesionalni sken PDF (samo obradjene JPG stranice).
 *
 * Ulaz: knjigagrabovica/korica/ + knjigagrabovica/do 11 strane/
 * Izlaz:
 *   admin/public/knjiga/grabovica-sken.pdf
 *   admin/public/knjiga/grabovica.pdf (ista kopija)
 *   admin/public/knjiga/pages/p###.webp
 *   admin/public/knjiga/manifest.json
 *
 * Pokretanje: npm run build:knjiga --prefix admin
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const adminRoot = join(__dirname, "..");
const repoRoot = join(adminRoot, "..");
const inputRoot = join(repoRoot, "knjigagrabovica");
const tmpDir = join(adminRoot, ".tmp", "knjiga");
const outDir = join(adminRoot, "public", "knjiga");
const pagesOutDir = join(outDir, "pages");

const ORDER = [
  { file: "korica/korica.jpg", label: "Korica" },
  { file: "korica/korica posle.jpg", label: "Korica posle" },
  { file: "korica/korica poslee.jpg", label: "Korica poslee" },
  { file: "do 11 strane/pocetak desno 5.jpg", label: "Str. 5 (UVOD)" },
  { file: "do 11 strane/6-7.jpg", label: "Str. 6–7" },
  { file: "do 11 strane/8-9.jpg", label: "Str. 8–9" },
  { file: "do 11 strane/10-11.jpg", label: "Str. 10–11" },
];

const PDF_JPEG_LONG = 2000;
const WEBP_LONG = 1400;
const PDF_LONG_PT = 720;
const WORK_LONG = 2400;

mkdirSync(pagesOutDir, { recursive: true });
mkdirSync(outDir, { recursive: true });
mkdirSync(tmpDir, { recursive: true });

function resolveInput(rel) {
  const p = join(inputRoot, rel);
  if (!existsSync(p)) throw new Error(`Nedostaje ulaz: ${p}`);
  return p;
}

function pageSizePt(imgW, imgH) {
  const aspect = imgW / imgH;
  if (aspect >= 1) return [PDF_LONG_PT, PDF_LONG_PT / aspect];
  return [PDF_LONG_PT * aspect, PDF_LONG_PT];
}

/** Retuš skenova — sRGB, histogram, blago posvetljavanje, oštrina, trim ivica. */
async function processScanPage(inputBuf) {
  const pipeline = sharp(inputBuf)
    .rotate()
    .resize(WORK_LONG, WORK_LONG, { fit: "inside", withoutEnlargement: true })
    .toColorspace("srgb")
    .normalize()
    .gamma(1.04)
    .linear(1.05, -14)
    .modulate({ brightness: 1.04, saturation: 1.06 })
    .sharpen({
      sigma: 0.85,
      m1: 0.8,
      m2: 2.2,
      x1: 2,
      y2: 10,
      y3: 16,
    });

  const beforeTrim = await pipeline.clone().jpeg({ quality: 92 }).toBuffer();
  const metaBefore = await sharp(beforeTrim).metadata();

  try {
    const trimmed = await sharp(beforeTrim)
      .trim({ threshold: 18, lineArt: false })
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();
    const metaAfter = await sharp(trimmed).metadata();
    const lost =
      (metaBefore.width || 0) - (metaAfter.width || 0) > (metaBefore.width || 0) * 0.08;
    if (!lost && (metaAfter.width || 0) > 200) {
      return trimmed;
    }
  } catch {
    /* trim nije uspeo */
  }

  return beforeTrim;
}

console.log(`[1/2] Sken PDF — ${ORDER.length} stranica iz ${inputRoot}`);

const pdfDoc = await PDFDocument.create();
const manifest = [];

for (let i = 0; i < ORDER.length; i++) {
  const spec = ORDER[i];
  const pageNum = i + 1;
  const inPath = resolveInput(spec.file);
  process.stdout.write(`[${pageNum}/${ORDER.length}] ${basename(spec.file)} ... `);

  const processed = await processScanPage(readFileSync(inPath));
  const meta = await sharp(processed).metadata();
  const imgW = meta.width || 1;
  const imgH = meta.height || 1;

  const pdfJpg = await sharp(processed)
    .resize(PDF_JPEG_LONG, PDF_JPEG_LONG, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();

  const [pageW, pageH] = pageSizePt(imgW, imgH);
  const page = pdfDoc.addPage([pageW, pageH]);
  const img = await pdfDoc.embedJpg(pdfJpg);
  const drawW = img.width * Math.min(pageW / img.width, pageH / img.height);
  const drawH = img.height * (drawW / img.width);
  page.drawImage(img, {
    x: (pageW - drawW) / 2,
    y: (pageH - drawH) / 2,
    width: drawW,
    height: drawH,
  });

  await sharp(processed)
    .resize(WEBP_LONG, WEBP_LONG, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 88, effort: 5 })
    .toFile(join(pagesOutDir, `p${String(pageNum).padStart(3, "0")}.webp`));

  writeFileSync(join(tmpDir, `preview-${String(pageNum).padStart(3, "0")}.jpg`), processed);

  manifest.push({ n: pageNum, type: "scan", label: spec.label, w: imgW, h: imgH });
  process.stdout.write(`ok ${imgW}x${imgH}\n`);
}

console.log("[2/2] Čuvanje PDF ...");
const pdfBytes = await pdfDoc.save({ useObjectStreams: false, addDefaultPage: false });

const skenPath = join(outDir, "grabovica-sken.pdf");
writeFileSync(skenPath, pdfBytes);
writeFileSync(join(outDir, "grabovica.pdf"), pdfBytes);

writeFileSync(
  join(outDir, "manifest.json"),
  JSON.stringify(
    {
      title: "Grabovica u Drobnjaku i porodice u njoj",
      mode: "scan",
      total: manifest.length,
      generatedAt: new Date().toISOString(),
      pdfUrl: "/knjiga/grabovica-sken.pdf",
      pdfUrlLegacy: "/knjiga/grabovica.pdf",
      pages: manifest,
    },
    null,
    2
  )
);

console.log(`\n✓ ${skenPath} (${(pdfBytes.length / 1024 / 1024).toFixed(2)} MB)`);
console.log(`✓ WebP: ${pagesOutDir}`);
console.log(`✓ Pregled: ${tmpDir}/preview-*.jpg`);
