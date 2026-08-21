"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { ArrowRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { EASE } from "@/components/ui/Motion";

interface FloatingHeroProps {
  user?: any;
  profile?: { role: string; full_name?: string } | null;
  onSignUp: () => void;
  onExplore: () => void;
}

function dashboardHref(user: any, profile?: { role: string } | null) {
  const role = profile?.role || user?.publicMetadata?.role;
  if (role === "teacher") return "/teacher/dashboard";
  if (role === "admin") return "/admin/dashboard";
  return "/student/dashboard";
}

/* -------------------------------------------------------------------------- */
/* The "Unboxed" mark, animated: three chevrons rising and fading into place.  */
const CHEVRONS = [
  { points: "8,46 20,46 32,58 20,58", o: 0.35 },
  { points: "16,30 30,30 44,44 30,44", o: 0.65 },
  { points: "24,12 40,12 56,28 40,28", o: 1 },
];
function AnimatedMark({ size = 56, className = "text-crimson" }: { size?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor" role="img" aria-label="Propel" className={className}>
      {CHEVRONS.map((c, i) => (
        <motion.polygon
          key={i}
          points={c.points}
          initial={reduce ? { opacity: c.o } : { opacity: 0, y: 16 }}
          animate={{ opacity: c.o, y: 0 }}
          transition={{ duration: 0.55, ease: EASE, delay: reduce ? 0 : 0.15 + i * 0.16 }}
        />
      ))}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Live-marking demo — a clean light "product" card. Colour + symbol together:
   teal earned, amber partial, coral lost. The sequence replays on a loop.     */
const MARK_ROWS = [
  { sym: "✓", code: "M1", text: "Kinetic energy rises", chip: "bg-mint-soft text-mint-ink", tone: "text-mint-ink", pts: "1" },
  { sym: "✓", code: "M1", text: "More frequent collisions", chip: "bg-mint-soft text-mint-ink", tone: "text-mint-ink", pts: "1" },
  { sym: "±", code: "A1", text: "Activation energy", chip: "bg-gold-soft text-gold-ink", tone: "text-gold-ink", pts: "1" },
  { sym: "✕", code: "B1", text: "Units on the rate", chip: "bg-clay-soft text-clay-ink", tone: "text-clay-ink", pts: "0" },
];

function ScoreRing({ score, total, delay }: { score: number; total: number; delay: number }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 64 64" className="-rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(250,246,240,0.28)" strokeWidth="6" />
        <motion.circle
          cx="32" cy="32" r={r} fill="none" stroke="#FAF6F0" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - (circ * score) / total }}
          transition={{ duration: 0.9, ease: EASE, delay }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <b className="font-display text-lg font-semibold leading-none text-cream">{score}/{total}</b>
      </div>
    </div>
  );
}

