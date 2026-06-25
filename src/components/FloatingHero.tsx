"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight,
  GraduationCap,
  TrendingUp,
  Flame,
  FileText,
  Check,
  Sparkles,
} from "lucide-react";
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

/* Mini readiness ring — echoes the real dashboard */
function MiniRing({ score = 64 }: { score?: number }) {
  const radius = 40;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (circ * score) / 100;
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="9" />
        <motion.circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#FBE9CF"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.6, ease: EASE, delay: 0.6 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <b className="font-display text-2xl font-semibold leading-none">{score}%</b>
        <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[.14em] text-white/70">Ready</span>
      </div>
    </div>
  );
}

const trendPoints = "6,70 40,58 74,62 108,44 142,40 176,28 210,22";

export default function FloatingHero({ user, profile, onSignUp, onExplore }: FloatingHeroProps) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const yUp = useTransform(scrollYProgress, [0, 1], [0, -70]);
  const yDown = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section
      ref={ref}
      className="relative w-full overflow-hidden bg-paper pt-32 pb-16 md:pt-44 md:pb-24"
    >
      {/* Decorative backdrop */}
      <div className="absolute inset-0 ed-grid-bg opacity-60" />
      <div className="absolute -top-24 -left-24 h-[30rem] w-[30rem] rounded-full bg-crimson/10 blur-[120px]" />
      <div className="absolute top-10 right-0 h-[26rem] w-[26rem] rounded-full bg-gold/10 blur-[120px]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden opacity-[0.03] dark:opacity-[0.05]"
      >
        <span className="-rotate-6 whitespace-nowrap font-display text-[22vw] font-black leading-none text-ink">
          O LEVELS
        </span>
      </div>

      <div className="relative z-10 mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-12 px-5 md:px-8 lg:grid-cols-[1.05fr_1fr]">
        {/* ---- Left: copy ---- */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[.14em] text-ink-muted backdrop-blur"
          >
            <Sparkles size={14} className="text-crimson" />
            O Level exam prep, reimagined
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.05 }}
            className="mt-5 font-display text-[2.7rem] font-semibold leading-[1.04] tracking-tight text-ink sm:text-6xl lg:text-7xl"
          >
            Propel your success in{" "}
            <span className="relative inline-block text-crimson">
              O Levels
              <svg
                className="absolute -bottom-2 left-0 h-3 w-full text-gold md:h-4"
                viewBox="0 0 200 20"
                preserveAspectRatio="none"
                fill="none"
              >
                <motion.path
                  d="M2 12 Q 50 2, 100 11 T 198 9"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1, ease: EASE, delay: 0.7 }}
                />
              </svg>
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
            className="mt-6 max-w-xl text-base leading-relaxed text-ink-muted md:text-lg"
          >
            One focused workspace for past papers, topical practice, AI answer grading, and
            real exam-readiness tracking — built to turn weak spots into A* grades.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.25 }}
            className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center"
          >
            {user ? (
              <Link href={dashboardHref(user, profile)}>
                <Button size="lg" className="h-14 rounded-full px-8 text-base shadow-crimson">
                  Go to dashboard <ArrowRight size={18} />
                </Button>
              </Link>
            ) : (
              <>
                <Button
                  onClick={onSignUp}
                  size="lg"
                  className="h-14 rounded-full px-8 text-base shadow-crimson"
                >
                  Get started free <ArrowRight size={18} />
                </Button>
                <Button
                  onClick={onExplore}
                  variant="ghost"
                  size="lg"
                  className="h-14 rounded-full border border-line bg-surface px-8 text-base"
                >
                  Explore platform
                </Button>
              </>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-3"
          >
            {[
              ["12k+", "questions solved"],
              ["50+", "past paper years"],
              ["94%", "hit their target"],
            ].map(([n, l]) => (
              <div key={l} className="flex items-baseline gap-2">
                <b className="font-display text-xl font-semibold text-ink">{n}</b>
                <span className="text-sm text-ink-faint">{l}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* ---- Right: animated dashboard showcase ---- */}
        <motion.div
          style={{ y: yUp, opacity: fade }}
          className="relative mx-auto w-full max-w-[460px]"
        >
          {/* Main readiness card */}
          <motion.div
            initial={{ opacity: 0, y: 40, rotate: -2 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}
            className="relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-[#A8123C] to-[#760B28] p-6 text-white shadow-[0_30px_60px_-25px_rgba(168,18,60,0.6)]"
          >
            <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/[.07]" />
            <div className="relative flex items-center gap-5">
              <MiniRing score={64} />
              <div>
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.12em] text-white/70">
                  <GraduationCap size={14} /> Exam readiness
                </div>
                <h3 className="mt-1.5 font-display text-2xl font-semibold">On track</h3>
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold">
                  <TrendingUp size={13} /> +8% this week
                </span>
              </div>
            </div>
            <div className="relative mt-5 grid grid-cols-3 gap-3 border-t border-white/15 pt-4">
              {[
                ["5", "strong"],
                ["3", "need work"],
                ["2", "at risk"],
              ].map(([n, l]) => (
                <div key={l}>
                  <b className="font-display text-xl font-semibold">{n}</b>
                  <p className="text-[11px] text-white/70">{l}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Floating streak card (top-left) */}
          <motion.div
            style={{ y: yDown }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.55 }}
            className="absolute -left-6 -top-8 hidden rounded-2xl border border-line bg-surface p-3.5 shadow-card sm:block"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold text-white">
                <Flame size={18} />
              </span>
              <div>
                <b className="font-display text-xl font-semibold leading-none text-gold-deep">12</b>
                <p className="text-[10px] font-bold uppercase tracking-[.1em] text-gold-deep/70">
                  day streak
                </p>
              </div>
            </div>
          </motion.div>

          {/* Floating trend card (bottom-right) */}
          <motion.div
            style={{ y: yDown }}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.7 }}
            className="absolute -bottom-10 -right-4 w-52 rounded-2xl border border-line bg-surface p-4 shadow-card md:-right-10"
          >
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.1em] text-ink-faint">
              <Sparkles size={12} className="text-crimson" /> Accuracy trend
            </div>
            <svg viewBox="0 0 216 80" className="mt-2 h-16 w-full" preserveAspectRatio="none">
              <motion.path
                d={`M${trendPoints}`}
                fill="none"
                stroke="#A8123C"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.4, ease: EASE, delay: 0.9 }}
              />
              <path d={`M${trendPoints} L210,80 L6,80 Z`} fill="rgba(168,18,60,.08)" />
            </svg>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-ink-faint">8 weeks</span>
              <span className="inline-flex items-center gap-1 font-bold text-mint">
                <Check size={12} /> +14%
              </span>
            </div>
          </motion.div>

          {/* Floating "papers solved" chip (right edge) */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.85 }}
            className="absolute right-2 top-1/3 hidden items-center gap-2 rounded-full border border-line bg-surface py-1.5 pl-2 pr-3.5 shadow-card lg:flex"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-crimson-soft text-crimson-ink">
              <FileText size={14} />
            </span>
            <span className="text-xs font-bold text-ink">47 papers</span>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll cue */}
      <motion.button
        onClick={onExplore}
        style={{ opacity: fade }}
        className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-ink-faint md:flex"
        aria-label="Scroll to explore"
      >
        <span className="text-[11px] font-bold uppercase tracking-[.2em]">Scroll</span>
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
