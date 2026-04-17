import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/database";

type DrzavaRow = Database["public"]["Tables"]["drzava"]["Row"];
type DrzavaInsert = Database["public"]["Tables"]["drzava"]["Insert"];

const emptyForm: DrzavaInsert = { opis: "" };

export function DrzavePage() {
  const [rows, setRows] = useState<DrzavaRow[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<DrzavaInsert>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error: qErr } = await supabase.from("drzava").select("*").order("opis", { ascending: true });
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
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (r.opis ?? "").toLowerCase().includes(q));
  }, [rows, search]);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function startEdit(r: DrzavaRow) {
    setEditingId(r.id);
    setForm({ opis: r.opis ?? "" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setError(null);
    const payload = { opis: form.opis?.trim() || null };

    if (editingId != null) {
      const { error: upErr } = await supabase.from("drzava").update(payload).eq("id", editingId);
      if (upErr) {
        setError(upErr.message);
        return;
      }
    } else {
      const { error: insErr } = await supabase.from("drzava").insert(payload);
      if (insErr) {
        setError(insErr.message);
        return;
      }
    }
    setEditingId(null);
    setForm(emptyForm);
    await load();
  }

  async function handleDelete(id: number) {
    if (!supabase) return;
    if (!confirm(`Obrisati državu (id ${id})?`)) return;
    setError(null);
    const { error: delErr } = await supabase.from("drzava").delete().eq("id", id);
    if (delErr) setError(delErr.message);
    else await load();
  }

  if (!supabase) {
    return <p className="error">Supabase nije podešen.</p>;
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Države</h1>

      <div className="card row">
        <label style={{ flex: "1 1 12rem" }}>
          Pretraga
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtriraj po nazivu…"
          />
        </label>
        <button type="button" className="primary" onClick={startCreate}>
          Nova država
        </button>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{editingId != null ? "Izmena države" : "Nova država"}</h2>
        <form className="stack" onSubmit={(e) => void handleSubmit(e)}>
          <label>
            Naziv (opis)
            <input
              value={form.opis ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, opis: e.target.value }))}
              required
            />
          </label>
          <div className="row">
            <button className="primary" type="submit">
              {editingId != null ? "Sačuvaj" : "Dodaj"}
            </button>
            {editingId != null ? (
              <button type="button" onClick={startCreate}>
                Otkaži
              </button>
            ) : null}
          </div>
        </form>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Lista ({filtered.length})</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Naziv</th>
              <th>Kreirano</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.opis ?? "—"}</td>
                <td>{r.created_at ? new Date(r.created_at).toLocaleString("sr-Latn-ME") : "—"}</td>
                <td>
                  <button type="button" onClick={() => startEdit(r)}>
                    Izmeni
                  </button>{" "}
                  <button type="button" className="danger" onClick={() => void handleDelete(r.id)}>
                    Obriši
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
