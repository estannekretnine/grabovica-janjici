import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/database";

type DrzavaRow = Database["public"]["Tables"]["drzava"]["Row"];
type OpstinaRow = Database["public"]["Tables"]["opstina"]["Row"];
type OpstinaInsert = Database["public"]["Tables"]["opstina"]["Insert"];

const emptyForm: OpstinaInsert = { opis: "", iddrzava: null };

export function OpstinePage() {
  const [drzave, setDrzave] = useState<DrzavaRow[]>([]);
  const [rows, setRows] = useState<OpstinaRow[]>([]);
  const [filterDrzavaId, setFilterDrzavaId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<OpstinaInsert>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const drzavaById = useMemo(() => {
    const m = new Map<number, string>();
    for (const d of drzave) m.set(d.id, d.opis ?? `id ${d.id}`);
    return m;
  }, [drzave]);

  const loadDrzave = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from("drzava").select("*").order("opis", { ascending: true });
    setDrzave(data ?? []);
  }, []);

  const loadOpstine = useCallback(async () => {
    if (!supabase) return;
    const { data, error: qErr } = await supabase.from("opstina").select("*").order("opis", { ascending: true });
    if (qErr) setError(qErr.message);
    else {
      setError(null);
      setRows(data ?? []);
    }
  }, []);

  useEffect(() => {
    void loadDrzave();
    void loadOpstine();
  }, [loadDrzave, loadOpstine]);

  const filtered = useMemo(() => {
    let list = rows;
    if (filterDrzavaId) {
      const id = Number(filterDrzavaId);
      list = list.filter((r) => r.iddrzava === id);
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => (r.opis ?? "").toLowerCase().includes(q));
  }, [rows, filterDrzavaId, search]);

  function startCreate() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      iddrzava: filterDrzavaId ? Number(filterDrzavaId) : null,
    });
  }

  function startEdit(r: OpstinaRow) {
    setEditingId(r.id);
    setForm({ opis: r.opis ?? "", iddrzava: r.iddrzava });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setError(null);
    const payload = {
      opis: form.opis?.trim() || null,
      iddrzava: form.iddrzava ?? null,
    };

    if (editingId != null) {
      const { error: upErr } = await supabase.from("opstina").update(payload).eq("id", editingId);
      if (upErr) {
        setError(upErr.message);
        return;
      }
    } else {
      const { error: insErr } = await supabase.from("opstina").insert(payload);
      if (insErr) {
        setError(insErr.message);
        return;
      }
    }
    setEditingId(null);
    setForm(emptyForm);
    await loadOpstine();
  }

  async function handleDelete(id: number) {
    if (!supabase) return;
    if (!confirm(`Obrisati opštinu (id ${id})?`)) return;
    setError(null);
    const { error: delErr } = await supabase.from("opstina").delete().eq("id", id);
    if (delErr) setError(delErr.message);
    else await loadOpstine();
  }

  if (!supabase) {
    return <p className="error">Supabase nije podešen.</p>;
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Opštine</h1>

      <div className="card row">
        <label>
          Država (filter)
          <select value={filterDrzavaId} onChange={(e) => setFilterDrzavaId(e.target.value)}>
            <option value="">Sve države</option>
            {drzave.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.opis ?? `id ${d.id}`}
              </option>
            ))}
          </select>
        </label>
        <label style={{ flex: "1 1 12rem" }}>
          Pretraga
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtriraj po nazivu…"
          />
        </label>
        <button type="button" className="primary" onClick={startCreate}>
          Nova opština
        </button>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{editingId != null ? "Izmena opštine" : "Nova opština"}</h2>
        <form className="stack" onSubmit={(e) => void handleSubmit(e)}>
          <label>
            Država
            <select
              value={form.iddrzava != null ? String(form.iddrzava) : ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  iddrzava: e.target.value ? Number(e.target.value) : null,
                }))
              }
              required
            >
              <option value="">— izaberi —</option>
              {drzave.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.opis ?? `id ${d.id}`}
                </option>
              ))}
            </select>
          </label>
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
              <th>Država</th>
              <th>Kreirano</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.opis ?? "—"}</td>
                <td>
                  {r.iddrzava != null ? drzavaById.get(r.iddrzava) ?? `id ${r.iddrzava}` : "—"}
                </td>
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
