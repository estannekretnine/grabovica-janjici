/**
 * Build "knjiga grabovica" — opcija A: tekstualni PDF (vektor tekst, bez JPG na stranicama sa sadržajem).
 *
 * Ulaz: knjigagrabovica/korica/ + knjigagrabovica/do 11 strane/
 * Izlaz: admin/public/knjiga/grabovica.pdf (+ manifest, WebP za budući flipbook)
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
const tmpDir = join(adminRoot, ".tmp", "knjiga");
const tessdataDir = join(adminRoot, ".tmp", "tessdata");
const fontsDir = join(adminRoot, ".tmp", "fonts");
const outDir = join(adminRoot, "public", "knjiga");
const pagesOutDir = join(outDir, "pages");

/** Eksplicitan redosled (test set do str. 11). */
const ORDER = [
  { file: "korica/korica.jpg", type: "image", label: "Korica" },
  { file: "korica/korica posle.jpg", type: "image", label: "Korica posle" },
  { file: "korica/korica poslee.jpg", type: "image", label: "Korica poslee" },
  { file: "do 11 strane/pocetak desno 5.jpg", type: "text", label: "Str. 5 (UVOD)" },
  { file: "do 11 strane/6-7.jpg", type: "text", label: "Str. 6–7" },
  { file: "do 11 strane/8-9.jpg", type: "text", label: "Str. 8–9" },
  { file: "do 11 strane/10-11.jpg", type: "text", label: "Str. 10–11" },
];

const A4_PORTRAIT = [595.28, 841.89];
const A4_LANDSCAPE = [841.89, 595.28];
const PDF_JPEG_LONG = 1800;
const WEBP_LONG = 1400;
const PDF_LONG_PT = 720;

mkdirSync(pagesOutDir, { recursive: true });
mkdirSync(outDir, { recursive: true });
mkdirSync(tmpDir, { recursive: true });

function resolveInput(rel) {
  const p = join(inputRoot, rel);
  if (!existsSync(p)) throw new Error(`Nedostaje ulaz: ${p}`);
  return p;
}

