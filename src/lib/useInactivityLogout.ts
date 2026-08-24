"use client";

import { useEffect, useRef } from "react";
import { useClerk, useUser } from "@clerk/nextjs";

/**
 * Sign the user out after a stretch of inactivity, and also on load if they've
 * been away longer than the window (so a tab left open overnight is logged out).
 * Any real interaction (move, key, click, scroll, touch, tab-focus) resets it.
 * Mounted only inside authenticated layouts.
 */
const LAST_ACTIVE_KEY = "propel_last_active";

export function useInactivityLogout(minutes = 30) {
  const { signOut } = useClerk();
  const { isSignedIn } = useUser();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    const ms = minutes * 60_000;

    const doLogout = () => { void signOut({ redirectUrl: "/" }); };

    // Already idle past the window before this tab even loaded → log out now.
    try {
      const last = Number(window.localStorage.getItem(LAST_ACTIVE_KEY) || 0);
      if (last && Date.now() - last > ms) { doLogout(); return; }
    } catch { /* ignore */ }

    const reset = () => {
      try { window.localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now())); } catch { /* ignore */ }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(doLogout, ms);
    };

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    // Re-check when the tab regains focus (it may have been idle in the background).
    const onVisible = () => { if (document.visibilityState === "visible") reset(); };
    document.addEventListener("visibilitychange", onVisible);
    reset();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      events.forEach((e) => window.removeEventListener(e, reset));
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isSignedIn, minutes, signOut]);
}
