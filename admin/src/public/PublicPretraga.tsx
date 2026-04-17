import { useCallback, useEffect, useMemo, useState } from "react";
import { audit, supabase } from "../lib/supabase";
import { PUBLIC_FAMILY_TREE_ID } from "../lib/publicFamilyTree";
import type { Database } from "../types/database";

type PersonRow = Database["audit"]["Tables"]["gr_persons"]["Row"];
type DrzavaRow = Database["public"]["Tables"]["drzava"]["Row"];
type OpstinaRow = Database["public"]["Tables"]["opstina"]["Row"];
type LokacijaRow = Database["public"]["Tables"]["lokacija"]["Row"];

function personLabel(p: Pick<PersonRow, "first_name" | "last_name">): string {
  return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "—";
}

function lifeLineShort(p: Pick<PersonRow, "birth_date" | "death_date" | "is_living">): string {
  const b = p.birth_date?.trim() || "—";
  const d = p.death_date?.trim();
  if (d) return `${b} – ${d}`;
  if (p.is_living === false) return `${b} –`;
  return b;
}

export function PublicPretraga() {
  const [persons, setPersons] = useState<PersonRow[]>([]);
  const [drzave, setDrzave] = useState<DrzavaRow[]>([]);
  const [opstine, setOpstine] = useState<OpstinaRow[]>([]);
  const [lokacije, setLokacije] = useState<LokacijaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterDrzava, setFilterDrzava] = useState<number | "">("");
  const [filterOpstina, setFilterOpstina] = useState<number | "">("");
  const [filterLokacija, setFilterLokacija] = useState<number | "">("");
  const [filterStatus, setFilterStatus] = useState<"" | "ziv" | "mrtav">("");
  const [filterKeyword, setFilterKeyword] = useState("");

  const loadData = useCallback(async () => {
    if (!audit || !supabase) {
      setError("Aplikacija nije povezana sa bazom.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const [pRes, dRes, oRes, lRes] = await Promise.all([
      audit
        .from("gr_persons")
        .select("*")
        .eq("tree_id", PUBLIC_FAMILY_TREE_ID)
        .order("last_name")
        .order("first_name"),
      supabase.from("drzava").select("*").order("opis"),
      supabase.from("opstina").select("*").order("opis"),
      supabase.from("lokacija").select("*").order("opis"),
    ]);

    if (pRes.error) {
      setError(pRes.error.message);
    } else {
      setPersons(pRes.data ?? []);
    }
    setDrzave(dRes.data ?? []);
    setOpstine(oRes.data ?? []);
    setLokacije(lRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const drzavaById = useMemo(() => {
    const m = new Map<number, string>();
    for (const d of drzave) m.set(d.id, d.opis ?? `#${d.id}`);
    return m;
  }, [drzave]);

  const opstinaById = useMemo(() => {
    const m = new Map<number, string>();
    for (const o of opstine) m.set(o.id, o.opis ?? `#${o.id}`);
    return m;
  }, [opstine]);

  const lokacijaById = useMemo(() => {
    const m = new Map<number, string>();
    for (const l of lokacije) m.set(l.id, l.opis ?? `#${l.id}`);
    return m;
  }, [lokacije]);

  const filteredOpstine = useMemo(() => {
    if (filterDrzava === "") return opstine;
    return opstine.filter((o) => o.iddrzava === filterDrzava);
  }, [opstine, filterDrzava]);

  const filteredLokacije = useMemo(() => {
    if (filterOpstina === "") return lokacije;
    return lokacije.filter((l) => l.idopstina === filterOpstina);
  }, [lokacije, filterOpstina]);

  useEffect(() => {
    if (filterDrzava !== "" && filterOpstina !== "") {
      const op = opstine.find((o) => o.id === filterOpstina);
      if (op && op.iddrzava !== filterDrzava) {
        setFilterOpstina("");
        setFilterLokacija("");
      }
    }
  }, [filterDrzava, filterOpstina, opstine]);

  useEffect(() => {
    if (filterOpstina !== "" && filterLokacija !== "") {
      const lok = lokacije.find((l) => l.id === filterLokacija);
      if (lok && lok.idopstina !== filterOpstina) {
        setFilterLokacija("");
      }
    }
  }, [filterOpstina, filterLokacija, lokacije]);

  const filtered = useMemo(() => {
    let list = persons;

    if (filterDrzava !== "") {
      list = list.filter(
        (p) => p.drzavaid === filterDrzava || p.drzavaidrodio === filterDrzava
      );
    }

    if (filterOpstina !== "") {
      list = list.filter(
        (p) => p.opstinaid === filterOpstina || p.opstinaidrodio === filterOpstina
      );
    }

    if (filterLokacija !== "") {
      list = list.filter(
        (p) => p.lokacijaid === filterLokacija || p.lokacijaidrodio === filterLokacija
      );
    }

    if (filterStatus === "ziv") {
      list = list.filter((p) => p.is_living === true);
    } else if (filterStatus === "mrtav") {
      list = list.filter((p) => p.is_living === false || (p.death_date && p.death_date.trim() !== ""));
    }

    const kw = filterKeyword.trim().toLowerCase();
    if (kw) {
      list = list.filter((p) => {
        const hay = [
          p.first_name,
          p.last_name,
          p.notes,
          p.karijera,
          p.birth_place,
          p.death_place,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(kw);
      });
    }

    return list;
  }, [persons, filterDrzava, filterOpstina, filterLokacija, filterStatus, filterKeyword]);

  function resetFilters() {
    setFilterDrzava("");
    setFilterOpstina("");
    setFilterLokacija("");
    setFilterStatus("");
    setFilterKeyword("");
  }

  return (
    <div className="public-page public-pretraga-page">
      <section className="public-section">
        <h1 className="public-page-title">Pretraga članova</h1>
        <p className="public-lead">
          Pronađite članove porodice po lokaciji, statusu ili ključnoj reči (ime, napomene, karijera).
        </p>

        {error ? <p className="public-muted">{error}</p> : null}

        <div className="public-pretraga-filters">
          <label className="public-pretraga-label">
            Država
            <select
              value={filterDrzava}
              onChange={(e) => setFilterDrzava(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">— sve —</option>
              {drzave.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.opis ?? `#${d.id}`}
                </option>
              ))}
            </select>
          </label>

          <label className="public-pretraga-label">
            Opština
            <select
              value={filterOpstina}
              onChange={(e) => setFilterOpstina(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">— sve —</option>
              {filteredOpstine.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.opis ?? `#${o.id}`}
                </option>
              ))}
            </select>
          </label>

          <label className="public-pretraga-label">
            Lokacija
            <select
              value={filterLokacija}
              onChange={(e) => setFilterLokacija(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">— sve —</option>
              {filteredLokacije.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.opis ?? `#${l.id}`}
                </option>
              ))}
            </select>
          </label>

          <label className="public-pretraga-label">
            Status
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as "" | "ziv" | "mrtav")}
            >
              <option value="">— svi —</option>
              <option value="ziv">Živ</option>
              <option value="mrtav">Preminuo</option>
            </select>
          </label>

          <label className="public-pretraga-label public-pretraga-label--wide">
            Ključna reč
            <input
              type="search"
              value={filterKeyword}
              onChange={(e) => setFilterKeyword(e.target.value)}
              placeholder="Ime, napomena, karijera…"
            />
          </label>

          <button type="button" className="public-pretraga-reset" onClick={resetFilters}>
            Resetuj filtere
          </button>
        </div>

        {loading ? <p className="public-muted">Učitavanje…</p> : null}

        {!loading && !error ? (
          <div className="public-pretraga-results">
            <p className="public-muted public-pretraga-count">
              Pronađeno: <strong>{filtered.length}</strong> {filtered.length === 1 ? "član" : "članova"}
            </p>

            {filtered.length > 0 ? (
              <div className="public-pretraga-grid">
                {filtered.map((p) => {
                  const drzNaziv = p.drzavaid ? drzavaById.get(p.drzavaid) : null;
                  const opNaziv = p.opstinaid ? opstinaById.get(p.opstinaid) : null;
                  const lokNaziv = p.lokacijaid ? lokacijaById.get(p.lokacijaid) : null;
                  const lokLabel = [lokNaziv, opNaziv, drzNaziv].filter(Boolean).join(", ");
                  return (
                    <div key={p.id} className="public-pretraga-card">
                      <div className="public-pretraga-card-name">{personLabel(p)}</div>
                      <div className="public-pretraga-card-life">{lifeLineShort(p)}</div>
                      {lokLabel ? (
                        <div className="public-pretraga-card-loc">{lokLabel}</div>
                      ) : null}
                      {p.karijera?.trim() ? (
                        <div className="public-pretraga-card-karijera" title={p.karijera}>
                          {p.karijera.length > 80 ? `${p.karijera.slice(0, 78)}…` : p.karijera}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="public-muted">Nema članova koji odgovaraju filterima.</p>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
