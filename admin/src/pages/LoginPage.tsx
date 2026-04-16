import { useState } from "react";
import { supabase } from "../lib/supabase";
import {
  clearKorisnikFromStorage,
  writeKorisnikToStorage,
  type KorisnikProfile,
} from "../lib/korisnikSession";
import { DEFAULT_LOGIN_EMAIL } from "../constants";
import "./LoginPage.css";

export function LoginPage() {
  const [email, setEmail] = useState(DEFAULT_LOGIN_EMAIL);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError("Supabase nije podešen.");
      return;
    }

    const u = email.trim();
    const p = password;

    setError(null);
    setBusy(true);

    const { data: rows, error: rpcErr } = await supabase.rpc("login_korisnik", {
      p_email: u,
      p_password: p,
    });

    if (rpcErr) {
      setBusy(false);
      setError(rpcErr.message);
      return;
    }

    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) {
      setBusy(false);
      setError("Pogrešno korisničko ime ili lozinka.");
      return;
    }

    const profile: KorisnikProfile = {
      id: String(row.id),
      naziv: String(row.naziv ?? ""),
      email: row.email != null ? String(row.email) : null,
      stsstatus: row.stsstatus != null ? String(row.stsstatus) : null,
    };
    clearKorisnikFromStorage();
    writeKorisnikToStorage(profile);

    const { error: anonErr } = await supabase.auth.signInAnonymously();
    setBusy(false);
    if (anonErr) {
      clearKorisnikFromStorage();
      const hint =
        /failed to fetch|networkerror|name_not_resolved/i.test(anonErr.message)
          ? "Proverite Supabase URL na Vercelu (https://…supabase.co)."
          : "Uključite Anonymous sign-ins (Authentication → Providers → Anonymous).";
      setError(`${hint} (${anonErr.message})`);
      return;
    }
  }

  if (!supabase) {
    return null;
  }

  return (
    <div className="login-shell">
      <section className="login-brand" aria-label="Brending">
        <div className="login-brand-top">
          <div className="login-logo-row">
            <div className="login-logo-mark">GJ</div>
            <div>
              <div className="login-logo-title">Grabovica Janjići</div>
              <div className="login-tagline-gold">
                porodično stablo janjici Grabovica Crna Gora
              </div>
            </div>
          </div>
          <div className="login-hero">
            <h2>
              <span className="white">Upravljajte</span>
              <br />
              <span className="gold">porodičnim stablom</span>
            </h2>
            <p>Centralizovano upravljanje članovima porodice i podacima na jednom mestu.</p>
          </div>
        </div>
        <div className="login-stats">
          <div>
            <strong>100%</strong>
            <span>Sigurnost podataka</span>
          </div>
          <div>
            <strong>24/7</strong>
            <span>Dostupnost</span>
          </div>
          <div>
            <strong>Pro</strong>
            <span>Podrška</span>
          </div>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-form-inner">
          <h1>Dobrodošli nazad</h1>
          <p className="subtitle">Unesite vaše podatke za pristup</p>

          <form onSubmit={(e) => void handleSubmit(e)}>
            <label htmlFor="login-email">Email adresa</label>
            <input
              id="login-email"
              type="text"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label htmlFor="login-pass">Lozinka</label>
            <input
              id="login-pass"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error ? <p className="login-error">{error}</p> : null}

            <button className="login-submit" type="submit" disabled={busy}>
              {busy ? "Prijava…" : "Prijavi se"} <span aria-hidden>→</span>
            </button>
          </form>

          <div className="login-or">ILI</div>

          <p className="login-footer-note">
            Nemate nalog? Kontaktirajte administratora na{" "}
            <a href="mailto:admin@grabovica-janjici.local">admin@grabovica-janjici.local</a>
          </p>

          <div className="login-meta">
            Poslednje ažuriranje aplikacije: {new Date().toLocaleString("sr-Latn-ME")}
          </div>

          <div className="login-version">Porodično stablo v1 • 2026</div>
        </div>
      </section>
    </div>
  );
}
