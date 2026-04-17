import { useEffect, useMemo, useState } from "react";
import { audit, supabase } from "../lib/supabase";
import { loadFamilyGraph, type PersonRow, type PartRow, type PcRow } from "../lib/familyTreeGraphLoad";
import { PUBLIC_FAMILY_TREE_ID } from "../lib/publicFamilyTree";
import { PUBLIC_IMG_DURMITOR } from "./publicMedia";

function personLabel(p: Pick<PersonRow, "first_name" | "last_name">): string {
  return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "—";
}

function getDefaultPhotoPath(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return trimmed;
  try {
    const parsed = JSON.parse(trimmed) as
      | { defaultIndex?: number; items?: Array<{ path?: string }> }
      | Array<string>;
    if (Array.isArray(parsed)) return parsed[0] ? String(parsed[0]) : null;
    const items = parsed.items ?? [];
    if (!items.length) return null;
    const idx = parsed.defaultIndex ?? 0;
    const safe = idx >= 0 && idx < items.length ? idx : 0;
    return items[safe]?.path ? String(items[safe].path) : null;
  } catch {
    return null;
  }
}

function toPublicPhotoUrl(path: string | null): string | null {
  if (!path || !supabase) return null;
  const normalized = path.replace(/^bucket\//, "");
  return supabase.storage.from("bucket").getPublicUrl(normalized).data.publicUrl;
}

function lifeLineShort(p: Pick<PersonRow, "birth_date" | "death_date" | "is_living">): string {
  const b = p.birth_date?.trim() || "";
  const d = p.death_date?.trim();
  if (d) return `${b || "?"} – ${d}`;
  if (p.is_living === false) return b ? `${b} –` : "";
  return b;
}

export function PublicHome() {
  const [persons, setPersons] = useState<PersonRow[]>([]);
  const [partnerships, setPartnerships] = useState<PartRow[]>([]);
  const [parentChild, setParentChild] = useState<PcRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [randomPerson, setRandomPerson] = useState<PersonRow | null>(null);

  useEffect(() => {
    if (!audit) {
      setError("Aplikacija nije povezana sa bazom.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const { data, error: err } = await loadFamilyGraph(PUBLIC_FAMILY_TREE_ID);
      if (cancelled) return;
      if (err) {
        setError(err);
        setLoading(false);
        return;
      }
      setError(null);
      setPersons(data.persons);
      setPartnerships(data.partnerships);
      setParentChild(data.relations);

      // Pick a random person who has a photo
      const withPhoto = data.persons.filter((p) => {
        const path = getDefaultPhotoPath(p.photo_storage_path);
        return path !== null;
      });
      if (withPhoto.length > 0) {
        const idx = Math.floor(Math.random() * withPhoto.length);
        setRandomPerson(withPhoto[idx]);
      } else if (data.persons.length > 0) {
        // Fallback: pick anyone
        const idx = Math.floor(Math.random() * data.persons.length);
        setRandomPerson(data.persons[idx]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const personsById = useMemo(() => {
    const m = new Map<string, PersonRow>();
    for (const p of persons) m.set(p.id, p);
    return m;
  }, [persons]);

  // Find partner of the random person
  const partner = useMemo(() => {
    if (!randomPerson) return null;
    const rel = partnerships.find(
      (r) => r.person_a_id === randomPerson.id || r.person_b_id === randomPerson.id
    );
    if (!rel) return null;
    const partnerId = rel.person_a_id === randomPerson.id ? rel.person_b_id : rel.person_a_id;
    return personsById.get(partnerId) ?? null;
  }, [randomPerson, partnerships, personsById]);

  // Find children of the random person (and/or partner)
  const children = useMemo(() => {
    if (!randomPerson) return [];
    const parentIds = new Set<string>([randomPerson.id]);
    if (partner) parentIds.add(partner.id);

    const childIds = new Set<string>();
    for (const rel of parentChild) {
      if (parentIds.has(rel.parent_person_id)) {
        childIds.add(rel.child_person_id);
      }
    }
    return [...childIds]
      .map((id) => personsById.get(id))
      .filter((p): p is PersonRow => p !== undefined)
      .sort((a, b) => {
        const aDate = a.birth_date ?? "";
        const bDate = b.birth_date ?? "";
        return aDate.localeCompare(bDate);
      });
  }, [randomPerson, partner, parentChild, personsById]);

  const mainPhotoUrl = randomPerson
    ? toPublicPhotoUrl(getDefaultPhotoPath(randomPerson.photo_storage_path))
    : null;
  const partnerPhotoUrl = partner
    ? toPublicPhotoUrl(getDefaultPhotoPath(partner.photo_storage_path))
    : null;

  return (
    <div className="public-page">
      <section className="public-hero" style={{ backgroundImage: `url(${PUBLIC_IMG_DURMITOR})` }}>
        <div className="public-hero-overlay" />
        <div className="public-hero-content">
          <h1 className="public-hero-title">Porodica Janjić — Grabovica</h1>
          <p className="public-hero-sub">
            Rodoslov i zajednica: činjenice, generacije i veze koje povezuju porodicu u Crnoj Gori i dijaspori.
          </p>
        </div>
      </section>

      <section className="public-section">
        <div className="public-home-family-card">
          <h2 className="public-section-title">Nasumična porodica</h2>

          {loading ? <p className="public-muted">Učitavanje…</p> : null}
          {error ? <p className="public-muted">{error}</p> : null}

          {!loading && !error && !randomPerson ? (
            <p className="public-muted">Nema članova u stablu.</p>
          ) : null}

          {!loading && !error && randomPerson ? (
            <>
              <div className="public-home-parents">
                <div className="public-home-person">
                  <div className="public-home-person-name">{personLabel(randomPerson)}</div>
                  {lifeLineShort(randomPerson) ? (
                    <div className="public-home-person-life">{lifeLineShort(randomPerson)}</div>
                  ) : null}
                  {mainPhotoUrl ? (
                    <img
                      src={mainPhotoUrl}
                      alt={personLabel(randomPerson)}
                      className="public-home-person-photo"
                    />
                  ) : (
                    <div className="public-home-person-photo public-home-person-photo--placeholder">
                      ?
                    </div>
                  )}
                </div>

                {partner ? (
                  <div className="public-home-person">
                    <div className="public-home-person-name">{personLabel(partner)}</div>
                    {lifeLineShort(partner) ? (
                      <div className="public-home-person-life">{lifeLineShort(partner)}</div>
                    ) : null}
                    {partnerPhotoUrl ? (
                      <img
                        src={partnerPhotoUrl}
                        alt={personLabel(partner)}
                        className="public-home-person-photo"
                      />
                    ) : (
                      <div className="public-home-person-photo public-home-person-photo--placeholder">
                        ?
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              {children.length > 0 ? (
                <>
                  <h3 className="public-home-children-title">
                    Deca ({children.length})
                  </h3>
                  <div className="public-home-children">
                    {children.map((child) => {
                      const childPhotoUrl = toPublicPhotoUrl(
                        getDefaultPhotoPath(child.photo_storage_path)
                      );
                      return (
                        <div key={child.id} className="public-home-child">
                          {childPhotoUrl ? (
                            <img
                              src={childPhotoUrl}
                              alt={personLabel(child)}
                              className="public-home-child-photo"
                            />
                          ) : (
                            <div className="public-home-child-photo public-home-child-photo--placeholder">
                              ?
                            </div>
                          )}
                          <div className="public-home-child-name">{personLabel(child)}</div>
                          {lifeLineShort(child) ? (
                            <div className="public-home-child-life">{lifeLineShort(child)}</div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="public-muted public-home-no-children">Nema unetih potomaka.</p>
              )}
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
