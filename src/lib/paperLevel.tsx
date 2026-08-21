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

  // Follow external level changes — chiefly when personalization is hydrated from
  // the server profile on login (so the toggle reflects the account, not just
  // this browser). Doesn't re-dispatch, so there's no loop with setLevel.
  useEffect(() => {
    const onExternal = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === "olevel" || detail === "alevel") { setLevelState(detail); return; }
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === "olevel" || saved === "alevel") setLevelState(saved);
      } catch {}
    };
    window.addEventListener("propel:level-change", onExternal);
    return () => window.removeEventListener("propel:level-change", onExternal);
  }, []);

  const setLevel = useCallback((next: PaperLevel) => {
    setLevelState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
      // Selected subjects are per-level — tell every consumer to reload for the
      // newly-active level (dashboard, practice, papers, datesheet, planner…).
      window.dispatchEvent(new CustomEvent("propel:selected-subjects-change"));
      window.dispatchEvent(new CustomEvent("propel:level-change", { detail: next }));
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
