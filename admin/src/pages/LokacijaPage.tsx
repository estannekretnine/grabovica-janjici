import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/database";

type DrzavaRow = Database["public"]["Tables"]["drzava"]["Row"];
type OpstinaRow = Database["public"]["Tables"]["opstina"]["Row"];
type LokacijaRow = Database["public"]["Tables"]["lokacija"]["Row"];
type LokacijaInsert = Database["public"]["Tables"]["lokacija"]["Insert"];

const emptyForm: LokacijaInsert = { opis: "", idopstina: null };

export function LokacijaPage() {
  const [drzave, setDrzave] = useState<DrzavaRow[]>([]);
  const [opstine, setOpstine] = useState<OpstinaRow[]>([]);
  const [rows, setRows] = useState<LokacijaRow[]>([]);
  const [filterDrzavaId, setFilterDrzavaId] = useState("");
  const [filterOpstinaId, setFilterOpstinaId] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<LokacijaInsert>(emptyForm);
  /** Izabrana država u formi (kaskada pre opštine). */
  const [formDrzavaId, setFormDrzavaId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const drzavaById = useMemo(() => {
    const m = new Map<number, string>();
    for (const d of drzave) m.set(d.id, d.opis ?? `id ${d.id}`);
    return m;
  }, [drzave]);

  const opstinaById = useMemo(() => {
    const m = new Map<number, { opis: string; iddrzava: number | null }>();
    for (const o of opstine) m.set(o.id, { opis: o.opis ?? `id ${o.id}`, iddrzava: o.iddrzava });
    return m;
  }, [opstine]);

  const opstineZaDrzavu = useMemo(() => {
    if (!filterDrzavaId) return opstine;
    const id = Number(filterDrzavaId);
    return opstine.filter((o) => o.iddrzava === id);
  }, [opstine, filterDrzavaId]);

  const opstineZaFormu = useMemo(() => {
    if (formDrzavaId == null) return [];
    return opstine.filter((o) => o.iddrzava === formDrzavaId);
  }, [opstine, formDrzavaId]);

  const loadDrzave = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from("drzava").select("*").order("opis", { ascending: true });
    setDrzave(data ?? []);
  }, []);

  const loadOpstine = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from("opstina").select("*").order("opis", { ascending: true });
    setOpstine(data ?? []);
  }, []);

  const loadLokacije = useCallback(async () => {
    if (!supabase) return;
    const { data, error: qErr } = await supabase.from("lokacija").select("*").order("opis", { ascending: true });
    if (qErr) setError(qErr.message);
    else {
      setError(null);
      setRows(data ?? []);
    }
  }, []);

  useEffect(() => {
    void loadDrzave();
    void loadOpstine();
    void loadLokacije();
  }, [loadDrzave, loadOpstine, loadLokacije]);

  const filtered = useMemo(() => {
    let list = rows;
    if (filterOpstinaId) {
      const id = Number(filterOpstinaId);
      list = list.filter((r) => r.idopstina === id);
    } else if (filterDrzavaId) {
      const did = Number(filterDrzavaId);
      const opIds = new Set(opstine.filter((o) => o.iddrzava === did).map((o) => o.id));
      list = list.filter((r) => r.idopstina != null && opIds.has(r.idopstina));
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => (r.opis ?? "").toLowerCase().includes(q));
  }, [rows, filterDrzavaId, filterOpstinaId, opstine, search]);

  function startCreate() {
    setEditingId(null);
    let drz: number | null = filterDrzavaId ? Number(filterDrzavaId) : null;
    const opId = filterOpstinaId ? Number(filterOpstinaId) : null;
    if (opId != null && drz == null) {
      drz = opstinaById.get(opId)?.iddrzava ?? null;
    }
    setFormDrzavaId(drz);
    setForm({
      ...emptyForm,
      idopstina: opId,
    });
  }

  function startEdit(r: LokacijaRow) {
    setEditingId(r.id);
    setForm({ opis: r.opis ?? "", idopstina: r.idopstina });
    const drz =
      r.idopstina != null ? opstinaById.get(r.idopstina)?.iddrzava ?? null : null;
    setFormDrzavaId(drz);
  }

  function onFormDrzavaChange(drzId: string) {
    const id = drzId ? Number(drzId) : null;
    setFormDrzavaId(id);
    setForm((f) => {
      const curOp = f.idopstina;
      const keep =
        curOp != null &&
        id != null &&
        opstinaById.get(curOp)?.iddrzava === id;
      return { ...f, idopstina: keep ? curOp : null };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setError(null);
    const payload = {
      opis: form.opis?.trim() || null,
      idopstina: form.idopstina ?? null,
    };

    if (editingId != null) {
      const { error: upErr } = await supabase.from("lokacija").update(payload).eq("id", editingId);
      if (upErr) {
        setError(upErr.message);
        return;
      }
    } else {
      const { error: insErr } = await supabase.from("lokacija").insert(payload);
      if (insErr) {
        setError(insErr.message);
        return;
      }
    }
    setEditingId(null);
    setForm(emptyForm);
    setFormDrzavaId(null);
    await loadLokacije();
  }

  async function handleDelete(id: number) {
    if (!supabase) return;
    if (!confirm(`Obrisati lokaciju (id ${id})?`)) return;
    setError(null);
    const { error: delErr } = await supabase.from("lokacija").delete().eq("id", id);
    if (delErr) setError(delErr.message);
    else await loadLokacije();
  }

  if (!supabase) {
    return <p className="error">Supabase nije podešen.</p>;
  }

  const formDrzavaSelectValue = formDrzavaId != null ? String(formDrzavaId) : "";

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Lokacije</h1>

      <div className="card row">
        <label>
          Država (filter)
          <select
            value={filterDrzavaId}
            onChange={(e) => {
              setFilterDrzavaId(e.target.value);
              setFilterOpstinaId("");
            }}
          >
            <option value="">Sve</option>
            {drzave.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.opis ?? `id ${d.id}`}
              </option>
            ))}
          </select>
        </label>
        <label>
          Opština (filter)
          <select
            value={filterOpstinaId}
            onChange={(e) => setFilterOpstinaId(e.target.value)}
          >
            <option value="">Sve opštine</option>
            {(filterDrzavaId ? opstineZaDrzavu : opstine).map((o) => (
              <option key={o.id} value={String(o.id)}>
                {o.opis ?? `id ${o.id}`}
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
          Nova lokacija
        </button>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{editingId != null ? "Izmena lokacije" : "Nova lokacija"}</h2>
        <form className="stack" onSubmit={(e) => void handleSubmit(e)}>
          <div className="row">
            <label>
              Država
              <select value={formDrzavaSelectValue} onChange={(e) => onFormDrzavaChange(e.target.value)}>
                <option value="">— izaberi —</option>
                {drzave.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.opis ?? `id ${d.id}`}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Opština
              <select
                value={form.idopstina != null ? String(form.idopstina) : ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    idopstina: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                required
                disabled={formDrzavaId == null}
              >
                <option value="">— izaberi —</option>
                {opstineZaFormu.map((o) => (
                  <option key={o.id} value={String(o.id)}>
                    {o.opis ?? `id ${o.id}`}
                  </option>
                ))}
              </select>
            </label>
          </div>
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
              <th>Opština</th>
              <th>Država</th>
              <th>Kreirano</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const op = r.idopstina != null ? opstinaById.get(r.idopstina) : undefined;
              const drzN =
                op?.iddrzava != null ? drzavaById.get(op.iddrzava) ?? "—" : "—";
              return (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.opis ?? "—"}</td>
                  <td>{op?.opis ?? (r.idopstina != null ? `id ${r.idopstina}` : "—")}</td>
                  <td>{drzN}</td>
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
