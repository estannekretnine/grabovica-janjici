import type { PartRow, PcRow, PersonRow } from "./familyTreeGraphLoad";

export type OgranakId = "sukovici" | "trivunovici" | "vidici";

export type OgranakDef = {
  id: OgranakId;
  /** Kratki label za pilulu u toolbaru. */
  label: string;
  /** Pun naziv za naslov stranice i aria-label. */
  fullLabel: string;
  /**
   * Putanja imena od korena (Janja) do "vrha" ogranka (ne uključujući Janju).
   * Šukovići: [Simeun]               → grana Simeun + potomci
   * Trivunovići: [Miloš, Trifun]    → preko Miloša do Trifuna + potomci
   * Vidići: [Miloš, Savo]           → preko Miloša do Save + potomci
   */
  branchPath: string[];
};

export const OGRANCI: OgranakDef[] = [
  {
    id: "sukovici",
    label: "Šukovići",
    fullLabel: "Ogranak Šukovići",
    branchPath: ["Simeun"],
  },
  {
    id: "trivunovici",
    label: "Trivunovići",
    fullLabel: "Ogranak Trivunovići",
    branchPath: ["Miloš", "Trifun"],
  },
  {
    id: "vidici",
    label: "Vidići",
    fullLabel: "Ogranak Vidići",
    branchPath: ["Miloš", "Savo"],
  },
];

export const DEFAULT_OGRANAK: OgranakId = "sukovici";

export function isOgranakId(v: string | null | undefined): v is OgranakId {
  return v === "sukovici" || v === "trivunovici" || v === "vidici";
}

