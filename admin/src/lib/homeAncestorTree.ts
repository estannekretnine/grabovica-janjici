import type { PersonRow, PcRow } from "./familyTreeGraphLoad";

export function normalizeToken(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function personPublicLabel(p: Pick<PersonRow, "first_name" | "last_name">): string {
  return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "—";
}

/** Pronađi Mihaila Janjića (ili blisku varijantu prezimena). */
export function findAnchorPersonId(
  persons: PersonRow[],
  anchorFirst: string,
  anchorLast: string
): string | null {
  const f0 = normalizeToken(anchorFirst);
  const l0 = normalizeToken(anchorLast).replace(/\s+/g, "");
  for (const p of persons) {
    if (normalizeToken(p.first_name) !== f0) continue;
    const ln = normalizeToken(p.last_name).replace(/\s+/g, "");
    if (ln === l0 || ln.startsWith("janjic") || ln.startsWith("janji")) return p.id;
  }
  return null;
}

/** Nivoi predaka: [0] = koren (dno), [1] = roditelji, … */
export function buildAncestorLevels(
  rootId: string,
  relations: Pick<PcRow, "parent_person_id" | "child_person_id">[],
  personsById: Map<string, PersonRow>
): string[][] {
  const known = new Set(personsById.keys());
  const parentsOf = (childId: string) =>
    relations
      .filter((r) => r.child_person_id === childId && known.has(r.parent_person_id))
      .map((r) => r.parent_person_id);

  const levels: string[][] = [[rootId]];
  const seen = new Set<string>([rootId]);

  while (levels.length < 18) {
    const frontier = levels[levels.length - 1];
    const next = new Set<string>();
    for (const id of frontier) {
      for (const pid of parentsOf(id)) {
        if (!seen.has(pid)) {
          seen.add(pid);
          next.add(pid);
        }
      }
    }
    if (next.size === 0) break;
    levels.push(
      [...next].sort((a, b) =>
        personPublicLabel(personsById.get(a)!).localeCompare(
          personPublicLabel(personsById.get(b)!),
          "sr",
          { sensitivity: "base" }
        )
      )
    );
  }
  return levels;
}

export function lifeLineShort(p: Pick<PersonRow, "birth_date" | "death_date" | "is_living">): string {
  const b = p.birth_date?.trim() || "—";
  const d = p.death_date?.trim();
  if (d) return `${b} – ${d}`;
  if (p.is_living === false) return `${b} –`;
  return b;
}
