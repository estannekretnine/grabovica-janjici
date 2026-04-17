import { useCallback, useEffect, useState } from "react";
import { audit, supabase } from "../lib/supabase";
import type { Database } from "../types/database";

type ActivityRow = Database["audit"]["Tables"]["gr_aktivnosti"]["Row"];
type ActivityInsert = Database["audit"]["Tables"]["gr_aktivnosti"]["Insert"];

function safeFilename(name: string): string {
  const cleaned = name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  return cleaned.replace(/-+/g, "-").replace(/^-|-$/g, "") || "photo.jpg";
}

function activityPhotoPublicUrl(path: string | null): string | null {
  if (!supabase || !path?.trim()) return null;
  const normalized = path.trim().replace(/^bucket\//, "");
  return supabase.storage.from("bucket").getPublicUrl(normalized).data.publicUrl;
}

function normalizeWebLink(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

const emptyActivityForm = {
  naslov: "",
  opis: "",
  datum: "",
  veb_link: "",
  napomena: "",
  redosled: 0,
  foto_storage_path: null as string | null,
  fotoFile: null as File | null,
};

type Props = {
  open: boolean;
  onClose: () => void;
  personId: string | null;
  personName: string;
  treeId: string;
};

export function PersonActivitiesModal({ open, onClose, personId, personName, treeId }: Props) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyActivityForm);

  const load = useCallback(async () => {
    if (!open || !personId || !audit) return;
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await audit
      .from("gr_aktivnosti")
      .select("*")
      .eq("person_id", personId)
      .order("redosled", { ascending: true })
      .order("created_at", { ascending: true });
    setLoading(false);
    if (qErr) setError(qErr.message);
    else setRows(data ?? []);
  }, [open, personId]);

  useEffect(() => {
    if (open && personId) void load();
    if (!open) {
      setRows([]);
      setEditingId(null);
      setForm(emptyActivityForm);
      setError(null);
    }
  }, [open, personId, load]);

  function startNew() {
    setEditingId(null);
    setForm(emptyActivityForm);
    setError(null);
  }

  function startEditRow(r: ActivityRow) {
    setEditingId(r.id);
    setForm({
      naslov: r.naslov ?? "",
      opis: r.opis ?? "",
      datum: r.datum ?? "",
      veb_link: r.veb_link ?? "",
      napomena: r.napomena ?? "",
      redosled: r.redosled ?? 0,
      foto_storage_path: r.foto_storage_path,
      fotoFile: null,
    });
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!audit || !supabase || !personId) return;
    const naslov = form.naslov.trim();
    if (!naslov) {
      setError("Naslov je obavezan.");
      return;
    }
    setError(null);

    const activityId = editingId ?? crypto.randomUUID();
    let fotoPath = form.foto_storage_path?.trim() || null;

    if (form.fotoFile) {
      const fileName = safeFilename(form.fotoFile.name);
      const objectPath = `persons/${treeId}/${personId}/activities/${activityId}/${Date.now()}-${fileName}`;
      const { error: upErr } = await supabase.storage
        .from("bucket")
        .upload(objectPath, form.fotoFile, { upsert: true });
      if (upErr) {
        setError(`Upload fotografije nije uspeo: ${upErr.message}`);
        return;
      }
      fotoPath = `bucket/${objectPath}`;
    }

    const payload: ActivityInsert = {
      id: activityId,
      person_id: personId,
      naslov,
      opis: form.opis.trim() || null,
      datum: form.datum.trim() || null,
      veb_link: normalizeWebLink(form.veb_link),
      foto_storage_path: fotoPath,
      redosled: Number.isFinite(form.redosled) ? form.redosled : 0,
      napomena: form.napomena.trim() || null,
    };

    if (editingId) {
      const { id: _omitId, person_id: _omitPerson, ...updateBody } = payload;
      void _omitId;
      void _omitPerson;
      const { error: upErr } = await audit.from("gr_aktivnosti").update(updateBody).eq("id", editingId);
      if (upErr) {
        setError(upErr.message);
        return;
      }
    } else {
      const { error: insErr } = await audit.from("gr_aktivnosti").insert(payload);
      if (insErr) {
        setError(insErr.message);
        return;
      }
    }

    startNew();
    await load();
  }

  async function handleDelete(id: string) {
    if (!audit || !confirm("Obrisati ovu aktivnost?")) return;
    setError(null);
    const { error: delErr } = await audit.from("gr_aktivnosti").delete().eq("id", id);
    if (delErr) setError(delErr.message);
    else {
      if (editingId === id) startNew();
      await load();
    }
  }

  if (!open) return null;

  return (
    <div className="person-activities-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="person-activities-modal card"
        role="dialog"
        aria-labelledby="activities-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="person-form-head">
          <h2 id="activities-modal-title" style={{ marginTop: 0 }}>
            Aktivnosti — {personName}
          </h2>
          <button type="button" onClick={onClose}>
            Zatvori
          </button>
        </div>

        {error ? <p className="error">{error}</p> : null}

        {loading ? <p className="muted">Učitavanje…</p> : null}

        <div className="person-activities-list">
          <h3 style={{ marginTop: 0 }}>Lista ({rows.length})</h3>
          {rows.length ? (
            <table>
              <thead>
                <tr>
                  <th>Foto</th>
                  <th>Naslov</th>
                  <th>Datum</th>
                  <th>Link</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const thumb = activityPhotoPublicUrl(r.foto_storage_path);
                  return (
                    <tr key={r.id}>
                      <td>
                        {thumb ? (
                          <img className="photo-thumb" src={thumb} alt="" width={36} height={36} />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{r.naslov}</td>
                      <td>{r.datum ?? "—"}</td>
                      <td>
                        {r.veb_link?.trim() ? (
                          <a href={r.veb_link.trim()} target="_blank" rel="noopener noreferrer">
                            link
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <button type="button" onClick={() => startEditRow(r)}>
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
          ) : (
            !loading && <p className="muted">Nema aktivnosti. Dodajte prvu ispod.</p>
          )}
        </div>

        <div className="person-form-section" style={{ marginTop: "1rem" }}>
          <h3>{editingId ? "Izmena aktivnosti" : "Nova aktivnost"}</h3>
          <form className="stack" onSubmit={(e) => void handleSubmit(e)}>
            <div className="row">
              <label>
                Naslov *
                <input
                  value={form.naslov}
                  onChange={(e) => setForm((f) => ({ ...f, naslov: e.target.value }))}
                  required
                />
              </label>
              <label>
                Datum
                <input
                  type="date"
                  value={form.datum}
                  onChange={(e) => setForm((f) => ({ ...f, datum: e.target.value }))}
                />
              </label>
              <label>
                Redosled
                <input
                  type="number"
                  value={form.redosled}
                  onChange={(e) => setForm((f) => ({ ...f, redosled: Number(e.target.value) || 0 }))}
                />
              </label>
            </div>
            <label>
              Opis
              <textarea
                value={form.opis}
                onChange={(e) => setForm((f) => ({ ...f, opis: e.target.value }))}
                rows={4}
              />
            </label>
            <div className="row">
              <label style={{ flex: "1 1 18rem" }}>
                Veb link
                <input
                  value={form.veb_link}
                  onChange={(e) => setForm((f) => ({ ...f, veb_link: e.target.value }))}
                  placeholder="https://…"
                />
              </label>
            </div>
            <label>
              Napomena
              <input
                value={form.napomena}
                onChange={(e) => setForm((f) => ({ ...f, napomena: e.target.value }))}
              />
            </label>
            <label>
              Fotografija (jedna)
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setForm((f) => ({ ...f, fotoFile: e.target.files?.[0] ?? null }))
                }
              />
            </label>
            {form.foto_storage_path && !form.fotoFile ? (
              <p className="muted" style={{ margin: 0 }}>
                Trenutna: {form.foto_storage_path.slice(0, 60)}
                {form.foto_storage_path.length > 60 ? "…" : ""}
              </p>
            ) : null}
            {form.fotoFile ? (
              <p className="muted" style={{ margin: 0 }}>
                Nova datoteka: {form.fotoFile.name}
              </p>
            ) : null}
            <div className="row">
              <button className="primary" type="submit">
                {editingId ? "Sačuvaj" : "Dodaj aktivnost"}
              </button>
              {editingId ? (
                <button type="button" onClick={startNew}>
                  Otkaži izmenu
                </button>
              ) : null}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
