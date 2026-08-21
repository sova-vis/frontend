"use client";

import { useEffect, useState } from "react";
import { isAuthSplashActive, subscribeAuthSplash } from "@/lib/authSplash";

/**
 * Full-screen Propel splash shown during the post-login route transition
 * (landing → onboarding → dashboard). Mounted once in the root layout so it
 * survives client navigations; visibility is driven by lib/authSplash.
 */
export default function AuthTransitionSplash() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(isAuthSplashActive());
    return subscribeAuthSplash(setActive);
  }, []);

  if (!active) return null;

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[200] grid place-items-center bg-paper"
      style={{ animation: "pplSplashIn .25s ease-out both" }}
    >
      <style>{`
        @keyframes pplSplashIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes pplRise { from { opacity: 0; transform: translateY(10px) scale(.96) } to { opacity: 1; transform: none } }
        /* the three chevrons brighten in sequence → a sense of upward propulsion */
        @keyframes pplWave { 0%, 100% { opacity: .28 } 45% { opacity: 1 } }
        @keyframes pplFloat { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
        @keyframes pplBar { 0% { transform: translateX(-100%) } 100% { transform: translateX(320%) } }
        @media (prefers-reduced-motion: reduce) {
          .ppl-splash-chev, .ppl-splash-float, .ppl-splash-bar { animation: none !important; }
          .ppl-splash-chev { opacity: 1 !important; }
        }
      `}</style>

      <div className="flex flex-col items-center gap-6" style={{ animation: "pplRise .5s ease-out both" }}>
        <div className="ppl-splash-float" style={{ animation: "pplFloat 2.4s ease-in-out infinite" }}>
          <svg width={72} height={72} viewBox="0 0 64 64" role="img" aria-label="Propel" className="text-crimson" fill="currentColor">
            <polygon className="ppl-splash-chev" points="8,46 20,46 32,58 20,58" style={{ animation: "pplWave 1.5s ease-in-out infinite", animationDelay: "0s" }} />
            <polygon className="ppl-splash-chev" points="16,30 30,30 44,44 30,44" style={{ animation: "pplWave 1.5s ease-in-out infinite", animationDelay: ".2s" }} />
            <polygon className="ppl-splash-chev" points="24,12 40,12 56,28 40,28" style={{ animation: "pplWave 1.5s ease-in-out infinite", animationDelay: ".4s" }} />
          </svg>
        </div>

        <span className="font-display text-3xl font-semibold leading-none tracking-[-0.025em]">
          <span className="text-ink">Pro</span><span className="text-crimson">pel</span>
        </span>

        <div className="h-1 w-40 overflow-hidden rounded-full bg-surface-soft">
          <div className="ppl-splash-bar h-full w-1/3 rounded-full bg-crimson" style={{ animation: "pplBar 1.15s ease-in-out infinite" }} />
        </div>
        <p className="text-sm text-ink-muted">Getting your workspace ready…</p>
      </div>
    </div>
  );
}
