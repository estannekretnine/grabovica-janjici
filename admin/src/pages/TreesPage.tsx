import { useCallback, useEffect, useState } from "react";
import { audit } from "../lib/supabase";
import type { Database } from "../types/database";

type TreeRow = Database["audit"]["Tables"]["gr_family_trees"]["Row"];

export function TreesPage() {
  const [rows, setRows] = useState<TreeRow[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: qErr } = await audit
      .from("gr_family_trees")
      .select("*")
      .order("created_at", { ascending: true });
    if (qErr) setError(qErr.message);
    else {
      setError(null);
      setRows(data ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error: insErr } = await audit.from("gr_family_trees").insert({
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
    const { error: delErr } = await audit.from("gr_family_trees").delete().eq("id", id);
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
    </div>
  );
}
