"use client";

/**
 * The Propel loading state — the brand mark's three chevrons brighten in
 * sequence (an upward "propel" pulse) instead of a generic spinning circle.
 * Use `fullScreen` for route/layout guards; otherwise it centres in its box.
 */
export default function PropelLoader({ label, size = 46, fullScreen = false }: { label?: string; size?: number; fullScreen?: boolean }) {
  const mark = (
    <div className="flex flex-col items-center gap-3">
      <style>{`
        @keyframes pplLoadWave { 0%,100%{opacity:.28} 45%{opacity:1} }
        @keyframes pplLoadFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @media (prefers-reduced-motion: reduce){ .ppl-load-chev{animation:none!important;opacity:1!important} .ppl-load-float{animation:none!important} }
      `}</style>
      <div className="ppl-load-float" style={{ animation: "pplLoadFloat 2.4s ease-in-out infinite" }}>
        <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor" className="text-crimson" role="img" aria-label={label || "Loading"}>
          <polygon className="ppl-load-chev" points="8,46 20,46 32,58 20,58" style={{ animation: "pplLoadWave 1.5s ease-in-out infinite", animationDelay: "0s" }} />
          <polygon className="ppl-load-chev" points="16,30 30,30 44,44 30,44" style={{ animation: "pplLoadWave 1.5s ease-in-out infinite", animationDelay: ".2s" }} />
          <polygon className="ppl-load-chev" points="24,12 40,12 56,28 40,28" style={{ animation: "pplLoadWave 1.5s ease-in-out infinite", animationDelay: ".4s" }} />
        </svg>
      </div>
      {label && <p className="text-sm font-medium text-ink-muted">{label}</p>}
    </div>
  );
  if (fullScreen) return <div className="min-h-screen flex items-center justify-center bg-paper">{mark}</div>;
  return <div className="flex items-center justify-center py-12">{mark}</div>;
}
