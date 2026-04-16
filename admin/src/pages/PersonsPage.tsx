import { useCallback, useEffect, useMemo, useState } from "react";
import { audit } from "../lib/supabase";
import { DEFAULT_TREE_ID } from "../constants";
import type { Database } from "../types/database";
import type { Gender } from "../types/database";

type PersonRow = Database["audit"]["Tables"]["gr_persons"]["Row"];
type PersonInsert = Database["audit"]["Tables"]["gr_persons"]["Insert"];
type TreeRow = Database["audit"]["Tables"]["gr_family_trees"]["Row"];

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
};

function personLabel(p: Pick<PersonRow, "first_name" | "last_name">) {
  const a = `${p.last_name} ${p.first_name}`.trim();
  return a || "(bez imena)";
}

export function PersonsPage() {
  const [trees, setTrees] = useState<TreeRow[]>([]);
  const [treeId, setTreeId] = useState(DEFAULT_TREE_ID);
  const [persons, setPersons] = useState<PersonRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PersonInsert>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const loadTrees = useCallback(async () => {
    const { data } = await audit.from("gr_family_trees").select("*").order("name");
    setTrees(data ?? []);
  }, []);

  const loadPersons = useCallback(async (tid: string) => {
    const { data, error: qErr } = await audit
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
  }, [loadTrees]);

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
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = { ...form, tree_id: treeId };

    if (editingId) {
      const { error: upErr } = await audit.from("gr_persons").update(payload).eq("id", editingId);
      if (upErr) {
        setError(upErr.message);
        return;
      }
    } else {
      const { error: insErr } = await audit.from("gr_persons").insert(payload);
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
    const { error: delErr } = await audit.from("gr_persons").delete().eq("id", id);
    if (delErr) setError(delErr.message);
    else await loadPersons(treeId);
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
              <label style={{ flex: "1 1 12rem" }}>
                Mesto rođenja
                <input
                  value={form.birth_place ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, birth_place: e.target.value || null }))
                  }
                />
              </label>
              <label style={{ flex: "1 1 12rem" }}>
                Mesto smrti
                <input
                  value={form.death_place ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, death_place: e.target.value || null }))
                  }
                />
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
