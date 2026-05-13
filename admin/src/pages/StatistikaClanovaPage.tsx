import { useCallback, useEffect, useMemo, useState } from "react";
import { audit, supabase } from "../lib/supabase";
import { ensureDefaultTreeExists } from "../lib/ensureDefaultTree";
import { DEFAULT_TREE_ID } from "../constants";
import type { Database, ZanimanjeEntry } from "../types/database";

type PersonRow = Pick<
  Database["audit"]["Tables"]["gr_persons"]["Row"],
  "id" | "tree_id" | "skolskaspremaid" | "fakultetid" | "zanimanja"
>;
type TreeRow = Database["audit"]["Tables"]["gr_family_trees"]["Row"];
type SkolskaSpremaRow = Database["public"]["Tables"]["skolskasprema"]["Row"];
type ZanimanjeRow = Database["public"]["Tables"]["zanimanje"]["Row"];
type FakultetRow = Database["public"]["Tables"]["fakultet"]["Row"];

type CountRow = { key: string; label: string; count: number };

function normalizeZanimanja(raw: unknown): ZanimanjeEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row): ZanimanjeEntry | null => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const idRaw = r.zanimanjeid;
      const id =
        typeof idRaw === "number"
          ? idRaw
          : typeof idRaw === "string" && idRaw.trim()
            ? Number(idRaw)
            : null;
      return {
        zanimanjeid: id == null || Number.isNaN(id) ? null : id,
        datum_od: typeof r.datum_od === "string" && r.datum_od ? r.datum_od : null,
        datum_do: typeof r.datum_do === "string" && r.datum_do ? r.datum_do : null,
        napomena: typeof r.napomena === "string" && r.napomena ? r.napomena : null,
      };
    })
    .filter((x): x is ZanimanjeEntry => x !== null);
}

function mapToSortedRows(map: Map<string, CountRow>): CountRow[] {
  return [...map.values()].sort((a, b) =>
    a.label.localeCompare(b.label, "sr-Latn", { sensitivity: "base" }),
  );
}

function sumCounts(rows: CountRow[]): number {
  return rows.reduce((s, r) => s + r.count, 0);
}

