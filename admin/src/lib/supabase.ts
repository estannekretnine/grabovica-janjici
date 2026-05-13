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

/**
 * Poseban klijent samo za javno (anonimno) pracenje sajta.
 * Ne deli auth sesiju sa glavnim klijentom (`persistSession: false`),
 * pa istek JWT-a iz admin login-a ne moze da vrati 401 na heartbeat update.
 * Uvek koristi anon API key.
 */
function createTrackingClient(): SupabaseClient<Database> | null {
  if (!url || !anon) return null;
  try {
    return createClient<Database>(url, anon, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  } catch {
    return null;
  }
}

const trackingClient = createTrackingClient();

/** Šema `audit` — samo kada je Supabase klijent aktivan. */
export const audit = supabase !== null ? supabase.schema("audit") : null;

/** Audit klijent za javno tracking (bez auth perzistencije). */
export const auditTracking = trackingClient !== null ? trackingClient.schema("audit") : null;

/** Public klijent za javno tracking (npr. RPC get_site_stats). */
export const publicTracking = trackingClient;
