import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function normalizeSupabaseUrl(raw: string | undefined): string {
  let u = (raw ?? "").trim().replace(/^["'“”]+|["'“”]+$/g, "");
  if (!u || u === "undefined" || u === "null") return "";
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    let parsed = new URL(u);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    let host = parsed.hostname.toLowerCase();
    if (/^[a-z0-9]{10,40}$/i.test(host)) {
      host = `${host}.supabase.co`;
      parsed = new URL(`${parsed.protocol}//${host}`);
    } else if (/^[a-z0-9]{10,40}\.co$/i.test(host) && !host.includes("supabase")) {
      const ref = host.replace(/\.co$/i, "");
      parsed = new URL(`${parsed.protocol}//${ref}.supabase.co`);
    }
    if (!parsed.hostname.endsWith(".supabase.co") && !parsed.hostname.endsWith(".supabase.in")) {
      return "";
    }
    const path =
      parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "");
    return `${parsed.origin}${path}`;
  } catch {
    return "";
  }
}

/**
 * Vercel postavlja promenljive u process.env pri buildu.
 * Podržani prefiksi: VITE_*, SUPABASE_*, NEXT_PUBLIC_SUPABASE_*.
 */
export default defineConfig(({ mode }) => {
  const file = loadEnv(mode, process.cwd(), "");

  const rawUrl =
    process.env.VITE_SUPABASE_URL ||
    file.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    file.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    file.NEXT_PUBLIC_SUPABASE_URL ||
    "";

  const rawAnon =
    process.env.VITE_SUPABASE_ANON_KEY ||
    file.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    file.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    file.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  const url = normalizeSupabaseUrl(rawUrl);
  const anon = (rawAnon || "").trim();

  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(url),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(anon),
    },
  };
});
