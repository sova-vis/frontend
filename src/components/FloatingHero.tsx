"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, ClipboardCheck, Sparkles, Zap } from "lucide-react";
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
function AnimatedMark({ size = 64, className = "text-crimson" }: { size?: number; className?: string }) {
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
/* Live-marking demo — the centrepiece. An answer gets marked in real time:
   a scan line sweeps, mark-scheme rows award one by one, the score ring fills.
   The whole sequence replays on a loop (remounted via `cycle`).               */
const MARK_ROWS = [
  { sym: "✓", code: "M1", text: "Kinetic energy rises", tone: "text-mint", chip: "bg-mint-soft text-mint-ink" },
  { sym: "✓", code: "M1", text: "More frequent collisions", tone: "text-mint", chip: "bg-mint-soft text-mint-ink" },
  { sym: "±", code: "A1", text: "Activation energy", tone: "text-gold-ink", chip: "bg-gold-soft text-gold-ink" },
  { sym: "✕", code: "B1", text: "Units on the rate", tone: "text-clay-ink", chip: "bg-clay-soft text-clay-ink" },
];

function ScoreRing({ score, total, delay }: { score: number; total: number; delay: number }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 64 64" className="-rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgb(var(--line))" strokeWidth="6" />
        <motion.circle
          cx="32" cy="32" r={r} fill="none" stroke="rgb(var(--mint))" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - (circ * score) / total }}
          transition={{ duration: 0.9, ease: EASE, delay }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <b className="font-display text-lg font-semibold leading-none text-ink">{score}/{total}</b>
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
    <div className="relative overflow-hidden rounded-[1.6rem] border border-line bg-surface/90 p-5 shadow-card backdrop-blur-xl md:p-6">
      {/* header */}
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[.14em] text-crimson">
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

      {/* question + answer */}
      <div className="mt-4 rounded-xl border border-line bg-paper/60 p-3.5">
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
            className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2"
          >
            <span className={`grid h-6 w-6 place-items-center rounded-lg text-sm font-bold ${row.chip}`}>{row.sym}</span>
            <span className="font-mono text-[10px] font-medium text-ink-faint">{row.code}</span>
            <span className="flex-1 truncate text-[13px] text-ink">{row.text}</span>
            <span className={`font-mono text-[11px] font-semibold ${row.tone}`}>{row.sym === "✕" ? "0" : "1"}</span>
          </motion.div>
        ))}

        {/* total */}
        <motion.div
          initial={reduce ? { opacity: 1 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: reduce ? 0 : 0.5 + MARK_ROWS.length * 0.45 }}
          className="flex items-center gap-4 rounded-xl bg-ink px-4 py-3 text-cream"
        >
          <ScoreRing score={3} total={4} delay={reduce ? 0 : 0.6 + MARK_ROWS.length * 0.45} />
          <div>
            <p className="font-display text-lg font-semibold leading-tight">Marked & explained</p>
            <p className="font-mono text-[10px] uppercase tracking-[.12em] text-cream/60">Every mark traced to the scheme</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function FloatingHero({ user, profile, onSignUp, onExplore }: FloatingHeroProps) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const yUp = useTransform(scrollYProgress, [0, 1], [0, -70]);
  const yDown = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const fade = useTransform(scrollYProgress, [0, 0.9], [1, 0]);

  // Headline lines for the mask reveal.
  const line1 = "See exactly";
  const line2 = "where your marks went";

  return (
    <section ref={ref} className="relative w-full overflow-hidden bg-paper pt-28 pb-24 md:pt-32 md:pb-28">
      {/* ---- Animated aurora backdrop ---- */}
      <div className="absolute inset-0 ed-grid-bg opacity-50" />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-[8%] h-[32rem] w-[32rem] rounded-full bg-crimson/15 blur-[130px]"
        animate={reduce ? {} : { x: [0, 40, 0], y: [0, 26, 0], scale: [1, 1.12, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute top-[20%] right-[6%] h-[26rem] w-[26rem] rounded-full bg-pink/15 blur-[120px]"
        animate={reduce ? {} : { x: [0, -34, 0], y: [0, -22, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[46%] flex justify-center overflow-hidden opacity-[0.03] dark:opacity-[0.05]">
        <span className="whitespace-nowrap font-display text-[20vw] font-black leading-none text-ink">O &amp; A LEVELS</span>
      </div>

      <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center px-5 text-center">
        {/* ---- Centered copy ---- */}
        <div className="flex w-full flex-col items-center text-center">
          {/* Mark with glow + gentle float */}
          <motion.div
            className="relative"
            animate={reduce ? {} : { y: [0, -7, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            <motion.div
              aria-hidden
              className="absolute -inset-6 rounded-full bg-crimson/25 blur-2xl"
              animate={reduce ? {} : { opacity: [0.5, 0.9, 0.5], scale: [0.9, 1.1, 0.9] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="relative"><AnimatedMark size={62} /></div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.5 }}
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3.5 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[.13em] text-ink-muted backdrop-blur"
          >
            <Sparkles size={13} className="text-crimson" />
            AI marking for Cambridge O &amp; A Level
          </motion.div>

          {/* Mask-reveal headline */}
          <h1 className="mt-5 font-display text-[2.7rem] font-semibold leading-[1.02] tracking-tight text-ink sm:text-6xl lg:text-[4.3rem]">
            <span className="block overflow-hidden pb-1">
              <motion.span className="block" initial={reduce ? {} : { y: "110%" }} animate={{ y: 0 }} transition={{ duration: 0.7, ease: EASE, delay: 0.55 }}>
                {line1}
              </motion.span>
            </span>
            <span className="block overflow-hidden pb-1">
              <motion.span className="block text-crimson" initial={reduce ? {} : { y: "110%" }} animate={{ y: 0 }} transition={{ duration: 0.7, ease: EASE, delay: 0.68 }}>
                {line2}
              </motion.span>
            </span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.85 }}
            className="mt-5 max-w-md text-base leading-relaxed text-ink-muted md:text-lg"
          >
            Submit your answers and Propel marks them against the official Cambridge
            scheme — then shows every mark won or lost, and what to fix next.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.95 }}
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
            transition={{ duration: 0.8, delay: 1.15 }}
            className="mt-9 flex flex-wrap items-center justify-center gap-x-8 gap-y-3"
          >
            {[["12k+", "answers marked"], ["15+", "past paper years"], ["100%", "marks explained"]].map(([n, l]) => (
              <div key={l} className="flex items-baseline gap-2">
                <b className="font-display text-xl font-semibold text-ink">{n}</b>
                <span className="text-sm text-ink-faint">{l}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* ---- The live-marking showcase + floating chips (centered below) ---- */}
        <motion.div
          style={{ y: yUp, opacity: fade }}
          initial={{ opacity: 0, y: 40, rotate: reduce ? 0 : -1.5 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.3 }}
          className="relative mx-auto mt-16 w-full max-w-[420px] md:mt-20"
        >
          <LiveMarking />

          {/* Floating readiness chip (top-left) */}
          <motion.div
            style={{ y: yDown }}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: EASE, delay: 1.1 }}
            className="absolute -left-5 -top-6 hidden items-center gap-2.5 rounded-2xl border border-line bg-surface p-3 shadow-card sm:flex"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-crimson-soft text-crimson-ink"><ClipboardCheck size={17} /></span>
            <div>
              <b className="font-display text-lg font-semibold leading-none text-ink">64%</b>
              <p className="font-mono text-[9px] font-medium uppercase tracking-[.12em] text-ink-faint">readiness</p>
            </div>
          </motion.div>

          {/* Floating weakness chip (bottom-right) */}
          <motion.div
            style={{ y: yDown }}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: EASE, delay: 1.25 }}
            className="absolute -bottom-6 -right-4 hidden items-center gap-2.5 rounded-2xl border border-line bg-surface p-3 shadow-card sm:flex md:-right-8"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-clay-soft text-clay-ink"><Check size={17} /></span>
            <div>
              <b className="font-display text-sm font-semibold leading-tight text-ink">Kinematics</b>
              <p className="font-mono text-[9px] font-medium uppercase tracking-[.12em] text-clay-ink">weakest · 42%</p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
