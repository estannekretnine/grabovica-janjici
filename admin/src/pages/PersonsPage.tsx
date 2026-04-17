import { useCallback, useEffect, useMemo, useState } from "react";
import { audit, supabase } from "../lib/supabase";
import { DEFAULT_TREE_ID } from "../constants";
import type { Database } from "../types/database";
import type { Gender } from "../types/database";

type PersonRow = Database["audit"]["Tables"]["gr_persons"]["Row"];
type PersonInsert = Database["audit"]["Tables"]["gr_persons"]["Insert"];
type TreeRow = Database["audit"]["Tables"]["gr_family_trees"]["Row"];
type DrzavaRow = Database["public"]["Tables"]["drzava"]["Row"];
type OpstinaRow = Database["public"]["Tables"]["opstina"]["Row"];
type LokacijaRow = Database["public"]["Tables"]["lokacija"]["Row"];

const emptyForm: PersonInsert = {
  tree_id: DEFAULT_TREE_ID,
  first_name: "",
  middle_name: null,
  last_name: "",
  maiden_name: null,
  gender: null,
  birth_date: null,
  death_date: null,
  birth_place: null,
  death_place: null,
  is_living: null,
  photo_storage_path: null,
  notes: null,
  drzavaid: null,
  opstinaid: null,
  lokacijaid: null,
  drzavaidrodio: null,
  opstinaidrodio: null,
  lokacijaidrodio: null,
};

function personLabel(p: Pick<PersonRow, "first_name" | "last_name">) {
  const a = `${p.last_name} ${p.first_name}`.trim();
  return a || "(bez imena)";
}

