import { useCallback, useEffect, useMemo, useState } from "react";
import { audit, supabase } from "../lib/supabase";
import { ensureDefaultTreeExists } from "../lib/ensureDefaultTree";
import { DEFAULT_TREE_ID } from "../constants";
import type { Database } from "../types/database";
import type { Gender } from "../types/database";

type PersonRow = Database["audit"]["Tables"]["gr_persons"]["Row"];
type PersonInsert = Database["audit"]["Tables"]["gr_persons"]["Insert"];
type TreeRow = Database["audit"]["Tables"]["gr_family_trees"]["Row"];
type DrzavaRow = Database["public"]["Tables"]["drzava"]["Row"];
type OpstinaRow = Database["public"]["Tables"]["opstina"]["Row"];
type LokacijaRow = Database["public"]["Tables"]["lokacija"]["Row"];
type PhotoItem = { id: string; storagePath: string; previewUrl: string | null; file: File | null };

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
  email: null,
  mob1: null,
  mob2: null,
};

function personLabel(p: Pick<PersonRow, "first_name" | "last_name">) {
  const a = `${p.last_name} ${p.first_name}`.trim();
  return a || "(bez imena)";
}

function createPhotoId() {
  return `p_${Math.random().toString(36).slice(2, 10)}`;
}

function parsePhotoItems(raw: string | null): { items: PhotoItem[]; defaultIndex: number } {
  if (!raw?.trim()) return { items: [], defaultIndex: 0 };
  try {
    const parsed = JSON.parse(raw) as
      | { defaultIndex?: number; items?: Array<{ path?: string }> }
      | Array<string>;
    if (Array.isArray(parsed)) {
      const items = parsed
        .map((p) => String(p ?? "").trim())
        .filter(Boolean)
        .map((path) => ({ id: createPhotoId(), storagePath: path, previewUrl: null, file: null }));
      return { items, defaultIndex: 0 };
    }
    const items = (parsed.items ?? [])
      .map((x) => String(x?.path ?? "").trim())
      .filter(Boolean)
      .map((path) => ({ id: createPhotoId(), storagePath: path, previewUrl: null, file: null }));
    const d = parsed.defaultIndex ?? 0;
    return { items, defaultIndex: d >= 0 && d < items.length ? d : 0 };
  } catch {
    return {
      items: [{ id: createPhotoId(), storagePath: raw.trim(), previewUrl: null, file: null }],
      defaultIndex: 0,
    };
  }
}

function serializePhotoItems(items: PhotoItem[], defaultIndex: number): string | null {
  const cleaned = items.map((x) => x.storagePath.trim()).filter(Boolean);
  if (!cleaned.length) return null;
  if (cleaned.length === 1 && defaultIndex === 0) return cleaned[0];
  return JSON.stringify({
    defaultIndex: Math.max(0, Math.min(defaultIndex, cleaned.length - 1)),
    items: cleaned.map((path) => ({ path })),
  });
}

function safeFilename(name: string): string {
  const cleaned = name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  return cleaned.replace(/-+/g, "-").replace(/^-|-$/g, "") || "photo.jpg";
}

function toPublicPhotoUrl(storagePath: string): string | null {
  if (!supabase) return null;
  const trimmed = storagePath.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/^bucket\//, "");
  return supabase.storage.from("bucket").getPublicUrl(normalized).data.publicUrl;
}

