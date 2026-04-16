import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { normalizeSupabaseUrl } from "./src/lib/normalizeSupabaseUrl";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function stripInvisible(s: string): string {
  return s.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
}

/**
 * Vercel ubacuje vrednosti u `process.env` tokom `vite build`.
 * Učitavamo i `.env*` iz `admin/` (`envDir`) da lokalni build radi isto.
 * Podržano: VITE_*, NEXT_PUBLIC_*, SUPABASE_URL / SUPABASE_ANON_KEY (bez SERVICE_ROLE u klijentu).
 */
function pickSupabaseFromEnv(mode: string): { url: string; anon: string } {
  const file = loadEnv(mode, __dirname, "");
  const rawUrl = stripInvisible(
    process.env.VITE_SUPABASE_URL ||
      file.VITE_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      file.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      file.SUPABASE_URL ||
      "",
  );
  const rawAnon = stripInvisible(
    process.env.VITE_SUPABASE_ANON_KEY ||
      file.VITE_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      file.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      file.SUPABASE_ANON_KEY ||
      "",
  );
  return {
    url: normalizeSupabaseUrl(rawUrl),
    anon: rawAnon,
  };
}

export default defineConfig(({ mode }) => {
  const { url, anon } = pickSupabaseFromEnv(mode);
  return {
    plugins: [react()],
    envDir: __dirname,
    envPrefix: ["VITE_", "NEXT_PUBLIC_"],
    define: {
      __GR_SUPABASE_URL__: JSON.stringify(url),
      __GR_SUPABASE_ANON__: JSON.stringify(anon),
    },
  };
});
