"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "propel_theme";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function ThemeToggle({
  className = "",
  withBackground = true,
}: {
  className?: string;
  withBackground?: boolean;
}) {
  const [theme, setTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored =
      (window.localStorage.getItem(STORAGE_KEY) as Theme | null) || null;
    const preferredDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextTheme = stored || (preferredDark ? "dark" : "light");

    setTheme(nextTheme);
    applyTheme(nextTheme);
    setReady(true);
  }, []);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  };

  if (!ready) {
    return (
      <button
        type="button"
        aria-label="Toggle theme"
        className={`h-10 w-10 rounded-full ${withBackground ? "bg-slate-200/80" : ""} ${className}`}
      />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`h-10 w-10 rounded-full border border-slate-300/80 text-slate-700 dark:text-slate-100 dark:border-slate-700 transition-colors ${
        withBackground
          ? "bg-white/90 hover:bg-white dark:bg-slate-900/80 dark:hover:bg-slate-900"
          : ""
      } ${className}`}
    >
      {isDark ? <Sun size={18} className="mx-auto" /> : <Moon size={18} className="mx-auto" />}
    </button>
  );
}
