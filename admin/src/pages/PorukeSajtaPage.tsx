import { useCallback, useEffect, useMemo, useState } from "react";
import { audit } from "../lib/supabase";
import { TablePagination } from "../components/TablePagination";
import type { Database } from "../types/database";

type KlijentRow = Database["audit"]["Tables"]["gr_klijenti"]["Row"];
const KLJ_TABLES = ["gr_klijenti", "klijenti"] as const;

function formatTs(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("sr-Latn-ME");
}

export function PorukeSajtaPage() {
  const [rows, setRows] = useState<KlijentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hideArchived, setHideArchived] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const readRows = useCallback(async () => {
    if (!audit) {
      return { rows: [] as KlijentRow[], table: null as string | null, error: null as string | null };
    }
    let lastError: string | null = null;
    for (const table of KLJ_TABLES) {
      const { data, error: qErr } = await audit.from(table).select("*").order("datumupisa", { ascending: false });
      if (!qErr) {
        return { rows: (data ?? []) as KlijentRow[], table, error: null };
      }
      lastError = qErr.message;
    }
    return { rows: [] as KlijentRow[], table: null as string | null, error: lastError };
  }, []);

  const load = useCallback(async () => {
    const result = await readRows();
    if (result.error) {
      setError(result.error);
    } else {
      setError(null);
      setRows(result.rows);
    }
  }, [readRows]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!hideArchived) return rows;
    return rows.filter((r) => !r.stsarhiviran);
  }, [rows, hideArchived]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setPage(1);
  }, [hideArchived]);

  async function toggleArchive(r: KlijentRow) {
    if (!audit) return;
    const next = !r.stsarhiviran;
    let updated = false;
    let lastError: string | null = null;
    for (const table of KLJ_TABLES) {
      const { error: uErr } = await audit
        .from(table)
        .update({ stsarhiviran: next, datumpromene: new Date().toISOString() })
        .eq("id", r.id);
      if (!uErr) {
        updated = true;
        break;
      }
      lastError = uErr.message;
    }
    if (!updated) setError(lastError ?? "Greška pri arhiviranju poruke.");
    else await load();
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Poruke sa sajta</h1>
      <p className="muted">Tabela audit.klijenti — kolone kao u bazi.</p>

      <div className="card row" style={{ alignItems: "center" }}>
        <label style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
          <input type="checkbox" checked={hideArchived} onChange={(e) => setHideArchived(e.target.checked)} />
          Sakrij arhivirane
        </label>
        <button type="button" onClick={() => void load()}>
          Osveži
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Lista ({filtered.length})</h2>
        <TablePagination
          idPrefix="poruke"
          page={page}
          pageSize={pageSize}
          totalItems={filtered.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
        <div className="klijenti-table-wrap">
          <table className="klijenti-table">
            <thead>
              <tr>
                <th>id</th>
                <th>datumupisa</th>
                <th>datumpromene</th>
                <th>ime</th>
                <th>prezime</th>
                <th>firma</th>
                <th>email</th>
                <th>kontakt</th>
                <th>opis</th>
                <th>stsinvestitoraudit</th>
                <th>source</th>
                <th>contactid</th>
                <th>stsarhiviran</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.id}>
                  <td className="muted klijenti-id">{r.id}</td>
                  <td className="muted klijenti-ts">{formatTs(r.datumupisa)}</td>
                  <td className="muted klijenti-ts">{formatTs(r.datumpromene)}</td>
                  <td>{r.ime ?? "—"}</td>
                  <td>{r.prezime ?? "—"}</td>
                  <td className="klijenti-cell-clip" title={r.firma ?? ""}>
                    {r.firma ?? "—"}
                  </td>
                  <td className="klijenti-cell-clip" title={r.email ?? ""}>
                    {r.email ?? "—"}
                  </td>
                  <td className="klijenti-cell-clip" title={r.kontakt ?? ""}>
                    {r.kontakt ?? "—"}
                  </td>
                  <td className="klijenti-opis" title={r.opis ?? ""}>
                    {r.opis ?? "—"}
                  </td>
                  <td>
                    <span className={`klijenti-badge ${r.stsinvestitoraudit ? "klijenti-badge--yes" : "klijenti-badge--no"}`}>
                      {r.stsinvestitoraudit ? "da" : "ne"}
                    </span>
                  </td>
                  <td className="muted klijenti-cell-clip" title={r.source ?? ""}>
                    {r.source ?? "—"}
                  </td>
                  <td className="muted klijenti-cell-mono" title={r.contactid ?? ""}>
                    {r.contactid ? `${r.contactid.slice(0, 8)}…` : "—"}
                  </td>
                  <td>
                    <span className={`klijenti-badge ${r.stsarhiviran ? "klijenti-badge--warn" : "klijenti-badge--no"}`}>
                      {r.stsarhiviran ? "da" : "ne"}
                    </span>
                  </td>
                  <td>
                    <button type="button" onClick={() => void toggleArchive(r)}>
                      {r.stsarhiviran ? "Vrati" : "Arhiviraj"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
