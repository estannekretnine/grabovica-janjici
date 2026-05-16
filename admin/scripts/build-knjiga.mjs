/**
 * Build "knjiga grabovica" — hibridni PDF + WebP za flipbook.
 *
 * Ulaz: knjigagrabovica/korica/ + knjigagrabovica/do 11 strane/
 * Izlaz: admin/public/knjiga/grabovica.pdf, pages/p###.webp, manifest.json
 *
 * Pokretanje: npm run build:knjiga --prefix admin
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { createWorker } from "tesseract.js";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const __dirname = dirname(fileURLToPath(import.meta.url));
const adminRoot = join(__dirname, "..");
const repoRoot = join(adminRoot, "..");
const inputRoot = join(repoRoot, "knjigagrabovica");
const tessdataDir = join(adminRoot, ".tmp", "tessdata");
const fontsDir = join(adminRoot, ".tmp", "fonts");
const outDir = join(adminRoot, "public", "knjiga");
const pagesOutDir = join(outDir, "pages");

/** Eksplicitan redosled stranica (test set do str. 11). */
const ORDER = [
  { file: "korica/korica.jpg", type: "image", label: "Korica" },
  { file: "korica/korica posle.jpg", type: "image", label: "Korica posle" },
  { file: "korica/korica poslee.jpg", type: "image", label: "Korica poslee" },
  { file: "do 11 strane/pocetak desno 5.jpg", type: "hybrid", label: "Str. 5 (UVOD)" },
  { file: "do 11 strane/6-7.jpg", type: "hybrid", label: "Str. 6–7" },
  { file: "do 11 strane/8-9.jpg", type: "hybrid", label: "Str. 8–9" },
  { file: "do 11 strane/10-11.jpg", type: "hybrid", label: "Str. 10–11" },
];

const PDF_LONG_PT = 720;
const PDF_JPEG_LONG = 1800;
const WEBP_LONG = 1400;

