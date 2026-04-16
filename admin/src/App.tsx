import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { MissingSupabaseConfig } from "./components/MissingSupabaseConfig";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { TreesPage } from "./pages/TreesPage";
import { PersonsPage } from "./pages/PersonsPage";
import { RelationshipsPage } from "./pages/RelationshipsPage";
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

  if (supabase === null) {
    return <MissingSupabaseConfig />;
  }

  if (loading) {
    return (
      <div className="layout">
        <main>
          <p className="muted">Učitavanje…</p>
        </main>
      </div>
    );
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const korisnik = readKorisnikFromStorage();
  const headerLabel =
    korisnik?.naziv?.trim() ||
    (session.user.is_anonymous ? "Gost" : null) ||
    session.user.email ||
    session.user.id;

  return (
    <Layout
      email={headerLabel}
      onSignOut={() => {
        clearKorisnikFromStorage();
        void supabase.auth.signOut();
      }}
    >
      <Routes>
        <Route path="/" element={<Navigate to="/persons" replace />} />
        <Route path="/trees" element={<TreesPage />} />
        <Route path="/persons" element={<PersonsPage />} />
        <Route path="/relationships" element={<RelationshipsPage />} />
        <Route path="*" element={<Navigate to="/persons" replace />} />
      </Routes>
    </Layout>
  );
}
