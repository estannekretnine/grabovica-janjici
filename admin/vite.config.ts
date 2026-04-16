import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Vercel postavlja promenljive u process.env pri buildu.
 * Eksplicitno ih ubacujemo u klijentski bundle jer u monorepu / prefix buildu
 * ponekad import.meta.env ne pokupi VITE_* kao što očekujemo.
 */
export default defineConfig(({ mode }) => {
  const file = loadEnv(mode, process.cwd(), "");

  const url =
    process.env.VITE_SUPABASE_URL?.trim() ||
    file.VITE_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    file.SUPABASE_URL?.trim() ||
    "";

  const anon =
    process.env.VITE_SUPABASE_ANON_KEY?.trim() ||
    file.VITE_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    file.SUPABASE_ANON_KEY?.trim() ||
    "";

  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(url),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(anon),
    },
  };
});