function sanitize(text) {
  return (text || "")
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "")
    .replace(/\u00AD/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wrapText(text, fnt, size, maxWidth) {
  const out = [];
  for (const para of text.split(/\n/)) {
    if (!para.trim()) {
      out.push("");
      continue;
    }
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";
    for (const w of words) {
      const tryLine = line ? `${line} ${w}` : w;
      let width;
      try {
        width = fnt.widthOfTextAtSize(tryLine, size);
      } catch {
        line = tryLine;
        continue;
      }
      if (width <= maxWidth) line = tryLine;
      else {
        if (line) out.push(line);
        line = w;
      }
    }
    if (line) out.push(line);
    out.push("");
  }
  return out;
}

function pageSizePt(imgW, imgH) {
  const aspect = imgW / imgH;
  if (aspect >= 1) return [PDF_LONG_PT, PDF_LONG_PT / aspect];
  return [PDF_LONG_PT * aspect, PDF_LONG_PT];
}

/** OCR jedne polovine ili cele slike. */
async function ocrBuffer(worker, buf) {
  const { data } = await worker.recognize(buf, {}, { text: true, blocks: true });
  return {
    text: sanitize(data.text || ""),
    confidence: data.confidence || 0,
  };
}

async function preprocessForOcr(rotated) {
  return rotated
    .clone()
    .resize(2400, null, { fit: "inside", withoutEnlargement: true })
    .grayscale()
    .normalize()
    .linear(1.2, -20)
    .sharpen({ sigma: 1.0, m1: 0.5, m2: 2.0 })
    .png()
    .toBuffer();
}

/** Spread: OCR leve i desne polovine, dve kolone na landscape A4. */
async function ocrSpreadTwoColumns(worker, rotated) {
  const meta = await rotated.metadata();
  const w = meta.width || 1;
  const h = meta.height || 1;
  const mid = Math.floor(w / 2);

  const leftBuf = await preprocessForOcr(
    rotated.clone().extract({ left: 0, top: 0, width: mid, height: h })
  );
  const rightBuf = await preprocessForOcr(
    rotated.clone().extract({ left: mid, top: 0, width: w - mid, height: h })
  );

  const left = await ocrBuffer(worker, leftBuf);
  const right = await ocrBuffer(worker, rightBuf);
  return {
    text: `${left.text}\n\n${right.text}`.trim(),
    leftText: left.text,
    rightText: right.text,
    confidence: (left.confidence + right.confidence) / 2,
    twoColumn: true,
  };
}

/** Bela tekstualna stranica — bez JPG. */
function drawTextPage(pdfDoc, font, text, { landscape = false, twoColumn = false, leftText = "", rightText = "" } = {}) {
  const [pageW, pageH] = landscape ? A4_LANDSCAPE : A4_PORTRAIT;
  const page = pdfDoc.addPage([pageW, pageH]);
  const margin = 44;
  const fontSize = 10.5;
  const lineHeight = 13.5;
  const colGap = 28;

  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageW,
    height: pageH,
    color: rgb(1, 1, 1),
  });

  if (twoColumn && (leftText || rightText)) {
    const colW = (pageW - 2 * margin - colGap) / 2;
    let yLeft = pageH - margin;
    let yRight = pageH - margin;

    for (const line of wrapText(leftText, font, fontSize, colW)) {
      if (yLeft < margin) break;
      if (line) {
        try {
          page.drawText(line, {
            x: margin,
            y: yLeft,
            size: fontSize,
            font,
            color: rgb(0.08, 0.08, 0.08),
          });
        } catch { /* skip */ }
      }
      yLeft -= lineHeight;
    }

    const xRight = margin + colW + colGap;
    for (const line of wrapText(rightText, font, fontSize, colW)) {
      if (yRight < margin) break;
      if (line) {
        try {
          page.drawText(line, {
            x: xRight,
            y: yRight,
            size: fontSize,
            font,
            color: rgb(0.08, 0.08, 0.08),
          });
        } catch { /* skip */ }
      }
      yRight -= lineHeight;
    }
    return page;
  }

  let y = pageH - margin;
  const maxW = pageW - 2 * margin;
  for (const line of wrapText(text, font, fontSize, maxW)) {
    if (y < margin) break;
    if (line) {
      try {
        page.drawText(line, {
          x: margin,
          y,
          size: fontSize,
          font,
          color: rgb(0.08, 0.08, 0.08),
        });
      } catch { /* skip */ }
    }
    y -= lineHeight;
  }
  return page;
}

