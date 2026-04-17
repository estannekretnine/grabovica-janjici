import { audit } from "./supabase";
import type { Database } from "../types/database";

export type PersonRow = Database["audit"]["Tables"]["gr_persons"]["Row"];
export type PcRow = Database["audit"]["Tables"]["gr_parent_child"]["Row"];
export type PartRow = Database["audit"]["Tables"]["gr_partnerships"]["Row"];

export type FamilyGraphData = {
  persons: PersonRow[];
  relations: PcRow[];
  partnerships: PartRow[];
};

/**
 * Učitaj osobe i veze za jedno porodično stablo (isti upiti kao prikaz stabla).
 */
export async function loadFamilyGraph(treeId: string): Promise<{
  data: FamilyGraphData;
  error: string | null;
}> {
  if (!audit || !treeId) {
    return {
      data: { persons: [], relations: [], partnerships: [] },
      error: !audit ? "Supabase nije podešen." : null,
    };
  }

  const { data: people, error: pErr } = await audit
    .from("gr_persons")
    .select("*")
    .eq("tree_id", treeId)
    .order("last_name")
    .order("first_name");

  if (pErr) {
    return {
      data: { persons: [], relations: [], partnerships: [] },
      error: pErr.message,
    };
  }

  const p = people ?? [];
  if (!p.length) {
    return { data: { persons: [], relations: [], partnerships: [] }, error: null };
  }

  const ids = p.map((x) => x.id);
  const { data: rel, error: rErr } = await audit
    .from("gr_parent_child")
    .select("*")
    .in("parent_person_id", ids)
    .in("child_person_id", ids);

  if (rErr) {
    return { data: { persons: p, relations: [], partnerships: [] }, error: rErr.message };
  }

  const { data: parts, error: paErr } = await audit
    .from("gr_partnerships")
    .select("*")
    .in("person_a_id", ids)
    .in("person_b_id", ids);

  if (paErr) {
    return {
      data: { persons: p, relations: rel ?? [], partnerships: [] },
      error: paErr.message,
    };
  }

  return {
    data: { persons: p, relations: rel ?? [], partnerships: parts ?? [] },
    error: null,
  };
}
