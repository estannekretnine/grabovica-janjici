import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  loadFamilyGraph,
  type PcRow,
  type PartRow,
  type PersonRow,
} from "../lib/familyTreeGraphLoad";
import { PUBLIC_FAMILY_TREE_ID } from "../lib/publicFamilyTree";
import { audit, supabase } from "../lib/supabase";
import type { Database } from "../types/database";

type ActivityRow = Database["audit"]["Tables"]["gr_aktivnosti"]["Row"];
type OpstinaRow = Database["public"]["Tables"]["opstina"]["Row"];

type MemberPanelMode = "details" | "kontakt-menu" | "activities";

/** Horizontalno stablo — kartice (isti vizuel kao Stablo 1). */
const CARD_W = 186;
const CARD_H = 118;
const CARD_HALF_W = CARD_W / 2;
const CARD_HALF_H = CARD_H / 2;
const COL_GAP = 48;
const ROW_GAP = 16;
const GEN_LABEL_HEIGHT = 28;

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

function karijeraTreeSnippet(raw: string | null | undefined, maxLen = 34): string {
  const t = raw?.replace(/\s+/g, " ").trim() ?? "";
  if (!t) return "";
  return t.length > maxLen ? `${t.slice(0, maxLen - 1)}…` : t;
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

function personLifeLine(p: PersonRow) {
  const b = p.birth_date?.trim();
  const d = p.death_date?.trim();
  const birth = b || "—";
  if (d) return `${birth} – ${d}`;
  if (p.is_living === false) return `${birth} –`;
  return b ? `${birth} –` : "—";
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
      y = nextRow * (CARD_H + ROW_GAP);
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
      const y = nextRow * (CARD_H + ROW_GAP);
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

  const edges: Array<{ from: string; to: string }> = [];
  for (const rel of relations) {
    if (positions.has(rel.parent_person_id) && positions.has(rel.child_person_id)) {
      edges.push({ from: rel.parent_person_id, to: rel.child_person_id });
    }
  }

  const nodes = Array.from(positions.values());
  const maxX = nodes.reduce((m, n) => Math.max(m, n.x + CARD_W), 0);
  const maxY = nodes.reduce((m, n) => Math.max(m, n.y + CARD_H), 0);

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

export function Stablo2Page() {
  const [persons, setPersons] = useState<PersonRow[]>([]);
  const [relations, setRelations] = useState<PcRow[]>([]);
  const [partnerships, setPartnerships] = useState<PartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 40, y: 40 });
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ active: boolean; x: number; y: number; ox: number; oy: number }>({
    active: false,
    x: 0,
    y: 0,
    ox: 0,
    oy: 0,
  });

  const [selectedMember, setSelectedMember] = useState<PersonRow | null>(null);
  const [memberPanelPos, setMemberPanelPos] = useState<{ x: number; y: number } | null>(null);
  const [memberPanelMode, setMemberPanelMode] = useState<MemberPanelMode>("details");
  const [activitiesList, setActivitiesList] = useState<ActivityRow[]>([]);
  const [activitiesErr, setActivitiesErr] = useState<string | null>(null);

  const [opstine, setOpstine] = useState<OpstinaRow[]>([]);
  const locateWrapRef = useRef<HTMLDivElement | null>(null);
  const [memberLocateQuery, setMemberLocateQuery] = useState("");
  const [memberLocateOpen, setMemberLocateOpen] = useState(false);
  const [highlightedLocatePersonId, setHighlightedLocatePersonId] = useState<string | null>(null);
  const [locateHint, setLocateHint] = useState<string | null>(null);

  const personsById = useMemo(() => {
    const m = new Map<string, PersonRow>();
    for (const p of persons) m.set(p.id, p);
    return m;
  }, [persons]);

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
    () => computeHorizontalLayout(persons, relations, partnerships),
    [persons, relations, partnerships]
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
      const panelX = offset.x + node.x * zoom + CARD_W * 0.35 * zoom;
      const panelY = offset.y + node.y * zoom - CARD_H * 0.15 * zoom;
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
      const maxX = Math.max(margin, wrap.clientWidth - panelW - margin);
      const maxY = Math.max(margin, wrap.clientHeight - panelH);
      setMemberPanelPos({
        x: Math.max(margin, Math.min(maxX, panelX)),
        y: Math.max(margin, Math.min(maxY, panelY)),
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

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as Element).closest(".tree-node")) return;
    if ((e.target as Element).closest(".tree-toolbar")) return;
    if ((e.target as Element).closest(".member-popover")) return;
    setHighlightedLocatePersonId(null);
    dragRef.current = {
      active: true,
      x: e.clientX,
      y: e.clientY,
      ox: offset.x,
      oy: offset.y,
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setOffset({ x: dragRef.current.ox + dx, y: dragRef.current.oy + dy });
  }
  function onPointerUp() {
    dragRef.current.active = false;
  }

  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    setZoom((z) => Math.min(2.5, Math.max(0.6, z + delta)));
  }

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
    const visible = persons.filter((p) => graphNodeByPersonId.has(p.id));
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
  }, [persons, memberLocateQuery, graphNodeByPersonId, opstinaById]);

  const locatePersonOnGraph = useCallback(
    (personId: string) => {
      const node = graphNodeByPersonId.get(personId);
      if (!node) {
        setLocateHint("Ova osoba nije na trenutnom prikazu stabla (npr. spojeni čvor sa partnerom).");
        window.setTimeout(() => setLocateHint(null), 4500);
        return;
      }
      setLocateHint(null);
      const wrap = canvasRef.current;
      const cx = node.x + CARD_HALF_W;
      const cy = GEN_LABEL_HEIGHT + node.y + CARD_HALF_H;
      const vw = wrap?.clientWidth ?? 980;
      const vh = wrap?.clientHeight ?? 520;
      setOffset({ x: vw / 2 - cx * zoom, y: vh / 2 - cy * zoom });
      setHighlightedLocatePersonId(personId);
      setMemberLocateOpen(false);
      setMemberLocateQuery("");
      closeMemberPanel();
    },
    [graphNodeByPersonId, zoom, closeMemberPanel]
  );

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

  const { totalMembers, generationStats } = layout;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <h1 style={{ margin: 0 }}>Stablo 2 — ogranak Šukovići</h1>
            {!loading && totalMembers > 0 ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.25rem 0.7rem",
                  borderRadius: 999,
                  background: "#f5f1e8",
                  border: "1px solid #d4c9a8",
                  color: "#4a3c24",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                }}
              >
                Ukupno članova: <strong style={{ fontSize: "1.05rem" }}>{totalMembers}</strong>
              </span>
            ) : null}
          </div>
          <p className="muted" style={{ margin: "0.25rem 0 0" }}>
            Horizontalni prikaz po uzoru na knjigu „Bratstvo Janjić".
          </p>
          {!loading && generationStats.length > 0 ? (
            <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.9rem" }}>
              {generationStats.map((g) => `${g.depth + 1}. koleno: ${g.count}`).join(" · ")}
            </p>
          ) : null}
        </div>
      </header>

      {error ? <p className="muted" style={{ color: "#b91c1c" }}>{error}</p> : null}
      {loading ? <p className="muted">Učitavanje…</p> : null}

      {!loading && persons.length === 0 ? (
        <p className="muted">Nema unetih članova za prikazano stablo.</p>
      ) : null}

      {!loading && persons.length > 0 ? (
        <div
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          style={{
            width: "100%",
            height: "78vh",
            background: "#f5f1e8",
            border: "1px solid #d4c9a8",
            borderRadius: 8,
            overflow: "hidden",
            cursor: dragRef.current.active ? "grabbing" : "grab",
            touchAction: "none",
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
            <button type="button" onClick={() => setZoom((z) => Math.min(2.5, z * 1.12))}>
              +
            </button>
            <button type="button" onClick={() => setZoom((z) => Math.max(0.6, z * 0.88))}>
              −
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setOffset({ x: 40, y: 40 });
                closeMemberPanel();
                setHighlightedLocatePersonId(null);
                setMemberLocateQuery("");
                setMemberLocateOpen(false);
                setLocateHint(null);
              }}
            >
              Reset prikaza
            </button>
            <span className="muted">Zoom: {Math.round(zoom * 100)}%</span>
            <div className="tree-toolbar-locate" ref={locateWrapRef}>
              <input
                type="search"
                className="tree-locate-input"
                placeholder="Pretraži člana (ime, prezime, opština, datum)…"
                value={memberLocateQuery}
                onChange={(e) => {
                  setMemberLocateQuery(e.target.value);
                  setMemberLocateOpen(true);
                }}
                onFocus={() => setMemberLocateOpen(true)}
                aria-label="Pretraga člana na stablu"
                autoComplete="off"
              />
              {memberLocateOpen && memberLocateFiltered.length ? (
                <ul className="tree-locate-dropdown" role="listbox">
                  {memberLocateFiltered.map((p) => (
                    <li key={p.id} role="option">
                      <button
                        type="button"
                        className="tree-locate-item"
                        onMouseDown={(ev) => ev.preventDefault()}
                        onClick={() => locatePersonOnGraph(p.id)}
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
          <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          <svg
            width={Math.max(layout.width + 200, 2000)}
            height={Math.max(layout.height + 200 + GEN_LABEL_HEIGHT, 800)}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
              display: "block",
            }}
          >
            <g transform={`translate(0, ${GEN_LABEL_HEIGHT})`}>
              {generationStats.map((g) => {
                const cx = g.depth * (CARD_W + COL_GAP) + CARD_W / 2;
                return (
                  <g key={`gen-${g.depth}`} transform={`translate(${cx}, ${-8})`}>
                    <text
                      textAnchor="middle"
                      fontSize={13}
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
                return <path key={i} d={d} stroke="#6b5a3a" strokeWidth={1.2} fill="none" />;
              })}

              {layout.nodes.map((node) => {
                const accent = pedigreeAccent(node.depth);
                const { first, second } = primaryPairForNode(node);
                const kSnip = karijeraTreeSnippet(first.person.karijera, 40);
                const life1 = personLifeLine(first.person);
                const life2 = second ? personLifeLine(second.person) : "";
                const isLocateHighlight =
                  highlightedLocatePersonId &&
                  (node.id === highlightedLocatePersonId ||
                    node.partners.some((x) => x.id === highlightedLocatePersonId));
                return (
                  <g
                    key={node.id}
                    className="tree-node pedigree-node"
                    transform={`translate(${node.x + CARD_HALF_W},${node.y + CARD_HALF_H})`}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      openMemberPanelAtNode(node, node.id, "kontakt-menu");
                    }}
                  >
                    {isLocateHighlight ? (
                      <rect
                        x={-CARD_HALF_W - 4}
                        y={-CARD_HALF_H - 4}
                        width={CARD_W + 8}
                        height={CARD_H + 8}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth={3}
                        rx={2}
                        pointerEvents="none"
                        className="pedigree-locate-ring"
                      />
                    ) : null}
                    <rect
                      x={-CARD_HALF_W}
                      y={-CARD_HALF_H}
                      width={CARD_W}
                      height={CARD_H}
                      fill="#ffffff"
                      stroke="#e2e8f0"
                      strokeWidth={1}
                    />
                    <rect
                      x={-CARD_HALF_W}
                      y={-CARD_HALF_H}
                      width={CARD_W}
                      height={5}
                      fill={accent}
                    />
                    <text
                      y={-CARD_HALF_H + 24}
                      textAnchor="middle"
                      fill="#0f172a"
                      fontSize="12.5"
                      fontWeight="700"
                      fontFamily="Georgia, 'Times New Roman', serif"
                      style={{ cursor: "pointer" }}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        openMemberPanelAtNode(node, first.id, "kontakt-menu");
                      }}
                    >
                      <title>{first.label}</title>
                      {first.label.length > 22 ? `${first.label.slice(0, 21)}…` : first.label}
                    </text>
                    {second ? (
                      <text
                        y={-CARD_HALF_H + 40}
                        textAnchor="middle"
                        fill="#475569"
                        fontSize="11"
                        fontStyle="italic"
                        fontWeight="600"
                        fontFamily="Georgia, 'Times New Roman', serif"
                        style={{ cursor: "pointer" }}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          openMemberPanelAtNode(node, second.id, "kontakt-menu");
                        }}
                      >
                        <title>{second.label}</title>
                        <tspan>+ </tspan>
                        <tspan>
                          {second.label.length > 20 ? `${second.label.slice(0, 19)}…` : second.label}
                        </tspan>
                      </text>
                    ) : null}
                    <text
                      y={-CARD_HALF_H + (second ? 56 : 44)}
                      textAnchor="middle"
                      fill="#64748b"
                      fontSize="10.5"
                      fontWeight="500"
                      fontFamily="Georgia, 'Times New Roman', serif"
                      style={{ cursor: "pointer" }}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        openMemberPanelAtNode(node, first.id, "kontakt-menu");
                      }}
                    >
                      <title>{second ? `${life1} / ${life2}` : life1}</title>
                      {second ? `${life1} · ${life2}` : life1}
                    </text>
                    {kSnip ? (
                      <text
                        y={-CARD_HALF_H + (second ? 72 : 60)}
                        textAnchor="middle"
                        fill="#64748b"
                        fontSize="9"
                        fontWeight="500"
                        fontFamily="Georgia, 'Times New Roman', serif"
                        style={{ cursor: "pointer" }}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          openMemberPanelAtNode(node, first.id, "kontakt-menu");
                        }}
                      >
                        <title>{first.person.karijera?.trim() ?? ""}</title>
                        {kSnip}
                      </text>
                    ) : null}
                    <text
                      y={-CARD_HALF_H + (second ? (kSnip ? 86 : 78) : kSnip ? 74 : 62)}
                      textAnchor="middle"
                      fill="#2563eb"
                      fontSize="10"
                      fontWeight="600"
                      textDecoration="underline"
                      fontFamily="Georgia, 'Times New Roman', serif"
                      style={{ cursor: "pointer" }}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        openMemberPanelAtNode(node, first.id, "kontakt-menu");
                      }}
                    >
                      Kontakt
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
          </div>

          {selectedMember && memberPanelPos ? (
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
          ) : null}
        </div>
      ) : null}

      <p className="muted" style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
        Navigacija: prevuci mišem za pomeranje · Ctrl+točkić ili dugmad za zoom.
      </p>
    </div>
  );
}
