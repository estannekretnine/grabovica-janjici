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
  /** Tekst ispod slike (druga / donja fotografija na skenu). */
  caption: string;
  /** Tekst iznad slike (prva fotografija na skenu), isti stil kao `caption`. */
  captionAbove?: string;
};

/** Početna — fotografije iz `homefoto/` u korenu repoa; generiši WebP: `npm run build:homefoto --prefix admin`. */
export const PUBLIC_HERITAGE_IMAGES: PublicHeritageImage[] = [
  {
    src: "/heritage/pocetna-1.webp",
    alt: "Kula Jankovića, 1861. Kuća Toma Janjića, kuća Mijata Janjića sa stajom i Radovanova na Brašinoj glavici.",
    captionAbove: "Kula Jankovića, 1861",
    caption: "Kuća Toma Janjića, kuća Mijata Janjića sa stajom i Radovanova na Brašinoj glavici.",
  },
  {
    src: "/heritage/pocetna-2.webp",
    alt: "Kuća braće Šćepana i Save Janjića; kuća Živka S. Janjića (brvnara).",
    captionAbove:
      "Kuća braće Šćepana i Save Janjića. Jedna od najstarijih u selu. Sada napuštena.",
    caption: "Kuća Živka S. Janjića (brvnara).",
  },
  {
    src: "/heritage/pocetna-3.webp",
    alt: "Kuća Marijana Lasića i Vasa Janjića. Kuća Mijajla Janjića, 1931.",
    captionAbove: "Kuća Marijana Lasića i Vasa Janjića.",
    caption: "Kuća Mijajla Janjića. 1931. g.",
  },
  {
    src: "/heritage/pocetna-4.webp",
    alt: "Kolibe Janka Janjića. Kuća Miloša J. Janjića.",
    captionAbove: "Kolibe Janka Janjića",
    caption: "Kuća Miloša J. Janjića",
  },
];
