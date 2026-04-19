/** Wikimedia — Durmitor (hero). */
export const PUBLIC_IMG_DURMITOR =
  "https://upload.wikimedia.org/wikipedia/commons/3/3e/Crno_jezero_%28Black_Lake%29%2C_Durmitor%2C_Montenegro_-_July_2012.jpg";

/** Wikimedia Commons — Durmitor pejzaž (umetnički prikaz na početnoj, ista kao hero). */
export const PUBLIC_IMG_DURMITOR_ART =
  "https://upload.wikimedia.org/wikipedia/commons/3/3e/Crno_jezero_%28Black_Lake%29%2C_Durmitor%2C_Montenegro_-_July_2012.jpg";

/** Ilustracija rodoslovnog stabla (referenca vizuala). */
export const PUBLIC_IMG_TREE =
  "https://upload.wikimedia.org/wikipedia/commons/2/2a/Family_tree_chart_%282%29.png";

/**
 * Početna — četiri fotografije (Wikimedia Commons, Crna Gora).
 * Za slike iz knjige zamenite `src` istim imenima u `admin/public/heritage/*.webp` i vratite putanje `/heritage/...`.
 */
export const PUBLIC_HERITAGE_IMAGES = [
  {
    src: "https://upload.wikimedia.org/wikipedia/commons/7/76/Durmitor_-_Bobotov_kuk.jpg",
    alt: "Kula Jankovića, sagrađena 1861. godine od strane braće Nikole, Mitra, Tripka i Simeuna",
    caption:
      "Kula Jankovića — braća Nikola, Mitar, Tripko i Simeun, 1861. Zapis iz knjige „Bratstvo Janjić”.",
  },
  {
    src: "https://upload.wikimedia.org/wikipedia/commons/5/59/Perast_-_Sveti_%C4%90or%C4%91e_Insel_1.jpg",
    alt: "Kuća Toma Janjića u šljiviku, kuća Mijata Janjića sa stajom i Radovanova kuća na Brašinoj glavici",
    caption: "Kuća Toma Janjića, kuća Mijata Janjića sa stajom i Radovanova na Brašinoj glavici.",
  },
  {
    src: "https://upload.wikimedia.org/wikipedia/commons/a/a5/Manastir_Ostrog.jpg",
    alt: "Kuća braće Šćepana i Save Janjića; kuća Živka S. Janjića, brvnara",
    caption: "Kuća braće Šćepana i Save Janjića; kuća Živka S. Janjića (brvnara).",
  },
  {
    src: "https://upload.wikimedia.org/wikipedia/commons/3/3e/Crno_jezero_%28Black_Lake%29%2C_Durmitor%2C_Montenegro_-_July_2012.jpg",
    alt: "Kolibe Janka Janjića pod Arapovim ždrijelom; kuća Miloša J. Janjića",
    caption: "Kolibe Janka Janjića pod Arapovim ždrijelom; kuća Miloša J. Janjića.",
  },
] as const;
