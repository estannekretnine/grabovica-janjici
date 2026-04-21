import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { PublicThemeProvider } from "./PublicThemeContext";

function navClass({ isActive }: { isActive: boolean }) {
  return `public-nav-link${isActive ? " public-nav-link--active" : ""}`;
}

function PublicLayoutInner() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="public-root" data-theme="light">
      <header className="public-header public-header--hero">
        <div className="public-header-bg" aria-hidden="true" />
        <div className="public-header-overlay" aria-hidden="true" />

        <div className="public-header-top">
          <div className="public-header-inner">
            <NavLink to="/" className="public-brand">
              <span className="public-brand-mark">GJ</span>
              <span className="public-brand-text">Grabovica Janjići</span>
            </NavLink>

            <button
              type="button"
              className={`public-nav-toggle${menuOpen ? " public-nav-toggle--open" : ""}`}
              aria-label={menuOpen ? "Zatvori meni" : "Otvori meni"}
              aria-expanded={menuOpen}
              aria-controls="public-main-nav"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="public-nav-toggle-bar" />
              <span className="public-nav-toggle-bar" />
              <span className="public-nav-toggle-bar" />
            </button>

            <nav
              id="public-main-nav"
              className={`public-nav${menuOpen ? " public-nav--open" : ""}`}
              aria-label="Glavna navigacija"
            >
              <NavLink to="/" end className={navClass}>
                Početna
              </NavLink>
              <NavLink to="/stablo" className={navClass}>
                Stablo
              </NavLink>
              <NavLink to="/pretraga" className={navClass}>
                Pretraga
              </NavLink>
              <NavLink to="/aktivnosti" className={navClass}>
                Aktivnosti
              </NavLink>
              <NavLink to="/kontakt" className={navClass}>
                Kontakt forma
              </NavLink>
            </nav>
          </div>
        </div>

        <div className="public-hero-title-block">
          <h1 className="public-hero-title">Crna Gora - Grabovica</h1>
          <p className="public-hero-subtitle">Bratstvo Janjići</p>
        </div>
      </header>

      {menuOpen ? (
        <button
          type="button"
          className="public-nav-backdrop"
          aria-label="Zatvori meni"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <Outlet />

      <footer className="public-footer">
        <div className="public-footer-inner public-footer-inner--three">
          <div className="public-footer-contact">
            <strong className="public-footer-heading">Kontakt</strong>
            <p className="public-footer-line public-footer-name">Autor: Dragan (Mihailo) Janjić, Beograd</p>
            <p className="public-footer-line">
              Telefon:{" "}
              <a href="tel:+381638676663" className="public-footer-link">
                +381 63 867 6663
              </a>
            </p>
            <p className="public-footer-line">
              e-mail:{" "}
              <a href="mailto:estannekretnine@gmail.com" className="public-footer-link">
                estannekretnine@gmail.com
              </a>
            </p>
          </div>
          <p className="public-footer-copyright">© 2026 Porodično stablo. Sva prava zadržana.</p>
          <div className="public-footer-aside">
            <NavLink to="/login" className="public-footer-link public-footer-login">
              Prijava (admin)
            </NavLink>
            <p className="public-footer-muted">Porodično stablo — Grabovica, Crna Gora</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Javni sajt: jedna (svetla) tema, zajednički hero header i footer. */
export function PublicShell() {
  return (
    <PublicThemeProvider>
      <PublicLayoutInner />
    </PublicThemeProvider>
  );
}
