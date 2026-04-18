import { useState } from "react";

const TREE_ID = "00000000-0000-0000-0000-000000000001";

interface ParsedRelation {
  parent: string;
  children: string[];
}

function parseInput(text: string): ParsedRelation[] {
  const lines = text.split("\n").filter((l) => l.trim());
  const relations: ParsedRelation[] = [];

  for (const line of lines) {
    const match = line.match(/^(.+?)\s*[>:→-]\s*(.+)$/);
    if (match) {
      const parent = match[1].trim();
      const children = match[2]
        .split(/[,;]/)
        .map((c) => c.trim())
        .filter(Boolean);
      if (parent && children.length > 0) {
        relations.push({ parent, children });
      }
    }
  }

  return relations;
}

function getAllNames(relations: ParsedRelation[]): string[] {
  const names = new Set<string>();
  for (const r of relations) {
    names.add(r.parent);
    for (const c of r.children) {
      names.add(c);
    }
  }
  return Array.from(names).sort();
}

function generatePersonsSQL(names: string[], lastName: string): string {
  const lines: string[] = [];
  lines.push("-- 1. INSERT članovi (gr_persons)");
  lines.push("-- Prvo pokreni ovo da dobiješ sve članove u bazi\n");
  
  for (const name of names) {
    const id = `gen_${name.toLowerCase().replace(/[^a-z0-9]/gi, "_")}`;
    lines.push(
      `INSERT INTO audit.gr_persons (id, tree_id, first_name, last_name, gender) VALUES ('${id}', '${TREE_ID}', '${name}', '${lastName}', 'male') ON CONFLICT (id) DO NOTHING;`
    );
  }

  return lines.join("\n");
}

function generateRelationsSQL(relations: ParsedRelation[]): string {
  const lines: string[] = [];
  lines.push("\n\n-- 2. INSERT veze otac-sin (gr_parent_child)");
  lines.push("-- Pokreni ovo NAKON što su svi članovi ubačeni\n");

  for (const r of relations) {
    const parentId = `gen_${r.parent.toLowerCase().replace(/[^a-z0-9]/gi, "_")}`;
    for (const child of r.children) {
      const childId = `gen_${child.toLowerCase().replace(/[^a-z0-9]/gi, "_")}`;
      lines.push(
        `INSERT INTO audit.gr_parent_child (parent_person_id, child_person_id, relation_subtype) VALUES ('${parentId}', '${childId}', 'biological') ON CONFLICT DO NOTHING;`
      );
    }
  }

  return lines.join("\n");
}

export function StabloImportPage() {
  const [input, setInput] = useState("");
  const [lastName, setLastName] = useState("Janjić");
  const [output, setOutput] = useState("");

  function handleGenerate() {
    const relations = parseInput(input);
    const names = getAllNames(relations);

    if (names.length === 0) {
      setOutput("-- Nema pronađenih imena. Proveri format unosa.");
      return;
    }

    const personsSql = generatePersonsSQL(names, lastName);
    const relationsSql = generateRelationsSQL(relations);

    setOutput(
      `-- Generisano: ${names.length} članova, ${relations.reduce((a, r) => a + r.children.length, 0)} veza\n\n` +
        personsSql +
        relationsSql
    );
  }

  function handleCopy() {
    void navigator.clipboard.writeText(output);
  }

  return (
    <div style={{ padding: "1.5rem" }}>
      <h1>Import stabla iz teksta</h1>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        Unesi porodično stablo u formatu: <code>Otac &gt; Sin1, Sin2, Sin3</code>
        <br />
        Svaki red predstavlja jednog oca i njegove sinove.
      </p>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <label>
          Prezime:
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            style={{ marginLeft: "0.5rem", width: "150px" }}
          />
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div>
          <label>
            <strong>Unos (otac &gt; sinovi):</strong>
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={25}
            style={{ width: "100%", fontFamily: "monospace", fontSize: "0.9rem" }}
            placeholder={`Primer:
Đorđije > Karo, Simeun
Karo > Obrad, Novica
Obrad > Filip, Naod
Filip > Petrašin, Obrad, Stефан
...`}
          />
        </div>

        <div>
          <label>
            <strong>SQL izlaz:</strong>
          </label>
          <textarea
            value={output}
            readOnly
            rows={25}
            style={{
              width: "100%",
              fontFamily: "monospace",
              fontSize: "0.85rem",
              backgroundColor: "#1a1a1f",
              color: "#e0e0e0",
            }}
          />
        </div>
      </div>

      <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
        <button type="button" onClick={handleGenerate}>
          Generiši SQL
        </button>
        <button type="button" onClick={handleCopy} disabled={!output}>
          Kopiraj SQL
        </button>
      </div>

      <div style={{ marginTop: "2rem" }}>
        <h3>Uputstvo:</h3>
        <ol>
          <li>Unesi stablo u levi panel (format: <code>Otac &gt; Sin1, Sin2</code>)</li>
          <li>Klikni "Generiši SQL"</li>
          <li>Kopiraj SQL i pokreni u Supabase SQL editoru</li>
          <li>Prvo pokreni INSERT za članove, pa za veze</li>
        </ol>
      </div>
    </div>
  );
}
