export type KnjigaManifest = {
  title: string;
  total: number;
  pdfUrl: string;
  pages: { n: number; label?: string }[];
};

export function knjigaPageSrc(n: number): string {
  return `/knjiga/pages/p${String(n).padStart(3, "0")}.webp`;
}
