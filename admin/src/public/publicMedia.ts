/** Wikimedia — Durmitor (hero). */
export const PUBLIC_IMG_DURMITOR =
  "https://upload.wikimedia.org/wikipedia/commons/3/3e/Crno_jezero_%28Black_Lake%29%2C_Durmitor%2C_Montenegro_-_July_2012.jpg";

/** Wikimedia Commons — Durmitor pejzaž (umetnički prikaz na početnoj, ista kao hero). */
export const PUBLIC_IMG_DURMITOR_ART =
  "https://upload.wikimedia.org/wikipedia/commons/3/3e/Crno_jezero_%28Black_Lake%29%2C_Durmitor%2C_Montenegro_-_July_2012.jpg";

/** Ilustracija rodoslovnog stabla (referenca vizuala). */
export const PUBLIC_IMG_TREE =
  "https://upload.wikimedia.org/wikipedia/commons/2/2a/Family_tree_chart_%282%29.png";

export type PublicHeritageImage = {
  src: string;
  alt: string;
};

/** Početna — galerija iz `homefoto/` (koren repoa); WebP: `npm run build:homefoto --prefix admin`. */
export const PUBLIC_HERITAGE_IMAGES: PublicHeritageImage[] = Array.from({ length: 8 }, (_, i) => ({
  src: `/heritage/pocetna-${i + 1}.webp`,
  alt: `Grabovica — fotografija ${i + 1}`,
}));
