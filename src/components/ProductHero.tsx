"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Check, X, Sparkles, TrendingUp, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { EASE } from "@/components/ui/Motion";

interface ProductHeroProps {
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

const STATS = [
  { value: "80k+", label: "past-paper questions" },
  { value: "30+", label: "O & A Level subjects" },
  { value: "1.8s", label: "to a marked answer" },
];

export default function ProductHero({ user, profile, onSignUp, onExplore }: ProductHeroProps) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const cardY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 80]);

  const rise = (delay: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, ease: EASE, delay },
  });

  const primaryHref = user ? dashboardHref(user, profile) : undefined;

  return (
    <section ref={ref} className="relative w-full overflow-hidden bg-paper pt-32 pb-20 md:pt-40 md:pb-28">
      {/* ---- atmosphere: brand-toned mesh + faint grid, no flat fill ---- */}
      <div aria-hidden className="pointer-events-none absolute inset-0 ed-grid-bg opacity-[0.35]" />
      <div aria-hidden className="pointer-events-none absolute -left-40 top-[-10%] h-[38rem] w-[38rem] rounded-full blur-[150px]" style={{ background: "rgb(var(--crimson) / 0.10)" }} />
      <div aria-hidden className="pointer-events-none absolute right-[-15%] top-[20%] h-[34rem] w-[34rem] rounded-full blur-[150px]" style={{ background: "rgb(var(--gold) / 0.10)" }} />

      <div className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-5 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        {/* ============================ LEFT: message ============================ */}
        <div className="max-w-xl">
          <motion.span {...rise(0.05)} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3.5 py-1.5 text-[0.82rem] font-semibold text-ink-muted backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: "rgb(var(--crimson))" }} />
              <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "rgb(var(--crimson))" }} />
            </span>
            AI marking · Cambridge O &amp; A Level
          </motion.span>

          <motion.h1 {...rise(0.14)} className="mt-6 font-display text-[2.9rem] font-semibold leading-[1.04] tracking-tight text-ink sm:text-6xl lg:text-[4.1rem]">
            Past papers,
            <br />
            marked like the{" "}
            <span className="relative whitespace-nowrap italic text-crimson">
              examiner
              <svg aria-hidden viewBox="0 0 300 24" preserveAspectRatio="none" className="absolute -bottom-1.5 left-0 h-[0.5em] w-full" fill="none">
                <path d="M4 16 C 80 6, 220 6, 296 14" stroke="rgb(var(--crimson) / 0.45)" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </span>
            .
          </motion.h1>

          <motion.p {...rise(0.24)} className="mt-6 max-w-lg text-base leading-relaxed text-ink-muted md:text-lg">
            Propel grades your written answers against the official Cambridge mark
            scheme — line by line, with the feedback and weakness tracking that
            actually moves your grade.
          </motion.p>

          <motion.div {...rise(0.34)} className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            {user ? (
              <Link href={primaryHref!}>
                <Button size="lg" className="h-14 rounded-full px-8 text-base shadow-crimson">
                  Go to dashboard <ArrowRight size={18} />
                </Button>
              </Link>
            ) : (
              <>
                <Button onClick={onSignUp} size="lg" className="h-14 rounded-full px-8 text-base shadow-crimson">
                  Start practising free <ArrowRight size={18} />
                </Button>
                <Button onClick={onExplore} variant="ghost" size="lg" className="h-14 rounded-full border border-line bg-surface px-7 text-base">
                  See how it works
                </Button>
              </>
            )}
          </motion.div>

          {/* trust stats */}
          <motion.div {...rise(0.46)} className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-4">
            {STATS.map((s, i) => (
              <div key={s.label} className="flex items-center gap-7">
                {i > 0 && <span aria-hidden className="hidden h-8 w-px bg-line sm:block" />}
                <div>
                  <div className="font-display text-2xl font-semibold text-ink">{s.value}</div>
                  <div className="text-[0.8rem] text-ink-faint">{s.label}</div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* ======================== RIGHT: product preview ======================== */}
        <motion.div style={{ y: cardY }} className="relative mx-auto w-full max-w-md lg:mx-0 lg:ml-auto">
          {/* soft base shadow */}
          <div aria-hidden className="absolute inset-x-6 bottom-2 h-16 rounded-[2rem] blur-2xl" style={{ background: "rgb(var(--ink) / 0.14)" }} />

          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 26, rotate: -1.5 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.3 }}
            className="relative overflow-hidden rounded-[1.6rem] border border-line bg-surface shadow-[0_30px_60px_-30px_rgba(0,0,0,0.4)]"
          >
            {/* panel header */}
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: "rgb(var(--crimson) / 0.12)" }}>
                  <Sparkles size={16} className="text-crimson" />
                </span>
                <div className="leading-tight">
                  <div className="text-[0.9rem] font-semibold text-ink">AI marking</div>
                  <div className="text-[0.72rem] text-ink-faint">Physics · Paper 4 · Q3</div>
                </div>
              </div>
              {/* score ring: 5 / 6 */}
              <ScoreRing scored={5} total={6} />
            </div>

            {/* question + answer */}
            <div className="px-5 pt-4">
              <p className="text-[0.86rem] leading-relaxed text-ink">
                <span className="font-semibold">Q.</span> Explain why a skydiver reaches a constant
                velocity during the fall. <span className="text-ink-faint">[3]</span>
              </p>
              <p className="mt-3 rounded-xl border border-line bg-surface-soft px-3.5 py-3 text-[0.82rem] leading-relaxed text-ink-muted">
                “Weight pulls the skydiver down. As speed increases, air resistance
                grows until it matches the weight, so they stop speeding up.”
              </p>
            </div>

            {/* mark-scheme breakdown */}
            <div className="px-5 py-4">
              <div className="mb-2 text-[0.72rem] font-semibold uppercase tracking-wider text-ink-faint">Against the scheme</div>
              <ul className="space-y-2">
                <MarkRow ok>Weight acts downward — identified</MarkRow>
                <MarkRow ok>Air resistance increases with speed</MarkRow>
                <MarkRow>Resultant force = 0 not stated</MarkRow>
              </ul>
            </div>

            {/* AI feedback */}
            <div className="mx-5 mb-5 rounded-xl px-3.5 py-3" style={{ background: "rgb(var(--gold) / 0.12)" }}>
              <div className="flex items-start gap-2">
                <ShieldCheck size={15} className="mt-0.5 shrink-0" style={{ color: "rgb(var(--gold))" }} />
                <p className="text-[0.8rem] leading-relaxed text-ink">
                  <span className="font-semibold">Almost full marks.</span> Add that acceleration
                  stops when the forces balance to earn the final mark.
                </p>
              </div>
            </div>
          </motion.div>

          {/* floating accent chips */}
          <motion.div aria-hidden {...rise(0.7)}
            className="absolute -left-5 top-16 hidden items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 shadow-lg sm:flex">
            <TrendingUp size={15} style={{ color: "rgb(var(--mint))" }} />
            <div className="leading-tight">
              <div className="text-[0.74rem] font-semibold text-ink">Forces &amp; motion</div>
              <div className="text-[0.68rem]" style={{ color: "rgb(var(--mint))" }}>improving · +12%</div>
            </div>
          </motion.div>

          <motion.div aria-hidden {...rise(0.82)}
            className="absolute -bottom-4 right-2 hidden items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 shadow-lg sm:flex">
            <span className="grid h-5 w-5 place-items-center rounded-full" style={{ background: "rgb(var(--mint) / 0.15)" }}>
              <Check size={12} style={{ color: "rgb(var(--mint))" }} strokeWidth={3} />
            </span>
            <span className="text-[0.74rem] font-semibold text-ink">Official Cambridge scheme</span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* Circular score ring rendered with a conic-gradient (mint fill, line track). */
