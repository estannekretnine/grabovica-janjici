import { useState } from "react";
import { audit } from "../lib/supabase";
import type { Database } from "../types/database";

type KlijentInsert = Database["audit"]["Tables"]["gr_klijenti"]["Insert"];

const ROLE_INVESTOR = "Investitor";
const ROLE_INVESTOR_AUDIT = "Investitor AuditClaw-Project";
const ROLE_BUYER = "Kupac";
const ROLE_FRIEND = "Prijatelj sajta";
const ROLE_SELLER = "Prodavac";

export function PublicKontakt() {
  const [ime, setIme] = useState("");
  const [prezime, setPrezime] = useState("");
  const [firma, setFirma] = useState("");
  const [email, setEmail] = useState("");
  const [kontakt, setKontakt] = useState("");
  const [roles, setRoles] = useState<Record<string, boolean>>({
    [ROLE_INVESTOR]: false,
    [ROLE_INVESTOR_AUDIT]: false,
    [ROLE_BUYER]: false,
    [ROLE_FRIEND]: false,
    [ROLE_SELLER]: false,
  });
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function toggleRole(key: string) {
    setRoles((r) => ({ ...r, [key]: !r[key] }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (!ime.trim() || !prezime.trim() || !email.trim() || !kontakt.trim()) {
      setErr("Polja označena zvezdicom su obavezna.");
      return;
    }
    if (!audit) {
      setErr("Slanje nije dostupno (nema konekcije na bazu).");
      return;
    }
    const picked = Object.entries(roles)
      .filter(([, v]) => v)
      .map(([k]) => k);
    const opis = picked.length ? picked.join(", ") : null;
    const stsinvestitoraudit = roles[ROLE_INVESTOR_AUDIT] ?? false;
    const payload: KlijentInsert = {
      ime: ime.trim(),
      prezime: prezime.trim(),
      firma: firma.trim() || null,
      email: email.trim(),
      kontakt: kontakt.trim(),
      opis,
      stsinvestitoraudit,
      source: "grabovica-web",
      contactid: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : null,
    };
    setSending(true);
    const { error } = await audit.from("gr_klijenti").insert(payload);
    setSending(false);
    if (error) setErr(error.message);
    else {
      setMsg("Hvala — poruka je poslata. Javićemo se uskoro.");
      setIme("");
      setPrezime("");
      setFirma("");
      setEmail("");
      setKontakt("");
      setRoles({
        [ROLE_INVESTOR]: false,
        [ROLE_INVESTOR_AUDIT]: false,
        [ROLE_BUYER]: false,
        [ROLE_FRIEND]: false,
        [ROLE_SELLER]: false,
      });
    }
  }

  const roleGrid = (
    <div className="public-role-grid">
      {[
        ROLE_INVESTOR,
        ROLE_INVESTOR_AUDIT,
        ROLE_BUYER,
        ROLE_FRIEND,
        ROLE_SELLER,
      ].map((label) => (
        <label key={label} className="public-role-tile">
          <input
            type="checkbox"
            checked={roles[label] ?? false}
            onChange={() => toggleRole(label)}
          />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );

  return (
    <div className="public-page public-page--narrow">
      <section className="public-section">
        <h1 className="public-page-title">Korisnički centar</h1>
        <p className="public-lead">Registrujte se i postanite deo naše zajednice — ostavite kontakt ispod.</p>

        <form className="public-form card-like" onSubmit={(e) => void onSubmit(e)}>
          <div className="public-form-row">
            <label className="public-label">
              Ime *
              <input value={ime} onChange={(e) => setIme(e.target.value)} required placeholder="Vaše ime" />
            </label>
            <label className="public-label">
              Prezime *
              <input value={prezime} onChange={(e) => setPrezime(e.target.value)} required placeholder="Vaše prezime" />
            </label>
          </div>
          <label className="public-label">
            Firma
            <input value={firma} onChange={(e) => setFirma(e.target.value)} placeholder="Naziv firme (opciono)" />
          </label>
          <div className="public-form-row">
            <label className="public-label">
              Email adresa *
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="vas@email.com"
              />
            </label>
            <label className="public-label">
              Telefon *
              <input value={kontakt} onChange={(e) => setKontakt(e.target.value)} required placeholder="+381 63 123 4567" />
            </label>
          </div>
          <fieldset className="public-fieldset">
            <legend>Ja sam (izaberite sve što se odnosi na vas)</legend>
            {roleGrid}
          </fieldset>
          {err ? <p className="public-error">{err}</p> : null}
          {msg ? <p className="public-success">{msg}</p> : null}
          <button type="submit" className="public-submit" disabled={sending}>
            {sending ? "Šaljem…" : "Pošalji"}
          </button>
        </form>
      </section>
    </div>
  );
}
