"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, ClipboardCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { EASE } from "@/components/ui/Motion";
import { PropelMark } from "@/components/ui/Logo";

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
/* The "Unboxed" mark, animated: three chevrons rising and fading into place —
   forward motion and marks accumulating. Angle & opacity steps stay fixed.    */
const CHEVRONS = [
  { points: "8,46 20,46 32,58 20,58", o: 0.35 },
  { points: "16,30 30,30 44,44 30,44", o: 0.65 },
  { points: "24,12 40,12 56,28 40,28", o: 1 },
];
function AnimatedMark({ size = 84, className = "text-crimson" }: { size?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor" role="img" aria-label="Propel" className={className}>
      {CHEVRONS.map((c, i) => (
        <motion.polygon
          key={i}
          points={c.points}
          initial={reduce ? { opacity: c.o } : { opacity: 0, y: 18 }}
          animate={{ opacity: c.o, y: 0 }}
          transition={{ duration: 0.55, ease: EASE, delay: reduce ? 0 : 0.1 + i * 0.16 }}
        />
      ))}
    </svg>
  );
}

/* Readiness ring — draws on view. */
function ReadinessRing({ score = 64 }: { score?: number }) {
  const r = 34;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg viewBox="0 0 80 80" className="-rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgb(var(--line))" strokeWidth="8" />
        <motion.circle
          cx="40" cy="40" r={r} fill="none" stroke="rgb(var(--crimson))" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          whileInView={{ strokeDashoffset: circ - (circ * score) / 100 }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, ease: EASE, delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <b className="font-display text-xl font-semibold leading-none text-ink">{score}%</b>
      </div>
    </div>
  );
}

/* The mark-scheme breakdown — the brand's most ownable device. Colour + symbol
   (never colour alone): teal earned, amber partial, coral lost. */
const SCHEME_ROWS = [
  { sym: "✓", code: "M1", text: "Balanced equation", tone: "text-mint", sub: "1 / 1" },
  { sym: "±", code: "A1", text: "State symbols given", tone: "text-gold-ink", sub: "0 / 1" },
  { sym: "✕", code: "B1", text: "Units on the rate", tone: "text-clay-ink", sub: "0 / 1" },
];

const WEAK_TOPICS = [
  { t: "Kinematics", pct: 42 },
  { t: "Moles & masses", pct: 58 },
  { t: "Electrolysis", pct: 71 },
];

