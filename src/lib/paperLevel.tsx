"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

/* ============================================================
   PROPEL — Paper level (O Levels / A Levels)
   Shared between the navbar toggle and the Past Papers page.
   Persisted per-browser so the choice sticks across visits.
   ============================================================ */

export type PaperLevel = "olevel" | "alevel";

export const LEVEL_LABEL: Record<PaperLevel, string> = {
  olevel: "O-Level",
  alevel: "A-Level",
};

const STORAGE_KEY = "propel_paper_level";

interface PaperLevelContextValue {
  level: PaperLevel;
  setLevel: (level: PaperLevel) => void;
  /** true once the persisted value has been restored on the client */
  ready: boolean;
}

const PaperLevelContext = createContext<PaperLevelContextValue>({
  level: "olevel",
  setLevel: () => {},
  ready: false,
});

export function PaperLevelProvider({ children }: { children: React.ReactNode }) {
  const [level, setLevelState] = useState<PaperLevel>("olevel");
  const [ready, setReady] = useState(false);

  // restore persisted choice (effect keeps SSR + first client render identical)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "olevel" || saved === "alevel") setLevelState(saved);
    } catch {}
    setReady(true);
  }, []);

  const setLevel = useCallback((next: PaperLevel) => {
    setLevelState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }, []);

  return (
    <PaperLevelContext.Provider value={{ level, setLevel, ready }}>
      {children}
    </PaperLevelContext.Provider>
  );
}

export function usePaperLevel() {
  return useContext(PaperLevelContext);
}