mkdirSync(pagesOutDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

function resolveInput(rel) {
  const p = join(inputRoot, rel);
  if (!existsSync(p)) throw new Error(`Nedostaje ulaz: ${p}`);
  return p;
}

function pageSizePt(imgW, imgH) {
  const aspect = imgW / imgH;
  if (aspect >= 1) {
    return [PDF_LONG_PT, PDF_LONG_PT / aspect];
  }
  return [PDF_LONG_PT * aspect, PDF_LONG_PT];
}

/** Izvuci linije teksta (manje PDF operacija = kompatibilniji fajl). */
function extractLines(blocks) {
  const lines = [];
  if (!blocks) return lines;
  for (const block of blocks) {
    for (const para of block.paragraphs || []) {
      for (const line of para.lines || []) {
        const text = (line.text || "").replace(/\s+/g, " ").trim();
        if (!text || !line.bbox) continue;
        if ((line.confidence ?? 0) < 15) continue;
        lines.push({ text, bbox: line.bbox });
      }
    }
  }
  return lines;
}

/** Nevidljiv OCR sloj — beli tekst, skoro providan (čitači ne pucaju kao sa opacity:0 × hiljade reči). */
function drawOcrOverlay(page, ocrLines, ocrW, ocrH, pageW, pageH, font) {
  const scaleX = pageW / ocrW;
  const scaleY = pageH / ocrH;
  let placed = 0;

  for (const line of ocrLines) {
    const b = line.bbox;
    if (b.x1 <= b.x0 || b.y1 <= b.y0) continue;

    const boxW = (b.x1 - b.x0) * scaleX;
    const boxH = (b.y1 - b.y0) * scaleY;
    const x = b.x0 * scaleX;
    const y = pageH - b.y1 * scaleY;
    let size = Math.max(5, Math.min(boxH * 0.9, 16));

    try {
      let tw = font.widthOfTextAtSize(line.text, size);
      if (tw > boxW * 1.1 && tw > 0) {
        size = Math.max(5, (boxW / tw) * size * 0.95);
      }
      page.drawText(line.text, {
        x,
        y: y + (boxH - size) * 0.12,
        size,
        font,
        color: rgb(1, 1, 1),
        opacity: 0.01,
      });
      placed++;
    } catch {
      // preskoči liniju koju font ne može da enkoduje
    }
  }
  return placed;
}

console.log(`[1/3] Učitavam ${ORDER.length} stranica iz ${inputRoot} ...`);

let worker = null;
const needsOcr = ORDER.some((o) => o.type === "hybrid");
if (needsOcr) {
  console.log("[2/3] OCR worker (srp + srp_latn) ...");
  worker = await createWorker(["srp", "srp_latn"], 1, {
    langPath: tessdataDir,
    cachePath: tessdataDir,
    cacheMethod: "none",
    gzip: false,
  });
} else {
  console.log("[2/3] Bez OCR (sve image).");
}

console.log("[3/3] PDF + WebP ...");
const pdfDoc = await PDFDocument.create();
pdfDoc.registerFontkit(fontkit);
const fontPath = [join(fontsDir, "NotoSerif-Regular.ttf"), join(fontsDir, "NotoSerif.ttf")].find(
  (p) => existsSync(p)
);
if (!fontPath) {
  throw new Error(`Nedostaje font u ${fontsDir} (NotoSerif-Regular.ttf)`);
}
const font = await pdfDoc.embedFont(readFileSync(fontPath), { subset: true });

const manifest = [];

for (let i = 0; i < ORDER.length; i++) {
  const spec = ORDER[i];
  const pageNum = i + 1;
  const inPath = resolveInput(spec.file);
  const tag = `[${pageNum}/${ORDER.length}] ${basename(spec.file)}`;
  process.stdout.write(`${tag} (${spec.type}) ... `);

  const origBuf = readFileSync(inPath);
  const rotated = sharp(origBuf).rotate();
  const meta = await rotated.metadata();
  const imgW = meta.width || 1;
  const imgH = meta.height || 1;

  const jpgBuf = await rotated
    .clone()
    .resize(PDF_JPEG_LONG, PDF_JPEG_LONG, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();

  const [pageW, pageH] = pageSizePt(imgW, imgH);
  const pdfPage = pdfDoc.addPage([pageW, pageH]);
  const pdfImg = await pdfDoc.embedJpg(jpgBuf);
  const drawW = pdfImg.width * Math.min(pageW / pdfImg.width, pageH / pdfImg.height);
  const drawH = pdfImg.height * (drawW / pdfImg.width);
  pdfPage.drawImage(pdfImg, {
    x: (pageW - drawW) / 2,
    y: (pageH - drawH) / 2,
    width: drawW,
    height: drawH,
  });

  let wordCount = 0;
  let confidence = 0;
  let ocrPlaced = 0;

  if (spec.type === "hybrid" && worker) {
    const ocrBuf = await rotated
      .clone()
      .resize(2400, null, { fit: "inside", withoutEnlargement: true })
      .grayscale()
      .normalize()
      .linear(1.2, -20)
      .sharpen({ sigma: 1.0, m1: 0.5, m2: 2.0 })
      .toFormat("png")
      .toBuffer();
    const ocrMeta = await sharp(ocrBuf).metadata();
    const ocrW = ocrMeta.width || imgW;
    const ocrH = ocrMeta.height || imgH;

    const { data } = await worker.recognize(ocrBuf, {}, { text: true, blocks: true });
    const ocrLines = extractLines(data.blocks);
    wordCount = ocrLines.length;
    confidence = data.confidence || 0;
    ocrPlaced = drawOcrOverlay(pdfPage, ocrLines, ocrW, ocrH, pageW, pageH, font);
    process.stdout.write(`ocr=${ocrPlaced}L conf=${confidence.toFixed(0)}\n`);
  } else {
    process.stdout.write(`image\n`);
  }

  await rotated
    .clone()
    .resize(WEBP_LONG, WEBP_LONG, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(join(pagesOutDir, `p${String(pageNum).padStart(3, "0")}.webp`));

  manifest.push({
    n: pageNum,
    type: spec.type,
    label: spec.label,
    w: imgW,
    h: imgH,
    words: wordCount,
    ocrWords: ocrPlaced,
    conf: Math.round(confidence),
  });
}

if (worker) await worker.terminate();

const pdfBytes = await pdfDoc.save({
  useObjectStreams: false,
  addDefaultPage: false,
});
writeFileSync(join(outDir, "grabovica.pdf"), pdfBytes);
writeFileSync(
  join(outDir, "manifest.json"),
  JSON.stringify(
    {
      title: "Grabovica u Drobnjaku i porodice u njoj",
      total: manifest.length,
      generatedAt: new Date().toISOString(),
      pdfUrl: "/knjiga/grabovica.pdf",
      pages: manifest,
    },
    null,
    2
  )
);

console.log(`\n✓ PDF: ${join(outDir, "grabovica.pdf")} (${(pdfBytes.length / 1024 / 1024).toFixed(1)} MB)`);
console.log(`✓ WebP: ${pagesOutDir} (${manifest.length} fajlova)`);
console.log(`✓ Manifest: ${join(outDir, "manifest.json")}`);
