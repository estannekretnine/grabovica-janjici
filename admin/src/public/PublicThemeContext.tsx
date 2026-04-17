import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type PublicTheme = "dark" | "light";

const STORAGE_KEY = "gj_public_theme";

type Ctx = {
  theme: PublicTheme;
  setTheme: (t: PublicTheme) => void;
  toggleTheme: () => void;
};

const PublicThemeContext = createContext<Ctx | null>(null);

function readStoredTheme(): PublicTheme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* ignore */
  }
  return "dark";
}

export function PublicThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<PublicTheme>(() =>
    typeof window !== "undefined" ? readStoredTheme() : "dark"
  );

  const setTheme = useCallback((t: PublicTheme) => {
    setThemeState(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);

  return <PublicThemeContext.Provider value={value}>{children}</PublicThemeContext.Provider>;
}

export function usePublicTheme() {
  const v = useContext(PublicThemeContext);
  if (!v) throw new Error("usePublicTheme van PublicThemeProvider-a");
  return v;
}
