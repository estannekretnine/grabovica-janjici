export function MissingSupabaseConfig() {
  return (
    <div className="layout">
      <main className="card" style={{ maxWidth: 520, margin: "2rem auto" }}>
        <h1 style={{ marginTop: 0 }}>Nedostaje konfiguracija Supabase</h1>
        <p>
          Aplikacija zahteva promenljive okruženja{" "}
          <code>VITE_SUPABASE_URL</code> i <code>VITE_SUPABASE_ANON_KEY</code>{" "}
          (vrednosti iz Supabase: Project Settings → API).
        </p>
        <p className="muted">
          Na <strong>Vercel</strong>: Project → <strong>Settings</strong> →{" "}
          <strong>Environment Variables</strong> → dodaj obe za <strong>Production</strong>{" "}
          (i Preview ako treba), zatim <strong>Deployments</strong> → tri tačke na poslednjem →{" "}
          <strong>Redeploy</strong> (bez keša). Bez redeploy-a, stari build i dalje nema ključeve.
        </p>
      </main>
    </div>
  );
}
