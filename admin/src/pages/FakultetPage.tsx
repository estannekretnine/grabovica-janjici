import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/database";

type FakultetRow = Database["public"]["Tables"]["fakultet"]["Row"];
type FakultetInsert = Database["public"]["Tables"]["fakultet"]["Insert"];

const emptyForm: FakultetInsert = { naziv: "", grad: null };

export function FakultetPage() {
  const [rows, setRows] = useState<FakultetRow[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FakultetInsert>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error: qErr } = await supabase
      .from("fakultet")
      .select("*")
      .order("naziv", { ascending: true });
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
    return rows.filter(
      (r) =>
        (r.naziv ?? "").toLowerCase().includes(q) ||
        (r.grad ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function startEdit(r: FakultetRow) {
    setEditingId(r.id);
    setForm({ naziv: r.naziv ?? "", grad: r.grad ?? null });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setError(null);
    const payload = {
      naziv: form.naziv?.trim() || "",
      grad: form.grad?.trim() ? form.grad.trim() : null,
    };

    if (editingId != null) {
      const { error: upErr } = await supabase.from("fakultet").update(payload).eq("id", editingId);
      if (upErr) {
        setError(upErr.message);
        return;
      }
    } else {
      const { error: insErr } = await supabase.from("fakultet").insert(payload);
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
    if (!confirm(`Obrisati fakultet (id ${id})?`)) return;
    setError(null);
    const { error: delErr } = await supabase.from("fakultet").delete().eq("id", id);
    if (delErr) setError(delErr.message);
    else await load();
  }

  if (!supabase) {
    return <p className="error">Supabase nije podešen.</p>;
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Fakulteti</h1>

      <div className="card row">
        <label style={{ flex: "1 1 12rem" }}>
          Pretraga
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtriraj po nazivu ili gradu…"
          />
        </label>
        <button type="button" className="primary" onClick={startCreate}>
          Novi fakultet
        </button>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>
          {editingId != null ? "Izmena fakulteta" : "Novi fakultet"}
        </h2>
        <form className="stack" onSubmit={(e) => void handleSubmit(e)}>
          <label>
            Naziv
            <input
              value={form.naziv ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, naziv: e.target.value }))}
              required
            />
          </label>
          <label>
            Grad
            <input
              value={form.grad ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, grad: e.target.value || null }))}
              placeholder="npr. Beograd"
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
              <th>Grad</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.naziv || "—"}</td>
                <td>{r.grad ?? "—"}</td>
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
