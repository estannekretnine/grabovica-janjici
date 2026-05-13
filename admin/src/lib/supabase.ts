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
 *
 * Garantovano izolovan od admin auth sesije:
 *  - persistSession: false  → ne pise u storage
 *  - autoRefreshToken: false
 *  - distinct storageKey    → ne deli kljuc sa glavnim klijentom
 *  - in-memory storage stub → ne cita iz localStorage uopste,
 *    pa istekli JWT iz admin login-a NIKAD ne dospeva u requeste
 *    (ranije je uzrokovalo 401 na heartbeat/update).
 */
const noopAuthStorage = {
  getItem: () => null,
  setItem: () => {
    /* no-op */
  },
  removeItem: () => {
    /* no-op */
  },
};

function createTrackingClient(): SupabaseClient<Database> | null {
  if (!url || !anon) return null;
  try {
    return createClient<Database>(url, anon, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: "sb-grabovica-tracking-anon",
        storage: noopAuthStorage,
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
