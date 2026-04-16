import { Link } from "react-router-dom";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  email: string;
  onSignOut: () => void;
};

export function Layout({ children, email, onSignOut }: Props) {
  return (
    <div className="layout">
      <header>
        <strong>Porodica — admin</strong>
        <nav>
          <Link to="/persons">Članovi</Link>
          <Link to="/relationships">Veze</Link>
          <Link to="/trees">Stabla</Link>
        </nav>
        <span className="muted" style={{ marginLeft: "auto", color: "#94a3b8" }}>
          {email}
        </span>
        <button type="button" onClick={onSignOut}>
          Odjava
        </button>
      </header>
      <main>{children}</main>
    </div>
  );
}
