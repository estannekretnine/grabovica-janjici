import { useCallback, useEffect, useMemo, useState } from "react";
import { loadFamilyGraph, type PersonRow, type PcRow } from "../lib/familyTreeGraphLoad";
import { DEFAULT_TREE_ID } from "../constants";

const MAX_GENERATIONS = 10;

type FanSegment = {
  id: string;
  generation: number;
  t0: number;
  t1: number;
};

function personLabel(p: Pick<PersonRow, "first_name" | "last_name">) {
  const full = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
  return full || "(bez imena)";
}

/** Uglovi u radijanima: 0 = sever, raste u smeru kazaljke na satu (gledano odozgo). */
function polar(cx: number, cy: number, r: number, t: number) {
  return {
    x: cx + r * Math.sin(t),
    y: cy - r * Math.cos(t),
  };
}

/** Luk na spoljašnjem ili unutrašnjem krugu od t0 do t1 (t1 > t0, razlika ≤ 2π). */
function ringArcPath(cx: number, cy: number, r: number, t0: number, t1: number, sweepClockwise: boolean) {
  const large = t1 - t0 > Math.PI ? 1 : 0;
  const sweep = sweepClockwise ? 1 : 0;
  const p0 = polar(cx, cy, r, t0);
  const p1 = polar(cx, cy, r, t1);
  return `A ${r} ${r} 0 ${large} ${sweep} ${p1.x} ${p1.y}`;
}

/** Segment prstena (anulus) između t0 i t1. */
function annulusWedgePath(cx: number, cy: number, rInner: number, rOuter: number, t0: number, t1: number) {
  const pOut0 = polar(cx, cy, rOuter, t0);
  const pOut1 = polar(cx, cy, rOuter, t1);
  const pIn1 = polar(cx, cy, rInner, t1);
  const pIn0 = polar(cx, cy, rInner, t0);
  const outerArc = ringArcPath(cx, cy, rOuter, t0, t1, true);
  const innerArc = ringArcPath(cx, cy, rInner, t1, t0, false);
  return `M ${pOut0.x} ${pOut0.y} ${outerArc} L ${pIn1.x} ${pIn1.y} ${innerArc} L ${pOut0.x} ${pOut0.y} Z`;
}

function buildParentsByChild(relations: PcRow[], personIds: Set<string>) {
  const m = new Map<string, string[]>();
  for (const rel of relations) {
    if (!personIds.has(rel.child_person_id) || !personIds.has(rel.parent_person_id)) continue;
    const cur = m.get(rel.child_person_id) ?? [];
    if (!cur.includes(rel.parent_person_id)) cur.push(rel.parent_person_id);
    m.set(rel.child_person_id, cur);
  }
  return m;
}

function layoutFanSegments(
  personId: string,
  generation: number,
  t0: number,
  t1: number,
  stack: Set<string>,
  parentsByChild: Map<string, string[]>,
  maxGen: number
): FanSegment[] {
  if (stack.has(personId)) {
    return [{ id: personId, generation, t0, t1 }];
  }
  const next = new Set(stack);
  next.add(personId);
  const out: FanSegment[] = [{ id: personId, generation, t0, t1 }];
  if (generation >= maxGen) return out;
  const parents = parentsByChild.get(personId) ?? [];
  if (!parents.length) return out;
  const span = t1 - t0;
  const step = span / parents.length;
  for (let i = 0; i < parents.length; i++) {
    const a0 = t0 + i * step;
    const a1 = t0 + (i + 1) * step;
    out.push(
      ...layoutFanSegments(parents[i]!, generation + 1, a0, a1, next, parentsByChild, maxGen)
    );
  }
  return out;
}

function radiusForGeneration(gen: number): { inner: number; outer: number } {
  const centerR = 44;
  const ring = 78;
  if (gen <= 0) return { inner: 0, outer: centerR };
  const inner = centerR + (gen - 1) * ring;
  const outer = centerR + gen * ring;
  return { inner, outer };
}

function wedgeFill(gen: number) {
  if (gen <= 0) return "#2563eb";
  return gen % 2 === 1 ? "#e8eef5" : "#f1f5f9";
}