function LiveMarking() {
  const reduce = useReducedMotion();
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setCycle((c) => c + 1), 6200);
    return () => window.clearInterval(id);
  }, [reduce]);

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-[0_40px_80px_-32px_rgba(168,18,60,0.28)]">
      {/* thin crimson accent at the very top */}
      <div aria-hidden className="h-1 w-full bg-crimson" />

      {/* header */}
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <span className="inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[.16em] text-crimson">
          <motion.span
            className="h-1.5 w-1.5 rounded-full bg-crimson"
            animate={reduce ? {} : { opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
          Marking live
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-crimson-soft px-2.5 py-1 font-mono text-[10px] font-medium text-crimson-ink">
          <Zap size={11} /> 4s
        </span>
      </div>

      <div className="p-5 md:p-6">
        {/* question */}
        <div className="rounded-xl border border-line bg-paper/70 p-3.5">
          <p className="font-mono text-[10px] uppercase tracking-[.12em] text-ink-faint">Chemistry 5070 · P4 · Q3 · [4]</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink">
            Explain why increasing temperature increases the rate of reaction.
          </p>
        </div>

        {/* the marking sequence — replays each cycle */}
        <div key={cycle} className="relative mt-4 space-y-2">
          {/* scan line */}
          {!reduce && (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-crimson/10 to-transparent"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 150, opacity: [0, 1, 0] }}
              transition={{ duration: 1.1, ease: "easeInOut" }}
            />
          )}
          {MARK_ROWS.map((row, i) => (
            <motion.div
              key={row.text}
              initial={reduce ? { opacity: 1 } : { opacity: 0, x: -14, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.4, ease: EASE, delay: reduce ? 0 : 0.5 + i * 0.45 }}
              className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-soft/60 px-3 py-2"
            >
              <span className={`grid h-6 w-6 place-items-center rounded-lg text-sm font-bold ${row.chip}`}>{row.sym}</span>
              <span className="font-mono text-[10px] font-medium text-ink-faint">{row.code}</span>
              <span className="flex-1 truncate text-[13px] text-ink">{row.text}</span>
              <span className={`font-mono text-[11px] font-semibold ${row.tone}`}>{row.pts}</span>
            </motion.div>
          ))}

          {/* total — crimson footer */}
          <motion.div
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: reduce ? 0 : 0.5 + MARK_ROWS.length * 0.45 }}
            className="flex items-center gap-4 rounded-xl bg-crimson px-4 py-3"
          >
            <ScoreRing score={3} total={4} delay={reduce ? 0 : 0.6 + MARK_ROWS.length * 0.45} />
            <div>
              <p className="font-display text-lg font-semibold leading-tight text-cream">Marked &amp; explained</p>
              <p className="font-mono text-[10px] uppercase tracking-[.12em] text-cream/70">Every mark traced to the scheme</p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default function FloatingHero({ user, profile, onSignUp, onExplore }: FloatingHeroProps) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const yUp = useTransform(scrollYProgress, [0, 1], [0, -60]);

  return (
    <section ref={ref} className="relative w-full overflow-hidden bg-paper pt-44 pb-20 md:pt-52 md:pb-28">
      {/* ---- Animated aurora backdrop ---- */}
      <div className="absolute inset-0 ed-grid-bg opacity-50" />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-20 -left-10 h-[32rem] w-[32rem] rounded-full bg-crimson/12 blur-[130px]"
        animate={reduce ? {} : { x: [0, 40, 0], y: [0, 26, 0], scale: [1, 1.12, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute top-[16%] right-0 h-[28rem] w-[28rem] rounded-full bg-pink/12 blur-[120px]"
        animate={reduce ? {} : { x: [0, -34, 0], y: [0, -22, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      />

      <div className="relative z-10 mx-auto grid max-w-[1180px] items-center gap-12 px-5 lg:grid-cols-2 lg:gap-10">
        {/* -------- LEFT: copy -------- */}
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <motion.div
            className="relative"
            animate={reduce ? {} : { y: [0, -6, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            <motion.div
              aria-hidden
              className="absolute -inset-5 rounded-full bg-crimson/20 blur-2xl"
              animate={reduce ? {} : { opacity: [0.5, 0.85, 0.5], scale: [0.9, 1.1, 0.9] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="relative"><AnimatedMark size={54} /></div>
          </motion.div>

          <h1 className="mt-8 font-display text-[2.7rem] font-semibold leading-[1.04] tracking-tight text-ink sm:text-6xl lg:text-[4rem]">
            <span className="block overflow-hidden pb-1">
              <motion.span className="block" initial={reduce ? {} : { y: "110%" }} animate={{ y: 0 }} transition={{ duration: 0.7, ease: EASE, delay: 0.5 }}>
                See exactly where
              </motion.span>
            </span>
            <span className="block overflow-hidden pb-1">
              <motion.span className="block text-crimson" initial={reduce ? {} : { y: "110%" }} animate={{ y: 0 }} transition={{ duration: 0.7, ease: EASE, delay: 0.62 }}>
                your marks went
              </motion.span>
            </span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.8 }}
            className="mt-5 max-w-lg text-base leading-relaxed text-ink-muted md:text-lg"
          >
            Submit your answers and Propel marks them against the official Cambridge
            scheme — then shows every mark won or lost, and what to fix next.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.9 }}
            className="mt-8 flex flex-col items-center gap-3 sm:flex-row"
          >
            {user ? (
              <Link href={dashboardHref(user, profile)}>
                <Button size="lg" className="h-14 rounded-full px-8 text-base shadow-crimson">
                  Go to dashboard <ArrowRight size={18} />
                </Button>
              </Link>
            ) : (
              <>
                <Button onClick={onSignUp} size="lg" className="h-14 rounded-full px-8 text-base shadow-crimson">
                  Get started free <ArrowRight size={18} />
                </Button>
                <Button onClick={onExplore} variant="ghost" size="lg" className="h-14 rounded-full border border-line bg-surface px-8 text-base">
                  See how it works
                </Button>
              </>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.1 }}
            className="mt-9 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 lg:justify-start"
          >
            {[["12k+", "answers marked"], ["15+", "past paper years"], ["100%", "marks explained"]].map(([n, l]) => (
              <div key={l} className="flex items-baseline gap-2">
                <b className="font-display text-xl font-semibold text-ink">{n}</b>
                <span className="text-sm text-ink-faint">{l}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* -------- RIGHT: the live-marking card -------- */}
        <motion.div
          style={{ y: yUp }}
          initial={{ opacity: 0, y: 40, rotate: reduce ? 0 : -1.5 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.3 }}
          className="mx-auto w-full max-w-[440px]"
        >
          <LiveMarking />
        </motion.div>
      </div>
    </section>
  );
}
