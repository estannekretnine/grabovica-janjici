import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";

/** false na Vercelu ako nisu podešene Environment Variables (mora redeploy posle dodavanja). */
export const isSupabaseConfigured = Boolean(url && anon);

const client: SupabaseClient<Database> | null =
  isSupabaseConfigured ? createClient<Database>(url, anon) : null;

export const supabase = client;

/** Šema `audit` — samo kada je Supabase podešen. */
export const audit = client !== null ? client.schema("audit") : null;