export function Stablo1FanPage() {
  const [persons, setPersons] = useState<PersonRow[]>([]);
  const [relations, setRelations] = useState<PcRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [egoId, setEgoId] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: gErr } = await loadFamilyGraph(DEFAULT_TREE_ID);
    setError(gErr);
    setPersons(data.persons);
    setRelations(data.relations);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const personsById = useMemo(() => {
    const m = new Map<string, PersonRow>();
    for (const p of persons) m.set(p.id, p);
    return m;
  }, [persons]);

  const personIdSet = useMemo(() => new Set(persons.map((p) => p.id)), [persons]);

  const parentsByChild = useMemo(
    () => buildParentsByChild(relations, personIdSet),
    [relations, personIdSet]
  );

  useEffect(() => {
    if (!persons.length) {
      setEgoId("");
      return;
    }
    const withParent = persons.find((p) => (parentsByChild.get(p.id) ?? []).length > 0);
    const pick = withParent ?? persons[0];
    setEgoId((prev) => (prev && persons.some((x) => x.id === prev) ? prev : pick!.id));
  }, [persons, parentsByChild]);

  const segments = useMemo(() => {
    if (!egoId) return [];
    return layoutFanSegments(egoId, 0, 0, Math.PI * 2, new Set(), parentsByChild, MAX_GENERATIONS);
  }, [egoId, parentsByChild]);

  const truncatedNote = segments.some(
    (s) =>
      s.generation >= MAX_GENERATIONS && (parentsByChild.get(s.id) ?? []).length > 0
  );

  const cx = 0;
  const cy = 0;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Stablo 1 — lepeza pretka</h1>
      <p className="muted">
        Prikaz pretka oko izabrane osobe za glavno stablo (podrazumevani ID iz migracije).
      </p>

      {error ? <p className="error">{error}</p> : null}

      {loading ? (
        <p className="muted">Učitavanje…</p>
      ) : !persons.length ? (
        <p className="muted">Nema članova u podrazumevanom stablu.</p>
      ) : (
        <div className="card fan-chart-card">
          <label className="fan-chart-label">
            Osoba u centru (ego)
            <select value={egoId} onChange={(e) => setEgoId(e.target.value)} className="fan-chart-select">
              {persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {personLabel(p)}
                </option>
              ))}
            </select>
          </label>
          {truncatedNote ? (
            <p className="muted fan-chart-note">
              Prikazano je najviše {MAX_GENERATIONS} generacija unazad.
            </p>
          ) : null}

          <div className="fan-chart-wrap">
            <svg className="fan-chart-svg" viewBox="-520 -520 1040 1040" role="img" aria-label="Lepeza pretka">
              {segments.map((s, idx) => {
                const p = personsById.get(s.id);
                const label = p ? personLabel(p) : s.id;
                const { inner, outer } = radiusForGeneration(s.generation);
                const midT = (s.t0 + s.t1) / 2;
                const midR = s.generation === 0 ? outer * 0.55 : (inner + outer) / 2;
                const lp = polar(cx, cy, midR, midT);
                const arcSpan = s.t1 - s.t0;
                const maxChars = Math.max(4, Math.floor(arcSpan * midR / 9));
                const shortLabel =
                  label.length > maxChars && maxChars > 3 ? `${label.slice(0, maxChars - 1)}…` : label;

                if (s.generation === 0) {
                  return (
                    <g key={`${s.id}-ego`}>
                      <circle cx={cx} cy={cy} r={outer} fill="#2563eb" stroke="#1e3a8a" strokeWidth="2" />
                      <text
                        x={cx}
                        y={cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#fff"
                        fontSize={outer > 36 ? 13 : 11}
                        fontWeight="700"
                      >
                        {shortLabel}
                      </text>
                    </g>
                  );
                }

                const d = annulusWedgePath(cx, cy, inner, outer, s.t0, s.t1);
                const rotDeg = ((midT * 180) / Math.PI) % 360;
                const useRotate = arcSpan < 0.35;

                return (
                  <g key={`${s.id}-${s.generation}-${idx}`}>
                    <path
                      d={d}
                      fill={wedgeFill(s.generation)}
                      stroke="#94a3b8"
                      strokeWidth="1"
                    />
                    {useRotate ? (
                      <text
                        x={lp.x}
                        y={lp.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#0f172a"
                        fontSize={10}
                        fontWeight="600"
                        transform={`rotate(${rotDeg}, ${lp.x}, ${lp.y})`}
                      >
                        {shortLabel}
                      </text>
                    ) : (
                      <text
                        x={lp.x}
                        y={lp.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#0f172a"
                        fontSize={11}
                        fontWeight="600"
                      >
                        {shortLabel}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
