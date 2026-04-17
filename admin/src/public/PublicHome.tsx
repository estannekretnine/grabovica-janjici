import { useEffect, useMemo, useState } from "react";
import { audit } from "../lib/supabase";
import { loadFamilyGraph, type PersonRow } from "../lib/familyTreeGraphLoad";
import { findAnchorPersonId } from "../lib/homeAncestorTree";
import {
  HOME_TREE_ANCHOR_FIRST,
  HOME_TREE_ANCHOR_LAST,
  PUBLIC_FAMILY_TREE_ID,
} from "../lib/publicFamilyTree";
import { PUBLIC_IMG_DURMITOR } from "./publicMedia";
import { HomeAncestorFan } from "./HomeAncestorFan";

export function PublicHome() {
  const [persons, setPersons] = useState<PersonRow[]>([]);
  const [relations, setRelations] = useState<
    { parent_person_id: string; child_person_id: string }[]
  >([]);
  const [rootId, setRootId] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [anchorMissing, setAnchorMissing] = useState(false);

  useEffect(() => {
    if (!audit) {
      setLoadErr("Aplikacija nije povezana sa bazom.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const { data, error } = await loadFamilyGraph(PUBLIC_FAMILY_TREE_ID);
      if (cancelled) return;
      if (error) {
        setLoadErr(error);
        setPersons([]);
        setRelations([]);
        setRootId(null);
        setAnchorMissing(false);
      } else {
        setLoadErr(null);
        setPersons(data.persons);
        setRelations(data.relations);
        const anchor = findAnchorPersonId(data.persons, HOME_TREE_ANCHOR_FIRST, HOME_TREE_ANCHOR_LAST);
        if (anchor) {
          setRootId(anchor);
          setAnchorMissing(false);
        } else {
          setRootId(null);
          setAnchorMissing(true);
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rootPerson = useMemo(
    () => (rootId ? persons.find((p) => p.id === rootId) ?? null : null),
    [persons, rootId]
  );

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
        <div className="public-card public-home-tree-card">
          <h2 className="public-section-title">Stablo predaka</h2>
          <p className="public-muted public-home-tree-lead">
            <strong>{HOME_TREE_ANCHOR_FIRST} {HOME_TREE_ANCHOR_LAST}</strong> u korenu (dno drveta); linije vode
            naviše ka roditeljima i daljim pretcima iz baze.
          </p>

          {loadErr ? <p className="public-muted">{loadErr}</p> : null}
          {loading ? <p className="public-muted">Učitavanje stabla…</p> : null}

          {!loading && !loadErr && anchorMissing ? (
            <p className="public-muted">
              U glavnom stablu nije pronađena osoba „{HOME_TREE_ANCHOR_FIRST} {HOME_TREE_ANCHOR_LAST}“. Proverite
              ime i prezime u administraciji (osobe).
            </p>
          ) : null}

          {!loading && !loadErr && rootId && rootPerson ? (
            <HomeAncestorFan rootId={rootId} persons={persons} relations={relations} />
          ) : null}
        </div>
      </section>
    </div>
  );
}
