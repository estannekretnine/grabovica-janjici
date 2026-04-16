import { useState } from "react";
import { supabase } from "../lib/supabase";
import { DEMO_PASSWORD, DEMO_USERNAME } from "../constants";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError("Supabase nije podešen.");
      return;
    }

    const u = username.trim();
    const p = password;

    if (u === DEMO_USERNAME && p === DEMO_PASSWORD) {
      setError(null);
      setBusy(true);
      const { error: anonErr } = await supabase.auth.signInAnonymously();
      setBusy(false);
      if (anonErr) {
        const hint =
          /failed to fetch|networkerror|name_not_resolved/i.test(anonErr.message)
            ? " Proverite NEXT_PUBLIC_SUPABASE_URL na Vercelu — mora biti https://…supabase.co (često pogrešno …co bez supabase)."
            : " U Supabase uključite Anonymous (Authentication → Providers → Anonymous).";
        setError(`Demo: ${hint} (${anonErr.message})`);
        return;
      }
      return;
    }

    setError(null);
    setBusy(true);
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email: u,
      password: p,
    });
    setBusy(false);
    if (signErr) setError(signErr.message);
  }

  if (!supabase) {
    return null;
  }

  return (
    <div className="layout">
      <main className="card" style={{ maxWidth: 420, margin: "2rem auto" }}>
        <h1 style={{ marginTop: 0 }}>Prijava</h1>
        <p className="muted">
          <strong>Demo nalog:</strong> korisničko ime <code>{DEMO_USERNAME}</code>, lozinka{" "}
          <code>{DEMO_PASSWORD}</code> — koristi anonimnu sesiju (mora biti uključena u Supabase).
          Inače unesite <strong>email</strong> i lozinku korisnika iz Authentication.
        </p>
        <form className="stack" onSubmit={(e) => void handleSubmit(e)}>
          <label>
            Korisničko ime ili email
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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
