import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";
import { normalizeSupabaseUrl } from "./normalizeSupabaseUrl";

declare const __GR_SUPABASE_URL__: string;
declare const __GR_SUPABASE_ANON__: string;

/** Ugrađeno u build iz vite.config (svi prefiksi + trim); fallback na import.meta za dev. */
const rawUrl = (
  (typeof __GR_SUPABASE_URL__ !== "undefined" ? __GR_SUPABASE_URL__ : "") ||
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  ""
).trim();

const rawAnon = (
  (typeof __GR_SUPABASE_ANON__ !== "undefined" ? __GR_SUPABASE_ANON__ : "") ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  ""
).trim();

const url = normalizeSupabaseUrl(rawUrl);
const anon = rawAnon.length > 0 ? rawAnon : "";

function createSafeClient(): SupabaseClient<Database> | null {
  if (!url || !anon) return null;
  try {
    return createClient<Database>(url, anon);
  } catch {
    return null;
  }
}

export const supabase = createSafeClient();

/** true samo ako postoji ispravan Supabase klijent. */
export const isSupabaseConfigured = supabase !== null;

/** Šema `audit` — samo kada je Supabase klijent aktivan. */
export const audit = supabase !== null ? supabase.schema("audit") : null;
