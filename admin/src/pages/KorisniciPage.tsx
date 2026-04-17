import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/database";

type KorisnikRow = Database["public"]["Tables"]["korisnici"]["Row"];
type KorisnikInsert = Database["public"]["Tables"]["korisnici"]["Insert"];
type KorisnikUpdate = Database["public"]["Tables"]["korisnici"]["Update"];

const STATUS_OPTIONS = ["kupac", "prodavac", "agent", "admin", "manager"] as const;

const emptyForm: KorisnikInsert = {
  naziv: "",
  email: null,
  password: null,
  brojmob: null,
  stsstatus: null,
  stsaktivan: null,
  adresa: null,
};

export function KorisniciPage() {
  const [rows, setRows] = useState<KorisnikRow[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<KorisnikInsert>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error: qErr } = await supabase
      .from("korisnici")
      .select(
        "id, naziv, email, brojmob, stsstatus, stsaktivan, datumk, datump, datumpt, adresa",
      )
      .order("naziv", { ascending: true });
    if (qErr) setError(qErr.message);
    else {
      setError(null);
      setRows((data ?? []) as KorisnikRow[]);
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
        (r.email ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function startEdit(r: KorisnikRow) {
    setEditingId(r.id);
    setForm({
      naziv: r.naziv,
      email: r.email,
      password: "",
      brojmob: r.brojmob,
      stsstatus: r.stsstatus,
      stsaktivan: r.stsaktivan,
      adresa: r.adresa,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setError(null);

    const base: KorisnikUpdate = {
      naziv: form.naziv?.trim() || "",
      email: form.email?.trim() || null,
      brojmob: form.brojmob?.trim() || null,
      stsstatus: form.stsstatus?.trim() || null,
      stsaktivan:
        form.stsaktivan === "" || form.stsaktivan == null ? null : form.stsaktivan,
      adresa: form.adresa?.trim() || null,
    };

    if (editingId != null) {
      const upd: KorisnikUpdate = { ...base };
      const pw = form.password?.trim();
      if (pw) upd.password = pw;
      const { error: upErr } = await supabase.from("korisnici").update(upd).eq("id", editingId);
      if (upErr) {
        setError(upErr.message);
        return;
      }
    } else {
      const pw = form.password?.trim();
      if (!pw) {
        setError("Lozinka je obavezna za novog korisnika.");
        return;
      }
      const ins: KorisnikInsert = {
        ...base,
        password: pw,
      };
      const { error: insErr } = await supabase.from("korisnici").insert(ins);
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
    if (!confirm(`Obrisati korisnika (id ${id})?`)) return;
    setError(null);
    const { error: delErr } = await supabase.from("korisnici").delete().eq("id", id);
    if (delErr) setError(delErr.message);
    else await load();
  }

  if (!supabase) {
    return <p className="error">Supabase nije podešen.</p>;
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Korisnici</h1>

      <div className="card row">
        <label style={{ flex: "1 1 12rem" }}>
          Pretraga
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Naziv ili email…"
          />
        </label>
        <button type="button" className="primary" onClick={startCreate}>
          Novi korisnik
        </button>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{editingId != null ? "Izmena korisnika" : "Novi korisnik"}</h2>
        <form className="stack" onSubmit={(e) => void handleSubmit(e)}>
          <div className="row">
            <label>
              Naziv
              <input
                value={form.naziv ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, naziv: e.target.value }))}
                required
              />
            </label>
            <label>
              Email
              <input
                type="text"
                value={form.email ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value || null }))}
              />
            </label>
          </div>
          <div className="row">
            <label>
              Lozinka
              <input
                type="password"
                value={form.password ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value || null }))}
                placeholder={editingId != null ? "(ostavi prazno da ne menjaš)" : ""}
                autoComplete="new-password"
              />
            </label>
            <label>
              Mobilni
              <input
                value={form.brojmob ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, brojmob: e.target.value || null }))}
              />
            </label>
          </div>
          <div className="row">
            <label>
              Status
              <select
                value={form.stsstatus ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, stsstatus: e.target.value || null }))
                }
              >
                <option value="">—</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Aktivan
              <select
                value={form.stsaktivan ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, stsaktivan: e.target.value || null }))
                }
              >
                <option value="">—</option>
                <option value="da">da</option>
                <option value="ne">ne</option>
              </select>
            </label>
          </div>
          <label>
            Adresa
            <textarea
              value={form.adresa ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, adresa: e.target.value || null }))}
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
              <th>Email</th>
              <th>Status</th>
              <th>Aktivan</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.naziv}</td>
                <td>{r.email ?? "—"}</td>
                <td>{r.stsstatus ?? "—"}</td>
                <td>{r.stsaktivan ?? "—"}</td>
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
