import { useCallback, useEffect, useMemo, useState } from "react";
import { audit, supabase } from "../lib/supabase";
import { ensureDefaultTreeExists } from "../lib/ensureDefaultTree";
import { DEFAULT_TREE_ID } from "../constants";
import { TablePagination } from "../components/TablePagination";
import type { Database } from "../types/database";
import type { PartnershipType, RelationSubtype } from "../types/database";

type PersonRow = Database["audit"]["Tables"]["gr_persons"]["Row"];
type TreeRow = Database["audit"]["Tables"]["gr_family_trees"]["Row"];
type PcRow = Database["audit"]["Tables"]["gr_parent_child"]["Row"];
type PartRow = Database["audit"]["Tables"]["gr_partnerships"]["Row"];
type OpstinaRow = Database["public"]["Tables"]["opstina"]["Row"];

function personLabel(p: Pick<PersonRow, "first_name" | "middle_name" | "last_name">) {
  const mid = (p.middle_name ?? "").trim();
  const midInitial = mid ? `${mid.charAt(0).toUpperCase()}.` : "";
  const a = [p.first_name, midInitial, p.last_name]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return a || "(bez imena)";
}

export function RelationshipsPage() {
  const [tab, setTab] = useState<"pc" | "part">("pc");
  const [trees, setTrees] = useState<TreeRow[]>([]);
  const [treeId, setTreeId] = useState(DEFAULT_TREE_ID);
  const [persons, setPersons] = useState<PersonRow[]>([]);
  const [opstine, setOpstine] = useState<OpstinaRow[]>([]);
  const [pcRows, setPcRows] = useState<PcRow[]>([]);
  const [partRows, setPartRows] = useState<PartRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [pcParent, setPcParent] = useState("");
  const [pcChild, setPcChild] = useState("");
  const [pcParentSearch, setPcParentSearch] = useState("");
  const [pcChildSearch, setPcChildSearch] = useState("");
  const [pcSubtype, setPcSubtype] = useState<RelationSubtype>("biological");
  const [pcNotes, setPcNotes] = useState("");

  const [pA, setPA] = useState("");
  const [pB, setPB] = useState("");
  const [pASearch, setPASearch] = useState("");
  const [pBSearch, setPBSearch] = useState("");
  const [pType, setPType] = useState<PartnershipType>("marriage");
  const [pStart, setPStart] = useState("");
  const [pEnd, setPEnd] = useState("");
  const [pPlace, setPPlace] = useState("");
  const [pNotes, setPNotes] = useState("");

  const [pcListPage, setPcListPage] = useState(1);
  const [pcListPageSize, setPcListPageSize] = useState(25);
  const [partListPage, setPartListPage] = useState(1);
  const [partListPageSize, setPartListPageSize] = useState(25);

  const loadTrees = useCallback(async () => {
    const { data } = await audit!.from("gr_family_trees").select("*").order("name");
    setTrees(data ?? []);
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

  const loadOpstine = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from("opstina").select("*").order("opis", { ascending: true });
    setOpstine(data ?? []);
  }, []);

  const loadParentChild = useCallback(async () => {
    const ids = persons.map((p) => p.id);
    if (ids.length === 0) {
      setPcRows([]);
      return;
    }
    const { data, error: qErr } = await audit!
      .from("gr_parent_child")
      .select("*")
      .in("parent_person_id", ids)
      .in("child_person_id", ids);
    if (qErr) setError(qErr.message);
    else {
      setError(null);
      setPcRows(data ?? []);
    }
  }, [persons]);

  const loadPartnerships = useCallback(async () => {
    const ids = persons.map((p) => p.id);
    if (ids.length === 0) {
      setPartRows([]);
      return;
    }
    const { data, error: qErr } = await audit!
      .from("gr_partnerships")
      .select("*")
      .in("person_a_id", ids)
      .in("person_b_id", ids);
    if (qErr) setError(qErr.message);
    else {
      setError(null);
      setPartRows(data ?? []);
    }
  }, [persons]);

  useEffect(() => {
    void (async () => {
      const bootErr = await ensureDefaultTreeExists();
      if (bootErr) setError(bootErr.message);
      await loadTrees();
      await loadOpstine();
    })();
  }, [loadTrees, loadOpstine]);

  useEffect(() => {
    void loadPersons(treeId);
  }, [treeId, loadPersons]);

  useEffect(() => {
    void loadParentChild();
  }, [loadParentChild]);

  useEffect(() => {
    void loadPartnerships();
  }, [loadPartnerships]);

  const personById = useMemo(() => {
    const m = new Map<string, PersonRow>();
    for (const p of persons) m.set(p.id, p);
    return m;
  }, [persons]);

  const treeOptions = useMemo(
    () =>
      trees.length
        ? trees
        : [{ id: DEFAULT_TREE_ID, name: "Glavno (podrazumevano)", slug: "default", created_at: "" }],
    [trees]
  );

  const opstinaById = useMemo(() => {
    const m = new Map<number, string>();
    for (const o of opstine) m.set(o.id, o.opis ?? `id ${o.id}`);
    return m;
  }, [opstine]);

  function personFullLabel(p: PersonRow) {
    const ime = personLabel(p);
    const opstina =
      p.opstinaid != null ? (opstinaById.get(p.opstinaid) ?? `id ${p.opstinaid}`) : "bez opštine";
    return `${ime} — ${opstina}`;
  }

  const pcTotalPages = Math.max(1, Math.ceil(pcRows.length / pcListPageSize));
  const pcSafePage = Math.min(Math.max(1, pcListPage), pcTotalPages);
  const paginatedPcRows = useMemo(() => {
    const start = (pcSafePage - 1) * pcListPageSize;
    return pcRows.slice(start, start + pcListPageSize);
  }, [pcRows, pcSafePage, pcListPageSize]);

  const partTotalPages = Math.max(1, Math.ceil(partRows.length / partListPageSize));
  const partSafePage = Math.min(Math.max(1, partListPage), partTotalPages);
  const paginatedPartRows = useMemo(() => {
    const start = (partSafePage - 1) * partListPageSize;
    return partRows.slice(start, start + partListPageSize);
  }, [partRows, partSafePage, partListPageSize]);

  useEffect(() => {
    setPcListPage((p) => Math.min(p, pcTotalPages));
  }, [pcTotalPages]);

  useEffect(() => {
    setPartListPage((p) => Math.min(p, partTotalPages));
  }, [partTotalPages]);

  useEffect(() => {
    setPcListPage(1);
    setPartListPage(1);
  }, [treeId]);

  async function addParentChild(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!pcParent || !pcChild || pcParent === pcChild) {
      setError("Izaberite različitog roditelja i deteta.");
      return;
    }
    const { error: insErr } = await audit!.from("gr_parent_child").insert({
      parent_person_id: pcParent,
      child_person_id: pcChild,
      relation_subtype: pcSubtype,
      notes: pcNotes.trim() || null,
    });
    if (insErr) setError(insErr.message);
    else {
      setPcNotes("");
      await loadParentChild();
    }
  }

  async function deletePc(id: string) {
    if (!confirm("Obrisati vezu roditelj–dete?")) return;
    const { error: delErr } = await audit!.from("gr_parent_child").delete().eq("id", id);
    if (delErr) setError(delErr.message);
    else await loadParentChild();
  }

  async function addPartnership(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!pA || !pB || pA === pB) {
      setError("Izaberite dve različite osobe.");
      return;
    }
    const { error: insErr } = await audit!.from("gr_partnerships").insert({
      person_a_id: pA,
      person_b_id: pB,
      partnership_type: pType,
      start_date: pStart || null,
      end_date: pEnd || null,
      place: pPlace.trim() || null,
      notes: pNotes.trim() || null,
    });
    if (insErr) setError(insErr.message);
    else {
      setPStart("");
      setPEnd("");
      setPPlace("");
      setPNotes("");
      await loadPartnerships();
    }
  }

  async function deletePart(id: string) {
    if (!confirm("Obrisati partnersku vezu?")) return;
    const { error: delErr } = await audit!.from("gr_partnerships").delete().eq("id", id);
    if (delErr) setError(delErr.message);
    else await loadPartnerships();
  }

  const personSelect = (
    value: string,
    onChange: (v: string) => void,
    search: string,
    onSearchChange: (v: string) => void,
    exclude?: string
  ) => (
    <>
      <input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Pretraži osobu..."
      />
      <select value={value} onChange={(e) => onChange(e.target.value)} required>
        <option value="">— izaberite —</option>
        {persons
          .filter((p) => p.id !== exclude)
          .filter((p) => {
            const q = search.trim().toLowerCase();
            if (!q) return true;
            return personFullLabel(p).toLowerCase().includes(q);
          })
          .map((p) => (
            <option key={p.id} value={p.id}>
              {personFullLabel(p)}
            </option>
          ))}
      </select>
    </>
  );

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Veze</h1>

      <div className="card row">
        <label>
          Stablo (filtar osoba)
          <select value={treeId} onChange={(e) => setTreeId(e.target.value)}>
            {treeOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="tabs">
        <button
          type="button"
          className={tab === "pc" ? "active" : ""}
          onClick={() => setTab("pc")}
        >
          Roditelj — dete
        </button>
        <button
          type="button"
          className={tab === "part" ? "active" : ""}
          onClick={() => setTab("part")}
        >
          Partnerstvo / brak
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}

      {tab === "pc" ? (
        <>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Nova veza</h2>
            <form className="stack" onSubmit={(e) => void addParentChild(e)}>
              <div className="row">
                <label>
                  Roditelj
                  {personSelect(pcParent, setPcParent, pcParentSearch, setPcParentSearch, pcChild)}
                </label>
                <label>
                  Dete
                  {personSelect(pcChild, setPcChild, pcChildSearch, setPcChildSearch, pcParent)}
                </label>
                <label>
                  Tip
                  <select
                    value={pcSubtype}
                    onChange={(e) => setPcSubtype(e.target.value as RelationSubtype)}
                  >
                    <option value="biological">Biološki</option>
                    <option value="adoptive">Usvojenje</option>
                    <option value="step">Očuh/maćeha</option>
                    <option value="guardian">Staratelj</option>
                    <option value="other">Drugo</option>
                  </select>
                </label>
              </div>
              <label>
                Napomene
                <input value={pcNotes} onChange={(e) => setPcNotes(e.target.value)} />
              </label>
              <button className="primary" type="submit">
                Dodaj vezu
              </button>
            </form>
          </div>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Lista ({pcRows.length})</h2>
            <TablePagination
              idPrefix="veze-pc"
              page={pcListPage}
              pageSize={pcListPageSize}
              totalItems={pcRows.length}
              onPageChange={setPcListPage}
              onPageSizeChange={setPcListPageSize}
            />
            <table>
              <thead>
                <tr>
                  <th>Roditelj</th>
                  <th>Dete</th>
                  <th>Tip</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paginatedPcRows.map((r) => {
                  const par = personById.get(r.parent_person_id);
                  const ch = personById.get(r.child_person_id);
                  return (
                    <tr key={r.id}>
                      <td>{par ? personLabel(par) : r.parent_person_id}</td>
                      <td>{ch ? personLabel(ch) : r.child_person_id}</td>
                      <td>{r.relation_subtype}</td>
                      <td>
                        <button type="button" className="danger" onClick={() => void deletePc(r.id)}>
                          Obriši
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Nova partnerska veza</h2>
            <form className="stack" onSubmit={(e) => void addPartnership(e)}>
              <div className="row">
                <label>
                  Osoba A
                  {personSelect(pA, setPA, pASearch, setPASearch, pB)}
                </label>
                <label>
                  Osoba B
                  {personSelect(pB, setPB, pBSearch, setPBSearch, pA)}
                </label>
                <label>
                  Tip
                  <select
                    value={pType}
                    onChange={(e) => setPType(e.target.value as PartnershipType)}
                  >
                    <option value="marriage">Brak</option>
                    <option value="civil_union">Građanska unija</option>
                    <option value="domestic_partnership">Partnerska zajednica</option>
                    <option value="other">Drugo</option>
                  </select>
                </label>
              </div>
              <div className="row">
                <label>
                  Početak
                  <input type="date" value={pStart} onChange={(e) => setPStart(e.target.value)} />
                </label>
                <label>
                  Kraj (razvod / prekid)
                  <input type="date" value={pEnd} onChange={(e) => setPEnd(e.target.value)} />
                </label>
                <label>
                  Mesto
                  <input value={pPlace} onChange={(e) => setPPlace(e.target.value)} />
                </label>
              </div>
              <label>
                Napomene
                <input value={pNotes} onChange={(e) => setPNotes(e.target.value)} />
              </label>
              <button className="primary" type="submit">
                Dodaj vezu
              </button>
            </form>
          </div>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Lista ({partRows.length})</h2>
            <TablePagination
              idPrefix="veze-part"
              page={partListPage}
              pageSize={partListPageSize}
              totalItems={partRows.length}
              onPageChange={setPartListPage}
              onPageSizeChange={setPartListPageSize}
            />
            <table>
              <thead>
                <tr>
                  <th>Osoba A</th>
                  <th>Osoba B</th>
                  <th>Tip</th>
                  <th>Period</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paginatedPartRows.map((r) => {
                  const a = personById.get(r.person_a_id);
                  const b = personById.get(r.person_b_id);
                  const period = [r.start_date, r.end_date].filter(Boolean).join(" → ") || "—";
                  return (
                    <tr key={r.id}>
                      <td>{a ? personLabel(a) : r.person_a_id}</td>
                      <td>{b ? personLabel(b) : r.person_b_id}</td>
                      <td>{r.partnership_type}</td>
                      <td>{period}</td>
                      <td>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => void deletePart(r.id)}
                        >
                          Obriši
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
