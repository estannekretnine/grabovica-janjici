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
  const buildAtIso = new Date().toISOString();

  console.log("[vite.config] mode:", mode);
  console.log("[vite.config] cwd:", process.cwd());
  console.log("[vite.config] __dirname:", __dirname);
  console.log("[vite.config] process.env keys with SUPA/NEXT:", Object.keys(process.env).filter(k => /supa|next_public/i.test(k)));
  console.log("[vite.config] raw process.env.NEXT_PUBLIC_SUPABASE_URL:", JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_URL));
  console.log("[vite.config] raw process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.slice(0, 10)}…(len=${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length})` : "undefined");
  console.log("[vite.config] resolved url:", JSON.stringify(url));
  console.log("[vite.config] resolved anon:", anon ? `${anon.slice(0, 10)}…(len=${anon.length})` : "(empty)");

  return {
    plugins: [react()],
    envDir: __dirname,
    envPrefix: ["VITE_", "NEXT_PUBLIC_"],
    define: {
      __GR_SUPABASE_URL__: JSON.stringify(url),
      __GR_SUPABASE_ANON__: JSON.stringify(anon),
      __GR_BUILD_AT__: JSON.stringify(buildAtIso),
    },
  };
});