export function PersonsPage() {
  const [trees, setTrees] = useState<TreeRow[]>([]);
  const [drzave, setDrzave] = useState<DrzavaRow[]>([]);
  const [opstine, setOpstine] = useState<OpstinaRow[]>([]);
  const [lokacije, setLokacije] = useState<LokacijaRow[]>([]);
  const [treeId, setTreeId] = useState(DEFAULT_TREE_ID);
  const [persons, setPersons] = useState<PersonRow[]>([]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<PersonInsert>(emptyForm);
  const [photoItems, setPhotoItems] = useState<PhotoItem[]>([]);
  const [defaultPhotoIndex, setDefaultPhotoIndex] = useState(0);
  const [dragActive, setDragActive] = useState(false);
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
    void (async () => {
      const bootErr = await ensureDefaultTreeExists();
      if (bootErr) setError(bootErr.message);
      await loadTrees();
      await loadLocations();
    })();
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

  const filteredPersons = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return persons;
    return persons.filter((p) => {
      const full = `${p.first_name ?? ""} ${p.middle_name ?? ""} ${p.last_name ?? ""} ${p.maiden_name ?? ""}`
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
      return full.includes(q);
    });
  }, [persons, search]);

  function startCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, tree_id: treeId });
    setPhotoItems([]);
    setDefaultPhotoIndex(0);
    setIsFormOpen(true);
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
      email: p.email,
      mob1: p.mob1,
      mob2: p.mob2,
    });
    const parsed = parsePhotoItems(p.photo_storage_path);
    setPhotoItems(
      parsed.items.map((item) => ({
        ...item,
        previewUrl: toPublicPhotoUrl(item.storagePath),
      }))
    );
    setDefaultPhotoIndex(parsed.defaultIndex);
    setIsFormOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const personId = editingId ?? crypto.randomUUID();
    const uploadedItems: PhotoItem[] = [];
    for (let i = 0; i < photoItems.length; i += 1) {
      const item = photoItems[i];
      if (!item.file) {
        uploadedItems.push(item);
        continue;
      }
      if (!supabase) {
        setError("Supabase nije podešen.");
        return;
      }
      const fileName = safeFilename(item.file.name);
      const objectPath = `persons/${treeId}/${personId}/${Date.now()}-${i + 1}-${fileName}`;
      const { error: upErr } = await supabase.storage
        .from("bucket")
        .upload(objectPath, item.file, { upsert: true });
      if (upErr) {
        setError(`Upload fotografije nije uspeo: ${upErr.message}`);
        return;
      }
      uploadedItems.push({
        ...item,
        file: null,
        storagePath: `bucket/${objectPath}`,
      });
    }

    const payload: PersonInsert = {
      ...form,
      id: personId,
      tree_id: treeId,
      photo_storage_path: serializePhotoItems(uploadedItems, defaultPhotoIndex),
    };

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
    setPhotoItems([]);
    setDefaultPhotoIndex(0);
    setIsFormOpen(false);
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

  function addPhotoPath() {
    setPhotoItems((prev) => {
      if (prev.length >= 10) return prev;
      return [...prev, { id: createPhotoId(), storagePath: "", previewUrl: null, file: null }];
    });
  }

  function removePhotoAt(index: number) {
    setPhotoItems((prev) => {
      const item = prev[index];
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      const next = prev.filter((_, i) => i !== index);
      setDefaultPhotoIndex((cur) => {
        if (!next.length) return 0;
        if (cur > index) return cur - 1;
        if (cur >= next.length) return next.length - 1;
        return cur;
      });
      return next;
    });
  }

  function handlePhotoDrop(files: FileList | null) {
    if (!files) return;
    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    setPhotoItems((prev) => {
      const slots = Math.max(0, 10 - prev.length);
      const picked = images.slice(0, slots).map((f) => ({
        id: createPhotoId(),
        storagePath: `bucket/${f.name}`,
        previewUrl: URL.createObjectURL(f),
        file: f,
      }));
      return [...prev, ...picked];
    });
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
        <label style={{ flex: "1 1 16rem" }}>
          Pretraga
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pretraži po imenu ili prezimenu…"
          />
        </label>
        <button type="button" className="primary" onClick={startCreate}>
          Nova osoba
        </button>
      </div>

      {isFormOpen ? (
        <div className="card person-form-card">
          <div className="person-form-head">
            <h2 style={{ marginTop: 0 }}>{editingId ? "Izmena osobe" : "Nova osoba"}</h2>
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                setEditingId(null);
              }}
            >
              Zatvori
            </button>
          </div>
          <form className="stack" onSubmit={(e) => void handleSubmit(e)}>
            <div className="person-form-section">
              <h3>Osnovni podaci</h3>
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
            </div>
            <div className="person-form-section">
              <h3>Kontakt</h3>
              <div className="row">
                <label>
                  Email
                  <input
                    type="email"
                    autoComplete="email"
                    value={form.email ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value.trim() || null }))}
                  />
                </label>
                <label>
                  Mobilni 1
                  <input
                    type="tel"
                    autoComplete="tel"
                    value={form.mob1 ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, mob1: e.target.value.trim() || null }))}
                  />
                </label>
                <label>
                  Mobilni 2
                  <input
                    type="tel"
                    autoComplete="tel"
                    value={form.mob2 ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, mob2: e.target.value.trim() || null }))}
                  />
                </label>
              </div>
            </div>
            <div className="person-form-section">
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
            </div>
            <div className="person-form-section">
              <h3>Fotografije</h3>
              <div
                className={`photo-dropzone${dragActive ? " active" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  handlePhotoDrop(e.dataTransfer.files);
                }}
              >
                Prevuci fotografije ovde (maksimalno 10), ili koristi izbor fajlova.
                <div style={{ marginTop: "0.5rem" }}>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handlePhotoDrop(e.target.files)}
                  />
                </div>
              </div>
              <div className="row">
                <button type="button" onClick={addPhotoPath} disabled={photoItems.length >= 10}>
                  Dodaj putanju ručno
                </button>
                <span className="muted">Broj fotografija: {photoItems.length}/10</span>
              </div>
              {photoItems.length ? (
                <div className="photo-list">
                  {photoItems.map((item, idx) => (
                    <div key={item.id} className="photo-row">
                      <label className="photo-default-choice">
                        <input
                          type="radio"
                          name="default-photo"
                          checked={defaultPhotoIndex === idx}
                          onChange={() => setDefaultPhotoIndex(idx)}
                        />
                        Podrazumevana
                      </label>
                      {item.previewUrl ? (
                        <img className="photo-thumb" src={item.previewUrl} alt={`foto-${idx + 1}`} />
                      ) : null}
                      <input
                        style={{ flex: 1 }}
                        value={item.storagePath}
                        onChange={(e) =>
                          setPhotoItems((prev) =>
                            prev.map((p, i) =>
                              i === idx
                                ? {
                                    ...p,
                                    storagePath: e.target.value,
                                    file: null,
                                    previewUrl: toPublicPhotoUrl(e.target.value),
                                  }
                                : p
                            )
                          )
                        }
                        placeholder="bucket/fajl.jpg"
                      />
                      <button type="button" className="danger" onClick={() => removePhotoAt(idx)}>
                        Ukloni
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
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
                    setPhotoItems([]);
                    setDefaultPhotoIndex(0);
                  }}
                >
                  Otkaži
                </button>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}

      {error ? <p className="error">{error}</p> : null}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Lista ({filteredPersons.length})</h2>
        <table>
          <thead>
            <tr>
              <th>Ime i prezime</th>
              <th>Default foto</th>
              <th>Pol</th>
              <th>Rođen/a</th>
              <th>Živ/živa</th>
              <th>Kreirano</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredPersons.map((p) => {
              const parsedPhotos = parsePhotoItems(p.photo_storage_path);
              const defaultPhotoPath =
                parsedPhotos.items[parsedPhotos.defaultIndex]?.storagePath ?? "—";
              const defaultPhotoUrl =
                defaultPhotoPath !== "—" && supabase
                  ? supabase.storage.from("bucket").getPublicUrl(defaultPhotoPath.replace(/^bucket\//, "")).data
                      .publicUrl
                  : null;
              return (
                <tr key={p.id}>
                  <td>{personLabel(p)}</td>
                  <td>
                    {defaultPhotoUrl ? (
                      <img className="photo-thumb" src={defaultPhotoUrl} alt="default-foto" />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{p.gender ?? "—"}</td>
                  <td>{p.birth_date ?? "—"}</td>
                  <td>{p.is_living === null ? "—" : p.is_living ? "da" : "ne"}</td>
                  <td>{p.created_at ? new Date(p.created_at).toLocaleString("sr-Latn-ME") : "—"}</td>
                  <td>
                    <button type="button" onClick={() => startEdit(p)}>
                      Izmeni
                    </button>{" "}
                    <button type="button" className="danger" onClick={() => void handleDelete(p.id)}>
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