function ScoreRing({ scored, total }: { scored: number; total: number }) {
  const pct = Math.round((scored / total) * 100);
  return (
    <div className="grid h-14 w-14 place-items-center rounded-full"
      style={{ background: `conic-gradient(rgb(var(--mint)) ${pct}%, rgb(var(--line)) ${pct}% 100%)` }}>
      <div className="grid h-11 w-11 place-items-center rounded-full bg-surface">
        <span className="font-display text-[0.95rem] font-semibold leading-none text-ink">{scored}/{total}</span>
      </div>
    </div>
  );
}

/* One mark-scheme line: awarded (mint check) or missed (crimson cross). */
function MarkRow({ ok, children }: { ok?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2.5 text-[0.82rem] text-ink">
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full"
        style={{ background: ok ? "rgb(var(--mint) / 0.15)" : "rgb(var(--crimson) / 0.12)" }}>
        {ok ? <Check size={12} strokeWidth={3} style={{ color: "rgb(var(--mint))" }} /> : <X size={12} strokeWidth={3} className="text-crimson" />}
      </span>
      <span className={ok ? "" : "text-ink-muted"}>{children}</span>
      <span className="ml-auto text-[0.72rem] font-semibold" style={{ color: ok ? "rgb(var(--mint))" : "rgb(var(--ink) / 0.4)" }}>{ok ? "+1" : "+0"}</span>
    </li>
  );
}