export function PersonsPage() {
  const [trees, setTrees] = useState<TreeRow[]>([]);
  const [drzave, setDrzave] = useState<DrzavaRow[]>([]);
  const [opstine, setOpstine] = useState<OpstinaRow[]>([]);
  const [lokacije, setLokacije] = useState<LokacijaRow[]>([]);
  const [treeId, setTreeId] = useState(DEFAULT_TREE_ID);
  const [persons, setPersons] = useState<PersonRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PersonInsert>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const loadTrees = useCallback(async () => {
    const { data } = await audit!.from("gr_family_trees").select("*").order("name");
    setTrees(data ?? []);
  }, []);

  const loadLocations = useCallback(async () => {
    if (!supabase) return;
    const [drRes, opRes, loRes] = await Promise.all([
      supabase.from("drzava").select("*").order("opis", { ascending: true }),
      supabase.from("opstina").select("*").order("opis", { ascending: true }),
      supabase.from("lokacija").select("*").order("opis", { ascending: true }),
    ]);
    if (drRes.error || opRes.error || loRes.error) {
      setError(drRes.error?.message ?? opRes.error?.message ?? loRes.error?.message ?? null);
      return;
    }
    setDrzave(drRes.data ?? []);
    setOpstine(opRes.data ?? []);
    setLokacije(loRes.data ?? []);
  }, []);

  const loadPersons = useCallback(async (tid: string) => {
    const { data, error: qErr } = await audit!
      .from("gr_persons")
      .select("*")
      .eq("tree_id", tid)
      .order("last_name")
      .order("first_name");
    if (qErr) setError(qErr.message);
    else {
      setError(null);
      setPersons(data ?? []);
    }
  }, []);

  useEffect(() => {
    void loadTrees();
    void loadLocations();
  }, [loadTrees, loadLocations]);

  useEffect(() => {
    void loadPersons(treeId);
  }, [treeId, loadPersons]);

  const treeOptions = useMemo(
    () =>
      trees.length
        ? trees
        : [{ id: DEFAULT_TREE_ID, name: "Glavno (podrazumevano)", slug: "default", created_at: "" }],
    [trees]
  );

  const opstineRodjenja = useMemo(
    () =>
      form.drzavaidrodio != null
        ? opstine.filter((o) => o.iddrzava === form.drzavaidrodio)
        : [],
    [opstine, form.drzavaidrodio]
  );

  const lokacijeRodjenja = useMemo(
    () =>
      form.opstinaidrodio != null
        ? lokacije.filter((l) => l.idopstina === form.opstinaidrodio)
        : [],
    [lokacije, form.opstinaidrodio]
  );

  const opstineZivljenja = useMemo(
    () =>
      form.drzavaid != null ? opstine.filter((o) => o.iddrzava === form.drzavaid) : [],
    [opstine, form.drzavaid]
  );

  const lokacijeZivljenja = useMemo(
    () =>
      form.opstinaid != null ? lokacije.filter((l) => l.idopstina === form.opstinaid) : [],
    [lokacije, form.opstinaid]
  );

  function startCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, tree_id: treeId });
  }

  function startEdit(p: PersonRow) {
    setEditingId(p.id);
    setForm({
      tree_id: p.tree_id,
      first_name: p.first_name,
      middle_name: p.middle_name,
      last_name: p.last_name,
      maiden_name: p.maiden_name,
      gender: p.gender,
      birth_date: p.birth_date,
      death_date: p.death_date,
      birth_place: p.birth_place,
      death_place: p.death_place,
      is_living: p.is_living,
      photo_storage_path: p.photo_storage_path,
      notes: p.notes,
      drzavaid: p.drzavaid,
      opstinaid: p.opstinaid,
      lokacijaid: p.lokacijaid,
      drzavaidrodio: p.drzavaidrodio,
      opstinaidrodio: p.opstinaidrodio,
      lokacijaidrodio: p.lokacijaidrodio,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = { ...form, tree_id: treeId };

    if (editingId) {
      const { error: upErr } = await audit!.from("gr_persons").update(payload).eq("id", editingId);
      if (upErr) {
        setError(upErr.message);
        return;
      }
    } else {
      const { error: insErr } = await audit!.from("gr_persons").insert(payload);
      if (insErr) {
        setError(insErr.message);
        return;
      }
    }
    setEditingId(null);
    setForm({ ...emptyForm, tree_id: treeId });
    await loadPersons(treeId);
  }

  async function handleDelete(id: string) {
    if (!confirm(`Obrisati osobu ${id}?`)) return;
    setError(null);
    const { error: delErr } = await audit!.from("gr_persons").delete().eq("id", id);
    if (delErr) setError(delErr.message);
    else await loadPersons(treeId);
  }

  function parseNullableId(v: string): number | null {
    return v ? Number(v) : null;
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Članovi porodice</h1>

      <div className="card row">
        <label>
          Stablo
          <select value={treeId} onChange={(e) => setTreeId(e.target.value)}>
            {treeOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.slug ? ` (${t.slug})` : ""}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="primary" onClick={startCreate}>
          Nova osoba
        </button>
      </div>

      <div className="card">
          <h2 style={{ marginTop: 0 }}>{editingId ? "Izmena osobe" : "Nova osoba"}</h2>
          <form className="stack" onSubmit={(e) => void handleSubmit(e)}>
            <div className="row">
              <label>
                Ime
                <input
                  value={form.first_name ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                />
              </label>
              <label>
                Srednje ime
                <input
                  value={form.middle_name ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, middle_name: e.target.value || null }))
                  }
                />
              </label>
              <label>
                Prezime
                <input
                  value={form.last_name ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                />
              </label>
              <label>
                Devojačko
                <input
                  value={form.maiden_name ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, maiden_name: e.target.value || null }))
                  }
                />
              </label>
            </div>
            <div className="row">
              <label>
                Pol
                <select
                  value={form.gender ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      gender: (e.target.value || null) as Gender | null,
                    }))
                  }
                >
                  <option value="">—</option>
                  <option value="male">Muški</option>
                  <option value="female">Ženski</option>
                  <option value="other">Drugo</option>
                  <option value="unknown">Nepoznato</option>
                </select>
              </label>
              <label>
                Datum rođenja
                <input
                  type="date"
                  value={form.birth_date ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, birth_date: e.target.value || null }))
                  }
                />
              </label>
              <label>
                Datum smrti
                <input
                  type="date"
                  value={form.death_date ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, death_date: e.target.value || null }))
                  }
                />
              </label>
              <label>
                Živ/živa
                <select
                  value={form.is_living === null ? "" : form.is_living ? "yes" : "no"}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm((f) => ({
                      ...f,
                      is_living: v === "" ? null : v === "yes",
                    }));
                  }}
                >
                  <option value="">—</option>
                  <option value="yes">Da</option>
                  <option value="no">Ne</option>
                </select>
              </label>
            </div>
            <div className="row">
              <label>
                Mesto rođenja: država
                <select
                  value={form.drzavaidrodio != null ? String(form.drzavaidrodio) : ""}
                  onChange={(e) => {
                    const id = parseNullableId(e.target.value);
                    setForm((f) => ({
                      ...f,
                      drzavaidrodio: id,
                      opstinaidrodio: null,
                      lokacijaidrodio: null,
                    }));
                  }}
                >
                  <option value="">—</option>
                  {drzave.map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {d.opis ?? `id ${d.id}`}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Mesto rođenja: opština
                <select
                  value={form.opstinaidrodio != null ? String(form.opstinaidrodio) : ""}
                  onChange={(e) => {
                    const id = parseNullableId(e.target.value);
                    setForm((f) => ({ ...f, opstinaidrodio: id, lokacijaidrodio: null }));
                  }}
                  disabled={form.drzavaidrodio == null}
                >
                  <option value="">—</option>
                  {opstineRodjenja.map((o) => (
                    <option key={o.id} value={String(o.id)}>
                      {o.opis ?? `id ${o.id}`}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Mesto rođenja: lokalitet
                <select
                  value={form.lokacijaidrodio != null ? String(form.lokacijaidrodio) : ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lokacijaidrodio: parseNullableId(e.target.value) }))
                  }
                  disabled={form.opstinaidrodio == null}
                >
                  <option value="">—</option>
                  {lokacijeRodjenja.map((l) => (
                    <option key={l.id} value={String(l.id)}>
                      {l.opis ?? `id ${l.id}`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="row">
              <label>
                Mesto življenja: država
                <select
                  value={form.drzavaid != null ? String(form.drzavaid) : ""}
                  onChange={(e) => {
                    const id = parseNullableId(e.target.value);
                    setForm((f) => ({ ...f, drzavaid: id, opstinaid: null, lokacijaid: null }));
                  }}
                >
                  <option value="">—</option>
                  {drzave.map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {d.opis ?? `id ${d.id}`}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Mesto življenja: opština
                <select
                  value={form.opstinaid != null ? String(form.opstinaid) : ""}
                  onChange={(e) => {
                    const id = parseNullableId(e.target.value);
                    setForm((f) => ({ ...f, opstinaid: id, lokacijaid: null }));
                  }}
                  disabled={form.drzavaid == null}
                >
                  <option value="">—</option>
                  {opstineZivljenja.map((o) => (
                    <option key={o.id} value={String(o.id)}>
                      {o.opis ?? `id ${o.id}`}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Mesto življenja: lokalitet
                <select
                  value={form.lokacijaid != null ? String(form.lokacijaid) : ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lokacijaid: parseNullableId(e.target.value) }))
                  }
                  disabled={form.opstinaid == null}
                >
                  <option value="">—</option>
                  {lokacijeZivljenja.map((l) => (
                    <option key={l.id} value={String(l.id)}>
                      {l.opis ?? `id ${l.id}`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Putanja fotografije (Storage)
              <input
                value={form.photo_storage_path ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, photo_storage_path: e.target.value || null }))
                }
                placeholder="bucket/fajl.jpg"
              />
            </label>
            <label>
              Napomene
              <textarea
                value={form.notes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value || null }))}
              />
            </label>
            <div className="row">
              <button className="primary" type="submit">
                {editingId ? "Sačuvaj" : "Dodaj osobu"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm({ ...emptyForm, tree_id: treeId });
                  }}
                >
                  Otkaži
                </button>
              ) : null}
            </div>
          </form>
        </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Lista ({persons.length})</h2>
        <table>
          <thead>
            <tr>
              <th>Ime i prezime</th>
              <th>Pol</th>
              <th>Rođen/a</th>
              <th>Živ/živa</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {persons.map((p) => (
              <tr key={p.id}>
                <td>{personLabel(p)}</td>
                <td>{p.gender ?? "—"}</td>
                <td>{p.birth_date ?? "—"}</td>
                <td>
                  {p.is_living === null ? "—" : p.is_living ? "da" : "ne"}
                </td>
                <td>
                  <button type="button" onClick={() => startEdit(p)}>
                    Izmeni
                  </button>{" "}
                  <button type="button" className="danger" onClick={() => void handleDelete(p.id)}>
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
