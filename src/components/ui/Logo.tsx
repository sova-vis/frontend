interface MarkProps {
  size?: number;
  className?: string;
}

/**
 * Propel "Unboxed" mark — three chevrons ascending right at 35% / 65% / 100%
 * opacity. Fill is `currentColor`, so the tone comes from the parent's text
 * colour (e.g. `text-crimson`, `text-pink`, `text-cream`, `text-ink`).
 * Never recolour a single chevron or flatten the opacity steps.
 */
export function PropelMark({ size = 32, className = "" }: MarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="currentColor"
      role="img"
      aria-label="Propel"
      className={className}
    >
      <polygon points="8,46 20,46 32,58 20,58" opacity="0.35" />
      <polygon points="16,30 30,30 44,44 30,44" opacity="0.65" />
      <polygon points="24,12 40,12 56,28 40,28" />
    </svg>
  );
}

/**
 * The mark on a full-bleed crimson tile with a cream knockout — the app-icon
 * lockup. Used as a compact avatar / standalone badge.
 */
export function MarkTile({ size = 32, className = "" }: MarkProps) {
  // Fixed brand crimson + cream — the app-icon does not theme-shift.
  return (
    <span
      className={`inline-grid place-items-center text-[#FAF6F0] ${className}`}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.28), background: "#A8123C" }}
    >
      <PropelMark size={Math.round(size * 0.72)} />
    </span>
  );
}

/** Back-compat alias — the old circular "O" badge is now the brand mark tile. */
export function CircularOLogo({ size = 32, className = "" }: MarkProps) {
  return <MarkTile size={size} className={className} />;
}

type Tone = "light" | "dark" | "crimson";

const TONES: Record<Tone, { mark: string; pro: string; pel: string }> = {
  // On paper / cream surfaces.
  light: { mark: "text-crimson", pro: "text-ink", pel: "text-crimson" },
  // On ink / charcoal surfaces — pink is the dark-UI variant.
  dark: { mark: "text-pink", pro: "text-cream", pel: "text-pink" },
  // On a crimson surface — full cream knockout.
  crimson: { mark: "text-cream", pro: "text-cream", pel: "text-cream" },
};

interface BrandLogoProps {
  size?: number;
  className?: string;
  /** Explicit tone. If omitted, inferred from a light/dark hint in labelClassName. */
  tone?: Tone;
  /** Sizing classes for the wordmark (e.g. "text-2xl"); colour hints here are ignored. */
  labelClassName?: string;
  /** Render the wordmark next to the mark (default true). */
  wordmark?: boolean;
}

/**
 * Mark + wordmark. The wordmark is Fraunces SemiBold, "Pro" + "pel", tracked
 * -0.025em, coloured per tone (never set it in another typeface).
 */
export function BrandLogo({
  size = 32,
  className = "",
  tone,
  labelClassName = "",
  wordmark = true,
}: BrandLogoProps) {
  const resolved: Tone =
    tone ?? (/text-(white|cream)/.test(labelClassName) ? "dark" : "light");
  const t = TONES[resolved];
  return (
    <div className={`inline-flex items-center ${className}`} style={{ gap: Math.round(size * 0.34) }}>
      <PropelMark size={size} className={`${t.mark} shrink-0`} />
      {wordmark && (
        <span className={`font-display font-semibold leading-none tracking-[-0.025em] ${labelClassName}`}>
          <span className={t.pro}>Pro</span>
          <span className={t.pel}>pel</span>
        </span>
      )}
    </div>
  );
}
