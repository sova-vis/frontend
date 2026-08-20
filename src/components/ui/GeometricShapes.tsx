/**
 * Soft, editorial backdrop — warm paper-toned crimson glows behind content.
 * Static and framer-free: this renders on every student page, so it must add
 * zero continuous paint/JS. Intentionally low-contrast so foreground leads.
 */
export default function GeometricShapes() {
  return (
    <div aria-hidden className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div className="absolute -top-32 -right-24 h-[28rem] w-[28rem] rounded-full bg-crimson/10 blur-[120px]" />
      <div className="absolute -bottom-40 -left-24 h-[26rem] w-[26rem] rounded-full bg-crimson/[0.06] blur-[120px]" />
      <div className="absolute top-1/3 left-1/4 h-40 w-40 rounded-full bg-crimson/[0.05] blur-3xl" />
    </div>
  );
}
