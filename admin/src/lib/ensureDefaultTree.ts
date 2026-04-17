import { audit } from "./supabase";
import { DEFAULT_TREE_ID } from "../constants";

/**
 * Obezbedi da podrazumevano stablo postoji pre rada sa clanovima i vezama.
 * Ako je obrisano u bazi, kreirace ga ponovo.
 */
export async function ensureDefaultTreeExists() {
  if (!audit) return null;

  const { count, error: qErr } = await audit
    .from("gr_family_trees")
    .select("id", { count: "exact", head: true })
    .eq("id", DEFAULT_TREE_ID);

  if (qErr) return qErr;
  if ((count ?? 0) > 0) return null;

  const { error: insErr } = await audit.from("gr_family_trees").insert({
    id: DEFAULT_TREE_ID,
    name: "Glavno porodično stablo",
    slug: "default",
  });

  if (insErr && !/duplicate key|already exists/i.test(insErr.message)) {
    return insErr;
  }

  return null;
}
