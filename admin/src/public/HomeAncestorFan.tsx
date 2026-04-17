import { useMemo } from "react";
import type { PersonRow } from "../lib/familyTreeGraphLoad";
import type { PcRow } from "../lib/familyTreeGraphLoad";
import { buildAncestorLevels, lifeLineShort, personPublicLabel } from "../lib/homeAncestorTree";

type Props = {
  rootId: string;
  persons: PersonRow[];
  relations: Pick<PcRow, "parent_person_id" | "child_person_id">[];
};

const NODE_W = 138;
const NODE_H = 50;
const LAYER_GAP = 86;
const TOP_PAD = 28;
const SIDE_PAD = 20;
const BOTTOM_PAD = 28;

function layoutFan(levels: string[][], viewW: number, viewH: number) {
  const pos = new Map<string, { x: number; y: number }>();
  const bottomY = viewH - BOTTOM_PAD - NODE_H;
  const innerW = viewW - 2 * SIDE_PAD;

  levels.forEach((ids, levelIdx) => {
    const n = ids.length;
    const y = bottomY - levelIdx * LAYER_GAP;
    const slotW = n > 0 ? innerW / n : innerW;
    ids.forEach((id, j) => {
      const x = SIDE_PAD + j * slotW + (slotW - NODE_W) / 2;
      pos.set(id, { x, y });
    });
  });
  return pos;
}

export function HomeAncestorFan({ rootId, persons, relations }: Props) {
  const personsById = useMemo(() => {
    const m = new Map<string, PersonRow>();
    for (const p of persons) m.set(p.id, p);
    return m;
  }, [persons]);

  const levels = useMemo(
    () => buildAncestorLevels(rootId, relations, personsById),
    [rootId, relations, personsById]
  );

  const viewW = 720;
  const viewH = Math.max(260, TOP_PAD + BOTTOM_PAD + NODE_H + levels.length * LAYER_GAP);

  const pos = useMemo(() => layoutFan(levels, viewW, viewH), [levels, viewW, viewH]);

  const parentsInNextLevel = useMemo(() => {
    const nextLevelHas = levels.map((lev) => new Set(lev));
    const map = new Map<string, string[]>();
    for (let lev = 0; lev < levels.length - 1; lev++) {
      const nextSet = nextLevelHas[lev + 1];
      for (const childId of levels[lev]) {
        const pids = relations
          .filter((r) => r.child_person_id === childId && nextSet.has(r.parent_person_id))
          .map((r) => r.parent_person_id);
        const uniq = [...new Set(pids)];
        if (uniq.length) map.set(childId, uniq);
      }
    }
    return map;
  }, [levels, relations]);

  const edges = useMemo(() => {
    const out: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let lev = 0; lev < levels.length - 1; lev++) {
      for (const childId of levels[lev]) {
        const pChild = pos.get(childId);
        if (!pChild) continue;
        const cx = pChild.x + NODE_W / 2;
        const yTop = pChild.y;
        const parents = parentsInNextLevel.get(childId) ?? [];
        for (const pid of parents) {
          const pPar = pos.get(pid);
          if (!pPar) continue;
          const px = pPar.x + NODE_W / 2;
          const yBot = pPar.y + NODE_H;
          out.push({ x1: cx, y1: yTop, x2: px, y2: yBot });
        }
      }
    }
    return out;
  }, [levels, pos, parentsInNextLevel]);

  return (
    <div className="public-home-fan">
      <svg
        className="public-home-fan-svg"
        viewBox={`0 0 ${viewW} ${viewH}`}
        width="100%"
        height={viewH}
        role="img"
        aria-label="Stablo predaka od izabranog člana naviše"
      >
        {levels[0]?.[0]
          ? (() => {
              const r = pos.get(levels[0][0]!);
              if (!r) return null;
              const h = Math.max(10, viewH - (r.y + NODE_H) - 6);
              return (
                <rect
                  x={r.x + NODE_W / 2 - 10}
                  y={r.y + NODE_H}
                  width={20}
                  height={h}
                  rx={4}
                  className="public-home-fan-trunk"
                />
              );
            })()
          : null}

        {edges.map((e, i) => (
          <line
            key={`e-${i}`}
            x1={e.x1}
            y1={e.y1}
            x2={e.x2}
            y2={e.y2}
            className="public-home-fan-branch"
          />
        ))}

        {levels.flatMap((ids) =>
          ids.map((id) => {
            const p = pos.get(id);
            const person = personsById.get(id);
            if (!p || !person) return null;
            const isRoot = id === rootId;
            const name = personPublicLabel(person);
            const life = lifeLineShort(person);
            const nameShort = name.length > 26 ? `${name.slice(0, 24)}…` : name;
            return (
              <g key={id} transform={`translate(${p.x},${p.y})`}>
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={6}
                  className={`public-home-fan-node${isRoot ? " public-home-fan-node--root" : ""}`}
                />
                <text x={NODE_W / 2} y={21} textAnchor="middle" className="public-home-fan-name">
                  {nameShort}
                </text>
                <text x={NODE_W / 2} y={39} textAnchor="middle" className="public-home-fan-life">
                  {life.length > 32 ? `${life.slice(0, 30)}…` : life}
                </text>
              </g>
            );
          })
        )}
      </svg>
    </div>
  );
}
