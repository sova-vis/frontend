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
    const nextTheme = stored || "light";

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
        className={`h-10 w-10 rounded-full ${withBackground ? "bg-surface-soft" : ""} ${className}`}
      />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`group relative h-10 w-10 overflow-hidden rounded-full border border-line text-ink transition-colors ${
        withBackground ? "bg-surface hover:bg-surface-soft" : ""
      } ${className}`}
    >
      <span className="relative block transition-transform duration-500 group-hover:rotate-12">
        {isDark ? <Sun size={18} className="mx-auto" /> : <Moon size={18} className="mx-auto" />}
      </span>
    </button>
  );
}
