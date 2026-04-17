import { useCallback, useEffect, useMemo, useState } from "react";
import { audit, supabase } from "../lib/supabase";
import { PUBLIC_FAMILY_TREE_ID } from "../lib/publicFamilyTree";
import type { Database } from "../types/database";

type PersonRow = Database["audit"]["Tables"]["gr_persons"]["Row"];
type PartnershipRow = Database["audit"]["Tables"]["gr_partnerships"]["Row"];
type DrzavaRow = Database["public"]["Tables"]["drzava"]["Row"];
type OpstinaRow = Database["public"]["Tables"]["opstina"]["Row"];
type LokacijaRow = Database["public"]["Tables"]["lokacija"]["Row"];
type ActivityRow = Database["audit"]["Tables"]["gr_aktivnosti"]["Row"];

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

function genderLabel(g: string | null): string {
  if (g === "male") return "Muško";
  if (g === "female") return "Žensko";
  return g ?? "—";
}

export function PublicPretraga() {
  const [persons, setPersons] = useState<PersonRow[]>([]);
  const [partnerships, setPartnerships] = useState<PartnershipRow[]>([]);
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

  const [searchTriggered, setSearchTriggered] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<{
    drzava: number | "";
    opstina: number | "";
    lokacija: number | "";
    status: "" | "ziv" | "mrtav";
    keyword: string;
  }>({ drzava: "", opstina: "", lokacija: "", status: "", keyword: "" });

  const [selectedPerson, setSelectedPerson] = useState<PersonRow | null>(null);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!audit || !supabase) {
      setError("Aplikacija nije povezana sa bazom.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const [pRes, partRes, dRes, oRes, lRes] = await Promise.all([
      audit
        .from("gr_persons")
        .select("*")
        .eq("tree_id", PUBLIC_FAMILY_TREE_ID)
        .order("last_name")
        .order("first_name"),
      audit.from("gr_partnerships").select("*"),
      supabase.from("drzava").select("*").order("opis"),
      supabase.from("opstina").select("*").order("opis"),
      supabase.from("lokacija").select("*").order("opis"),
    ]);

    if (pRes.error) {
      setError(pRes.error.message);
    } else {
      setPersons(pRes.data ?? []);
    }
    setPartnerships(partRes.data ?? []);
    setDrzave(dRes.data ?? []);
    setOpstine(oRes.data ?? []);
    setLokacije(lRes.data ?? []);
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

  const getPartner = useCallback(
    (personId: string): PersonRow | null => {
      const rel = partnerships.find(
        (r) => r.person_a_id === personId || r.person_b_id === personId
      );
      if (!rel) return null;
      const partnerId = rel.person_a_id === personId ? rel.person_b_id : rel.person_a_id;
      return personsById.get(partnerId) ?? null;
    },
    [partnerships, personsById]
  );

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

  const hasAnyFilter =
    filterDrzava !== "" ||
    filterOpstina !== "" ||
    filterLokacija !== "" ||
    filterStatus !== "";

  const hasKeyword = filterKeyword.trim() !== "";

  function doSearch() {
    setAppliedFilters({
      drzava: filterDrzava,
      opstina: filterOpstina,
      lokacija: filterLokacija,
      status: filterStatus,
      keyword: filterKeyword.trim(),
    });
    setSearchTriggered(true);
  }

  function doKeywordSearch() {
    setAppliedFilters({
      drzava: "",
      opstina: "",
      lokacija: "",
      status: "",
      keyword: filterKeyword.trim(),
    });
    setSearchTriggered(true);
  }

  const filtered = useMemo(() => {
    if (!searchTriggered) return [];

    let list = persons;
    const f = appliedFilters;

    if (f.drzava !== "") {
      list = list.filter((p) => p.drzavaid === f.drzava);
    }

    if (f.opstina !== "") {
      list = list.filter((p) => p.opstinaid === f.opstina);
    }

    if (f.lokacija !== "") {
      list = list.filter((p) => p.lokacijaid === f.lokacija);
    }

    if (f.status === "ziv") {
      list = list.filter((p) => p.is_living === true);
    } else if (f.status === "mrtav") {
      list = list.filter((p) => p.is_living === false || (p.death_date && p.death_date.trim() !== ""));
    }

    const kw = f.keyword.toLowerCase();
    if (kw) {
      list = list.filter((p) => {
        const hay = [p.first_name, p.last_name, p.notes, p.karijera, p.birth_place, p.death_place]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(kw);
      });
    }

    return list;
  }, [persons, searchTriggered, appliedFilters]);

  function resetFilters() {
    setFilterDrzava("");
    setFilterOpstina("");
    setFilterLokacija("");
    setFilterStatus("");
    setFilterKeyword("");
    setSearchTriggered(false);
    setAppliedFilters({ drzava: "", opstina: "", lokacija: "", status: "", keyword: "" });
  }

  async function openPersonModal(p: PersonRow) {
    setSelectedPerson(p);
    setActivities([]);
    if (!audit) return;
    setActivitiesLoading(true);
    const { data } = await audit
      .from("gr_aktivnosti")
      .select("*")
      .eq("person_id", p.id)
      .order("redosled")
      .order("created_at");
    setActivities(data ?? []);
    setActivitiesLoading(false);
  }

  function closeModal() {
    setSelectedPerson(null);
    setActivities([]);
  }

  function getLokacijaLabel(p: PersonRow): string {
    const lokNaziv = p.lokacijaid ? lokacijaById.get(p.lokacijaid) : null;
    const opNaziv = p.opstinaid ? opstinaById.get(p.opstinaid) : null;
    const drzNaziv = p.drzavaid ? drzavaById.get(p.drzavaid) : null;
    return [lokNaziv, opNaziv, drzNaziv].filter(Boolean).join(", ");
  }

  function getMestoRodjenjaLabel(p: PersonRow): string {
    const lokNaziv = p.lokacijaidrodio ? lokacijaById.get(p.lokacijaidrodio) : null;
    const opNaziv = p.opstinaidrodio ? opstinaById.get(p.opstinaidrodio) : null;
    const drzNaziv = p.drzavaidrodio ? drzavaById.get(p.drzavaidrodio) : null;
    const fromDb = [lokNaziv, opNaziv, drzNaziv].filter(Boolean).join(", ");
    if (fromDb) return fromDb;
    return p.birth_place ?? "";
  }

  return (
    <div className="public-page public-pretraga-page">
      <section className="public-section">
        <h1 className="public-page-title">Pretraga članova</h1>
        <p className="public-lead">
          Pronađite članove porodice po lokaciji, statusu ili ključnoj reči. Unesite bar jedan kriterijum i kliknite
          „Traži".
        </p>

        {error ? <p className="public-muted">{error}</p> : null}

        <div className="public-pretraga-filters">
          <div className="public-pretraga-filters-heading">Prebivalište</div>
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

          <button
            type="button"
            className="public-pretraga-search"
            onClick={doSearch}
            disabled={!hasAnyFilter}
          >
            Traži
          </button>

          <button type="button" className="public-pretraga-reset" onClick={resetFilters}>
            Resetuj
          </button>
        </div>

        <div className="public-pretraga-keyword-section">
          <label className="public-pretraga-label public-pretraga-label--wide">
            Ključna reč (ime, napomena, karijera…)
            <input
              type="search"
              value={filterKeyword}
              onChange={(e) => setFilterKeyword(e.target.value)}
              placeholder="Unesite tekst za pretragu…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && hasKeyword) doKeywordSearch();
              }}
            />
          </label>
          <button
            type="button"
            className="public-pretraga-search"
            onClick={doKeywordSearch}
            disabled={!hasKeyword}
          >
            Traži po ključnoj reči
          </button>
        </div>

        {loading ? <p className="public-muted">Učitavanje podataka…</p> : null}

        {!loading && !error && !searchTriggered ? (
          <p className="public-muted public-pretraga-hint">
            Izaberite filtere ili unesite ključnu reč, zatim kliknite „Traži".
          </p>
        ) : null}

        {!loading && !error && searchTriggered ? (
          <div className="public-pretraga-results">
            <p className="public-muted public-pretraga-count">
              Pronađeno: <strong>{filtered.length}</strong> {filtered.length === 1 ? "član" : "članova"}
            </p>

            {filtered.length > 0 ? (
              <div className="public-pretraga-grid">
                {filtered.map((p) => {
                  const partner = getPartner(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className="public-pretraga-card"
                      onClick={() => void openPersonModal(p)}
                    >
                      <div className="public-pretraga-card-name">{personLabel(p)}</div>
                      {partner ? (
                        <div className="public-pretraga-card-partner">
                          <em>Partner/ka: {personLabel(partner)}</em>
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="public-muted">Nema članova koji odgovaraju kriterijumima.</p>
            )}
          </div>
        ) : null}
      </section>

      {selectedPerson ? (
        <div className="public-pretraga-modal-backdrop" onClick={closeModal}>
          <div className="public-pretraga-modal" onClick={(e) => e.stopPropagation()}>
            <div className="public-pretraga-modal-head">
              <strong>{personLabel(selectedPerson)}</strong>
              <button type="button" className="public-pretraga-modal-close" onClick={closeModal}>
                ×
              </button>
            </div>

            <div className="public-pretraga-modal-body">
              <h3 className="public-pretraga-modal-section-title">Detalji</h3>
              <dl className="public-pretraga-modal-dl">
                {selectedPerson.middle_name?.trim() ? (
                  <>
                    <dt>Srednje ime</dt>
                    <dd>{selectedPerson.middle_name}</dd>
                  </>
                ) : null}
                {selectedPerson.maiden_name?.trim() ? (
                  <>
                    <dt>Devojačko prezime</dt>
                    <dd>{selectedPerson.maiden_name}</dd>
                  </>
                ) : null}
                <dt>Pol</dt>
                <dd>{genderLabel(selectedPerson.gender)}</dd>
                <dt>Datum rođenja</dt>
                <dd>{selectedPerson.birth_date ?? "—"}</dd>
                <dt>Mesto rođenja</dt>
                <dd>{getMestoRodjenjaLabel(selectedPerson) || "—"}</dd>
                <dt>Živ/a</dt>
                <dd>
                  {selectedPerson.is_living === true
                    ? "Da"
                    : selectedPerson.is_living === false
                      ? "Ne"
                      : "—"}
                </dd>
                {selectedPerson.death_date || selectedPerson.is_living === false ? (
                  <>
                    <dt>Datum smrti</dt>
                    <dd>{selectedPerson.death_date ?? "—"}</dd>
                    <dt>Mesto smrti</dt>
                    <dd>{selectedPerson.death_place ?? "—"}</dd>
                  </>
                ) : null}
                <dt>Prebivalište</dt>
                <dd>{getLokacijaLabel(selectedPerson) || "—"}</dd>
                {selectedPerson.karijera?.trim() ? (
                  <>
                    <dt>Karijera</dt>
                    <dd className="public-pretraga-modal-karijera">{selectedPerson.karijera}</dd>
                  </>
                ) : null}
                {selectedPerson.notes?.trim() ? (
                  <>
                    <dt>Napomene</dt>
                    <dd className="public-pretraga-modal-notes">{selectedPerson.notes}</dd>
                  </>
                ) : null}
              </dl>

              <h3 className="public-pretraga-modal-section-title">Aktivnosti</h3>
              {activitiesLoading ? <p className="public-muted">Učitavanje aktivnosti…</p> : null}
              {!activitiesLoading && activities.length === 0 ? (
                <p className="public-muted">Nema unetih aktivnosti.</p>
              ) : null}
              {!activitiesLoading && activities.length > 0 ? (
                <div className="public-pretraga-modal-activities">
                  {activities.map((a) => (
                    <div key={a.id} className="public-pretraga-activity">
                      <div className="public-pretraga-activity-title">
                        {a.naslov}
                        {a.datum ? <span className="public-pretraga-activity-date">{a.datum}</span> : null}
                      </div>
                      {a.opis?.trim() ? <p className="public-pretraga-activity-opis">{a.opis}</p> : null}
                      {a.veb_link?.trim() ? (
                        <a
                          href={a.veb_link.startsWith("http") ? a.veb_link : `https://${a.veb_link}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="public-pretraga-activity-link"
                        >
                          {a.veb_link}
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
