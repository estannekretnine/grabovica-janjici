import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { audit, supabase } from "../lib/supabase";
import { loadFamilyGraph } from "../lib/familyTreeGraphLoad";
import type { Database } from "../types/database";

type TreeRow = Database["audit"]["Tables"]["gr_family_trees"]["Row"];
type PersonRow = Database["audit"]["Tables"]["gr_persons"]["Row"];
type PcRow = Database["audit"]["Tables"]["gr_parent_child"]["Row"];
type PartRow = Database["audit"]["Tables"]["gr_partnerships"]["Row"];
type ActivityRow = Database["audit"]["Tables"]["gr_aktivnosti"]["Row"];

type MemberPanelMode = "details" | "kontakt-menu" | "activities";

function personLabel(p: Pick<PersonRow, "first_name" | "last_name">) {
  const full = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
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

type PartnerLabel = { id: string; person: PersonRow; label: string };

/** Isti redosled imena kao u postojećem prikazu čvora (Janjić / pol pravila). */
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

/** Jednolinijski isječak karijere ispod imena na grafu. */
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

/** Kartice u rodoslovnom prikazu (Stablo 1). */
const PEDIGREE_CARD_W = 172;
const PEDIGREE_CARD_H = 112;
const PEDIGREE_HALF_W = PEDIGREE_CARD_W / 2;
const PEDIGREE_HALF_H = PEDIGREE_CARD_H / 2;
const PEDIGREE_CONNECTOR_STUB = 18;

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

function orthConnectors(
  px: number,
  py: number,
  children: Array<{ sx: number; sy: number }>,
  halfH: number
): string {
  if (!children.length) return "";
  const pBottom = py + halfH;
  const yMid = pBottom + PEDIGREE_CONNECTOR_STUB;
  const cxs = children.map((c) => c.sx);
  const minX = Math.min(px, ...cxs);
  const maxX = Math.max(px, ...cxs);
  const d: string[] = [`M ${px} ${pBottom} L ${px} ${yMid} L ${minX} ${yMid} L ${maxX} ${yMid}`];
  for (const c of children) {
    const cTop = c.sy - halfH;
    d.push(`M ${c.sx} ${yMid} L ${c.sx} ${cTop}`);
  }
  return d.join(" ");
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

type TreesPageProps = { variant?: "full" | "stablo1" };

export function TreesPage({ variant = "full" }: TreesPageProps) {
  const [rows, setRows] = useState<TreeRow[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [selectedTreeId, setSelectedTreeId] = useState("");
  const [persons, setPersons] = useState<PersonRow[]>([]);
  const [relations, setRelations] = useState<PcRow[]>([]);
  const [partnerships, setPartnerships] = useState<PartRow[]>([]);
  const [selectedMember, setSelectedMember] = useState<PersonRow | null>(null);
  const [memberPanelPos, setMemberPanelPos] = useState<{ x: number; y: number } | null>(null);
  const [memberPanelMode, setMemberPanelMode] = useState<MemberPanelMode>("details");
  const [activitiesList, setActivitiesList] = useState<ActivityRow[]>([]);
  const [activitiesErr, setActivitiesErr] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 90, y: 70 });
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ active: boolean; x: number; y: number; ox: number; oy: number }>({
    active: false,
    x: 0,
    y: 0,
    ox: 0,
    oy: 0,
  });

  const load = useCallback(async () => {
    const { data, error: qErr } = await audit!
      .from("gr_family_trees")
      .select("*")
      .order("created_at", { ascending: true });
    if (qErr) setError(qErr.message);
    else {
      setError(null);
      setRows(data ?? []);
      if (!selectedTreeId && (data ?? []).length) {
        setSelectedTreeId((data ?? [])[0].id);
      }
    }
  }, [selectedTreeId]);

  const loadGraph = useCallback(async (treeId: string) => {
    if (!treeId) {
      setPersons([]);
      setRelations([]);
      setPartnerships([]);
      return;
    }
    const { data, error: gErr } = await loadFamilyGraph(treeId);
    if (gErr) setError(gErr);
    else setError(null);
    setPersons(data.persons);
    setRelations(data.relations);
    setPartnerships(data.partnerships);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadGraph(selectedTreeId);
  }, [selectedTreeId, loadGraph]);

  const personsById = useMemo(() => {
    const m = new Map<string, PersonRow>();
    for (const p of persons) m.set(p.id, p);
    return m;
  }, [persons]);

  const childByParent = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const rel of relations) {
      const cur = m.get(rel.parent_person_id) ?? [];
      cur.push(rel.child_person_id);
      m.set(rel.parent_person_id, cur);
    }
    return m;
  }, [relations]);

  const partnersByPerson = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const rel of partnerships) {
      if (!m.has(rel.person_a_id)) m.set(rel.person_a_id, new Set<string>());
      if (!m.has(rel.person_b_id)) m.set(rel.person_b_id, new Set<string>());
      m.get(rel.person_a_id)!.add(rel.person_b_id);
      m.get(rel.person_b_id)!.add(rel.person_a_id);
    }
    return m;
  }, [partnerships]);

  const parentIds = useMemo(() => new Set(relations.map((r) => r.parent_person_id)), [relations]);
  const childIds = useMemo(() => new Set(relations.map((r) => r.child_person_id)), [relations]);

  /**
   * Sakrij dupli čvor partnera po paru, zadržavajući "glavni" čvor:
   * prioritet ima onaj ko je dete u nekoj grani (ima roditelja),
   * zatim Janjić muškarac, zatim muškarac, pa broj dece.
   */
  const hiddenPartnerIds = useMemo(() => {
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
  }, [partnersByPerson, parentIds, childIds, personsById, childByParent]);

  const roots = useMemo(() => {
    if (!persons.length) return [];
    const childIds = new Set(relations.map((r) => r.child_person_id));
    const rootNodes = persons.filter((p) => !childIds.has(p.id) && !hiddenPartnerIds.has(p.id));
    if (rootNodes.length) return rootNodes;
    return persons.filter((p) => !hiddenPartnerIds.has(p.id));
  }, [persons, relations, hiddenPartnerIds]);

  function childrenFor(id: string) {
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

  const treeGraph = useMemo(() => {
    const nodes = new Map<
      string,
      {
        id: string;
        person: PersonRow;
        x: number;
        y: number;
        depth: number;
        partners: Array<{ id: string; person: PersonRow; label: string }>;
      }
    >();
    const edges: Array<{ from: string; to: string }> = [];
    let leafCursor = 0;

    function place(id: string, depth: number, stack: Set<string>): number {
      const p = personsById.get(id);
      if (hiddenPartnerIds.has(id)) return leafCursor++;
      if (!p || stack.has(id)) return leafCursor++;
      if (nodes.has(id)) return nodes.get(id)!.x;

      const nextStack = new Set(stack);
      nextStack.add(id);
      const children = childrenFor(id).filter((cid) => !nextStack.has(cid));
      const childXs = children.map((cid) => place(cid, depth + 1, nextStack));
      const x = childXs.length ? childXs.reduce((a, b) => a + b, 0) / childXs.length : leafCursor++;
      const partners = Array.from(partnersByPerson.get(id) ?? [])
        .map((pid) => personsById.get(pid))
        .filter((x): x is PersonRow => Boolean(x))
        .map((x) => ({ id: x.id, person: x, label: personLabel(x) }));

      nodes.set(id, { id, person: p, x, y: depth, depth, partners });
      for (const cid of children) edges.push({ from: id, to: cid });
      return x;
    }

    roots.forEach((r) => place(r.id, 0, new Set<string>()));
    return { nodes: Array.from(nodes.values()), edges };
  }, [roots, personsById, partnersByPerson, childByParent, hiddenPartnerIds]);

  const positionedGraph = useMemo(() => {
    const X_SPACING = 196;
    const Y_SPACING = PEDIGREE_CARD_H + PEDIGREE_CONNECTOR_STUB + 44;
    return {
      nodes: treeGraph.nodes.map((n) => ({
        ...n,
        sx: n.x * X_SPACING,
        sy: n.y * Y_SPACING,
      })),
      edges: treeGraph.edges,
    };
  }, [treeGraph]);

  const edgesByParent = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const e of positionedGraph.edges) {
      const cur = m.get(e.from) ?? [];
      cur.push(e.to);
      m.set(e.from, cur);
    }
    return m;
  }, [positionedGraph.edges]);

  const pedigreeViewBox = useMemo(() => {
    const nodes = positionedGraph.nodes;
    if (!nodes.length) return "0 0 980 520";
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.sx - PEDIGREE_HALF_W);
      maxX = Math.max(maxX, n.sx + PEDIGREE_HALF_W);
      minY = Math.min(minY, n.sy - PEDIGREE_HALF_H);
      maxY = Math.max(maxY, n.sy + PEDIGREE_HALF_H + PEDIGREE_CONNECTOR_STUB + 8);
    }
    const pad = 72;
    const w = maxX - minX + pad * 2;
    const h = maxY - minY + pad * 2;
    return `${minX - pad} ${minY - pad} ${w} ${h}`;
  }, [positionedGraph.nodes]);

  function onCanvasWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    const next = e.deltaY > 0 ? zoom * 0.92 : zoom * 1.08;
    setZoom(Math.max(0.35, Math.min(2.6, next)));
  }

  function onCanvasMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as Element;
    if (target.closest(".tree-node")) return;
    dragRef.current = { active: true, x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }

  function onCanvasMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setOffset({ x: dragRef.current.ox + dx, y: dragRef.current.oy + dy });
  }

  function onCanvasMouseUp() {
    dragRef.current.active = false;
  }

  function closeMemberPanel() {
    setSelectedMember(null);
    setMemberPanelPos(null);
    setMemberPanelMode("details");
    setActivitiesList([]);
    setActivitiesErr(null);
  }

  function openMemberPanelAtNode(
    node: { sx: number; sy: number },
    personId: string,
    mode: MemberPanelMode = "details"
  ) {
    const person = personsById.get(personId);
    if (!person) return;
    const wrap = canvasRef.current;
    if (wrap) {
      const panelX = offset.x + node.sx * zoom + PEDIGREE_HALF_W * 0.35 * zoom;
      const panelY = offset.y + node.sy * zoom - PEDIGREE_HALF_H * 0.4 * zoom;
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error: insErr } = await audit!.from("gr_family_trees").insert({
      name: name.trim(),
      slug: slug.trim() || null,
    });
    if (insErr) {
      setError(insErr.message);
      return;
    }
    setName("");
    setSlug("");
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Obrisati stablo? Svi članovi i veze u njemu biće obrisani (cascade).")) {
      return;
    }
    setError(null);
    const { error: delErr } = await audit!.from("gr_family_trees").delete().eq("id", id);
    if (delErr) setError(delErr.message);
    else await load();
  }

  const isStablo1 = variant === "stablo1";

  return (
    <div>
      {isStablo1 ? (
        <>
          <h1 style={{ marginTop: 0 }}>Stablo 1</h1>
          <p className="muted">
            Rodoslov odozgo nadole — kartice i stepenaste veze. Izbor stabla i isti paneli
            (Kontakt, detalji, aktivnosti) kao na stranici Stabla.
          </p>
        </>
      ) : (
        <>
          <h1 style={{ marginTop: 0 }}>Porodična stabla</h1>
          <p className="muted">
            Podrazumevano stablo iz migracije možete zadržati; dodatna stabla za druge
            grane porodice.
          </p>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Novo stablo</h2>
            <form className="row" onSubmit={(e) => void handleCreate(e)}>
              <label>
                Naziv
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label>
                Slug (opciono)
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="npr. janjici"
                />
              </label>
              <button className="primary" type="submit">
                Dodaj
              </button>
            </form>
          </div>
        </>
      )}

      {error ? <p className="error">{error}</p> : null}

      {!isStablo1 ? (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Lista</h2>
          <table>
            <thead>
              <tr>
                <th>Naziv</th>
                <th>Slug</th>
                <th>ID</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.slug ?? "—"}</td>
                  <td className="muted" style={{ fontSize: "0.75rem" }}>
                    {r.id}
                  </td>
                  <td>
                    <button type="button" className="danger" onClick={() => void handleDelete(r.id)}>
                      Obriši
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Prikaz stabla</h2>
        <label>
          Stablo za prikaz
          <select value={selectedTreeId} onChange={(e) => setSelectedTreeId(e.target.value)}>
            <option value="">— izaberite —</option>
            {rows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        {!selectedTreeId ? (
          <p className="muted">Izaberite stablo za prikaz.</p>
        ) : !persons.length ? (
          <p className="muted">Nema članova u izabranom stablu.</p>
        ) : (
          <>
            <div className="row" style={{ marginTop: "0.65rem" }}>
              <button type="button" onClick={() => setZoom((z) => Math.min(2.6, z * 1.12))}>
                +
              </button>
              <button type="button" onClick={() => setZoom((z) => Math.max(0.35, z * 0.88))}>
                -
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setOffset({ x: 90, y: 70 });
                  closeMemberPanel();
                }}
              >
                Reset prikaza
              </button>
              <span className="muted">Zoom: {Math.round(zoom * 100)}%</span>
            </div>

            <div
              ref={canvasRef}
              className="tree-canvas"
              onWheel={onCanvasWheel}
              onMouseDown={onCanvasMouseDown}
              onMouseMove={onCanvasMouseMove}
              onMouseUp={onCanvasMouseUp}
              onMouseLeave={onCanvasMouseUp}
            >
              <div className="tree-canvas-inner">
              <svg
                className="pedigree-svg"
                width="100%"
                viewBox={pedigreeViewBox}
                preserveAspectRatio="xMidYMid meet"
              >
                <g transform={`translate(${offset.x},${offset.y}) scale(${zoom})`}>
                  {Array.from(edgesByParent.entries()).map(([fromId, toIds]) => {
                    const parent = positionedGraph.nodes.find((n) => n.id === fromId);
                    if (!parent) return null;
                    const kids = toIds
                      .map((tid) => positionedGraph.nodes.find((n) => n.id === tid))
                      .filter((n): n is (typeof positionedGraph.nodes)[0] => Boolean(n));
                    if (!kids.length) return null;
                    const d = orthConnectors(parent.sx, parent.sy, kids, PEDIGREE_HALF_H);
                    return (
                      <path
                        key={`fork-${fromId}`}
                        d={d}
                        fill="none"
                        stroke="#cbd5e1"
                        strokeWidth="1.75"
                        className="pedigree-connector"
                      />
                    );
                  })}

                  {positionedGraph.nodes.map((node) => {
                    const accent = pedigreeAccent(node.depth);
                    const { first, second } = primaryPairForNode(node);
                    const kSnip = karijeraTreeSnippet(first.person.karijera, 40);
                    const life1 = personLifeLine(first.person);
                    const life2 = second ? personLifeLine(second.person) : "";
                    return (
                      <g
                        key={node.id}
                        className="tree-node pedigree-node"
                        transform={`translate(${node.sx},${node.sy})`}
                        onClick={(e) => {
                          e.stopPropagation();
                          openMemberPanelAtNode(node, node.id, "kontakt-menu");
                        }}
                      >
                        <rect
                          x={-PEDIGREE_HALF_W}
                          y={-PEDIGREE_HALF_H}
                          width={PEDIGREE_CARD_W}
                          height={PEDIGREE_CARD_H}
                          fill="#ffffff"
                          stroke="#e2e8f0"
                          strokeWidth="1"
                        />
                        <rect
                          x={-PEDIGREE_HALF_W}
                          y={-PEDIGREE_HALF_H}
                          width={PEDIGREE_CARD_W}
                          height="5"
                          fill={accent}
                        />
                        <text
                          y={-PEDIGREE_HALF_H + 24}
                          textAnchor="middle"
                          fill="#0f172a"
                          fontSize="12.5"
                          fontWeight="700"
                          style={{ cursor: "pointer" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openMemberPanelAtNode(node, first.id, "kontakt-menu");
                          }}
                        >
                          <title>{first.label}</title>
                          {first.label.length > 22 ? `${first.label.slice(0, 21)}…` : first.label}
                        </text>
                        {second ? (
                          <text
                            y={-PEDIGREE_HALF_H + 40}
                            textAnchor="middle"
                            fill="#475569"
                            fontSize="11"
                            fontStyle="italic"
                            fontWeight="600"
                            style={{ cursor: "pointer" }}
                            onClick={(e) => {
                              e.stopPropagation();
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
                          y={-PEDIGREE_HALF_H + (second ? 56 : 44)}
                          textAnchor="middle"
                          fill="#64748b"
                          fontSize="10.5"
                          fontWeight="500"
                          style={{ cursor: "pointer" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openMemberPanelAtNode(node, first.id, "kontakt-menu");
                          }}
                        >
                          <title>
                            {second ? `${life1} / ${life2}` : life1}
                          </title>
                          {second ? `${life1} · ${life2}` : life1}
                        </text>
                        {kSnip ? (
                          <text
                            y={-PEDIGREE_HALF_H + (second ? 72 : 60)}
                            textAnchor="middle"
                            fill="#64748b"
                            fontSize="9"
                            fontWeight="500"
                            style={{ cursor: "pointer" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openMemberPanelAtNode(node, first.id, "kontakt-menu");
                            }}
                          >
                            <title>{first.person.karijera?.trim() ?? ""}</title>
                            {kSnip}
                          </text>
                        ) : null}
                        <text
                          y={-PEDIGREE_HALF_H + (second ? (kSnip ? 86 : 78) : kSnip ? 74 : 62)}
                          textAnchor="middle"
                          fill="#2563eb"
                          fontSize="10"
                          fontWeight="600"
                          textDecoration="underline"
                          style={{ cursor: "pointer" }}
                          onClick={(e) => {
                            e.stopPropagation();
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
                                {a.opis?.trim() ? (
                                  <p className="member-tree-activity-opis">{a.opis}</p>
                                ) : null}
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
          </>
        )}
      </div>
    </div>
  );
}
