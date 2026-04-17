import { NavLink, Outlet } from "react-router-dom";
import { PublicThemeProvider, usePublicTheme } from "./PublicThemeContext";

function navClass({ isActive }: { isActive: boolean }) {
  return `public-nav-link${isActive ? " public-nav-link--active" : ""}`;
}

function PublicLayoutInner() {
  const { theme, toggleTheme } = usePublicTheme();

  return (
    <div className="public-root" data-theme={theme}>
      <header className="public-header">
        <div className="public-header-inner">
          <NavLink to="/" className="public-brand">
            <span className="public-brand-mark">GJ</span>
            <span className="public-brand-text">Grabovica Janjići</span>
          </NavLink>
          <nav className="public-nav" aria-label="Glavna navigacija">
            <NavLink to="/" end className={navClass}>
              Početna
            </NavLink>
            <NavLink to="/stablo" className={navClass}>
              Stablo
            </NavLink>
            <NavLink to="/kontakt" className={navClass}>
              Kontakt forma
            </NavLink>
          </nav>
          <div className="public-header-actions">
            <button type="button" className="public-theme-toggle" onClick={toggleTheme} aria-label="Promena teme">
              {theme === "dark" ? "Svetla tema" : "Tamna tema"}
            </button>
          </div>
        </div>
      </header>

      <Outlet />

      <footer className="public-footer">
        <div className="public-footer-inner">
          <div>
            <strong>Kontakt</strong>
            <p className="public-footer-line">
              Telefon:{" "}
              <a href="tel:+381638676663" className="public-footer-link">
                +381 63 867 6663
              </a>
            </p>
            <p className="public-footer-muted">Porodično stablo — Grabovica, Crna Gora</p>
          </div>
          <div className="public-footer-links">
            <NavLink to="/kontakt" className="public-footer-link">
              Kontakt forma
            </NavLink>
            <NavLink to="/login" className="public-footer-link public-footer-login">
              Prijava (admin)
            </NavLink>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Javni sajt: tamna/svetla tema + zajednički header/footer. */
export function PublicShell() {
  return (
    <PublicThemeProvider>
      <PublicLayoutInner />
    </PublicThemeProvider>
  );
}
