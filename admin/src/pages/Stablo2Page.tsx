import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadFamilyGraph, type PcRow, type PersonRow } from "../lib/familyTreeGraphLoad";
import { PUBLIC_FAMILY_TREE_ID } from "../lib/publicFamilyTree";

const NODE_WIDTH = 130;
const NODE_HEIGHT = 34;
const COL_GAP = 60;
const ROW_GAP = 14;

type Positioned = {
  id: string;
  person: PersonRow;
  x: number;
  y: number;
  depth: number;
};

function personLabel(p: PersonRow): string {
  const first = (p.first_name ?? "").trim();
  const middle = (p.middle_name ?? "").trim();
  if (first && middle) return `${first} (${middle})`;
  return first || middle || "(bez imena)";
}

function computeLayout(persons: PersonRow[], relations: PcRow[]) {
  const byId = new Map<string, PersonRow>();
  for (const p of persons) byId.set(p.id, p);

  const childrenOf = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const r of relations) {
    if (!byId.has(r.parent_person_id) || !byId.has(r.child_person_id)) continue;
    const arr = childrenOf.get(r.parent_person_id) ?? [];
    arr.push(r.child_person_id);
    childrenOf.set(r.parent_person_id, arr);
    hasParent.add(r.child_person_id);
  }

  const roots = persons
    .filter((p) => !hasParent.has(p.id))
    .map((p) => p.id)
    .sort((a, b) => {
      const fa = byId.get(a)?.first_name ?? "";
      const fb = byId.get(b)?.first_name ?? "";
      return fa.localeCompare(fb, "sr");
    });

  const positions = new Map<string, Positioned>();
  let nextRow = 0;

  function assign(personId: string, depth: number): number {
    const person = byId.get(personId);
    if (!person) return nextRow;
    const children = (childrenOf.get(personId) ?? []).slice();

    let y: number;
    if (children.length === 0) {
      y = nextRow * (NODE_HEIGHT + ROW_GAP);
      nextRow += 1;
    } else {
      const childYs: number[] = [];
      for (const childId of children) {
        const cy = assign(childId, depth + 1);
        childYs.push(cy);
      }
      const first = childYs[0] ?? 0;
      const last = childYs[childYs.length - 1] ?? first;
      y = (first + last) / 2;
    }

    positions.set(personId, {
      id: personId,
      person,
      x: depth * (NODE_WIDTH + COL_GAP),
      y,
      depth,
    });

    return y;
  }

  for (const rootId of roots) {
    assign(rootId, 0);
  }

  for (const p of persons) {
    if (!positions.has(p.id)) {
      const y = nextRow * (NODE_HEIGHT + ROW_GAP);
      nextRow += 1;
      positions.set(p.id, { id: p.id, person: p, x: 0, y, depth: 0 });
    }
  }

  const edges: Array<{ from: string; to: string }> = [];
  for (const r of relations) {
    if (positions.has(r.parent_person_id) && positions.has(r.child_person_id)) {
      edges.push({ from: r.parent_person_id, to: r.child_person_id });
    }
  }

  const allNodes = Array.from(positions.values());
  const maxX = allNodes.reduce((m, n) => Math.max(m, n.x + NODE_WIDTH), 0);
  const maxY = allNodes.reduce((m, n) => Math.max(m, n.y + NODE_HEIGHT), 0);

  return { nodes: allNodes, edges, width: maxX, height: maxY };
}

export function Stablo2Page() {
  const [persons, setPersons] = useState<PersonRow[]>([]);
  const [relations, setRelations] = useState<PcRow[]>([]);
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

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await loadFamilyGraph(PUBLIC_FAMILY_TREE_ID);
    if (err) setError(err);
    else setError(null);
    setPersons(data.persons);
    setRelations(data.relations);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const layout = useMemo(() => computeLayout(persons, relations), [persons, relations]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
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
    const m = new Map<string, Positioned>();
    for (const n of layout.nodes) m.set(n.id, n);
    return m;
  }, [layout.nodes]);

  const generationStats = useMemo(() => {
    const counts = new Map<number, number>();
    for (const n of layout.nodes) {
      counts.set(n.depth, (counts.get(n.depth) ?? 0) + 1);
    }
    const depths = Array.from(counts.keys()).sort((a, b) => a - b);
    return depths.map((depth) => ({ depth, count: counts.get(depth) ?? 0 }));
  }, [layout.nodes]);

  const totalMembers = layout.nodes.length;
  const GEN_LABEL_HEIGHT = 28;

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
              {generationStats
                .map((g) => `${g.depth + 1}. koleno: ${g.count}`)
                .join(" · ")}
            </p>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button type="button" onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}>
            −
          </button>
          <span style={{ minWidth: 48, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))}>
            +
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setOffset({ x: 40, y: 40 });
            }}
          >
            Reset
          </button>
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
          }}
        >
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
              const cx = g.depth * (NODE_WIDTH + COL_GAP) + NODE_WIDTH / 2;
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
              const x1 = a.x + NODE_WIDTH;
              const y1 = a.y + NODE_HEIGHT / 2;
              const x2 = b.x;
              const y2 = b.y + NODE_HEIGHT / 2;
              const mx = x1 + (x2 - x1) / 2;
              const d = `M ${x1} ${y1} H ${mx} V ${y2} H ${x2}`;
              return <path key={i} d={d} stroke="#6b5a3a" strokeWidth={1.2} fill="none" />;
            })}

            {layout.nodes.map((n) => (
              <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
                <rect
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={NODE_HEIGHT / 2}
                  ry={NODE_HEIGHT / 2}
                  fill="#fffdf6"
                  stroke="#4a3c24"
                  strokeWidth={1.2}
                />
                <text
                  x={NODE_WIDTH / 2}
                  y={NODE_HEIGHT / 2 + 4}
                  textAnchor="middle"
                  fontSize={14}
                  fontWeight={700}
                  fontFamily="Georgia, 'Times New Roman', serif"
                  fill="#1a1407"
                >
                  {personLabel(n.person)}
                </text>
              </g>
            ))}
            </g>
          </svg>
        </div>
      ) : null}

      <p className="muted" style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
        Navigacija: prevuci mišem za pomeranje · Ctrl+točkić ili dugmad za zoom.
      </p>
    </div>
  );
}
