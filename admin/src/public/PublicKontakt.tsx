import { useState } from "react";
import { audit } from "../lib/supabase";
import type { Database } from "../types/database";

type KlijentInsert = Database["audit"]["Tables"]["klijenti"]["Insert"];

/**
 * Javna forma: samo ono što korisnik unosi — ime, prezime, firma, email, kontakt, opis.
 * stsarhiviran / stsinvestitoraudit / datumupisa ostaju na defaultima u bazi; source i contactid šalje aplikacija.
 */
export function PublicKontakt() {
  const [ime, setIme] = useState("");
  const [prezime, setPrezime] = useState("");
  const [firma, setFirma] = useState("");
  const [email, setEmail] = useState("");
  const [kontakt, setKontakt] = useState("");
  const [opis, setOpis] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
    const opisTrim = opis.trim();
    const payload: KlijentInsert = {
      ime: ime.trim(),
      prezime: prezime.trim(),
      firma: firma.trim() || null,
      email: email.trim(),
      kontakt: kontakt.trim(),
      opis: opisTrim || null,
      source: "grabovica-web",
      contactid: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : null,
    };
    setSending(true);
    const { error } = await audit.from("klijenti").insert(payload);
    setSending(false);
    if (error) setErr(error.message);
    else {
      setMsg("Hvala — poruka je poslata. Javićemo se uskoro.");
      setIme("");
      setPrezime("");
      setFirma("");
      setEmail("");
      setKontakt("");
      setOpis("");
    }
  }

  return (
    <div className="public-page public-kontakt-page">
      <section className="public-section public-kontakt-section">
        <form className="public-form public-form--kontakt" onSubmit={(e) => void onSubmit(e)}>
          <h1 className="public-kontakt-title">Korisnički centar</h1>
          <p className="public-kontakt-lead">
            Registrujte se i postanite deo naše zajednice — ostavite kontakt ispod.
          </p>

          <div className="public-form-row">
            <label className="public-kontakt-label">
              Ime *
              <input value={ime} onChange={(e) => setIme(e.target.value)} required placeholder="Vaše ime" />
            </label>
            <label className="public-kontakt-label">
              Prezime *
              <input value={prezime} onChange={(e) => setPrezime(e.target.value)} required placeholder="Vaše prezime" />
            </label>
          </div>

          <label className="public-kontakt-label public-kontakt-label--full">
            Firma
            <input value={firma} onChange={(e) => setFirma(e.target.value)} placeholder="Naziv firme (opciono)" />
          </label>

          <div className="public-form-row">
            <label className="public-kontakt-label">
              Email adresa *
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="vas@email.com"
              />
            </label>
            <label className="public-kontakt-label">
              Telefon *
              <input value={kontakt} onChange={(e) => setKontakt(e.target.value)} required placeholder="+381 63 123 4567" />
            </label>
          </div>

          <label className="public-kontakt-label public-kontakt-label--full">
            Napomena / poruka (opciono)
            <textarea
              value={opis}
              onChange={(e) => setOpis(e.target.value)}
              rows={4}
              placeholder="Dodatne informacije, interesovanja ili poruka…"
              className="public-kontakt-textarea"
            />
          </label>

          {err ? <p className="public-kontakt-error">{err}</p> : null}
          {msg ? <p className="public-kontakt-success">{msg}</p> : null}

          <button type="submit" className="public-kontakt-submit" disabled={sending}>
            {sending ? "Šaljem…" : "Pošalji"}
          </button>
        </form>
      </section>
    </div>
  );
}
