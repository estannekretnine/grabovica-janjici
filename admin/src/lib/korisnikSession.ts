const KEY = "family_tree_korisnik_v1";

export type KorisnikProfile = {
  id: string;
  naziv: string;
  email: string | null;
  stsstatus: string | null;
};

export function readKorisnikFromStorage(): KorisnikProfile | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as KorisnikProfile;
  } catch {
    return null;
  }
}

export function writeKorisnikToStorage(k: KorisnikProfile): void {
  sessionStorage.setItem(KEY, JSON.stringify(k));
}

export function clearKorisnikFromStorage(): void {
  sessionStorage.removeItem(KEY);
}
