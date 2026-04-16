import { useState } from "react";
import { supabase } from "../lib/supabase";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (signErr) setError(signErr.message);
  }

  return (
    <div className="layout">
      <main className="card" style={{ maxWidth: 420, margin: "2rem auto" }}>
        <h1 style={{ marginTop: 0 }}>Prijava</h1>
        <p className="muted">
          Koristite nalog kreiran u Supabase Authentication. RLS dozvoljava samo
          ulogovanim korisnicima.
        </p>
        <form className="stack" onSubmit={(e) => void handleSubmit(e)}>
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Lozinka
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button className="primary" type="submit" disabled={busy}>
            {busy ? "Prijava…" : "Prijavi se"}
          </button>
        </form>
      </main>
    </div>
  );
}
