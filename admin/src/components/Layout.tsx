import { NavLink, Outlet } from "react-router-dom";
import { useState } from "react";

type Props = {
  email: string;
  onSignOut: () => void;
};

function navClass({ isActive }: { isActive: boolean }) {
  return `sidebar-link${isActive ? " active" : ""}`;
}

export function Layout({ email, onSignOut }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function closeSidebar() {
    setSidebarOpen(false);
  }

  return (
    <div className={`app-shell${sidebarOpen ? " sidebar-open" : ""}`}>
      {sidebarOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Zatvori meni"
          onClick={closeSidebar}
        />
      ) : null}

      <aside id="app-sidebar" className={`sidebar${sidebarOpen ? " open" : ""}`}>
        <div className="sidebar-brand">
          <div className="sidebar-logo">GJ</div>
          <div>
            <div className="sidebar-title">Grabovica Janjići</div>
            <div className="sidebar-sub">Admin panel</div>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Glavna navigacija">
          <div className="sidebar-group">
            <div className="sidebar-label">Admin</div>
            <NavLink to="/korisnici" className={navClass} onClick={closeSidebar}>
              Korisnici
            </NavLink>
            <NavLink to="/poruke-sajta" className={navClass} onClick={closeSidebar}>
              Poruke sa sajta
            </NavLink>
            <NavLink to="/statistika-sajta" className={navClass} onClick={closeSidebar}>
              Statistika sajta
            </NavLink>
          </div>

          <div className="sidebar-group">
            <div className="sidebar-label">Lokalitet</div>
            <NavLink to="/countries" className={navClass} onClick={closeSidebar}>
              Države
            </NavLink>
            <NavLink to="/municipalities" className={navClass} onClick={closeSidebar}>
              Opštine
            </NavLink>
            <NavLink to="/locations" className={navClass} onClick={closeSidebar}>
              Lokacije
            </NavLink>
          </div>

          <div className="sidebar-group">
            <div className="sidebar-label">Stablo</div>
            <NavLink to="/persons" className={navClass} onClick={closeSidebar}>
              Članovi
            </NavLink>
            <NavLink to="/relationships" className={navClass} onClick={closeSidebar}>
              Veze
            </NavLink>
            <NavLink to="/trees" className={navClass} onClick={closeSidebar}>
              Stabla
            </NavLink>
            <NavLink to="/stablo-1" className={navClass} onClick={closeSidebar}>
              Stablo 1
            </NavLink>
            <NavLink to="/stablo-2" className={navClass} onClick={closeSidebar}>
              Stablo 2
            </NavLink>
            <NavLink to="/stablo-import" className={navClass} onClick={closeSidebar}>
              Import stabla
            </NavLink>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user muted">{email}</div>
          <button type="button" className="sidebar-signout" onClick={onSignOut}>
            Odjava
          </button>
        </div>
      </aside>

      <div className="app-main-wrap">
        <header className="mobile-topbar">
          <button
            type="button"
            className="sidebar-toggle"
            aria-expanded={sidebarOpen}
            aria-controls="app-sidebar"
            onClick={() => setSidebarOpen((o) => !o)}
          >
            Meni
          </button>
          <strong className="mobile-topbar-title">Porodica — admin</strong>
        </header>
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
