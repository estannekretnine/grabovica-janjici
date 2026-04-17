import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { audit, supabase } from "../lib/supabase";
import type { Database } from "../types/database";

type TreeRow = Database["audit"]["Tables"]["gr_family_trees"]["Row"];
type PersonRow = Database["audit"]["Tables"]["gr_persons"]["Row"];
type PcRow = Database["audit"]["Tables"]["gr_parent_child"]["Row"];
type PartRow = Database["audit"]["Tables"]["gr_partnerships"]["Row"];

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

export function TreesPage() {
  const [rows, setRows] = useState<TreeRow[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [selectedTreeId, setSelectedTreeId] = useState("");
  const [persons, setPersons] = useState<PersonRow[]>([]);
  const [relations, setRelations] = useState<PcRow[]>([]);
  const [partnerships, setPartnerships] = useState<PartRow[]>([]);
  const [selectedMember, setSelectedMember] = useState<PersonRow | null>(null);
  const [memberPanelPos, setMemberPanelPos] = useState<{ x: number; y: number } | null>(null);
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
    const { data: people, error: pErr } = await audit!
      .from("gr_persons")
      .select("*")
      .eq("tree_id", treeId)
      .order("last_name")
      .order("first_name");
    if (pErr) {
      setError(pErr.message);
      return;
    }
    const p = people ?? [];
    setPersons(p);
    if (!p.length) {
      setRelations([]);
      return;
    }
    const ids = p.map((x) => x.id);
    const { data: rel, error: rErr } = await audit!
      .from("gr_parent_child")
      .select("*")
      .in("parent_person_id", ids)
      .in("child_person_id", ids);
    if (rErr) {
      setError(rErr.message);
      return;
    }
    setRelations(rel ?? []);

    const { data: parts, error: paErr } = await audit!
      .from("gr_partnerships")
      .select("*")
      .in("person_a_id", ids)
      .in("person_b_id", ids);
    if (paErr) {
      setError(paErr.message);
      return;
    }
    setPartnerships(parts ?? []);
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
    const X_SPACING = 170;
    const Y_SPACING = 150;
    return {
      nodes: treeGraph.nodes.map((n) => ({
        ...n,
        sx: n.x * X_SPACING,
        sy: n.y * Y_SPACING,
      })),
      edges: treeGraph.edges,
    };
  }, [treeGraph]);

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

  function openMemberCardAtNode(node: { sx: number; sy: number }, personId: string) {
    const person = personsById.get(personId);
    if (!person) return;
    const wrap = canvasRef.current;
    if (wrap) {
      const panelX = offset.x + node.sx * zoom + 34;
      const panelY = offset.y + node.sy * zoom - 12;
      const maxX = Math.max(12, wrap.clientWidth - 320);
      const maxY = Math.max(12, wrap.clientHeight - 220);
      setMemberPanelPos({
        x: Math.max(12, Math.min(maxX, panelX)),
        y: Math.max(12, Math.min(maxY, panelY)),
      });
    }
    setSelectedMember(person);
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

  return (
    <div>
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

      {error ? <p className="error">{error}</p> : null}

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
                  setSelectedMember(null);
                  setMemberPanelPos(null);
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
              <svg width="100%" height="560" viewBox="0 0 1400 560">
                <g transform={`translate(${offset.x},${offset.y}) scale(${zoom})`}>
                  {positionedGraph.edges.map((edge, idx) => {
                    const a = positionedGraph.nodes.find((n) => n.id === edge.from);
                    const b = positionedGraph.nodes.find((n) => n.id === edge.to);
                    if (!a || !b) return null;
                    return (
                      <line
                        key={`${edge.from}-${edge.to}-${idx}`}
                        x1={a.sx}
                        y1={a.sy + 22}
                        x2={b.sx}
                        y2={b.sy - 22}
                        stroke="#94a3b8"
                        strokeWidth="2"
                      />
                    );
                  })}

                  {positionedGraph.nodes.map((node) => (
                    <g
                      key={node.id}
                      transform={`translate(${node.sx},${node.sy})`}
                      className="tree-node"
                      onClick={(e) => {
                        e.stopPropagation();
                        openMemberCardAtNode(node, node.id);
                      }}
                    >
                      <circle r="24" fill="#1d4ed8" />
                      <text y="5" textAnchor="middle" fill="#fff" fontSize="11">
                        {node.person.first_name?.slice(0, 1) || "?"}
                      </text>
                      {(() => {
                        const firstPartner = node.partners[0] ?? null;
                        const pair = firstPartner
                          ? [
                              { id: node.id, person: node.person, label: personLabel(node.person) },
                              firstPartner,
                            ]
                          : [{ id: node.id, person: node.person, label: personLabel(node.person) }];

                        const male = pair.find((m) => m.person.gender === "male") ?? null;
                        const female = pair.find((m) => m.person.gender === "female") ?? null;

                        let first = pair[0];
                        let second = pair[1] ?? null;
                        if (male && second) {
                          if (isJanjicSurname(male.person.last_name)) {
                            first = male;
                            second = pair.find((x) => x.id !== male.id) ?? second;
                          } else if (female) {
                            first = female;
                            second = pair.find((x) => x.id !== female.id) ?? second;
                          }
                        }

                        return (
                          <>
                            <text
                              y="44"
                              textAnchor="middle"
                              fill="#0f172a"
                              fontSize="12"
                              fontWeight={second ? "700" : "600"}
                              fontStyle="normal"
                              textDecoration="underline"
                              style={{ cursor: "pointer" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                openMemberCardAtNode(node, first.id);
                              }}
                            >
                              {first.label}
                            </text>
                            {second ? (
                              <text y="60" textAnchor="middle" fill="#475569" fontSize="11">
                                <tspan>+ </tspan>
                                <tspan
                                  style={{ cursor: "pointer" }}
                                  fontWeight="500"
                                  fontStyle="italic"
                                  textDecoration="underline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openMemberCardAtNode(node, second.id);
                                  }}
                                >
                                  {second.label}
                                </tspan>
                              </text>
                            ) : null}
                          </>
                        );
                      })()}
                    </g>
                  ))}
                </g>
              </svg>

              {selectedMember && memberPanelPos ? (
                <aside
                  className="member-popover"
                  style={{ left: memberPanelPos.x, top: memberPanelPos.y }}
                >
                  <div className="member-popover-head">
                    <strong>{personLabel(selectedMember)}</strong>
                    <button
                      type="button"
                      className="member-popover-close"
                      onClick={() => {
                        setSelectedMember(null);
                        setMemberPanelPos(null);
                      }}
                    >
                      x
                    </button>
                  </div>
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
                      {selectedMember.is_living == null ? "—" : selectedMember.is_living ? "da" : "ne"}
                    </span>
                    <span>Napomene</span>
                    <span>{selectedMember.notes ?? "—"}</span>
                  </div>
                </aside>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
