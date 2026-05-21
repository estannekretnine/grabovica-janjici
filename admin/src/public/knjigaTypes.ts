export type KnjigaPage = {
  n: number;
  w?: number;
  h?: number;
};

export type KnjigaManifest = {
  title: string;
  total: number;
  coverFront?: string;
  coverBack?: string;
  pages: KnjigaPage[];
};

export function knjigaPageSrc(n: number): string {
  return `/knjiga/pages/p${String(n).padStart(3, "0")}.webp`;
}
