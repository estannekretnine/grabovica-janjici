import { useCallback, useEffect, useMemo, useState } from "react";
import { audit, supabase } from "../lib/supabase";
import { PUBLIC_FAMILY_TREE_ID } from "../lib/publicFamilyTree";
import type { Database } from "../types/database";

type ActivityRow = Database["audit"]["Tables"]["gr_aktivnosti"]["Row"];
type PersonRow = Database["audit"]["Tables"]["gr_persons"]["Row"];

function toPublicPhotoUrl(path: string | null | undefined): string | null {
  if (!path?.trim() || !supabase) return null;
  const normalized = path.trim().replace(/^bucket\//, "");
  return supabase.storage.from("bucket").getPublicUrl(normalized).data.publicUrl;
}

export function PublicAktivnosti() {
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [persons, setPersons] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedActivity, setSelectedActivity] = useState<ActivityRow | null>(null);

  const loadData = useCallback(async () => {
    if (!audit) {
      setError("Aplikacija nije povezana sa bazom.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const [aRes, pRes] = await Promise.all([
      audit
        .from("gr_aktivnosti")
        .select("*")
        .order("created_at", { ascending: false }),
      audit
        .from("gr_persons")
        .select("id, first_name, last_name")
        .eq("tree_id", PUBLIC_FAMILY_TREE_ID),
    ]);

    if (aRes.error) {
      setError(aRes.error.message);
    } else {
      setActivities(aRes.data ?? []);
    }
    setPersons(pRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const personsById = useMemo(() => {
    const m = new Map<string, PersonRow>();
    for (const p of persons) m.set(p.id, p);
    return m;
  }, [persons]);

  function getPersonLabel(personId: string | null): string {
    if (!personId) return "—";
    const p = personsById.get(personId);
    if (!p) return "—";
    return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "—";
  }

  function openActivity(a: ActivityRow) {
    setSelectedActivity(a);
  }

  function closeModal() {
    setSelectedActivity(null);
  }

  return (
    <div className="public-page public-aktivnosti-page">
      <section className="public-section">
        <h1 className="public-page-title">Aktivnosti</h1>
        <p className="public-lead">
          Pregled svih aktivnosti članova porodice — najnovije prvo.
        </p>

        {error ? <p className="public-muted">{error}</p> : null}
        {loading ? <p className="public-muted">Učitavanje aktivnosti…</p> : null}

        {!loading && !error && activities.length === 0 ? (
          <p className="public-muted">Nema unetih aktivnosti.</p>
        ) : null}

        {!loading && !error && activities.length > 0 ? (
          <div className="public-aktivnosti-grid">
            {activities.map((a) => {
              const thumbUrl = toPublicPhotoUrl(a.thumbnail_path);
              return (
                <button
                  key={a.id}
                  type="button"
                  className="public-aktivnosti-card"
                  onClick={() => openActivity(a)}
                >
                  {thumbUrl ? (
                    <img src={thumbUrl} alt="" className="public-aktivnosti-card-thumb" />
                  ) : null}
                  <div className="public-aktivnosti-card-body">
                    <div className="public-aktivnosti-card-title">{a.naslov}</div>
                    {a.datum ? (
                      <div className="public-aktivnosti-card-date">{a.datum}</div>
                    ) : null}
                    <div className="public-aktivnosti-card-person">
                      {getPersonLabel(a.person_id)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
      </section>

      {selectedActivity ? (
        <div className="public-aktivnosti-modal-backdrop" onClick={closeModal}>
          <div className="public-aktivnosti-modal" onClick={(e) => e.stopPropagation()}>
            <div className="public-aktivnosti-modal-head">
              <strong>{selectedActivity.naslov}</strong>
              <button type="button" className="public-aktivnosti-modal-close" onClick={closeModal}>
                ×
              </button>
            </div>
            <div className="public-aktivnosti-modal-body">
              {selectedActivity.datum ? (
                <p className="public-aktivnosti-modal-date">
                  <strong>Datum:</strong> {selectedActivity.datum}
                </p>
              ) : null}
              <p className="public-aktivnosti-modal-person">
                <strong>Član:</strong> {getPersonLabel(selectedActivity.person_id)}
              </p>
              {selectedActivity.opis?.trim() ? (
                <div className="public-aktivnosti-modal-opis">
                  <strong>Opis:</strong>
                  <p>{selectedActivity.opis}</p>
                </div>
              ) : null}
              {selectedActivity.veb_link?.trim() ? (
                <p className="public-aktivnosti-modal-link">
                  <strong>Link:</strong>{" "}
                  <a
                    href={
                      selectedActivity.veb_link.startsWith("http")
                        ? selectedActivity.veb_link
                        : `https://${selectedActivity.veb_link}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {selectedActivity.veb_link}
                  </a>
                </p>
              ) : null}
              {toPublicPhotoUrl(selectedActivity.thumbnail_path) ? (
                <img
                  src={toPublicPhotoUrl(selectedActivity.thumbnail_path)!}
                  alt=""
                  className="public-aktivnosti-modal-img"
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