/** JPG stranica (samo korice / stablo). */
async function drawImagePage(pdfDoc, rotated) {
  const meta = await rotated.metadata();
  const imgW = meta.width || 1;
  const imgH = meta.height || 1;
  const jpgBuf = await rotated
    .clone()
    .resize(PDF_JPEG_LONG, PDF_JPEG_LONG, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  const [pageW, pageH] = pageSizePt(imgW, imgH);
  const page = pdfDoc.addPage([pageW, pageH]);
  const img = await pdfDoc.embedJpg(jpgBuf);
  const drawW = img.width * Math.min(pageW / img.width, pageH / img.height);
  const drawH = img.height * (drawW / img.width);
  page.drawImage(img, {
    x: (pageW - drawW) / 2,
    y: (pageH - drawH) / 2,
    width: drawW,
    height: drawH,
  });
  return page;
}

/** WebP za flipbook: tekstualne strane = krem bez fotografije. */
async function writeWebpPreview(rotated, outPath, type) {
  if (type === "text") {
    const meta = await rotated.metadata();
    const w = Math.min(WEBP_LONG, meta.width || WEBP_LONG);
    const h = Math.round(w * 0.72);
    await sharp({
      create: {
        width: w,
        height: h,
        channels: 3,
        background: { r: 248, g: 246, b: 240 },
      },
    })
      .webp({ quality: 85 })
      .toFile(outPath);
    return;
  }
  await rotated
    .clone()
    .resize(WEBP_LONG, WEBP_LONG, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(outPath);
}

console.log(`[1/3] Učitavam ${ORDER.length} stranica (opcija A — tekstualni PDF) ...`);

const needsOcr = ORDER.some((o) => o.type === "text");
let worker = null;
if (needsOcr) {
  console.log("[2/3] OCR (srp + srp_latn) ...");
  worker = await createWorker(["srp", "srp_latn"], 1, {
    langPath: tessdataDir,
    cachePath: tessdataDir,
    cacheMethod: "none",
    gzip: false,
  });
}

console.log("[3/3] PDF + WebP ...");
const pdfDoc = await PDFDocument.create();
pdfDoc.registerFontkit(fontkit);
const fontPath = [join(fontsDir, "NotoSerif-Regular.ttf"), join(fontsDir, "NotoSerif.ttf")].find(
  (p) => existsSync(p)
);
if (!fontPath) throw new Error(`Nedostaje font: ${fontsDir}/NotoSerif-Regular.ttf`);
const font = await pdfDoc.embedFont(readFileSync(fontPath), { subset: true });

const manifest = [];

for (let i = 0; i < ORDER.length; i++) {
  const spec = ORDER[i];
  const pageNum = i + 1;
  const inPath = resolveInput(spec.file);
  process.stdout.write(`[${pageNum}/${ORDER.length}] ${basename(spec.file)} (${spec.type}) ... `);

  const rotated = sharp(readFileSync(inPath)).rotate();
  const meta = await rotated.metadata();
  const isWide = (meta.width || 0) > (meta.height || 0);

  let wordCount = 0;
  let confidence = 0;

  if (spec.type === "text" && worker) {
    const ocr = isWide
      ? await ocrSpreadTwoColumns(worker, rotated)
      : await (async () => {
          const buf = await preprocessForOcr(rotated);
          const r = await ocrBuffer(worker, buf);
          return { ...r, twoColumn: false, leftText: "", rightText: "" };
        })();

    wordCount = ocr.text.split(/\s+/).filter(Boolean).length;
    confidence = ocr.confidence;

    drawTextPage(pdfDoc, font, ocr.text, {
      landscape: isWide,
      twoColumn: ocr.twoColumn,
      leftText: ocr.leftText || "",
      rightText: ocr.rightText || "",
    });

    writeFileSync(
      join(tmpDir, `ocr-${String(pageNum).padStart(3, "0")}.txt`),
      `# ${spec.label}\n# conf=${confidence.toFixed(0)} words=${wordCount}\n\n${ocr.text}\n`
    );
    process.stdout.write(`text w=${wordCount} conf=${confidence.toFixed(0)}${isWide ? " 2col" : ""}\n`);
  } else {
    await drawImagePage(pdfDoc, rotated);
    process.stdout.write(`image\n`);
  }

  await writeWebpPreview(rotated, join(pagesOutDir, `p${String(pageNum).padStart(3, "0")}.webp`), spec.type);

  manifest.push({
    n: pageNum,
    type: spec.type,
    label: spec.label,
    w: meta.width,
    h: meta.height,
    words: wordCount,
    conf: Math.round(confidence),
  });
}

if (worker) await worker.terminate();

const pdfBytes = await pdfDoc.save({ useObjectStreams: false, addDefaultPage: false });
writeFileSync(join(outDir, "grabovica.pdf"), pdfBytes);
writeFileSync(
  join(outDir, "manifest.json"),
  JSON.stringify(
    {
      title: "Grabovica u Drobnjaku i porodice u njoj",
      mode: "text-only",
      total: manifest.length,
      generatedAt: new Date().toISOString(),
      pdfUrl: "/knjiga/grabovica.pdf",
      pages: manifest,
    },
    null,
    2
  )
);

console.log(`\n✓ PDF (tekst): ${join(outDir, "grabovica.pdf")} (${(pdfBytes.length / 1024).toFixed(0)} KB)`);
console.log(`✓ OCR tekstovi: ${tmpDir}/ocr-*.txt`);
console.log(`✓ Manifest: ${join(outDir, "manifest.json")}`);
