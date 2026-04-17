import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { audit } from "../lib/supabase";
import type { Database } from "../types/database";

type TreeRow = Database["audit"]["Tables"]["gr_family_trees"]["Row"];
type PersonRow = Database["audit"]["Tables"]["gr_persons"]["Row"];
type PcRow = Database["audit"]["Tables"]["gr_parent_child"]["Row"];
type PartRow = Database["audit"]["Tables"]["gr_partnerships"]["Row"];

function personLabel(p: Pick<PersonRow, "first_name" | "last_name">) {
  const full = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
  return full || "(bez imena)";
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
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 90, y: 70 });
  const [error, setError] = useState<string | null>(null);
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

  const roots = useMemo(() => {
    if (!persons.length) return [];
    const childIds = new Set(relations.map((r) => r.child_person_id));
    const rootNodes = persons.filter((p) => !childIds.has(p.id));
    if (rootNodes.length) return rootNodes;
    return persons;
  }, [persons, relations]);

  function childrenFor(id: string) {
    const partnerIds = Array.from(partnersByPerson.get(id) ?? []);
    const childrenSet = new Set<string>();
    for (const pid of [id, ...partnerIds]) {
      for (const c of childByParent.get(pid) ?? []) {
        childrenSet.add(c);
      }
    }
    return Array.from(childrenSet);
  }

  const treeGraph = useMemo(() => {
    const nodes = new Map<
      string,
      { id: string; person: PersonRow; x: number; y: number; depth: number; partners: string[] }
    >();
    const edges: Array<{ from: string; to: string }> = [];
    let leafCursor = 0;

    function place(id: string, depth: number, stack: Set<string>): number {
      const p = personsById.get(id);
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
        .map((x) => personLabel(x));

      nodes.set(id, { id, person: p, x, y: depth, depth, partners });
      for (const cid of children) edges.push({ from: id, to: cid });
      return x;
    }

    roots.forEach((r) => place(r.id, 0, new Set<string>()));
    return { nodes: Array.from(nodes.values()), edges };
  }, [roots, personsById, partnersByPerson, childByParent]);

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
                }}
              >
                Reset prikaza
              </button>
              <span className="muted">Zoom: {Math.round(zoom * 100)}%</span>
            </div>

            <div
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
                      onClick={() => setSelectedMember(node.person)}
                    >
                      <circle r="24" fill="#1d4ed8" />
                      <text y="5" textAnchor="middle" fill="#fff" fontSize="11">
                        {node.person.first_name?.slice(0, 1) || "?"}
                      </text>
                      <text y="44" textAnchor="middle" fill="#0f172a" fontSize="12" fontWeight="600">
                        {personLabel(node.person)}
                      </text>
                      {node.partners.length ? (
                        <text y="60" textAnchor="middle" fill="#475569" fontSize="11">
                          + {node.partners.join(", ")}
                        </text>
                      ) : null}
                    </g>
                  ))}
                </g>
              </svg>
            </div>

            {selectedMember ? (
              <div className="card" style={{ marginTop: "0.8rem" }}>
                <h3 style={{ marginTop: 0 }}>Član</h3>
                <p><strong>Ime i prezime:</strong> {personLabel(selectedMember)}</p>
                <p><strong>Pol:</strong> {selectedMember.gender ?? "—"}</p>
                <p><strong>Rođen/a:</strong> {selectedMember.birth_date ?? "—"}</p>
                <p><strong>Živ/živa:</strong> {selectedMember.is_living == null ? "—" : selectedMember.is_living ? "da" : "ne"}</p>
                <p><strong>Napomene:</strong> {selectedMember.notes ?? "—"}</p>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
