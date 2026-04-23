import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  loadFamilyGraph,
  type PcRow,
  type PartRow,
  type PersonRow,
} from "../lib/familyTreeGraphLoad";
import { PUBLIC_FAMILY_TREE_ID } from "../lib/publicFamilyTree";
import {
  DEFAULT_OGRANAK,
  OGRANCI,
  computeAllowedPersonIds,
  filterFamilyGraph,
  isOgranakId,
  type OgranakId,
} from "../lib/stabloOgranci";
import { audit, supabase } from "../lib/supabase";
import type { Database } from "../types/database";

type ActivityRow = Database["audit"]["Tables"]["gr_aktivnosti"]["Row"];
type OpstinaRow = Database["public"]["Tables"]["opstina"]["Row"];

type MemberPanelMode = "details" | "kontakt-menu" | "activities";

/** Horizontalno stablo — kartice (~50% manje od originala 228×144). */
const TREE_CARD_SCALE = 0.5;
const BASE_CARD_W = 228;
const BASE_CARD_H = 144;
const CARD_W = Math.round(BASE_CARD_W * TREE_CARD_SCALE);
/** Beli pravougaonik je 0.7 × 0.8 = 0.56 od poloviranog originala; unutra samo imena.
 *  Dodatno snižen za 10% (× 0.9) da bude kompaktniji. */
const CARD_HEIGHT_SHRINK = 0.56 * 0.9;
const CARD_H = Math.round(BASE_CARD_H * TREE_CARD_SCALE * CARD_HEIGHT_SHRINK);
const CARD_HALF_W = CARD_W / 2;
const CARD_HALF_H = CARD_H / 2;
const COL_GAP = Math.round(48 * TREE_CARD_SCALE);
const ROW_GAP = Math.round(16 * TREE_CARD_SCALE);
const GEN_LABEL_HEIGHT = Math.round(28 * TREE_CARD_SCALE);

const ty = (px: number) => Math.round(px * TREE_CARD_SCALE);
/** Vertikalni razmak između vrsta čvorova (bela kartica + trak za Kontakt + razmak). */
const CARD_KONTAKT_STRIP_H = Math.max(11, ty(18));
const NODE_PITCH_H = CARD_H + CARD_KONTAKT_STRIP_H + ROW_GAP;
const TREE_EDGE_SW = 0.55;
const TREE_CARD_SW = 0.5;
const TREE_RING_SW = 2;
/** Fontovi — kartica sadrži samo imena. Blago smanjeni da prate nižu karticu. */
const FS_CARD_TITLE = 9.5;
const FS_CARD_PARTNER = 8.5;
const FS_CARD_KONTAKT = 7.8;
const FS_GEN_LABEL = 10;
const CARD_NAME_MAX = 14;
const CARD_NAME2_MAX = 13;

/** Padding oko sadržaja (u SVG jedinicama) — obezbeđuje da lociranje uvek može da centrira čvor,
 *  i kada graf inače celeg staje u viewport. */
const SCROLL_PAD_X = 600;
const SCROLL_PAD_Y = 160;

/** Visina SVG dokumenta = sadržaj + labele kolena + vertikalni scroll-padding. */
function treeSvgDocumentHeight(layoutHeight: number): number {
  return Math.max(layoutHeight + GEN_LABEL_HEIGHT + SCROLL_PAD_Y * 2, 160);
}

/** Širina SVG dokumenta = sadržaj + horizontalni scroll-padding sa obe strane. */
function treeSvgDocumentWidth(layoutWidth: number): number {
  return Math.max(layoutWidth + SCROLL_PAD_X * 2, 320);
}

/** Fizička skala koja u UI odgovara „100%“ (raniji prikaz na ~60% bio je prevelik na starom 100%). */
const ZOOM_BASELINE = 0.85;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;

function zoomDisplayPercent(physicalZoom: number) {
  return Math.round((physicalZoom / ZOOM_BASELINE) * 100);
}

type PartnerLabel = { id: string; person: PersonRow; label: string };

type PositionedNode = {
  id: string;
  person: PersonRow;
  x: number;
  y: number;
  depth: number;
  partners: PartnerLabel[];
};

function personLabel(p: Pick<PersonRow, "first_name" | "middle_name" | "last_name">) {
  const first = (p.first_name ?? "").trim();
  const middle = (p.middle_name ?? "").trim();
  const last = (p.last_name ?? "").trim();
  const headPart = middle ? `${first} (${middle})`.trim() : first;
  const full = [headPart, last].filter(Boolean).join(" ").trim();
  return full || "(bez imena)";
}