export function StatistikaClanovaPage() {
  const [trees, setTrees] = useState<TreeRow[]>([]);
  const [treeId, setTreeId] = useState(DEFAULT_TREE_ID);
  const [persons, setPersons] = useState<PersonRow[]>([]);
  const [skolskeSpreme, setSkolskeSpreme] = useState<SkolskaSpremaRow[]>([]);
  const [fakulteti, setFakulteti] = useState<FakultetRow[]>([]);
  const [zanimanjaRef, setZanimanjaRef] = useState<ZanimanjeRow[]>([]);
  const [secSkolska, setSecSkolska] = useState(true);
  const [secFakultet, setSecFakultet] = useState(true);
  const [secZanimanje, setSecZanimanje] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTrees = useCallback(async () => {
    const { data } = await audit!.from("gr_family_trees").select("*").order("name");
    setTrees(data ?? []);
  }, []);

  const loadRefs = useCallback(async () => {
    if (!supabase) return;
    const [ssRes, faRes, zaRes] = await Promise.all([
      supabase.from("skolskasprema").select("*").order("opis", { ascending: true }),
      supabase.from("fakultet").select("*").order("naziv", { ascending: true }),
      supabase.from("zanimanje").select("*").order("opis", { ascending: true }),
    ]);
    if (ssRes.error || faRes.error || zaRes.error) {
      setError(ssRes.error?.message ?? faRes.error?.message ?? zaRes.error?.message ?? null);
      return;
    }
    setSkolskeSpreme(ssRes.data ?? []);
    setFakulteti(faRes.data ?? []);
    setZanimanjaRef(zaRes.data ?? []);
  }, []);

  const loadPersons = useCallback(async (tid: string) => {
    const { data, error: qErr } = await audit!
      .from("gr_persons")
      .select("id, tree_id, skolskaspremaid, fakultetid, zanimanja")
      .eq("tree_id", tid);
    if (qErr) setError(qErr.message);
    else {
      setError(null);
      setPersons((data ?? []) as PersonRow[]);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const bootErr = await ensureDefaultTreeExists();
      if (bootErr) setError(bootErr.message);
      await loadTrees();
      await loadRefs();
    })();
  }, [loadTrees, loadRefs]);

  useEffect(() => {
    void loadPersons(treeId);
  }, [treeId, loadPersons]);

  const skolskaLookup = useMemo(() => {
    const m = new Map<number, string>();
    for (const s of skolskeSpreme) {
      m.set(s.id, (s.opis ?? "").trim() || `id ${s.id}`);
    }
    return m;
  }, [skolskeSpreme]);

  const fakultetLookup = useMemo(() => {
    const m = new Map<number, string>();
    for (const f of fakulteti) {
      const n = (f.naziv ?? "").trim();
      const g = (f.grad ?? "").trim();
      m.set(f.id, n ? (g ? `${n} (${g})` : n) : g || `id ${f.id}`);
    }
    return m;
  }, [fakulteti]);

  const zanimanjeLookup = useMemo(() => {
    const m = new Map<number, string>();
    for (const z of zanimanjaRef) {
      m.set(z.id, (z.opis ?? "").trim() || `id ${z.id}`);
    }
    return m;
  }, [zanimanjaRef]);

  const rowsSkolska = useMemo(() => {
    const map = new Map<string, CountRow>();
    for (const p of persons) {
      const id = p.skolskaspremaid;
      const key = id == null ? "__null__" : String(id);
      const label =
        id == null ? "Bez vrednosti" : skolskaLookup.get(id) ?? `id ${id}`;
      const cur = map.get(key) ?? { key, label, count: 0 };
      cur.count += 1;
      map.set(key, cur);
    }
    return mapToSortedRows(map);
  }, [persons, skolskaLookup]);

  const rowsFakultet = useMemo(() => {
    const map = new Map<string, CountRow>();
    for (const p of persons) {
      const id = p.fakultetid;
      const key = id == null ? "__null__" : String(id);
      const label =
        id == null ? "Bez vrednosti" : fakultetLookup.get(id) ?? `id ${id}`;
      const cur = map.get(key) ?? { key, label, count: 0 };
      cur.count += 1;
      map.set(key, cur);
    }
    return mapToSortedRows(map);
  }, [persons, fakultetLookup]);

  const rowsZanimanje = useMemo(() => {
    const map = new Map<string, CountRow>();
    for (const p of persons) {
      const entries = normalizeZanimanja(p.zanimanja);
      for (const e of entries) {
        const id = e.zanimanjeid;
        if (id == null) continue;
        const key = String(id);
        const label = zanimanjeLookup.get(id) ?? `id ${id}`;
        const cur = map.get(key) ?? { key, label, count: 0 };
        cur.count += 1;
        map.set(key, cur);
      }
    }
    return mapToSortedRows(map);
  }, [persons, zanimanjeLookup]);

  const subSkolska = sumCounts(rowsSkolska);
  const subFakultet = sumCounts(rowsFakultet);
  const subZanimanje = sumCounts(rowsZanimanje);

  const grandTotal = useMemo(() => {
    let s = 0;
    if (secSkolska) s += subSkolska;
    if (secFakultet) s += subFakultet;
    if (secZanimanje) s += subZanimanje;
    return s;
  }, [secSkolska, secFakultet, secZanimanje, subSkolska, subFakultet, subZanimanje]);

  const treeOptions = useMemo(
    () =>
      trees.length
        ? trees
        : [{ id: DEFAULT_TREE_ID, name: "Glavno (podrazumevano)", slug: "default", created_at: "" }],
    [trees],
  );

  function handlePrintPdf() {
    window.print();
  }

  if (!audit || !supabase) {
    return <p className="error">Supabase nije podešen.</p>;
  }

  const printTitle = `Statistika članova — ${new Date().toLocaleString("sr-Latn-ME")}`;

  return (
    <div>
      <div className="no-print">
        <h1 style={{ marginTop: 0 }}>Statistika članova</h1>

        <div className="card row" style={{ flexWrap: "wrap", gap: "1rem", alignItems: "flex-end" }}>
          <label style={{ flex: "1 1 12rem" }}>
            Stablo
            <select value={treeId} onChange={(e) => setTreeId(e.target.value)}>
              {treeOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <div className="stack" style={{ gap: "0.35rem" }}>
            <span className="muted" style={{ fontSize: "0.85rem" }}>
              Sekcije u izveštaju
            </span>
            <label className="row" style={{ gap: "0.5rem", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={secSkolska}
                onChange={(e) => setSecSkolska(e.target.checked)}
              />
              Školska sprema
            </label>
            <label className="row" style={{ gap: "0.5rem", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={secFakultet}
                onChange={(e) => setSecFakultet(e.target.checked)}
              />
              Fakulteti
            </label>
            <label className="row" style={{ gap: "0.5rem", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={secZanimanje}
                onChange={(e) => setSecZanimanje(e.target.checked)}
              />
              Zanimanja
            </label>
          </div>
          <button type="button" className="primary" onClick={handlePrintPdf}>
            Štampaj / PDF
          </button>
        </div>

        {error ? <p className="error">{error}</p> : null}
      </div>

      <div className="stat-clanova-print card" style={{ marginTop: "1rem" }}>
        <p className="muted no-print" style={{ marginTop: 0 }}>
          Broj članova u stablu: <strong>{persons.length}</strong>
        </p>
        <h2 className="print-only" style={{ marginTop: 0 }}>
          {printTitle}
        </h2>
        <p className="print-only muted">
          Broj članova u stablu: {persons.length}
        </p>
        <p className="print-only muted">
          Stablo: {treeOptions.find((t) => t.id === treeId)?.name ?? treeId}
        </p>

        {secSkolska ? (
          <section style={{ marginTop: "1rem" }}>
            <h3 style={{ marginTop: 0 }}>Školska sprema</h3>
            <table className="stat-clanova-table">
              <thead>
                <tr>
                  <th>Naziv</th>
                  <th style={{ textAlign: "right", width: "8rem" }}>Broj</th>
                </tr>
              </thead>
              <tbody>
                {rowsSkolska.map((r) => (
                  <tr key={r.key}>
                    <td>{r.label}</td>
                    <td style={{ textAlign: "right" }}>{r.count}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th style={{ textAlign: "left" }}>Ukupno (sekcija)</th>
                  <th style={{ textAlign: "right" }}>{subSkolska}</th>
                </tr>
              </tfoot>
            </table>
          </section>
        ) : null}

        {secFakultet ? (
          <section style={{ marginTop: "1.5rem" }}>
            <h3 style={{ marginTop: 0 }}>Fakulteti</h3>
            <table className="stat-clanova-table">
              <thead>
                <tr>
                  <th>Naziv</th>
                  <th style={{ textAlign: "right", width: "8rem" }}>Broj</th>
                </tr>
              </thead>
              <tbody>
                {rowsFakultet.map((r) => (
                  <tr key={r.key}>
                    <td>{r.label}</td>
                    <td style={{ textAlign: "right" }}>{r.count}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th style={{ textAlign: "left" }}>Ukupno (sekcija)</th>
                  <th style={{ textAlign: "right" }}>{subFakultet}</th>
                </tr>
              </tfoot>
            </table>
          </section>
        ) : null}

        {secZanimanje ? (
          <section style={{ marginTop: "1.5rem" }}>
            <h3 style={{ marginTop: 0 }}>Zanimanja</h3>
            <p className="muted" style={{ fontSize: "0.9rem", marginTop: 0 }}>
              Brojanje po stavkama u polju zanimanja (jedna osoba može imati više unosa).
            </p>
            <table className="stat-clanova-table">
              <thead>
                <tr>
                  <th>Naziv</th>
                  <th style={{ textAlign: "right", width: "8rem" }}>Broj</th>
                </tr>
              </thead>
              <tbody>
                {rowsZanimanje.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="muted">
                      Nema unetih zanimanja kod članova.
                    </td>
                  </tr>
                ) : (
                  rowsZanimanje.map((r) => (
                    <tr key={r.key}>
                      <td>{r.label}</td>
                      <td style={{ textAlign: "right" }}>{r.count}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr>
                  <th style={{ textAlign: "left" }}>Ukupno (sekcija)</th>
                  <th style={{ textAlign: "right" }}>{subZanimanje}</th>
                </tr>
              </tfoot>
            </table>
          </section>
        ) : null}

        <section style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid #e2e8f0" }}>
          <table className="stat-clanova-table">
            <tbody>
              <tr>
                <th style={{ textAlign: "left", fontSize: "1.05rem" }}>Ukupno (sve uključene sekcije)</th>
                <th style={{ textAlign: "right", fontSize: "1.05rem", width: "8rem" }}>{grandTotal}</th>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
