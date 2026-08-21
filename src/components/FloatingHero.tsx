"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { EASE } from "@/components/ui/Motion";
import { BookStack, OpenBook, Pencil, GradCap, ScoreDial, MarkedScript, StickyMark } from "@/components/ui/StudyObjects";

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

      {/* ---- Floating study objects (parallax on scroll) ----
           All kept below top-[24%] so nothing tucks behind the fixed navbar,
           and clear of the centred headline (sides, or lower than 55%).      */}
      <motion.div style={{ y: floatY }} className="absolute inset-0">
        {/* left */}
        <Floater className="left-[5%] top-[27%]" delay={0.1}><BookStack size={80} style={{ transform: "rotate(-4deg)" }} /></Floater>
        <Floater className="left-[12%] top-[55%]" delay={0.5}><Pencil size={64} style={{ transform: "rotate(8deg)" }} /></Floater>
        <Floater className="left-[6%] top-[80%]" delay={0.9}><StickyMark sym="✓" code="M1" base="#DBF1E9" ink="#0E6E52" size={50} style={{ transform: "rotate(-5deg)" }} /></Floater>
        <Floater className="left-[22%] top-[83%]" delay={1.2}><OpenBook size={76} style={{ transform: "rotate(3deg)" }} /></Floater>
        {/* right */}
        <Floater className="right-[6%] top-[25%]" delay={0.3}><GradCap size={72} style={{ transform: "rotate(5deg)" }} /></Floater>
        <Floater className="right-[13%] top-[26%]" delay={1.4}><StickyMark sym="✕" code="B1" base="#F7DED6" ink="#B23A1E" size={48} style={{ transform: "rotate(6deg)" }} /></Floater>
        <Floater className="right-[16%] top-[53%]" delay={0.7}><StickyMark sym="±" code="A1" base="#FBEBC4" ink="#9A6A05" size={50} style={{ transform: "rotate(-4deg)" }} /></Floater>
        <Floater className="right-[6%] top-[74%]" delay={1.0}><ScoreDial value={4} total={6} size={62} style={{ transform: "rotate(6deg)" }} /></Floater>
        <Floater className="right-[21%] top-[84%]" delay={1.3}><MarkedScript size={62} style={{ transform: "rotate(-6deg)" }} /></Floater>
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