export default function FloatingHero({ user, profile, onSignUp, onExplore }: FloatingHeroProps) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const yUp = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const fade = useTransform(scrollYProgress, [0, 0.85], [1, 0]);

  return (
    <section ref={ref} className="relative w-full overflow-hidden bg-paper pt-28 pb-20 md:pt-36 md:pb-28">
      {/* Decorative backdrop */}
      <div className="absolute inset-0 ed-grid-bg opacity-60" />
      <div className="absolute -top-24 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-crimson/10 blur-[130px]" />
      <PropelMark size={620} className="pointer-events-none absolute left-1/2 top-[-6rem] -translate-x-1/2 text-crimson/[0.035] dark:text-crimson/[0.06]" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 flex justify-center overflow-hidden opacity-[0.03] dark:opacity-[0.05]">
        <span className="whitespace-nowrap font-display text-[20vw] font-black leading-none text-ink">O &amp; A LEVELS</span>
      </div>

      {/* -------- Centered hero -------- */}
      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-5 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <AnimatedMark size={80} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.55 }}
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3.5 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[.13em] text-ink-muted backdrop-blur"
        >
          <Sparkles size={13} className="text-crimson" />
          AI marking for Cambridge O &amp; A Level
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.62 }}
          className="mt-5 font-display text-[2.6rem] font-semibold leading-[1.04] tracking-tight text-ink sm:text-6xl lg:text-[4.4rem]"
        >
          See exactly where your{" "}
          <span className="relative inline-block text-crimson">
            marks went
            <svg className="absolute -bottom-1.5 left-0 h-3 w-full text-crimson/40 md:h-4" viewBox="0 0 200 20" preserveAspectRatio="none" fill="none">
              <motion.path
                d="M2 12 Q 50 2, 100 11 T 198 9" stroke="currentColor" strokeWidth="5" strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.9, ease: EASE, delay: 1.2 }}
              />
            </svg>
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.72 }}
          className="mt-6 max-w-xl text-base leading-relaxed text-ink-muted md:text-lg"
        >
          Submit your answers and Propel marks them against the official Cambridge
          scheme — then shows you every mark won or lost, and the topics to fix next.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.82 }}
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
          transition={{ duration: 0.8, delay: 1 }}
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

      {/* -------- Product depiction — the three things Propel does -------- */}
      <motion.div style={{ y: yUp, opacity: fade }} className="relative z-10 mx-auto mt-16 grid max-w-[1080px] grid-cols-1 gap-4 px-5 md:mt-20 md:grid-cols-3">
        {/* 1 · Marked against the scheme (the ownable device) */}
        <motion.div
          initial={{ opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="ed-card p-6 md:col-span-1"
        >
          <div className="flex items-center justify-between">
            <span className="ed-label">Where your 6 marks went</span>
            <span className="font-display text-lg font-semibold text-ink">4/6</span>
          </div>
          <div className="mt-4 space-y-2">
            {SCHEME_ROWS.map((row, i) => (
              <motion.div
                key={row.code}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, ease: EASE, delay: 0.25 + i * 0.14 }}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2"
              >
                <span className={`text-base font-bold ${row.tone}`}>{row.sym}</span>
                <span className="font-mono text-[11px] font-medium text-ink-faint">{row.code}</span>
                <span className="flex-1 truncate text-sm text-ink">{row.text}</span>
                <span className="font-mono text-[11px] text-ink-faint">{row.sub}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* 2 · Exam readiness ring */}
        <motion.div
          initial={{ opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
          className="ed-card flex flex-col items-center justify-center p-6 text-center"
        >
          <ReadinessRing score={64} />
          <div className="mt-3 flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-[.13em] text-ink-faint">
            <ClipboardCheck size={13} className="text-crimson" /> Exam readiness
          </div>
          <p className="mt-1 font-display text-lg font-semibold text-ink">On track</p>
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-mint-soft px-2.5 py-1 text-xs font-bold text-mint-ink">
            <Check size={12} /> +8% this week
          </span>
        </motion.div>

        {/* 3 · Weakest topics, tracked */}
        <motion.div
          initial={{ opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}
          className="ed-card p-6"
        >
          <span className="ed-label">Weakest topics</span>
          <div className="mt-4 space-y-3">
            {WEAK_TOPICS.map((w, i) => (
              <div key={w.t}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-ink">{w.t}</span>
                  <span className="font-mono text-[11px] text-ink-faint">{w.pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-soft">
                  <motion.div
                    className={w.pct < 50 ? "h-full rounded-full bg-clay" : w.pct < 75 ? "h-full rounded-full bg-gold" : "h-full rounded-full bg-mint"}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${w.pct}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.9, ease: EASE, delay: 0.3 + i * 0.12 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>

      {/* Scroll cue */}
      <motion.button
        onClick={onExplore}
        style={{ opacity: fade }}
        className="mx-auto mt-12 hidden flex-col items-center gap-2 text-ink-faint md:flex"
        aria-label="Scroll to explore"
      >
        <span className="font-mono text-[10px] font-medium uppercase tracking-[.2em]">Scroll</span>
        <span className="flex h-9 w-6 items-start justify-center rounded-full border-2 border-line p-1">
          <motion.span
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            className="h-1.5 w-1.5 rounded-full bg-crimson"
          />
        </span>
      </motion.button>
    </section>
  );
}
