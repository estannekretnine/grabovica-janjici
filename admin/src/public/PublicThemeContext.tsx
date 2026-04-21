import { createContext, useContext, useMemo, type ReactNode } from "react";

export type PublicTheme = "light";

type Ctx = {
  theme: PublicTheme;
  setTheme: (t: PublicTheme) => void;
  toggleTheme: () => void;
};

const PublicThemeContext = createContext<Ctx | null>(null);

/** Javni sajt: jedna (svetla) tema. Provider ostaje radi kompatibilnosti sa postojećim kodom. */
export function PublicThemeProvider({ children }: { children: ReactNode }) {
  const value = useMemo<Ctx>(
    () => ({
      theme: "light",
      setTheme: () => {},
      toggleTheme: () => {},
    }),
    []
  );

  return <PublicThemeContext.Provider value={value}>{children}</PublicThemeContext.Provider>;
}

export function usePublicTheme() {
  const v = useContext(PublicThemeContext);
  if (!v) throw new Error("usePublicTheme van PublicThemeProvider-a");
  return v;
}