function normalizeSurname(v: string | null | undefined) {
  return (v ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function isJanjicSurname(v: string | null | undefined) {
  return normalizeSurname(v) === "janjic";
}

function primaryPairForNode(node: {
  id: string;
  person: PersonRow;
  partners: PartnerLabel[];
}): { first: PartnerLabel; second: PartnerLabel | null } {
  const firstPartner = node.partners[0] ?? null;
  const pair: PartnerLabel[] = firstPartner
    ? [
        { id: node.id, person: node.person, label: personLabel(node.person) },
        firstPartner,
      ]
    : [{ id: node.id, person: node.person, label: personLabel(node.person) }];

  const male = pair.find((m) => m.person.gender === "male") ?? null;
  const female = pair.find((m) => m.person.gender === "female") ?? null;

  let first = pair[0];
  let second: PartnerLabel | null = pair[1] ?? null;
  if (male && second) {
    if (isJanjicSurname(male.person.last_name)) {
      first = male;
      second = pair.find((x) => x.id !== male.id) ?? second;
    } else if (female) {
      first = female;
      second = pair.find((x) => x.id !== female.id) ?? second;
    }
  }
  return { first, second };
}

function getDefaultPhotoPath(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return trimmed;
  try {
    const parsed = JSON.parse(trimmed) as
      | { defaultIndex?: number; items?: Array<{ path?: string }> }
      | Array<string>;
    if (Array.isArray(parsed)) return parsed[0] ? String(parsed[0]) : null;
    const items = parsed.items ?? [];
    if (!items.length) return null;
    const idx = parsed.defaultIndex ?? 0;
    const safe = idx >= 0 && idx < items.length ? idx : 0;
    return items[safe]?.path ? String(items[safe].path) : null;
  } catch {
    return null;
  }
}

function toPublicPhotoUrl(path: string | null): string | null {
  if (!path || !supabase) return null;
  const normalized = path.replace(/^bucket\//, "");
  return supabase.storage.from("bucket").getPublicUrl(normalized).data.publicUrl;
}

function activityWebHref(url: string | null | undefined): string | null {
  const t = url?.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function activityThumbUrl(path: string | null | undefined): string | null {
  if (!supabase || !path?.trim()) return null;
  const normalized = path.trim().replace(/^bucket\//, "");
  return supabase.storage.from("bucket").getPublicUrl(normalized).data.publicUrl;
}

function pedigreeAccent(depth: number) {
  const c = ["#1e40af", "#0d9488", "#7c3aed", "#db2777"];
  return c[depth % c.length] ?? "#1e40af";
}

/** Opština za listu lociranja: prvo rođenje, zatim prebivalište. */
function personLocateOpstinaLabel(p: PersonRow, opstinaById: Map<number, string>) {
  if (p.opstinaidrodio != null) {
    const t = opstinaById.get(p.opstinaidrodio)?.trim();
    if (t) return t;
  }
  if (p.opstinaid != null) {
    const t = opstinaById.get(p.opstinaid)?.trim();
    if (t) return t;
  }
  return "—";
}

function buildPartnersByPerson(partnerships: PartRow[]) {
  const m = new Map<string, Set<string>>();
  for (const rel of partnerships) {
    if (!m.has(rel.person_a_id)) m.set(rel.person_a_id, new Set<string>());
    if (!m.has(rel.person_b_id)) m.set(rel.person_b_id, new Set<string>());
    m.get(rel.person_a_id)!.add(rel.person_b_id);
    m.get(rel.person_b_id)!.add(rel.person_a_id);
  }
  return m;
}

function buildChildByParent(relations: PcRow[]) {
  const m = new Map<string, string[]>();
  for (const rel of relations) {
    const cur = m.get(rel.parent_person_id) ?? [];
    cur.push(rel.child_person_id);
    m.set(rel.parent_person_id, cur);
  }
  return m;
}

function buildHiddenPartnerIds(
  partnersByPerson: Map<string, Set<string>>,
  personsById: Map<string, PersonRow>,
  childIds: Set<string>,
  childByParent: Map<string, string[]>
): Set<string> {
  const hidden = new Set<string>();
  const processedPairs = new Set<string>();
  for (const [id, partners] of partnersByPerson.entries()) {
    if (!partners.size) continue;
    for (const pid of partners) {
      const pairKey = [id, pid].sort().join("|");
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);

      const a = personsById.get(id);
      const b = personsById.get(pid);
      if (!a || !b) continue;

      const score = (p: PersonRow) => {
        const hasParent = childIds.has(p.id) ? 1 : 0;
        const male = p.gender === "male" ? 1 : 0;
        const maleJanjic = male && isJanjicSurname(p.last_name) ? 1 : 0;
        const childrenCount = (childByParent.get(p.id) ?? []).length;
        return [hasParent, maleJanjic, male, childrenCount] as const;
      };

      const sa = score(a);
      const sb = score(b);
      const aWins =
        sa[0] !== sb[0]
          ? sa[0] > sb[0]
          : sa[1] !== sb[1]
            ? sa[1] > sb[1]
            : sa[2] !== sb[2]
              ? sa[2] > sb[2]
              : sa[3] !== sb[3]
                ? sa[3] >= sb[3]
                : a.id <= b.id;

      const hide = aWins ? b.id : a.id;
      hidden.add(hide);
    }
  }
  return hidden;
}

function computeHorizontalLayout(persons: PersonRow[], relations: PcRow[], partnerships: PartRow[]) {
  const byId = new Map<string, PersonRow>();
  for (const p of persons) byId.set(p.id, p);

  const childByParent = buildChildByParent(relations);
  const partnersByPerson = buildPartnersByPerson(partnerships);
  const childIds = new Set(relations.map((r) => r.child_person_id));
  const hiddenPartnerIds = buildHiddenPartnerIds(
    partnersByPerson,
    byId,
    childIds,
    childByParent
  );

  function childrenFor(id: string): string[] {
    const partnerIds = Array.from(partnersByPerson.get(id) ?? []);
    const childrenSet = new Set<string>();
    for (const pid of [id, ...partnerIds]) {
      for (const c of childByParent.get(pid) ?? []) {
        if (hiddenPartnerIds.has(c)) continue;
        childrenSet.add(c);
      }
    }
    return Array.from(childrenSet);
  }

  const roots = (() => {
    if (!persons.length) return [] as PersonRow[];
    const rootNodes = persons.filter((p) => !childIds.has(p.id) && !hiddenPartnerIds.has(p.id));
    if (rootNodes.length) return rootNodes;
    return persons.filter((p) => !hiddenPartnerIds.has(p.id));
  })();

  const positions = new Map<string, PositionedNode>();
  let nextRow = 0;

  function assign(personId: string, depth: number, stack: Set<string>): number {
    if (hiddenPartnerIds.has(personId)) return nextRow++;
    const person = byId.get(personId);
    if (!person || stack.has(personId)) return nextRow++;
    const existing = positions.get(personId);
    if (existing) return existing.y;

    const nextStack = new Set(stack);
    nextStack.add(personId);
    const children = childrenFor(personId).filter((cid) => !nextStack.has(cid));

    let y: number;
    if (children.length === 0) {
      y = nextRow * NODE_PITCH_H;
      nextRow += 1;
    } else {
      const childYs: number[] = [];
      for (const childId of children) {
        childYs.push(assign(childId, depth + 1, nextStack));
      }
      y = childYs.reduce((a, b) => a + b, 0) / childYs.length;
    }

    const partners = Array.from(partnersByPerson.get(personId) ?? [])
      .map((pid) => byId.get(pid))
      .filter((x): x is PersonRow => Boolean(x))
      .map((x) => ({ id: x.id, person: x, label: personLabel(x) }));

    positions.set(personId, {
      id: personId,
      person,
      x: depth * (CARD_W + COL_GAP),
      y,
      depth,
      partners,
    });
    return y;
  }

  for (const r of roots) {
    assign(r.id, 0, new Set<string>());
  }

  for (const p of persons) {
    if (!positions.has(p.id) && !hiddenPartnerIds.has(p.id)) {
      const y = nextRow * NODE_PITCH_H;
      nextRow += 1;
      positions.set(p.id, {
        id: p.id,
        person: p,
        x: 0,
        y,
        depth: 0,
        partners: Array.from(partnersByPerson.get(p.id) ?? [])
          .map((pid) => byId.get(pid))
          .filter((x): x is PersonRow => Boolean(x))
          .map((x) => ({ id: x.id, person: x, label: personLabel(x) })),
      });
    }
  }

  /** Post-procesor: kada je prikaz filtriran na jedan ogranak (npr. Šukovići),
   *  ostali neposredni Janjini sinovi (Miloš, Obren) nemaju vidljive potomke
   *  i algoritam ih stavlja na dno (posle cele grane aktivnog sina). To vizuelno
   *  "razvuče" stablo, a Janju gurne u sredinu. Ovde ih skupljamo uz vrh pored
   *  aktivne grane i Janju pomeramo uz vrh — nema kolizije jer lepe sinove
   *  stavljamo u ISTOM kolonu kao aktivni sin, ali u prvim redovima (koji su u
   *  njegovoj koloni inače prazni dok njegov potomci žive u sledećoj koloni). */
  function descendantsIds(id: string): Set<string> {
    const out = new Set<string>();
    const stack: string[] = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      if (out.has(cur)) continue;
      out.add(cur);
      for (const c of childByParent.get(cur) ?? []) {
        if (!out.has(c)) stack.push(c);
      }
    }
    return out;
  }
  for (const rootPerson of roots) {
    const rootPos = positions.get(rootPerson.id);
    if (!rootPos) continue;

    // Neposredna deca ovog korena (uključujući preko partnera), ograničena na vidljive.
    const kidIds = new Set<string>();
    for (const pid of [rootPerson.id, ...(partnersByPerson.get(rootPerson.id) ?? [])]) {
      for (const c of childByParent.get(pid) ?? []) {
        if (!hiddenPartnerIds.has(c) && positions.has(c)) kidIds.add(c);
      }
    }
    if (kidIds.size < 2) continue;

    // Klasifikacija: list (bez potomaka u trenutnom prikazu) vs. grana.
    const leafKids: PositionedNode[] = [];
    const branchKids: PositionedNode[] = [];
    for (const kid of kidIds) {
      const kp = positions.get(kid);
      if (!kp) continue;
      const hasGrand =
        (childByParent.get(kid) ?? []).some((gc) => positions.has(gc) && !hiddenPartnerIds.has(gc)) ||
        Array.from(partnersByPerson.get(kid) ?? []).some((pid) =>
          (childByParent.get(pid) ?? []).some(
            (gc) => positions.has(gc) && !hiddenPartnerIds.has(gc),
          ),
        );
      if (hasGrand) branchKids.push(kp);
      else leafKids.push(kp);
    }
    if (leafKids.length === 0 || branchKids.length === 0) continue;

    // Najviši Y među potomcima aktivne grane — referentna "vrh" tačka.
    let topY = Infinity;
    for (const bk of branchKids) {
      for (const did of descendantsIds(bk.id)) {
        const pos = positions.get(did);
        if (pos && pos.y < topY) topY = pos.y;
      }
    }
    if (!isFinite(topY)) topY = 0;

    // Stavi listove uz vrh kolone, stacked jedan ispod drugog, stabilnim redosledom.
    const sortedLeaves = [...leafKids].sort((a, b) => a.y - b.y);
    const sortedBranches = [...branchKids].sort((a, b) => a.y - b.y);
    let cursor = topY;
    for (const lk of sortedLeaves) {
      lk.y = cursor;
      cursor += NODE_PITCH_H;
    }
    // I aktivni sin/sinovi (grane) ide odmah ispod listova — tako su Janja + sva
    // tri sina u kompaktnom bloku pri vrhu. Deca aktivne grane zadržavaju svoje
    // originalne Y pozicije (što znači da ivice od aktivnog sina ka njegovoj deci
    // mogu ići i iznad i ispod — ali nema kolizije kartica).
    for (const bk of sortedBranches) {
      bk.y = cursor;
      cursor += NODE_PITCH_H;
    }

    // Koren (Janja) u sredini kompaktnog bloka svoja 3 sina — blizu vrha, ne razvučeno.
    const sonsYs = [...sortedLeaves, ...sortedBranches].map((n) => n.y);
    rootPos.y = sonsYs.reduce((s, y) => s + y, 0) / sonsYs.length;
  }

  /** Minimalna kompakcija direktnih sibling-a (deca istog roditelja): ako se
   *  dva susedna (po Y) sibling-a dodiruju (gap < NODE_PITCH_H), pomeri niži
   *  čvor i njegov subtree dole za razliku. Bottom-up obilazak čuva strukturu;
   *  ne radi globalno po dubinama (to bi razvlačilo stablo jer interni čvorovi
   *  po originalnom algoritmu dele red sa svojom decom, a forsiran razmak
   *  između svih u koloni bi pomerao sve unedogled). */
  function collectSubtreeIds(rootId: string): Set<string> {
    const out = new Set<string>();
    const stack: string[] = [rootId];
    while (stack.length) {
      const cur = stack.pop()!;
      if (out.has(cur)) continue;
      out.add(cur);
      for (const c of childrenFor(cur)) {
        if (!out.has(c) && positions.has(c)) stack.push(c);
      }
    }
    return out;
  }

  // Bottom-up: obradi najdublje roditelje prvo, pa se promena propaguje nagore.
  const allNodesDeepFirst = Array.from(positions.values()).sort(
    (a, b) => b.depth - a.depth,
  );
  for (const parent of allNodesDeepFirst) {
    const kidIds = childrenFor(parent.id).filter((id) => positions.has(id));
    if (kidIds.length < 2) continue;
    const kids = kidIds
      .map((id) => positions.get(id)!)
      .sort((a, b) => a.y - b.y);
    for (let i = 1; i < kids.length; i++) {
      const prev = kids[i - 1];
      const cur = kids[i];
      const minY = prev.y + NODE_PITCH_H;
      if (cur.y + 0.5 < minY) {
        const shift = minY - cur.y;
        const ids = collectSubtreeIds(cur.id);
        for (const id of ids) {
          const p = positions.get(id);
          if (p) p.y += shift;
        }
      }
    }
    // Posle razdvajanja dece, roditelj treba biti centriran na sredinu opsega.
    const ys = kids.map((k) => k.y);
    parent.y = (Math.min(...ys) + Math.max(...ys)) / 2;
  }

  const edges: Array<{ from: string; to: string }> = [];
  for (const rel of relations) {
    if (positions.has(rel.parent_person_id) && positions.has(rel.child_person_id)) {
      edges.push({ from: rel.parent_person_id, to: rel.child_person_id });
    }
  }

  const nodes = Array.from(positions.values());
  const maxX = nodes.reduce((m, n) => Math.max(m, n.x + CARD_W), 0);
  const maxY = nodes.reduce((m, n) => Math.max(m, n.y + CARD_H + CARD_KONTAKT_STRIP_H), 0);

  const depthByPerson = new Map<string, number>();
  for (const n of nodes) {
    depthByPerson.set(n.person.id, n.depth);
    for (const par of n.partners) {
      if (hiddenPartnerIds.has(par.id)) depthByPerson.set(par.id, n.depth);
    }
  }

  const counts = new Map<number, number>();
  for (const p of persons) {
    const d = depthByPerson.get(p.id) ?? 0;
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const depths = Array.from(counts.keys()).sort((a, b) => a - b);
  const generationStats = depths.map((depth) => ({ depth, count: counts.get(depth) ?? 0 }));

  return {
    nodes,
    edges,
    width: maxX,
    height: maxY,
    totalMembers: persons.length,
    generationStats,
  };
}

function MemberKontaktBlock({
  person,
  onKontaktTitleClick,
}: {
  person: PersonRow;
  onKontaktTitleClick?: () => void;
}) {
  const email = person.email?.trim() ?? "";
  const mob1 = person.mob1?.trim() ?? "";
  const mob2 = person.mob2?.trim() ?? "";
  return (
    <div className="member-popover-kontakt">
      {onKontaktTitleClick ? (
        <button type="button" className="member-popover-kontakt-title-btn" onClick={onKontaktTitleClick}>
          Kontakt
        </button>
      ) : (
        <div className="member-popover-kontakt-title">Kontakt</div>
      )}
      <div className="member-popover-grid">
        <span>Email</span>
        <span className="member-popover-value">
          {email ? (
            <a href={`mailto:${encodeURIComponent(email)}`} className="member-popover-link">
              {email}
            </a>
          ) : (
            "—"
          )}
        </span>
        <span>Mobilni 1</span>
        <span className="member-popover-value">
          {mob1 ? (
            <a href={`tel:${mob1.replace(/\s+/g, "")}`} className="member-popover-link">
              {mob1}
            </a>
          ) : (
            "—"
          )}
        </span>
        <span>Mobilni 2</span>
        <span className="member-popover-value">
          {mob2 ? (
            <a href={`tel:${mob2.replace(/\s+/g, "")}`} className="member-popover-link">
              {mob2}
            </a>
          ) : (
            "—"
          )}
        </span>
      </div>
    </div>
  );
}

type Stablo2PageProps = { variant?: "admin" | "public" };

export function Stablo2Page({ variant = "admin" }: Stablo2PageProps) {
  const isPublic = variant === "public";
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightPersonParam = isPublic ? searchParams.get("person") : null;
  const ogranakParam = searchParams.get("ogranak");
  const initialOgranak: OgranakId = isOgranakId(ogranakParam)
    ? ogranakParam
    : DEFAULT_OGRANAK;
  const [selectedOgranak, setSelectedOgranak] = useState<OgranakId>(initialOgranak);
  const activeOgranakDef = useMemo(
    () => OGRANCI.find((o) => o.id === selectedOgranak) ?? OGRANCI[0],
    [selectedOgranak],
  );
  const [autoLocateDone, setAutoLocateDone] = useState(false);
  const [persons, setPersons] = useState<PersonRow[]>([]);
  const [relations, setRelations] = useState<PcRow[]>([]);
  const [partnerships, setPartnerships] = useState<PartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [zoom, setZoom] = useState(ZOOM_BASELINE);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const treeScrollerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    active: boolean;
    pointerId: number;
    x: number;
    y: number;
    sx: number;
    sy: number;
    moved: boolean;
  }>({
    active: false,
    pointerId: -1,
    x: 0,
    y: 0,
    sx: 0,
    sy: 0,
    moved: false,
  });
  /** Sidro za zoom koji čuva tačku ispod kursora (primena u efektu nakon izmene zoom-a). */
  const zoomAnchorRef = useRef<{
    cursorX: number;
    cursorY: number;
    worldX: number;
    worldY: number;
  } | null>(null);
  /** Da li je korisnik već pomerao/zumirao prikaz — ako jeste, ne vraćamo auto-kadrovanje. */
  const userInteractedRef = useRef<boolean>(false);

  const [selectedMember, setSelectedMember] = useState<PersonRow | null>(null);
  const [memberPanelPos, setMemberPanelPos] = useState<{ x: number; y: number } | null>(null);
  const [memberPanelMode, setMemberPanelMode] = useState<MemberPanelMode>("details");
  const [activitiesList, setActivitiesList] = useState<ActivityRow[]>([]);
  const [activitiesErr, setActivitiesErr] = useState<string | null>(null);

  const [opstine, setOpstine] = useState<OpstinaRow[]>([]);
  const locateWrapRef = useRef<HTMLDivElement | null>(null);
  const locateInputRef = useRef<HTMLInputElement | null>(null);
  const [memberLocateQuery, setMemberLocateQuery] = useState("");
  const [memberLocateOpen, setMemberLocateOpen] = useState(false);
  const [highlightedLocatePersonId, setHighlightedLocatePersonId] = useState<string | null>(null);
  const [locateHint, setLocateHint] = useState<string | null>(null);
  const highlightedLocateRef = useRef<string | null>(null);
  highlightedLocateRef.current = highlightedLocatePersonId;

  /** Filter po ograncima: Janja i njena tri sina su uvek vidljivi, a ispod toga
   *  prikazujemo samo potomke odabranog ogranka (Šukovići/Trivunovići/Vidići). */
  const filteredGraph = useMemo(() => {
    const allowed = computeAllowedPersonIds(
      persons,
      relations,
      partnerships,
      selectedOgranak,
    );
    return filterFamilyGraph(persons, relations, partnerships, allowed);
  }, [persons, relations, partnerships, selectedOgranak]);

  const visiblePersons = filteredGraph.persons;
  const visibleRelations = filteredGraph.relations;
  const visiblePartnerships = filteredGraph.partnerships;

  const personsById = useMemo(() => {
    const m = new Map<string, PersonRow>();
    for (const p of visiblePersons) m.set(p.id, p);
    return m;
  }, [visiblePersons]);

  const loadOpstine = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from("opstina").select("*").order("opis", { ascending: true });
    setOpstine(data ?? []);
  }, []);

  useEffect(() => {
    void loadOpstine();
  }, [loadOpstine]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await loadFamilyGraph(PUBLIC_FAMILY_TREE_ID);
    if (err) setError(err);
    else setError(null);
    setPersons(data.persons);
    setRelations(data.relations);
    setPartnerships(data.partnerships);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const layout = useMemo(
    () => computeHorizontalLayout(visiblePersons, visibleRelations, visiblePartnerships),
    [visiblePersons, visibleRelations, visiblePartnerships]
  );

  /** Promena aktivnog ogranka — resetuje scroll / highlight i sinhronizuje URL (?ogranak=…). */
  const handleSelectOgranak = useCallback(
    (next: OgranakId) => {
      if (next === selectedOgranak) return;
      setSelectedOgranak(next);
      setHighlightedLocatePersonId(null);
      setLocateHint(null);
      setMemberLocateQuery("");
      setMemberLocateOpen(false);
      // Tab menja prikazani graf — inicijalno kadriranje opet treba da odluči automatski.
      userInteractedRef.current = false;
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next === DEFAULT_OGRANAK) {
            p.delete("ogranak");
          } else {
            p.set("ogranak", next);
          }
          // Kad menjamo ogranak, deep-link ?person= više nije relevantan.
          p.delete("person");
          return p;
        },
        { replace: true },
      );
    },
    [selectedOgranak, setSearchParams],
  );

  const closeMemberPanel = useCallback(() => {
    setSelectedMember(null);
    setMemberPanelPos(null);
    setMemberPanelMode("details");
    setActivitiesList([]);
    setActivitiesErr(null);
  }, []);

  function openMemberPanelAtNode(
    node: Pick<PositionedNode, "x" | "y">,
    personId: string,
    mode: MemberPanelMode = "details"
  ) {
    const person = personsById.get(personId);
    if (!person) return;
    const wrap = canvasRef.current;
    if (wrap) {
      const scroller = treeScrollerRef.current;
      const scrollLeft = scroller?.scrollLeft ?? 0;
      const scrollTop = scroller?.scrollTop ?? 0;
      const scrollerOffsetTop = scroller?.offsetTop ?? 0;
      const scrollerOffsetLeft = scroller?.offsetLeft ?? 0;
      const nodeScreenX =
        scrollerOffsetLeft + (SCROLL_PAD_X + node.x) * zoom - scrollLeft;
      const nodeScreenY =
        scrollerOffsetTop +
        (SCROLL_PAD_Y + GEN_LABEL_HEIGHT + node.y) * zoom -
        scrollTop;
      const panelX = nodeScreenX + CARD_W * 0.35 * zoom;
      const panelY = nodeScreenY - CARD_H * 0.15 * zoom;
      const narrow = typeof window !== "undefined" && window.innerWidth < 640;
      const isChoice = mode === "kontakt-menu";
      const panelW = narrow
        ? Math.min(isChoice ? 208 : 252, Math.max(156, wrap.clientWidth - 20))
        : isChoice
          ? 228
          : 300;
      const panelH = narrow
        ? Math.min(
            isChoice ? 150 : 300,
            Math.max(isChoice ? 100 : 140, Math.round(wrap.clientHeight * (isChoice ? 0.26 : 0.5)))
          )
        : isChoice
          ? 118
          : 220;
      const margin = 8;
      const minY = (scroller?.offsetTop ?? 0) + margin;
      const maxX = Math.max(margin, wrap.clientWidth - panelW - margin);
      const maxY = Math.max(minY, wrap.clientHeight - panelH - margin);
      setMemberPanelPos({
        x: Math.max(margin, Math.min(maxX, panelX)),
        y: Math.max(minY, Math.min(maxY, panelY)),
      });
    }
    setMemberPanelMode(mode);
    setSelectedMember(person);
    if (mode !== "activities") {
      setActivitiesList([]);
      setActivitiesErr(null);
    }
  }

  async function loadActivitiesForPerson(personId: string) {
    if (!audit) return;
    setActivitiesErr(null);
    setActivitiesList([]);
    const { data, error: qErr } = await audit
      .from("gr_aktivnosti")
      .select("*")
      .eq("person_id", personId)
      .order("redosled", { ascending: true })
      .order("created_at", { ascending: true });
    if (qErr) setActivitiesErr(qErr.message);
    else setActivitiesList(data ?? []);
  }

  async function openActivitiesView(personId: string) {
    setMemberPanelMode("activities");
    await loadActivitiesForPerson(personId);
  }

  const tapRef = useRef<{ x: number; y: number; t: number; target: Element | null } | null>(null);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as Element).closest(".tree-toolbar")) return;
    if ((e.target as Element).closest(".member-popover")) return;
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const scroller = treeScrollerRef.current;
    if (!scroller) return;
    tapRef.current = {
      x: e.clientX,
      y: e.clientY,
      t: Date.now(),
      target: e.target as Element,
    };
    userInteractedRef.current = true;
    // Na dodirnim uređajima pustimo browser da nativno scroll-uje (touch-action: pan-x pan-y).
    // Ručni drag koristimo samo za miš/pero, inače bismo se sudarili sa nativnim scroll-om.
    if (e.pointerType === "touch") return;
    dragRef.current = {
      active: true,
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      sx: scroller.scrollLeft,
      sy: scroller.scrollTop,
      moved: false,
    };
    try {
      (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* noop */
    }
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current.active) return;
    const scroller = treeScrollerRef.current;
    if (!scroller) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    if (!dragRef.current.moved && dx * dx + dy * dy > 9) {
      dragRef.current.moved = true;
    }
    scroller.scrollLeft = dragRef.current.sx - dx;
    scroller.scrollTop = dragRef.current.sy - dy;
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const wasDrag = dragRef.current.active && dragRef.current.moved;
    if (dragRef.current.active) {
      try {
        (e.currentTarget as HTMLDivElement).releasePointerCapture?.(
          dragRef.current.pointerId,
        );
      } catch {
        /* noop */
      }
    }
    dragRef.current.active = false;
    dragRef.current.moved = false;
    const tap = tapRef.current;
    tapRef.current = null;
    if (wasDrag || !tap) return;
    const dx = e.clientX - tap.x;
    const dy = e.clientY - tap.y;
    if (dx * dx + dy * dy > 144) return;
    if (Date.now() - tap.t > 700) return;
    const downTarget = tap.target;
    const upTarget = e.target as Element | null;
    const el =
      (downTarget?.closest?.("[data-person-id]") as (HTMLElement | SVGElement) | null) ??
      (upTarget?.closest?.("[data-person-id]") as (HTMLElement | SVGElement) | null) ??
      null;
    const id = el?.getAttribute("data-person-id");
    if (!id) return;
    const nodeEl = el?.closest?.("[data-node-person-id]") as (HTMLElement | SVGElement) | null;
    const nodeId = nodeEl?.getAttribute("data-node-person-id") ?? id;
    const n = nodesById.get(nodeId);
    if (n) {
      openMemberPanelAtNode(n, id, "kontakt-menu");
    }
  }

  /** Na mobilnom, čim browser počne da scroll-uje, emituje pointercancel — tada tap ne sme
   *  pogrešno otvoriti karticu. */
  function onPointerCancel(e: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current.active) {
      try {
        (e.currentTarget as HTMLDivElement).releasePointerCapture?.(
          dragRef.current.pointerId,
        );
      } catch {
        /* noop */
      }
    }
    dragRef.current.active = false;
    dragRef.current.moved = false;
    tapRef.current = null;
  }

  /** React onWheel (passive) — Ctrl+wheel zoom. Ne možemo preventDefault (passive),
   *  ali je najvažnije da ne kvarimo native scroll koji Chrome dobro radi na overflow:auto. */
  const onTreeWheelReact = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const scroller = treeScrollerRef.current;
      if (!scroller) return;
      const rect = scroller.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const worldX = (cursorX + scroller.scrollLeft) / zoom;
      const worldY = (cursorY + scroller.scrollTop) / zoom;
      const factor = Math.exp(-e.deltaY * 0.0015);
      const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom * factor));
      if (Math.abs(newZoom - zoom) < 0.0001) return;
      zoomAnchorRef.current = { cursorX, cursorY, worldX, worldY };
      userInteractedRef.current = true;
      setHighlightedLocatePersonId(null);
      setZoom(newZoom);
    },
    [zoom],
  );

  /** Nakon promene zoom-a, zadrži tačku ispod kursora na istom mestu. */
  useEffect(() => {
    const anchor = zoomAnchorRef.current;
    if (!anchor) return;
    const scroller = treeScrollerRef.current;
    if (!scroller) {
      zoomAnchorRef.current = null;
      return;
    }
    const targetScrollLeft = anchor.worldX * zoom - anchor.cursorX;
    const targetScrollTop = anchor.worldY * zoom - anchor.cursorY;
    scroller.scrollLeft = Math.max(
      0,
      Math.min(scroller.scrollWidth - scroller.clientWidth, targetScrollLeft),
    );
    scroller.scrollTop = Math.max(
      0,
      Math.min(scroller.scrollHeight - scroller.clientHeight, targetScrollTop),
    );
    zoomAnchorRef.current = null;
  }, [zoom]);


  const nodesById = useMemo(() => {
    const m = new Map<string, PositionedNode>();
    for (const n of layout.nodes) m.set(n.id, n);
    return m;
  }, [layout.nodes]);

  const opstinaById = useMemo(() => {
    const m = new Map<number, string>();
    for (const o of opstine) m.set(o.id, o.opis ?? `id ${o.id}`);
    return m;
  }, [opstine]);

  const graphNodeByPersonId = useMemo(() => {
    const m = new Map<string, PositionedNode>();
    for (const n of layout.nodes) {
      m.set(n.id, n);
      for (const p of n.partners) {
        if (!m.has(p.id)) m.set(p.id, n);
      }
    }
    return m;
  }, [layout.nodes]);

  const memberLocateFiltered = useMemo(() => {
    const visible = visiblePersons.filter((p) => graphNodeByPersonId.has(p.id));
    const sorted = [...visible].sort((a, b) =>
      personLabel(a).localeCompare(personLabel(b), "sr", { sensitivity: "base" })
    );
    const q = memberLocateQuery.trim().toLowerCase();
    if (!q) return sorted.slice(0, 120);
    return sorted
      .filter((p) => {
        const op = personLocateOpstinaLabel(p, opstinaById).toLowerCase();
        const hay = `${p.first_name ?? ""} ${p.middle_name ?? ""} ${p.last_name ?? ""} ${op} ${p.birth_date ?? ""}`
          .toLowerCase()
          .replace(/\s+/g, " ");
        return hay.includes(q);
      })
      .slice(0, 120);
  }, [visiblePersons, memberLocateQuery, graphNodeByPersonId, opstinaById]);

  /** Javni prikaz: poslednje (najdublje) koleno na desnoj strani viewport-a, vertikalno uz vrh sadržaja. */
  const framePublicViewToLastGeneration = useCallback(
    (zoomOverride?: number) => {
      if (!isPublic) return;
      const scroller = treeScrollerRef.current;
      if (!scroller) return;
      if (scroller.clientWidth < 48 || scroller.clientHeight < 48) return;
      const z = zoomOverride ?? zoom;
      // Desna ivica sadržaja = početak desnog padding-a.
      const contentRightEdge = (SCROLL_PAD_X + layout.width) * z;
      const targetLeft = contentRightEdge - scroller.clientWidth + 14;
      const targetTop = SCROLL_PAD_Y * z - 8;
      const maxLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      scroller.scrollTo({
        left: Math.max(0, Math.min(maxLeft, targetLeft)),
        top: Math.max(0, Math.min(maxTop, targetTop)),
        behavior: "auto",
      });
    },
    [isPublic, layout.width, zoom],
  );

  /** Pozicija scrollera tako da je tree početak (prvi stupac) uz levu ivicu viewport-a. */
  const resetAdminScroll = useCallback(() => {
    const scroller = treeScrollerRef.current;
    if (!scroller) return;
    scroller.scrollTo({
      left: SCROLL_PAD_X * zoom - 14,
      top: SCROLL_PAD_Y * zoom - 8,
      behavior: "auto",
    });
  }, [zoom]);

  /** Skroluj scroller tako da kartica člana bude centrirana.
   *  Primarno koristimo browser-nativni scrollIntoView na SVG <g> elementu — on
   *  tačno zna gde je element i skroluje nadređene scrollere do centra. */
  const centerOnPersonNode = useCallback(
    (personId: string) => {
      const node = graphNodeByPersonId.get(personId);
      if (!node) return false;
      const scroller = treeScrollerRef.current;
      if (!scroller) return false;
      if (scroller.clientWidth < 48 || scroller.clientHeight < 48) return false;

      const safeId =
        typeof CSS !== "undefined" && typeof CSS.escape === "function"
          ? CSS.escape(node.id)
          : node.id.replace(/"/g, '\\"');
      const el = scroller.querySelector<SVGGElement>(
        `[data-node-person-id="${safeId}"]`,
      );
      if (!el) return false;

      try {
        (el as unknown as Element).scrollIntoView({
          block: "center",
          inline: "center",
          behavior: "auto",
        });
      } catch {
        /* starije verzije bez options formata — padamo na ručni račun ispod */
      }

      // Fallback / korekcija: ako scrollIntoView iz bilo kog razloga nije
      // pomerio scroller dovoljno, dodatno doteramo scrollLeft/Top ručno.
      const nodeRect = el.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();

      const nodeCenterX = nodeRect.left + nodeRect.width / 2 - scrollerRect.left;
      const nodeCenterY = nodeRect.top + nodeRect.height / 2 - scrollerRect.top;

      const targetCenterX = scroller.clientWidth / 2;
      const targetCenterY = scroller.clientHeight * 0.35;

      const dx = nodeCenterX - targetCenterX;
      const dy = nodeCenterY - targetCenterY;

      // Ako je kartica već blizu centra (tolerancija 4px), nemoj dirati.
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        const maxLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
        const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
        scroller.scrollLeft = Math.max(
          0,
          Math.min(maxLeft, scroller.scrollLeft + dx),
        );
        scroller.scrollTop = Math.max(
          0,
          Math.min(maxTop, scroller.scrollTop + dy),
        );
      }
      return true;
    },
    [graphNodeByPersonId],
  );

  const locatePersonOnGraph = useCallback(
    (personId: string) => {
      const node = graphNodeByPersonId.get(personId);
      if (!node) {
        setLocateHint("Ova osoba nije na trenutnom prikazu stabla (npr. spojeni čvor sa partnerom).");
        window.setTimeout(() => setLocateHint(null), 4500);
        return;
      }
      userInteractedRef.current = true;
      setMemberLocateOpen(false);
      setMemberLocateQuery("");
      closeMemberPanel();
      locateInputRef.current?.blur();
      if (
        typeof document !== "undefined" &&
        document.activeElement instanceof HTMLElement
      ) {
        document.activeElement.blur();
      }
      const person = persons.find((p) => p.id === personId);
      const label = person ? personLabel(person) : "član";
      setLocateHint(`Lociran: ${label}`);
      window.setTimeout(() => setLocateHint(null), 2500);
      // Stvarno scroll-ovanje sprovodi useEffect koji osluškuje highlightedLocatePersonId
      // (izvršava se posle React commit-a DOM promena), tako da izbegavamo race condition.
      // Ako je isti ID već aktivan (korisnik je upravo odabrao istog člana), resetujemo pa postavimo ponovo.
      setHighlightedLocatePersonId((prev) => (prev === personId ? null : prev));
      window.requestAnimationFrame(() => setHighlightedLocatePersonId(personId));
    },
    [graphNodeByPersonId, closeMemberPanel, persons],
  );

  /** Scroll do člana izvršavamo u effectu — React je do tada commit-ovao sve
   *  re-render-e (zatvaranje dropdown-a, pojavu locate-hint trake), pa je layout stabilan.
   *  Retry schedule pokriva i slučajeve kada font/layout tek dođe do konačne veličine. */
  useEffect(() => {
    if (!highlightedLocatePersonId) return;
    const id = highlightedLocatePersonId;
    let cancelled = false;
    const timers: number[] = [];
    const rafs: number[] = [];
    const attempt = () => {
      if (cancelled) return;
      centerOnPersonNode(id);
    };
    // Prvo kroz dva rAF-a da budemo sigurni da je browser uradio layout pass.
    rafs.push(
      window.requestAnimationFrame(() => {
        attempt();
        rafs.push(window.requestAnimationFrame(attempt));
      }),
    );
    // Pa još nekoliko timeout-ova da uhvatimo i kasnu layout korekciju.
    for (const ms of [30, 80, 160, 320, 600, 1000]) {
      timers.push(window.setTimeout(attempt, ms));
    }
    return () => {
      cancelled = true;
      for (const t of timers) window.clearTimeout(t);
      for (const r of rafs) window.cancelAnimationFrame(r);
    };
  }, [highlightedLocatePersonId, centerOnPersonNode]);

  /** Dok je otvoren dropdown i postoji tačno jedan pogodak, lociraj (pomeri prikaz) bez zatvaranja polja. */
  useEffect(() => {
    if (!memberLocateOpen) return;
    const q = memberLocateQuery.trim();
    if (q.length === 0) return;

    const tid = window.setTimeout(() => {
      if (memberLocateFiltered.length === 1) {
        const id = memberLocateFiltered[0].id;
        if (!graphNodeByPersonId.get(id)) return;
        userInteractedRef.current = true;
        // Triggeri useEffect(highlightedLocatePersonId) centriranje.
        setHighlightedLocatePersonId((prev) => (prev === id ? null : prev));
        window.requestAnimationFrame(() => setHighlightedLocatePersonId(id));
      } else {
        setHighlightedLocatePersonId(null);
      }
    }, 280);

    return () => window.clearTimeout(tid);
  }, [
    memberLocateOpen,
    memberLocateQuery,
    memberLocateFiltered,
    graphNodeByPersonId,
  ]);

  useEffect(() => {
    if (!memberLocateOpen) return;
    function onDocDown(e: MouseEvent) {
      if (locateWrapRef.current && !locateWrapRef.current.contains(e.target as Node)) {
        setMemberLocateOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [memberLocateOpen]);

  useEffect(() => {
    setAutoLocateDone(false);
  }, [highlightPersonParam, selectedOgranak]);

  /** Ako je deep-link ?person=XYZ ciljao osobu koja nije u trenutno odabranom
   *  ogranku, automatski prebacimo na ogranak koji tu osobu sadrži (ako takav postoji).
   *  Korisnik je već eksplicitno izabrao kog člana hoće da vidi — ima prednost nad defaultom. */
  useEffect(() => {
    if (!highlightPersonParam || persons.length === 0) return;
    if (ogranakParam && isOgranakId(ogranakParam)) return; // korisnik je eksplicitno zadao ogranak u URL-u
    const currentAllowed = computeAllowedPersonIds(
      persons,
      relations,
      partnerships,
      selectedOgranak,
    );
    if (!currentAllowed || currentAllowed.has(highlightPersonParam)) return;
    for (const def of OGRANCI) {
      if (def.id === selectedOgranak) continue;
      const allowed = computeAllowedPersonIds(
        persons,
        relations,
        partnerships,
        def.id,
      );
      if (allowed && allowed.has(highlightPersonParam)) {
        setSelectedOgranak(def.id);
        return;
      }
    }
  }, [
    highlightPersonParam,
    ogranakParam,
    persons,
    relations,
    partnerships,
    selectedOgranak,
  ]);

  useEffect(() => {
    if (!highlightPersonParam || visiblePersons.length === 0 || autoLocateDone) return;
    const person = visiblePersons.find((p) => p.id === highlightPersonParam);
    if (!person) return;
    const t = window.setTimeout(() => {
      locatePersonOnGraph(person.id);
      setAutoLocateDone(true);
    }, 150);
    return () => window.clearTimeout(t);
  }, [highlightPersonParam, visiblePersons, autoLocateDone, locatePersonOnGraph]);

  /** Inicijalno kadriranje (samo jednom, dok korisnik nije ništa dodirnuo).
   *  Javni: poslednje koleno desno; admin: početak stabla uz levu ivicu (uz padding). */
  useEffect(() => {
    if (loading || persons.length === 0) return;
    if (highlightPersonParam) return;
    if (highlightedLocatePersonId) return;
    if (userInteractedRef.current) return;
    let innerRaf = 0;
    const outerRaf = window.requestAnimationFrame(() => {
      innerRaf = window.requestAnimationFrame(() => {
        if (userInteractedRef.current) return;
        if (isPublic) {
          framePublicViewToLastGeneration();
        } else {
          resetAdminScroll();
        }
      });
    });
    return () => {
      window.cancelAnimationFrame(outerRaf);
      if (innerRaf) window.cancelAnimationFrame(innerRaf);
    };
  }, [
    isPublic,
    loading,
    persons.length,
    layout.width,
    layout.height,
    highlightPersonParam,
    highlightedLocatePersonId,
    framePublicViewToLastGeneration,
    resetAdminScroll,
  ]);

  /** Na promeni veličine prozora, ako korisnik nije interagovao, ponovo kadriraj. */
  useEffect(() => {
    if (!isPublic) return;
    const onResize = () => {
      if (userInteractedRef.current) return;
      if (highlightedLocateRef.current) return;
      window.requestAnimationFrame(() => framePublicViewToLastGeneration());
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [isPublic, framePublicViewToLastGeneration]);

  const { totalMembers, generationStats } = layout;

  /** Dijagnostika (samo admin): koliko osoba/veza postoji u bazi vs. koliko
   *  se stvarno prikazuje u trenutnom ogranku i layout-u. Pomaže da se
   *  identifikuju osobe koje su unete ali nisu povezane parent_child vezom
   *  (zbog toga neće biti potomci Trifuna/Simeuna/Save i neće biti vidljive
   *  u pojedinačnim ograncima). */
  const diagnostics = useMemo(() => {
    const totalPersons = persons.length;
    const totalRelations = relations.length;
    const totalPartnerships = partnerships.length;

    const personsById = new Map<string, PersonRow>();
    for (const p of persons) personsById.set(p.id, p);

    const childIds = new Set(relations.map((r) => r.child_person_id));
    const parentIds = new Set(relations.map((r) => r.parent_person_id));

    const fullName = (p: PersonRow) =>
      [p.first_name, p.middle_name, p.last_name]
        .map((s) => (s ?? "").trim())
        .filter(Boolean)
        .join(" ") || "(bez imena)";

    // Roditelji po detetu — za tooltip/prikaz "od koga je dete".
    const parentsByChild = new Map<string, string[]>();
    for (const r of relations) {
      const arr = parentsByChild.get(r.child_person_id) ?? [];
      arr.push(r.parent_person_id);
      parentsByChild.set(r.child_person_id, arr);
    }

    const orphans = persons.filter(
      (p) => !childIds.has(p.id) && !parentIds.has(p.id),
    );

    const visiblePersonsCount = visiblePersons.length;
    const renderedNodes = layout.nodes.length;

    // Osobe koje su u trenutnom ogranku (visiblePersons) ali ih layout nije
    // raspodelio (mogu biti "hidden partner" u paru koji je sveden na jedan
    // čvor, ili — retko — nisu priključene parent_child vezama).
    const renderedIds = new Set(layout.nodes.map((n) => n.id));
    const partnersInNodes = new Set<string>();
    for (const n of layout.nodes) {
      for (const p of n.partners) partnersInNodes.add(p.id);
    }
    const missingInLayout = visiblePersons.filter(
      (p) => !renderedIds.has(p.id) && !partnersInNodes.has(p.id),
    );

    // Osobe u bazi koje NISU u trenutnom ogranku. Za svaku ispiši ime roditelja
    // (ako postoji), pa korisnik brzo vidi u kom se ogranku (ili van stabla) nalazi.
    const visibleIds = new Set(visiblePersons.map((p) => p.id));
    const outOfOgranakRows = persons
      .filter((p) => !visibleIds.has(p.id))
      .map((p) => {
        const parentIdsForP = parentsByChild.get(p.id) ?? [];
        const parentNames = parentIdsForP
          .map((pid) => {
            const par = personsById.get(pid);
            return par ? fullName(par) : "(nepoznat)";
          })
          .join(" / ");
        return {
          id: p.id,
          name: fullName(p),
          parents: parentNames || "— (nema roditelja u bazi)",
          hasAnyRelation: childIds.has(p.id) || parentIds.has(p.id),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "sr", { sensitivity: "base" }));

    return {
      totalPersons,
      totalRelations,
      totalPartnerships,
      orphanCount: orphans.length,
      orphanRows: orphans
        .map((p) => ({ id: p.id, name: fullName(p) }))
        .sort((a, b) => a.name.localeCompare(b.name, "sr", { sensitivity: "base" })),
      visiblePersonsCount,
      renderedNodes,
      missingInLayoutCount: missingInLayout.length,
      missingInLayoutNames: missingInLayout
        .slice(0, 8)
        .map(fullName),
      outOfOgranakCount: outOfOgranakRows.length,
      outOfOgranakRows,
    };
  }, [persons, relations, partnerships, visiblePersons, layout.nodes]);

  /** Detalji o nepovezanim i osobama van ogranka otvoreni po default-u — da ih
   *  korisnik ne propusti. Može se ručno sakriti dugmetom u dijagnostičkoj traci. */
  const [showDiagnosticsDetails, setShowDiagnosticsDetails] = useState(true);

  return (
    <div className={`page stablo2-page${isPublic ? " stablo2-page--public" : ""}`}>
      <header className="page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <h1 style={{ margin: 0 }}>
              {isPublic
                ? `Stablo — ogranak ${activeOgranakDef.label}`
                : `Stablo 2 — ogranak ${activeOgranakDef.label}`}
            </h1>
            {!loading && totalMembers > 0 ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.25rem 0.7rem",
                  borderRadius: 999,
                  background: isPublic ? "var(--pub-surface, #fffdf6)" : "#f5f1e8",
                  border: isPublic ? "1px solid var(--pub-border, #d4c9a8)" : "1px solid #d4c9a8",
                  color: isPublic ? "var(--pub-text, #4a3c24)" : "#4a3c24",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                }}
              >
                Ukupno članova: <strong style={{ fontSize: "1.05rem" }}>{totalMembers}</strong>
              </span>
            ) : null}
          </div>
          <p className="muted" style={{ margin: "0.25rem 0 0" }}>
            {isPublic
              ? "Horizontalni prikaz stabla — zumiranje (Ctrl+točkić ili +/−), pomak prikaza točkićem ili prevlačenjem, kartica člana (detalji, kontakt, aktivnosti). Prikazano je glavno porodično stablo."
              : 'Horizontalni prikaz po uzoru na knjigu „Bratstvo Janjić".'}
          </p>
        </div>
      </header>

      {error ? <p className="muted" style={{ color: "#b91c1c" }}>{error}</p> : null}
      {loading ? <p className="muted">Učitavanje…</p> : null}

      {!isPublic && !loading && persons.length > 0 ? (
        <div
          style={{
            margin: "0.25rem 0 0.5rem",
            padding: "0.5rem 0.75rem",
            background: "#fffdf6",
            border: "1px solid #d4c9a8",
            borderRadius: 6,
            fontSize: "0.85rem",
            color: "#4a3c24",
            lineHeight: 1.45,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <strong>Dijagnostika:</strong>
            <span>
              osobe u bazi: <strong>{diagnostics.totalPersons}</strong> · roditelj-dete veze: <strong>{diagnostics.totalRelations}</strong> · partnerstva: <strong>{diagnostics.totalPartnerships}</strong>
            </span>
            <button
              type="button"
              onClick={() => setShowDiagnosticsDetails((v) => !v)}
              style={{
                padding: "0.15rem 0.55rem",
                fontSize: "0.8rem",
                background: "#fff",
                border: "1px solid #d4c9a8",
                borderRadius: 4,
                cursor: "pointer",
                color: "#4a3c24",
              }}
            >
              {showDiagnosticsDetails ? "Sakrij detalje" : "Prikaži detalje (nepovezane / van ogranka)"}
            </button>
          </div>
          <div>
            u ogranku „{activeOgranakDef.label}" vidljivih: <strong>{diagnostics.visiblePersonsCount}</strong> · iscrtanih čvorova (parovi se sažimaju u jedan): <strong>{diagnostics.renderedNodes}</strong>
            {diagnostics.missingInLayoutCount > 0 ? (
              <>
                {" "}
                · <span style={{ color: "#b91c1c" }}>nepovezanih u ogranku: <strong>{diagnostics.missingInLayoutCount}</strong></span>
              </>
            ) : null}
            {diagnostics.outOfOgranakCount > 0 ? (
              <>
                {" · van ogranka: "}
                <strong>{diagnostics.outOfOgranakCount}</strong>
              </>
            ) : null}
          </div>
          {diagnostics.orphanCount > 0 ? (
            <div style={{ color: "#b91c1c" }}>
              Osobe bez ijedne parent_child veze (ni roditelj ni dete): <strong>{diagnostics.orphanCount}</strong>
              {" "}— ne mogu biti vidljive ni u jednom ogranku dok se ne povežu.
            </div>
          ) : null}
          {diagnostics.missingInLayoutCount > 0 && diagnostics.missingInLayoutNames.length > 0 ? (
            <div style={{ color: "#b91c1c" }}>
              Primeri članova u ogranku koji nisu iscrtani: {diagnostics.missingInLayoutNames.join(", ")}
              {diagnostics.missingInLayoutCount > diagnostics.missingInLayoutNames.length ? " …" : ""}
            </div>
          ) : null}

          {showDiagnosticsDetails ? (
            <div style={{ marginTop: "0.5rem", display: "grid", gap: "0.6rem" }}>
              {diagnostics.orphanRows.length > 0 ? (
                <div
                  style={{
                    padding: "0.4rem 0.55rem",
                    background: "#fff5f5",
                    border: "1px solid #f1b0b0",
                    borderRadius: 4,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: "0.3rem", color: "#7f1d1d" }}>
                    Nepovezane osobe ({diagnostics.orphanRows.length}) — nemaju nijednu parent_child vezu:
                  </div>
                  <ol style={{ margin: 0, paddingLeft: "1.3rem", color: "#7f1d1d" }}>
                    {diagnostics.orphanRows.map((r) => (
                      <li key={r.id}>{r.name}</li>
                    ))}
                  </ol>
                  <div style={{ marginTop: "0.3rem", fontSize: "0.8rem", color: "#4a3c24" }}>
                    Otvori modul <strong>Veze → Roditelj–Dete</strong> i dodaj svakom njegovog roditelja (ili bar nekog deteta).
                  </div>
                </div>
              ) : null}

              {diagnostics.outOfOgranakRows.length > 0 ? (
                <div
                  style={{
                    padding: "0.4rem 0.55rem",
                    background: "#fff",
                    border: "1px solid #d4c9a8",
                    borderRadius: 4,
                    maxHeight: 320,
                    overflow: "auto",
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: "0.3rem" }}>
                    Osobe u bazi koje nisu u ogranku „{activeOgranakDef.label}" ({diagnostics.outOfOgranakRows.length}):
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <thead>
                      <tr style={{ textAlign: "left" }}>
                        <th style={{ borderBottom: "1px solid #d4c9a8", padding: "0.2rem 0.3rem" }}>Ime</th>
                        <th style={{ borderBottom: "1px solid #d4c9a8", padding: "0.2rem 0.3rem" }}>Roditelj(i) u bazi</th>
                        <th style={{ borderBottom: "1px solid #d4c9a8", padding: "0.2rem 0.3rem" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diagnostics.outOfOgranakRows.map((r) => (
                        <tr key={r.id}>
                          <td style={{ padding: "0.18rem 0.3rem", borderBottom: "1px dotted #e5dfc9" }}>
                            {r.name}
                          </td>
                          <td style={{ padding: "0.18rem 0.3rem", borderBottom: "1px dotted #e5dfc9" }}>
                            {r.parents}
                          </td>
                          <td style={{ padding: "0.18rem 0.3rem", borderBottom: "1px dotted #e5dfc9" }}>
                            {r.hasAnyRelation ? (
                              <span style={{ color: "#065f46" }}>povezan — ali ne pripada ovom ogranku</span>
                            ) : (
                              <span style={{ color: "#b91c1c" }}>bez ikakve veze</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && persons.length === 0 ? (
        <p className="muted">Nema unetih članova za prikazano stablo.</p>
      ) : null}

      {!loading && persons.length > 0 ? (
        <div
          className="stablo2-canvas"
          ref={canvasRef}
          style={{
            width: "100%",
            ...(isPublic
              ? { flex: 1, minHeight: 0, height: "auto" }
              : { height: "78vh" }),
            background: "#f5f1e8",
            border: "1px solid #d4c9a8",
            borderRadius: 8,
            overflow: "hidden",
            position: "relative",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            className="row tree-toolbar"
            style={{
              flexShrink: 0,
              flexWrap: "wrap",
              gap: "0.5rem",
              padding: "0.5rem 0.65rem",
              borderBottom: "1px solid #d4c9a8",
              background: "rgba(255, 253, 246, 0.97)",
              alignItems: "center",
            }}
          >
            <button type="button" onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z * 1.12))}>
              +
            </button>
            <button type="button" onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z * 0.88))}>
              −
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(ZOOM_BASELINE);
                closeMemberPanel();
                setHighlightedLocatePersonId(null);
                setMemberLocateQuery("");
                setMemberLocateOpen(false);
                setLocateHint(null);
                userInteractedRef.current = false;
                window.requestAnimationFrame(() => {
                  window.requestAnimationFrame(() => {
                    if (isPublic) {
                      framePublicViewToLastGeneration(ZOOM_BASELINE);
                    } else {
                      resetAdminScroll();
                    }
                  });
                });
              }}
            >
              Reset prikaza
            </button>
            {!isPublic ? (
              <button
                type="button"
                onClick={() => {
                  closeMemberPanel();
                  setHighlightedLocatePersonId(null);
                  setLocateHint("Osvežavanje podataka…");
                  void (async () => {
                    await load();
                    setLocateHint("Podaci osveženi.");
                    window.setTimeout(() => setLocateHint(null), 1800);
                  })();
                }}
                title="Ponovo učitaj osobe, roditelje-deca veze i partnerstva iz baze"
              >
                Osveži podatke
              </button>
            ) : null}
            <span className="muted">Zoom: {zoomDisplayPercent(zoom)}%</span>
            <div
              className="tree-ogranak-switch"
              role="tablist"
              aria-label="Izbor ogranka"
            >
              {OGRANCI.map((o) => {
                const isActive = o.id === selectedOgranak;
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={o.fullLabel}
                    className={`tree-ogranak-pill${isActive ? " is-active" : ""}`}
                    onClick={() => handleSelectOgranak(o.id)}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
            <div className="tree-toolbar-locate" ref={locateWrapRef}>
              <input
                ref={locateInputRef}
                type="search"
                className="tree-locate-input"
                placeholder="Pretraži člana (ime, prezime, opština, datum)…"
                value={memberLocateQuery}
                onChange={(e) => {
                  setMemberLocateQuery(e.target.value);
                  setMemberLocateOpen(true);
                }}
                onFocus={() => setMemberLocateOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && memberLocateFiltered[0]) {
                    e.preventDefault();
                    locatePersonOnGraph(memberLocateFiltered[0].id);
                  } else if (e.key === "Escape") {
                    setMemberLocateOpen(false);
                    locateInputRef.current?.blur();
                  }
                }}
                aria-label="Pretraga člana na stablu"
                autoComplete="off"
              />
              {memberLocateOpen && memberLocateFiltered.length ? (
                <ul
                  className="tree-locate-dropdown"
                  role="listbox"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {memberLocateFiltered.map((p) => (
                    <li key={p.id} role="option">
                      <button
                        type="button"
                        className="tree-locate-item"
                        onClick={(ev) => {
                          ev.preventDefault();
                          ev.stopPropagation();
                          locatePersonOnGraph(p.id);
                        }}
                      >
                        <span className="tree-locate-item-name">{personLabel(p)}</span>
                        <span className="tree-locate-item-meta">
                          {personLocateOpstinaLabel(p, opstinaById)}
                          <span className="tree-locate-item-sep"> · </span>
                          {p.birth_date?.trim() || "—"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
          {locateHint ? <p className="muted tree-locate-hint" style={{ padding: "0 0.65rem", margin: 0 }}>{locateHint}</p> : null}
          <div
            ref={treeScrollerRef}
            data-tree-scroller="true"
            className="tree-scroller"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onWheel={onTreeWheelReact}
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "auto",
              position: "relative",
              cursor: dragRef.current.active ? "grabbing" : "grab",
              touchAction: "pan-x pan-y",
              WebkitOverflowScrolling: "touch",
            }}
          >
          <svg
            className="tree-scale-content"
            width={treeSvgDocumentWidth(layout.width) * zoom}
            height={treeSvgDocumentHeight(layout.height) * zoom}
            viewBox={`0 0 ${treeSvgDocumentWidth(layout.width)} ${treeSvgDocumentHeight(layout.height)}`}
            preserveAspectRatio="xMinYMin meet"
            style={{ display: "block" }}
          >
            <g transform={`translate(${SCROLL_PAD_X}, ${SCROLL_PAD_Y + GEN_LABEL_HEIGHT})`}>
              {generationStats.map((g) => {
                const cx = g.depth * (CARD_W + COL_GAP) + CARD_W / 2;
                return (
                  <g key={`gen-${g.depth}`} transform={`translate(${cx}, ${Math.round(-8 * TREE_CARD_SCALE)})`}>
                    <text
                      textAnchor="middle"
                      fontSize={FS_GEN_LABEL}
                      fontWeight={700}
                      fontFamily="Georgia, 'Times New Roman', serif"
                      fill="#4a3c24"
                    >
                      {g.depth + 1}. koleno ({g.count})
                    </text>
                  </g>
                );
              })}
              {layout.edges.map((e, i) => {
                const a = nodesById.get(e.from);
                const b = nodesById.get(e.to);
                if (!a || !b) return null;
                const x1 = a.x + CARD_W;
                const y1 = a.y + CARD_H / 2;
                const x2 = b.x;
                const y2 = b.y + CARD_H / 2;
                const mx = x1 + (x2 - x1) / 2;
                const d = `M ${x1} ${y1} H ${mx} V ${y2} H ${x2}`;
                return <path key={i} d={d} stroke="#6b5a3a" strokeWidth={TREE_EDGE_SW} fill="none" />;
              })}

              {layout.nodes.map((node) => {
                const accent = pedigreeAccent(node.depth);
                const { first, second } = primaryPairForNode(node);
                const isLocateHighlight =
                  highlightedLocatePersonId &&
                  (node.id === highlightedLocatePersonId ||
                    node.partners.some((x) => x.id === highlightedLocatePersonId));
                const firstName =
                  first.label.length > CARD_NAME_MAX
                    ? `${first.label.slice(0, CARD_NAME_MAX - 1)}…`
                    : first.label;
                const secondName = second
                  ? second.label.length > CARD_NAME2_MAX
                    ? `${second.label.slice(0, CARD_NAME2_MAX - 1)}…`
                    : second.label
                  : "";
                // Sa dve vrste (partner): prva i druga linija bliže centru; bez partnera: jedna centralna.
                const y1 = second ? -4 : 3;
                const y2 = 9;
                return (
                  <g
                    key={node.id}
                    className="tree-node pedigree-node"
                    data-node-person-id={node.id}
                    data-person-id={node.id}
                    transform={`translate(${node.x + CARD_HALF_W},${node.y + CARD_HALF_H})`}
                  >
                    {isLocateHighlight ? (
                      <>
                        <rect
                          x={-CARD_HALF_W - ty(6)}
                          y={-CARD_HALF_H - ty(6)}
                          width={CARD_W + ty(12)}
                          height={CARD_H + ty(12)}
                          fill="#fde68a"
                          fillOpacity={0.35}
                          stroke="none"
                          rx={2.5}
                          pointerEvents="none"
                          className="pedigree-locate-fill"
                        />
                        <rect
                          x={-CARD_HALF_W - ty(4)}
                          y={-CARD_HALF_H - ty(4)}
                          width={CARD_W + ty(8)}
                          height={CARD_H + ty(8)}
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth={TREE_RING_SW}
                          rx={2}
                          pointerEvents="none"
                          className="pedigree-locate-ring"
                        />
                      </>
                    ) : null}
                    <rect
                      x={-CARD_HALF_W}
                      y={-CARD_HALF_H}
                      width={CARD_W}
                      height={CARD_H}
                      fill="#ffffff"
                      stroke="#e2e8f0"
                      strokeWidth={TREE_CARD_SW}
                    />
                    <rect
                      x={-CARD_HALF_W}
                      y={-CARD_HALF_H}
                      width={CARD_W}
                      height={Math.max(4, ty(5))}
                      fill={accent}
                    />
                    <text
                      y={y1}
                      textAnchor="middle"
                      fill="#0f172a"
                      fontSize={FS_CARD_TITLE}
                      fontWeight="700"
                      fontFamily="Georgia, 'Times New Roman', serif"
                      style={{ cursor: "pointer" }}
                      data-person-id={first.id}
                    >
                      <title>{first.label}</title>
                      {firstName}
                    </text>
                    {second ? (
                      <text
                        y={y2}
                        textAnchor="middle"
                        fill="#334155"
                        fontSize={FS_CARD_PARTNER}
                        fontStyle="italic"
                        fontWeight="600"
                        fontFamily="Georgia, 'Times New Roman', serif"
                        style={{ cursor: "pointer" }}
                        data-person-id={second.id}
                      >
                        <title>{second.label}</title>
                        <tspan>+ </tspan>
                        <tspan>{secondName}</tspan>
                      </text>
                    ) : null}
                    <text
                      y={CARD_HALF_H + ty(10)}
                      textAnchor="middle"
                      fill="#2563eb"
                      fontSize={FS_CARD_KONTAKT}
                      fontWeight="600"
                      textDecoration="underline"
                      fontFamily="Georgia, 'Times New Roman', serif"
                      style={{ cursor: "pointer" }}
                      data-person-id={first.id}
                    >
                      <title>Kontakt</title>
                      Kontakt
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
          </div>

          {selectedMember && memberPanelPos ? (
            <>
              <button
                type="button"
                className="member-popover-backdrop"
                aria-label="Zatvori karticu"
                onClick={closeMemberPanel}
              />
            <aside
              className={`member-popover${memberPanelMode === "kontakt-menu" ? " member-popover--kontakt-choice" : ""}${memberPanelMode === "details" ? " member-popover--details" : ""}`}
              style={{ left: memberPanelPos.x, top: memberPanelPos.y }}
            >
              <div className="member-popover-head">
                <strong>{personLabel(selectedMember)}</strong>
                <button type="button" className="member-popover-close" onClick={closeMemberPanel}>
                  ×
                </button>
              </div>
              {memberPanelMode === "kontakt-menu" ? (
                <div className="member-popover-kontakt-menu-inner">
                  <p className="member-popover-kontakt-menu-label">Izaberite prikaz</p>
                  <div className="member-popover-kontakt-menu-pair">
                    <button
                      type="button"
                      className="member-btn-aktivnosti"
                      onClick={() => void openActivitiesView(selectedMember.id)}
                    >
                      Aktivnosti
                    </button>
                    <button
                      type="button"
                      className="member-btn-detalji"
                      onClick={() => setMemberPanelMode("details")}
                    >
                      Detalji
                    </button>
                  </div>
                </div>
              ) : null}
              {memberPanelMode === "activities" ? (
                <div className="member-popover-activities">
                  <button
                    type="button"
                    className="member-popover-back"
                    onClick={() => {
                      setMemberPanelMode("kontakt-menu");
                      setActivitiesList([]);
                      setActivitiesErr(null);
                    }}
                  >
                    ← Nazad
                  </button>
                  <h4 className="member-popover-activities-heading">Aktivnosti</h4>
                  {activitiesErr ? <p className="error">{activitiesErr}</p> : null}
                  <div className="member-popover-activities-scroll">
                    {activitiesList.length ? (
                      activitiesList.map((a) => {
                        const href = activityWebHref(a.veb_link);
                        const thumb = activityThumbUrl(a.foto_storage_path);
                        return (
                          <div key={a.id} className="member-tree-activity-card">
                            <div className="member-tree-activity-head">
                              <strong>{a.naslov}</strong>
                              {a.datum ? (
                                <span className="muted" style={{ marginLeft: "0.35rem" }}>
                                  {a.datum}
                                </span>
                              ) : null}
                            </div>
                            {thumb ? (
                              <img className="member-tree-activity-thumb" src={thumb} alt="" />
                            ) : null}
                            {a.opis?.trim() ? <p className="member-tree-activity-opis">{a.opis}</p> : null}
                            {href ? (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="member-popover-link"
                              >
                                {a.veb_link?.trim() || href}
                              </a>
                            ) : null}
                          </div>
                        );
                      })
                    ) : (
                      !activitiesErr && (
                        <p className="muted" style={{ margin: "0.5rem 0.65rem" }}>
                          Nema unetih aktivnosti.
                        </p>
                      )
                    )}
                  </div>
                </div>
              ) : null}
              {memberPanelMode === "details" ? (
                <div className="member-popover-details-body">
                  {(() => {
                    const photoPath = getDefaultPhotoPath(selectedMember.photo_storage_path);
                    const photoUrl = toPublicPhotoUrl(photoPath);
                    return photoUrl ? (
                      <div className="member-photo-wrap">
                        <img className="member-photo" src={photoUrl} alt={personLabel(selectedMember)} />
                      </div>
                    ) : null;
                  })()}
                  <div className="member-popover-grid">
                    <span>Pol</span>
                    <span>{selectedMember.gender ?? "—"}</span>
                    <span>Rođen/a</span>
                    <span>{selectedMember.birth_date ?? "—"}</span>
                    <span>Živ/živa</span>
                    <span>
                      {selectedMember.is_living == null
                        ? "—"
                        : selectedMember.is_living
                          ? "da"
                          : "ne"}
                    </span>
                    <span>Napomene</span>
                    <span className="member-popover-multiline">
                      {selectedMember.notes?.trim() ? selectedMember.notes : "—"}
                    </span>
                    <span>Karijera</span>
                    <span className="member-popover-multiline member-popover-multiline--karijera">
                      {selectedMember.karijera?.trim() ? selectedMember.karijera : "—"}
                    </span>
                  </div>
                  <MemberKontaktBlock
                    person={selectedMember}
                    onKontaktTitleClick={() => setMemberPanelMode("kontakt-menu")}
                  />
                </div>
              ) : null}
            </aside>
            </>
          ) : null}
        </div>
      ) : null}

      <p className="muted" style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
        Navigacija: prevuci mišem za pomeranje · Ctrl+točkić ili dugmad za zoom.
      </p>
    </div>
  );
}
