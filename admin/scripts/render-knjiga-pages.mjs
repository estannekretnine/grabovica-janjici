/**
 * Renderuje sve strane PDF knjige u WebP slike za brz prikaz na sajtu.
 *
 * Ulaz:  knjigagrabovica/pdf/202605211119.pdf
 * Izlaz: admin/public/knjiga/pages/p###.webp (sve strane)
 *        admin/public/knjiga/manifest.json (total, dimenzije)
 *
 * Pokretanje (iz korena repo-a): npm run build:knjiga --prefix admin
 */

import { mkdirSync, writeFileSync, existsSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { pdf } from "pdf-to-img";

const __dirname = dirname(fileURLToPath(import.meta.url));
const adminRoot = join(__dirname, "..");
const repoRoot = join(adminRoot, "..");

const PDF_INPUT = join(repoRoot, "knjigagrabovica", "pdf", "202605211119.pdf");
const OUT_DIR = join(adminRoot, "public", "knjiga");
const PAGES_DIR = join(OUT_DIR, "pages");

const RENDER_SCALE = 2.0;
const WEBP_QUALITY = 82;
const WEBP_EFFORT = 5;
const TARGET_LONG_EDGE = 1600;

if (!existsSync(PDF_INPUT)) {
  console.error(`Ulazni PDF ne postoji: ${PDF_INPUT}`);
  process.exit(1);
}

if (existsSync(PAGES_DIR)) {
  rmSync(PAGES_DIR, { recursive: true, force: true });
}
mkdirSync(PAGES_DIR, { recursive: true });

console.log(`Otvaranje PDF-a: ${PDF_INPUT}`);
const doc = await pdf(PDF_INPUT, { scale: RENDER_SCALE });
console.log(`Stranica: ${doc.length}`);

const pages = [];
let pageNum = 0;
for await (const pngBuffer of doc) {
  pageNum += 1;
  const outName = `p${String(pageNum).padStart(3, "0")}.webp`;
  const outPath = join(PAGES_DIR, outName);

  let img = sharp(pngBuffer);
  const meta = await img.metadata();
  const longest = Math.max(meta.width || 0, meta.height || 0);
  if (longest > TARGET_LONG_EDGE) {
    img = img.resize(TARGET_LONG_EDGE, TARGET_LONG_EDGE, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }
  await img.webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT }).toFile(outPath);

  const finalMeta = await sharp(outPath).metadata();
  pages.push({
    n: pageNum,
    w: finalMeta.width || 0,
    h: finalMeta.height || 0,
  });
  process.stdout.write(
    `[${pageNum}/${doc.length}] ${outName} (${finalMeta.width}x${finalMeta.height})\n`,
  );
}

await doc.destroy();

const manifest = {
  title: "Grabovica u Drobnjaku i porodice u njoj",
  total: pages.length,
  coverFront: "/knjiga/korica-prednja.webp",
  coverBack: "/knjiga/korica-zadnja.webp",
  pages,
  generatedAt: new Date().toISOString(),
};

writeFileSync(
  join(OUT_DIR, "manifest.json"),
  JSON.stringify(manifest, null, 2),
);

console.log(`\nGotovo. ${pages.length} strana renderovano u ${PAGES_DIR}`);
console.log(`Manifest: ${join(OUT_DIR, "manifest.json")}`);
