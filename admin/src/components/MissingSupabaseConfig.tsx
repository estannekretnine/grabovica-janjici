/** Tekst uputstva (koristi se i u punom layoutu prijave kada nema env). */
export function SupabaseEnvHelp() {
  return (
    <div className="login-env-help">
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
        URL mora biti u obliku <code>https://&lt;project-ref&gt;.supabase.co</code> (iz Supabase
        Dashboard → Settings → API). Ako je slučajno <code>.co</code> bez <code>.supabase</code>,
        aplikacija pokušava ispravku pri učitavanju.
      </p>
      <p className="muted">
        Na <strong>Vercel</strong>: Settings → <strong>Environment Variables</strong> → obavezno
        uključi <strong>Production</strong> (kvačica pored imena promenljive). Posle izmene:{" "}
        <strong>Deployments</strong> → ⋯ na poslednjem → <strong>Redeploy</strong>.
      </p>
      <p className="muted">
        Ako su promenljive već postavljene, a poruka ostaje: ponovo uradi <strong>Redeploy</strong> i
        uključi <strong>Clear build cache</strong> (stari build je možda napravljen bez env-a). URL u
        Vercelu mora biti tačan <strong>Project URL</strong> sa API stranice (ne connection string /
        pooler).
      </p>
    </div>
  );
}

/** Samostalna stranica (retko); uobičajeno se koristi split prijava + SupabaseEnvHelp. */
export function MissingSupabaseConfig() {
  return (
    <div className="layout">
      <main className="card" style={{ maxWidth: 520, margin: "2rem auto" }}>
        <SupabaseEnvHelp />
      </main>
    </div>
  );
}
