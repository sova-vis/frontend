"use client";

import { useEffect, useRef } from "react";
import { useClerk, useUser } from "@clerk/nextjs";

/**
 * Sign the user out after a stretch of inactivity WITHIN the current session.
 * Any real interaction (move, key, click, scroll, touch, tab-focus) resets the
 * timer. Mounted only inside authenticated layouts.
 *
 * Note: we deliberately do NOT log out based on a timestamp left in
 * localStorage from a previous visit. A returning user who just signed in has,
 * by definition, been away longer than the window, and reading that stale value
 * on mount was logging them straight back out. Page load = fresh activity.
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

    const reset = () => {
      try { window.localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now())); } catch { /* ignore */ }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(doLogout, ms);
    };

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    const onVisible = () => { if (document.visibilityState === "visible") reset(); };
    document.addEventListener("visibilitychange", onVisible);
    // Loading the app counts as activity — start the clock fresh, never log out here.
    reset();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      events.forEach((e) => window.removeEventListener(e, reset));
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isSignedIn, minutes, signOut]);
}
