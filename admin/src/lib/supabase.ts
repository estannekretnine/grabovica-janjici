import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";
import { normalizeSupabaseUrl } from "./normalizeSupabaseUrl";

const rawUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const rawAnon = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";

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
