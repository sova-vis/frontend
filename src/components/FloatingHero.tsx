"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, PenTool, Atom, Sigma } from "lucide-react";
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
/* A small object floating around the headline. Gentle bob + one-time pop-in;
   reduced-motion just fades it in. Hidden on small screens to avoid clutter.  */
function Floater({ className, delay = 0, children }: { className: string; delay?: number; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      className={`pointer-events-none absolute z-0 hidden lg:block ${className}`}
      initial={{ opacity: 0, scale: 0.7, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: reduce ? 0 : [0, -12, 0] }}
      transition={{
        opacity: { duration: 0.6, delay, ease: EASE },
        scale: { duration: 0.6, delay, ease: EASE },
        y: reduce ? {} : { duration: 4.5 + delay, repeat: Infinity, ease: "easeInOut", delay: 0.6 + delay },
      }}
    >
      {children}
    </motion.div>
  );
}

/* Small tile with an icon (rounded, tilted, soft shadow). */
function IconTile({ icon: Icon, bg, fg, tilt }: { icon: typeof Check; bg: string; fg: string; tilt: string }) {
  return (
    <span className={`grid h-14 w-14 place-items-center rounded-2xl shadow-card ${tilt}`} style={{ background: bg, color: fg }}>
      <Icon size={22} strokeWidth={2.4} />
    </span>
  );
}

/* Mark-scheme chip — symbol + code (colour always paired with a symbol). */
function SchemeChip({ sym, code, cls, tilt }: { sym: string; code: string; cls: string; tilt: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-xs font-semibold shadow-card ${cls} ${tilt}`}>
      <b className="text-sm">{sym}</b> {code}
    </span>
  );
}

/* Mini marked script with an A* grade. */
function ScriptTile() {
  return (
    <span className="block w-16 -rotate-6 rounded-xl border border-line bg-surface p-2.5 shadow-card">
      <span className="block space-y-1">
        <span className="block h-1 w-9 rounded bg-ink/20" />
        <span className="block h-1 w-11 rounded bg-ink/12" />
        <span className="block h-1 w-7 rounded bg-ink/12" />
      </span>
      <span className="mt-2 block font-display text-base font-bold text-crimson">A*</span>
    </span>
  );
}

/* Mini score dial. */
function ScoreTile() {
  return (
    <span className="grid h-16 w-16 place-items-center rounded-2xl bg-ink shadow-card rotate-6">
      <span className="relative grid h-12 w-12 place-items-center">
        <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90">
          <circle cx="24" cy="24" r="19" fill="none" stroke="rgba(250,246,240,0.2)" strokeWidth="5" />
          <circle cx="24" cy="24" r="19" fill="none" stroke="#5FD3B3" strokeWidth="5" strokeLinecap="round" strokeDasharray={2 * Math.PI * 19} strokeDashoffset={(2 * Math.PI * 19) * 0.25} />
        </svg>
        <b className="font-display text-xs font-semibold text-cream">4/6</b>
      </span>
    </span>
  );
}

export default function FloatingHero({ user, profile, onSignUp, onExplore }: FloatingHeroProps) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const floatY = useTransform(scrollYProgress, [0, 1], [0, 60]);

  const line = (delay: number) => ({
    initial: reduce ? {} : { y: "115%" },
    animate: { y: 0 },
    transition: { duration: 0.7, ease: EASE, delay },
  });

  return (
    <section ref={ref} className="relative w-full overflow-hidden bg-paper pt-40 pb-24 md:pt-48 md:pb-28">
      {/* ---- soft aurora backdrop ---- */}
      <div className="absolute inset-0 ed-grid-bg opacity-40" />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[6%] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-crimson/10 blur-[130px]"
        animate={reduce ? {} : { scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* ---- Floating study objects (parallax on scroll) ---- */}
      <motion.div style={{ y: floatY }} className="absolute inset-0">
        <Floater className="left-[7%] top-[16%]" delay={0.1}><ScriptTile /></Floater>
        <Floater className="left-[15%] top-[46%]" delay={0.5}><IconTile icon={Check} bg="#A8123C" fg="#FAF6F0" tilt="rotate-6" /></Floater>
        <Floater className="left-[8%] top-[72%]" delay={0.9}><SchemeChip sym="✓" code="M1" cls="bg-mint-soft text-mint-ink" tilt="-rotate-3" /></Floater>
        <Floater className="left-[27%] top-[80%]" delay={1.2}><IconTile icon={Sigma} bg="#F6E1E7" fg="#A8123C" tilt="-rotate-6" /></Floater>
        <Floater className="right-[9%] top-[14%]" delay={0.3}><IconTile icon={Atom} bg="#1C1714" fg="#FAF6F0" tilt="-rotate-6" /></Floater>
        <Floater className="right-[16%] top-[44%]" delay={0.7}><SchemeChip sym="±" code="A1" cls="bg-gold-soft text-gold-ink" tilt="rotate-3" /></Floater>
        <Floater className="right-[7%] top-[70%]" delay={1.0}><ScoreTile /></Floater>
        <Floater className="right-[26%] top-[82%]" delay={1.3}><IconTile icon={PenTool} bg="#DBEFE8" fg="#16876B" tilt="rotate-6" /></Floater>
        <Floater className="right-[30%] top-[9%]" delay={1.4}><SchemeChip sym="✕" code="B1" cls="bg-clay-soft text-clay-ink" tilt="rotate-6" /></Floater>
      </motion.div>

      {/* ---- Centered headline + CTA ---- */}
      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-5 text-center">
        <h1 className="font-display text-[3rem] font-bold leading-[0.98] tracking-tight text-ink sm:text-7xl lg:text-[5.4rem]">
          <span className="block overflow-hidden pb-1">
            <motion.span className="block" {...line(0.35)}>Propel your</motion.span>
          </span>
          <span className="block overflow-hidden pb-1">
            <motion.span className="block" {...line(0.47)}>O &amp; A Level</motion.span>
          </span>
          <span className="block overflow-hidden pb-1">
            <motion.span className="block text-crimson" {...line(0.59)}>game.</motion.span>
          </span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.8 }}
          className="mt-6 max-w-xl text-base leading-relaxed text-ink-muted md:text-lg"
        >
          AI marking against the official Cambridge scheme, mark-scheme feedback and
          weakness tracking — everything to take your prep to the next level.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.92 }}
          className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
        >
          {user ? (
            <Link href={dashboardHref(user, profile)}>
              <Button size="lg" className="h-14 rounded-full px-9 text-base shadow-crimson">
                Go to dashboard <ArrowRight size={18} />
              </Button>
            </Link>
          ) : (
            <>
              <Button onClick={onSignUp} size="lg" className="h-14 rounded-full px-9 text-base shadow-crimson">
                Get started free <ArrowRight size={18} />
              </Button>
              <Button onClick={onExplore} variant="ghost" size="lg" className="h-14 rounded-full border border-line bg-surface px-8 text-base">
                See how it works
              </Button>
            </>
          )}
        </motion.div>
      </div>
    </section>
  );
}
