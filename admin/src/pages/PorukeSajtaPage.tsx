import { useCallback, useEffect, useMemo, useState } from "react";
import { audit } from "../lib/supabase";
import { TablePagination } from "../components/TablePagination";
import type { Database } from "../types/database";

type KlijentRow = Database["audit"]["Tables"]["gr_klijenti"]["Row"];

export function PorukeSajtaPage() {
  const [rows, setRows] = useState<KlijentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hideArchived, setHideArchived] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const load = useCallback(async () => {
    if (!audit) return;
    const { data, error: qErr } = await audit.from("gr_klijenti").select("*").order("datumupisa", { ascending: false });
    if (qErr) setError(qErr.message);
    else {
      setError(null);
      setRows(data ?? []);
    }
  }, []);

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
    const { error: uErr } = await audit
      .from("gr_klijenti")
      .update({ stsarhiviran: next, datumpromene: new Date().toISOString() })
      .eq("id", r.id);
    if (uErr) setError(uErr.message);
    else await load();
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Poruke sa sajta</h1>
      <p className="muted">Kontakt obrasci sa javnog sajta (tabela audit.gr_klijenti).</p>

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
        <table>
          <thead>
            <tr>
              <th>Datum</th>
              <th>Ime</th>
              <th>Prezime</th>
              <th>Firma</th>
              <th>Email</th>
              <th>Kontakt</th>
              <th>Uloge / opis</th>
              <th>Investitor audit</th>
              <th>Izvor</th>
              <th>Arhiva</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => (
              <tr key={r.id}>
                <td className="muted" style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                  {r.datumupisa ? new Date(r.datumupisa).toLocaleString("sr-Latn-ME") : "—"}
                </td>
                <td>{r.ime ?? "—"}</td>
                <td>{r.prezime ?? "—"}</td>
                <td>{r.firma ?? "—"}</td>
                <td>{r.email ?? "—"}</td>
                <td>{r.kontakt ?? "—"}</td>
                <td style={{ maxWidth: "14rem", fontSize: "0.85rem" }}>{r.opis ?? "—"}</td>
                <td>{r.stsinvestitoraudit ? "da" : "ne"}</td>
                <td className="muted" style={{ fontSize: "0.75rem" }}>
                  {r.source ?? "—"}
                </td>
                <td>{r.stsarhiviran ? "da" : "ne"}</td>
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
  );
}
