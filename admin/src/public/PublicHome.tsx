import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { PUBLIC_IMG_DURMITOR, PUBLIC_IMG_TREE } from "./publicMedia";

type HomePerson = {
  first_name?: string;
  last_name?: string;
  birth_date?: string | null;
  birth_place?: string | null;
  death_date?: string | null;
  gender?: string | null;
  is_living?: boolean | null;
};

export function PublicHome() {
  const [person, setPerson] = useState<HomePerson | null>(null);
  const [personErr, setPersonErr] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setPersonErr("Aplikacija nije povezana sa bazom.");
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.rpc("get_public_home_person");
      if (cancelled) return;
      if (error) setPersonErr(error.message);
      else {
        setPersonErr(null);
        setPerson((data as HomePerson | null) ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const name =
    person && `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim()
      ? `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim()
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

      <section className="public-section public-section--split">
        <div className="public-card public-card--person">
          <h2 className="public-section-title">Nasumičan član</h2>
          {personErr ? <p className="public-muted">{personErr}</p> : null}
          {!personErr && !person ? <p className="public-muted">Učitavanje…</p> : null}
          {person && name ? (
            <dl className="public-dl">
              <dt>Ime i prezime</dt>
              <dd>{name}</dd>
              {person.birth_date ? (
                <>
                  <dt>Datum rođenja</dt>
                  <dd>{person.birth_date}</dd>
                </>
              ) : null}
              {person.birth_place ? (
                <>
                  <dt>Mesto rođenja</dt>
                  <dd>{person.birth_place}</dd>
                </>
              ) : null}
              {person.gender ? (
                <>
                  <dt>Pol</dt>
                  <dd>{person.gender}</dd>
                </>
              ) : null}
              {person.is_living != null ? (
                <>
                  <dt>Živ/živa</dt>
                  <dd>{person.is_living ? "da" : "ne"}</dd>
                </>
              ) : null}
            </dl>
          ) : null}
          {person && !name ? <p className="public-muted">Nema podataka o članu u stablu.</p> : null}
        </div>
        <div className="public-card public-card--tree">
          <h2 className="public-section-title">Rodoslovno stablo</h2>
          <p className="public-muted public-tree-caption">
            Inspiracija vizuelnog prikaza veza između generacija (ilustracija).
          </p>
          <img
            src={PUBLIC_IMG_TREE}
            alt="Ilustracija rodoslovnog stabla"
            className="public-tree-img"
            loading="lazy"
          />
        </div>
      </section>
    </div>
  );
}
