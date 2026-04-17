import { useCallback, useEffect, useMemo, useState } from "react";
import { audit } from "../lib/supabase";
import type { Database } from "../types/database";

type TreeRow = Database["audit"]["Tables"]["gr_family_trees"]["Row"];
type PersonRow = Database["audit"]["Tables"]["gr_persons"]["Row"];
type PcRow = Database["audit"]["Tables"]["gr_parent_child"]["Row"];

function personLabel(p: Pick<PersonRow, "first_name" | "last_name">) {
  const full = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
  return full || "(bez imena)";
}

export function TreesPage() {
  const [rows, setRows] = useState<TreeRow[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [selectedTreeId, setSelectedTreeId] = useState("");
  const [persons, setPersons] = useState<PersonRow[]>([]);
  const [relations, setRelations] = useState<PcRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: qErr } = await audit!
      .from("gr_family_trees")
      .select("*")
      .order("created_at", { ascending: true });
    if (qErr) setError(qErr.message);
    else {
      setError(null);
      setRows(data ?? []);
      if (!selectedTreeId && (data ?? []).length) {
        setSelectedTreeId((data ?? [])[0].id);
      }
    }
  }, [selectedTreeId]);

  const loadGraph = useCallback(async (treeId: string) => {
    if (!treeId) {
      setPersons([]);
      setRelations([]);
      return;
    }
    const { data: people, error: pErr } = await audit!
      .from("gr_persons")
      .select("*")
      .eq("tree_id", treeId)
      .order("last_name")
      .order("first_name");
    if (pErr) {
      setError(pErr.message);
      return;
    }
    const p = people ?? [];
    setPersons(p);
    if (!p.length) {
      setRelations([]);
      return;
    }
    const ids = p.map((x) => x.id);
    const { data: rel, error: rErr } = await audit!
      .from("gr_parent_child")
      .select("*")
      .in("parent_person_id", ids)
      .in("child_person_id", ids);
    if (rErr) {
      setError(rErr.message);
      return;
    }
    setRelations(rel ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadGraph(selectedTreeId);
  }, [selectedTreeId, loadGraph]);

  const personsById = useMemo(() => {
    const m = new Map<string, PersonRow>();
    for (const p of persons) m.set(p.id, p);
    return m;
  }, [persons]);

  const childByParent = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const rel of relations) {
      const cur = m.get(rel.parent_person_id) ?? [];
      cur.push(rel.child_person_id);
      m.set(rel.parent_person_id, cur);
    }
    return m;
  }, [relations]);

  const roots = useMemo(() => {
    if (!persons.length) return [];
    const childIds = new Set(relations.map((r) => r.child_person_id));
    const rootNodes = persons.filter((p) => !childIds.has(p.id));
    return rootNodes.length ? rootNodes : persons;
  }, [persons, relations]);

  function renderNode(id: string, visited: Set<string>) {
    const p = personsById.get(id);
    if (!p) return null;
    const children = childByParent.get(id) ?? [];
    const nextVisited = new Set(visited);
    nextVisited.add(id);
    return (
      <li key={id}>
        <span>{personLabel(p)}</span>
        {children.length ? (
          <ul style={{ marginTop: "0.35rem" }}>
            {children
              .filter((cid) => !nextVisited.has(cid))
              .map((cid) => renderNode(cid, nextVisited))}
          </ul>
        ) : null}
      </li>
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error: insErr } = await audit!.from("gr_family_trees").insert({
      name: name.trim(),
      slug: slug.trim() || null,
    });
    if (insErr) {
      setError(insErr.message);
      return;
    }
    setName("");
    setSlug("");
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Obrisati stablo? Svi članovi i veze u njemu biće obrisani (cascade).")) {
      return;
    }
    setError(null);
    const { error: delErr } = await audit!.from("gr_family_trees").delete().eq("id", id);
    if (delErr) setError(delErr.message);
    else await load();
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Porodična stabla</h1>
      <p className="muted">
        Podrazumevano stablo iz migracije možete zadržati; dodatna stabla za druge
        grane porodice.
      </p>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Novo stablo</h2>
        <form className="row" onSubmit={(e) => void handleCreate(e)}>
          <label>
            Naziv
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Slug (opciono)
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="npr. janjici"
            />
          </label>
          <button className="primary" type="submit">
            Dodaj
          </button>
        </form>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Lista</h2>
        <table>
          <thead>
            <tr>
              <th>Naziv</th>
              <th>Slug</th>
              <th>ID</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.slug ?? "—"}</td>
                <td className="muted" style={{ fontSize: "0.75rem" }}>
                  {r.id}
                </td>
                <td>
                  <button type="button" className="danger" onClick={() => void handleDelete(r.id)}>
                    Obriši
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Prikaz stabla</h2>
        <label>
          Stablo za prikaz
          <select value={selectedTreeId} onChange={(e) => setSelectedTreeId(e.target.value)}>
            <option value="">— izaberite —</option>
            {rows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        {!selectedTreeId ? (
          <p className="muted">Izaberite stablo za prikaz.</p>
        ) : !persons.length ? (
          <p className="muted">Nema članova u izabranom stablu.</p>
        ) : (
          <ul style={{ marginTop: "0.8rem" }}>
            {roots.map((r) => renderNode(r.id, new Set<string>()))}
          </ul>
        )}
      </div>
    </div>
  );
}
