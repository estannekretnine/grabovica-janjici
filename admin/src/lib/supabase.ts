import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.warn("Nedostaju VITE_SUPABASE_URL ili VITE_SUPABASE_ANON_KEY u .env");
}

export const supabase = createClient<Database>(url ?? "", anon ?? "");

/** Porodične tabele (`gr_*`) žive u šemi `audit` — koristiti umesto `supabase.from` za podatke. */
export const audit = supabase.schema("audit");