/** „Simeun" upoređen neosetljivo na dijakritiku i velika/mala slova. */
function normalizeName(v: string | null | undefined): string {
  return (v ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

/**
 * Pronalazi osobu sa datim imenom među zadatom listom kandidata.
 * Prvo traži tačno poklapanje po `first_name`, zatim po delu imena
 * (npr. ako je ime "Simeun Janjić" unet kao first_name).
 */
function findByFirstName(
  candidates: PersonRow[],
  name: string,
): PersonRow | null {
  const target = normalizeName(name);
  if (!target) return null;
  const exact = candidates.find((p) => normalizeName(p.first_name) === target);
  if (exact) return exact;
  return (
    candidates.find((p) => normalizeName(p.first_name).startsWith(target)) ?? null
  );
}

/**
 * Identifikuje korena (Janja) — osobu bez roditelja koja ima najviše potomaka.
 * Sigurnije od pretrage po imenu jer je u bazi definisana kao koren stabla.
 */
function findRootPerson(persons: PersonRow[], relations: PcRow[]): PersonRow | null {
  if (!persons.length) return null;
  const childIds = new Set(relations.map((r) => r.child_person_id));
  const rootCandidates = persons.filter((p) => !childIds.has(p.id));
  if (rootCandidates.length === 0) return null;
  if (rootCandidates.length === 1) return rootCandidates[0] ?? null;

  // Kod više potencijalnih korena biraj onu koja ima "Janja" u first_name,
  // ili onu sa najviše potomaka.
  const janja = rootCandidates.find(
    (p) => normalizeName(p.first_name) === "janja",
  );
  if (janja) return janja;

  const childByParent = new Map<string, string[]>();
  for (const r of relations) {
    const arr = childByParent.get(r.parent_person_id) ?? [];
    arr.push(r.child_person_id);
    childByParent.set(r.parent_person_id, arr);
  }
  function descendantCount(id: string, seen: Set<string>): number {
    if (seen.has(id)) return 0;
    seen.add(id);
    const kids = childByParent.get(id) ?? [];
    let n = kids.length;
    for (const k of kids) n += descendantCount(k, seen);
    return n;
  }
  return (
    [...rootCandidates]
      .map((p) => ({ p, n: descendantCount(p.id, new Set<string>()) }))
      .sort((a, b) => b.n - a.n)[0]?.p ?? null
  );
}

/**
 * Vraća skup ID-jeva svih potomaka date osobe (uključujući samu osobu), bez ciklusa.
 */
function collectDescendants(
  rootId: string,
  childByParent: Map<string, string[]>,
): Set<string> {
  const out = new Set<string>();
  const stack: string[] = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    for (const c of childByParent.get(id) ?? []) {
      if (!out.has(c)) stack.push(c);
    }
  }
  return out;
}

/**
 * Izračunaj dozvoljeni skup person.id za zadati ogranak.
 *
 * Logika:
 *  1) Janja (koren) i njena tri sina (Simeun, Miloš, Obren) su UVEK uključeni.
 *  2) Pored toga uključujemo sve potomke "vrha" ogranka:
 *       Šukovići  → svi potomci Simeuna
 *       Trivunovići → svi potomci Trifuna (Miloš → Trifun)
 *       Vidići    → svi potomci Save   (Miloš → Savo)
 *  3) Za sve tako uključene osobe dodajemo i njihove partnere (iz partnerships),
 *     da bi partnerske oznake iznad kartica ostale kompletne.
 *
 * Ako identifikacija ne uspe (npr. ime nije kako očekujemo), vraća `null` —
 * poziv se tada graceful svodi na prikaz celog stabla (bez filtera).
 */
export function computeAllowedPersonIds(
  persons: PersonRow[],
  relations: PcRow[],
  partnerships: PartRow[],
  ogranak: OgranakId,
): Set<string> | null {
  if (!persons.length) return null;

  const def = OGRANCI.find((o) => o.id === ogranak);
  if (!def) return null;

  const root = findRootPerson(persons, relations);
  if (!root) return null;

  const childByParent = new Map<string, string[]>();
  for (const r of relations) {
    const arr = childByParent.get(r.parent_person_id) ?? [];
    arr.push(r.child_person_id);
    childByParent.set(r.parent_person_id, arr);
  }
  const personsById = new Map<string, PersonRow>();
  for (const p of persons) personsById.set(p.id, p);

  function kidsOf(id: string): PersonRow[] {
    return (childByParent.get(id) ?? [])
      .map((cid) => personsById.get(cid))
      .filter((x): x is PersonRow => Boolean(x));
  }

  // 1) Janja + tri sina — uvek.
  const janjaKids = kidsOf(root.id);
  const simeun = findByFirstName(janjaKids, "Simeun");
  const milos = findByFirstName(janjaKids, "Miloš");
  const obren = findByFirstName(janjaKids, "Obren");

  const allowed = new Set<string>();
  allowed.add(root.id);
  if (simeun) allowed.add(simeun.id);
  if (milos) allowed.add(milos.id);
  if (obren) allowed.add(obren.id);

  // 2) Nalaženje "vrha" ogranka po branchPath (ime po ime od Janje nadole).
  let branchHead: PersonRow | null = root;
  for (const stepName of def.branchPath) {
    if (!branchHead) break;
    const next = findByFirstName(kidsOf(branchHead.id), stepName);
    branchHead = next;
  }
  if (!branchHead) {
    // Nismo uspeli da identifikujemo vrh ogranka — vraćamo null da ne sakrijemo celo stablo.
    return null;
  }

  // Uključi sve potomke vrha ogranka (+ njega samog).
  const branchIds = collectDescendants(branchHead.id, childByParent);
  for (const id of branchIds) allowed.add(id);

  // 3) Partneri svih uključenih osoba — da bi partnerske labele iznad kartica ostale kompletne.
  const partnersOf = new Map<string, Set<string>>();
  for (const pr of partnerships) {
    if (!partnersOf.has(pr.person_a_id))
      partnersOf.set(pr.person_a_id, new Set<string>());
    if (!partnersOf.has(pr.person_b_id))
      partnersOf.set(pr.person_b_id, new Set<string>());
    partnersOf.get(pr.person_a_id)!.add(pr.person_b_id);
    partnersOf.get(pr.person_b_id)!.add(pr.person_a_id);
  }
  for (const id of Array.from(allowed)) {
    for (const pid of partnersOf.get(id) ?? []) allowed.add(pid);
  }

  return allowed;
}

/**
 * Pomoćnik za filtriranje persons/relations/partnerships u jednom prolazu.
 * Ako `allowed === null`, vraća ulaz nepromenjen (graceful fallback).
 */
export function filterFamilyGraph(
  persons: PersonRow[],
  relations: PcRow[],
  partnerships: PartRow[],
  allowed: Set<string> | null,
): { persons: PersonRow[]; relations: PcRow[]; partnerships: PartRow[] } {
  if (!allowed) return { persons, relations, partnerships };
  const p = persons.filter((x) => allowed.has(x.id));
  const r = relations.filter(
    (x) => allowed.has(x.parent_person_id) && allowed.has(x.child_person_id),
  );
  const pa = partnerships.filter(
    (x) => allowed.has(x.person_a_id) && allowed.has(x.person_b_id),
  );
  return { persons: p, relations: r, partnerships: pa };
}
