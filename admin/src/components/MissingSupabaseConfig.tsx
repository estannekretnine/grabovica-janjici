export function MissingSupabaseConfig() {
  return (
    <div className="layout">
      <main className="card" style={{ maxWidth: 520, margin: "2rem auto" }}>
        <h1 style={{ marginTop: 0 }}>Nedostaje konfiguracija Supabase</h1>
        <p>
          Aplikacija zahteva URL i anon ključ iz Supabase (Project Settings → API). U Vercelu
          koristi tačno jedan par imena (kopiraj ključeve bez razmaka na početku/kraju):
        </p>
        <ul className="muted">
          <li>
            <code>VITE_SUPABASE_URL</code> i <code>VITE_SUPABASE_ANON_KEY</code> (Vite), ili
          </li>
          <li>
            <code>NEXT_PUBLIC_SUPABASE_URL</code> i <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
            (kao na Next.js tutorijalima — podržano), ili
          </li>
          <li>
            <code>SUPABASE_URL</code> i <code>SUPABASE_ANON_KEY</code>
          </li>
        </ul>
        <p className="muted">
          Na <strong>Vercel</strong>: Settings → <strong>Environment Variables</strong> → obavezno
          uključi <strong>Production</strong> (kvačica pored imena promenljive). Posle izmene:{" "}
          <strong>Deployments</strong> → ⋯ na poslednjem → <strong>Redeploy</strong>.
        </p>
      </main>
    </div>
  );
}
