import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { TreesPage } from "./pages/TreesPage";
import { PersonsPage } from "./pages/PersonsPage";
import { RelationshipsPage } from "./pages/RelationshipsPage";
import { DrzavePage } from "./pages/DrzavePage";
import { OpstinePage } from "./pages/OpstinePage";
import { LokacijaPage } from "./pages/LokacijaPage";
import { KorisniciPage } from "./pages/KorisniciPage";
import { PorukeSajtaPage } from "./pages/PorukeSajtaPage";
import { StabloImportPage } from "./pages/StabloImportPage";
import { PublicShell } from "./public/PublicLayout";
import { PublicHome } from "./public/PublicHome";
import { PublicStablo } from "./public/PublicStablo";
import { PublicKontakt } from "./public/PublicKontakt";
import { PublicPretraga } from "./public/PublicPretraga";
import { PublicAktivnosti } from "./public/PublicAktivnosti";
import {
  clearKorisnikFromStorage,
  readKorisnikFromStorage,
} from "./lib/korisnikSession";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (supabase === null) {
      setLoading(false);
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="layout">
        <main>
          <p className="muted">Učitavanje…</p>
        </main>
      </div>
    );
  }

  const korisnik = session ? readKorisnikFromStorage() : null;
  const headerLabel =
    korisnik?.naziv?.trim() ||
    (session?.user.is_anonymous ? "Gost" : null) ||
    session?.user.email ||
    session?.user.id ||
    "";

  const adminSignOut = () => {
    clearKorisnikFromStorage();
    void supabase?.auth.signOut();
  };

  return (
    <Routes>
      <Route path="/" element={<PublicShell />}>
        <Route index element={<PublicHome />} />
        <Route path="stablo" element={<PublicStablo />} />
        <Route path="pretraga" element={<PublicPretraga />} />
        <Route path="aktivnosti" element={<PublicAktivnosti />} />
        <Route path="kontakt" element={<PublicKontakt />} />
      </Route>

      <Route
        path="/login"
        element={session ? <Navigate to="/countries" replace /> : <LoginPage />}
      />

      {session ? (
        <Route
          element={
            <Layout
              email={headerLabel}
              onSignOut={adminSignOut}
            />
          }
        >
          <Route path="/korisnici" element={<KorisniciPage />} />
          <Route path="/poruke-sajta" element={<PorukeSajtaPage />} />
          <Route path="/countries" element={<DrzavePage />} />
          <Route path="/municipalities" element={<OpstinePage />} />
          <Route path="/locations" element={<LokacijaPage />} />
          <Route path="/trees" element={<TreesPage />} />
          <Route path="/stablo-1" element={<TreesPage variant="stablo1" />} />
          <Route path="/persons" element={<PersonsPage />} />
          <Route path="/relationships" element={<RelationshipsPage />} />
          <Route path="/stablo-import" element={<StabloImportPage />} />
        </Route>
      ) : null}

      <Route
        path="*"
        element={<Navigate to={session ? "/countries" : "/"} replace />}
      />
    </Routes>
  );
}
