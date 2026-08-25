"use client";

import { useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MousePointer2 } from "lucide-react";
import { EASE } from "@/components/ui/Motion";

interface PlayfulHeroProps {
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

const display = { fontFamily: "var(--font-fredoka), var(--font-fraunces), system-ui, sans-serif" } as const;

/* Real 3D sticker avatars cropped from the brief, placed by their centre and
   sized in cqw so the whole composition scales as one unit with the stage.  */
const AVATARS = [
  { src: "/hero/star.png",   cx: 9.8,  cy: 23,   w: 13,   rot: -3, delay: 0.10 },
  { src: "/hero/selfie.png", cx: 89,   cy: 24,   w: 15.5, rot: 3,  delay: 0.30 },
  { src: "/hero/laptop.png", cx: 10,   cy: 68.5, w: 11,   rot: -2, delay: 0.50 },
  { src: "/hero/flower.png", cx: 90,   cy: 80.5, w: 14.5, rot: 2,  delay: 0.70 },
  { src: "/hero/book.png",   cx: 65,   cy: 18,   w: 10,   rot: 0,  delay: 0.90 },
  { src: "/hero/globe.png",  cx: 38.5, cy: 82,   w: 9,    rot: 0,  delay: 1.00 },
];

const DOTS = [
  { cx: 56, cy: 5,  s: 1.5, c: "var(--crimson)" },
  { cx: 37, cy: 12, s: 1.1, c: "var(--gold)" },
  { cx: 6.5, cy: 42, s: 1.3, c: "var(--crimson)" },
  { cx: 33, cy: 77, s: 1.4, c: "var(--gold)" },
  { cx: 82, cy: 93, s: 1.1, c: "var(--mint)" },
  { cx: 96, cy: 66, s: 1.0, c: "var(--crimson)" },
];

export default function PlayfulHero({ user, profile, onSignUp }: PlayfulHeroProps) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const go = () => onSignUp();
  const primaryHref = user ? dashboardHref(user, profile) : undefined;

  // absolute element positioned by its centre; float bob lives on an inner layer
  const bob = (delay: number) => (reduce ? {} : { animate: { y: [0, -9, 0] }, transition: { duration: 4.6 + delay, repeat: Infinity, ease: "easeInOut" as const, delay } });

  return (
    <section ref={ref} className="relative w-full overflow-hidden bg-paper pt-28 pb-16 md:pt-32 md:pb-20">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/3 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-crimson/5 blur-[130px]" />

      {/* ======================= desktop / tablet: exact stage ======================= */}
      <div className="relative mx-auto hidden w-full max-w-[1000px] px-4 md:block">
        <div className="relative w-full" style={{ aspectRatio: "698 / 377", containerType: "inline-size" } as React.CSSProperties}>
          {/* avatars */}
          {AVATARS.map((a) => (
            <motion.div key={a.src} aria-hidden
              className="pointer-events-none absolute"
              style={{ left: `${a.cx}%`, top: `${a.cy}%`, width: `${a.w}cqw`, transform: "translate(-50%,-50%)", zIndex: 1 }}
              initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: EASE, delay: a.delay }}>
              <motion.div {...bob(a.delay)} style={{ rotate: a.rot }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.src} alt="" className="block h-auto w-full select-none" style={{ filter: "drop-shadow(0 14px 22px rgba(0,0,0,0.16))" }} />
              </motion.div>
            </motion.div>
          ))}

          {/* confetti dots */}
          {DOTS.map((d, i) => (
            <span key={i} aria-hidden className="absolute rounded-full"
              style={{ left: `${d.cx}%`, top: `${d.cy}%`, width: `${d.s}cqw`, height: `${d.s}cqw`, background: `rgb(${d.c})`, transform: "translate(-50%,-50%)" }} />
          ))}

          {/* red "+" app icon */}
          <motion.div aria-hidden className="absolute" style={{ left: "29.7%", top: "23.5%", width: "8.6cqw", transform: "translate(-50%,-50%)", zIndex: 2 }}
            initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero/plus.png" alt="" className="block h-auto w-full select-none" style={{ transform: "rotate(-6deg)", filter: "drop-shadow(0 10px 16px rgba(0,0,0,0.18))" }} />
          </motion.div>

          {/* ---- headline words (Fredoka), placed like the brief ---- */}
          <Word cx={50}   cy={27}   size={9.9} delay={0.15}>Take&nbsp;it</Word>
          <Word cx={51.5} cy={47}   size={9.9} delay={0.28}>to</Word>
          {/* "the" in a dark chip + "next" */}
          <div className="absolute" style={{ left: "40.5%", top: "56.5%", transform: "translate(-50%,-50%)", zIndex: 2, ...display }}>
            <motion.span initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE, delay: 0.4 }}
              className="inline-flex items-center rounded-[0.35em] bg-ink px-[0.32em] py-[0.02em] font-semibold leading-none text-paper"
              style={{ fontSize: "8.8cqw", transform: "rotate(-2deg)", boxShadow: "0 0.14em 0.3em rgba(0,0,0,0.35)" }}>the</motion.span>
          </div>
          <Word cx={58.5} cy={58.5} size={9.9} delay={0.46}>next</Word>

          {/* "levels" with a hand-drawn crimson/gold ring */}
          <div className="absolute" style={{ left: "55%", top: "80%", transform: "translate(-50%,-50%)", zIndex: 2 }}>
            <motion.div className="relative inline-block" style={{ ...display }}
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE, delay: 0.56 }}>
              <span className="font-semibold leading-none text-ink" style={{ fontSize: "9.9cqw" }}>levels</span>
              <svg aria-hidden viewBox="0 0 240 120" className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: "128%", height: "156%" }} fill="none">
                <path d="M120 10 C56 10 14 33 14 60 C14 89 66 110 124 110 C184 110 228 86 226 57 C224 31 178 12 130 11"
                  stroke="rgb(var(--gold))" strokeWidth="4.5" strokeLinecap="round" />
              </svg>
            </motion.div>
          </div>

          {/* "Let's Chat" pill + cursor — the only call to action, like the brief */}
          {user ? (
            <a href={primaryHref} className="group absolute z-[3] -translate-x-1/2 -translate-y-1/2" style={{ left: "61%", top: "43.8%" }}>
              <ChatPill />
            </a>
          ) : (
            <button type="button" onClick={go} className="group absolute z-[3] -translate-x-1/2 -translate-y-1/2" style={{ left: "61%", top: "43.8%" }}>
              <ChatPill />
            </button>
          )}
        </div>
      </div>

      {/* ============================= mobile: stacked ============================= */}
      <div className="mx-auto flex max-w-md flex-col items-center px-6 text-center md:hidden">
        <div className="mb-6 flex items-center justify-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero/star.png" alt="" className="h-16 w-auto" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero/selfie.png" alt="" className="h-20 w-auto" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero/flower.png" alt="" className="h-16 w-auto" />
        </div>
        <h1 style={display} className="text-[3.4rem] font-semibold leading-[1.04] tracking-tight text-ink">
          <span className="flex items-center justify-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero/plus.png" alt="" className="h-11 w-auto -rotate-6" /> Take it
          </span>
          <span className="block">to</span>
          <span className="flex items-center justify-center gap-2">
            <span className="inline-flex items-center rounded-xl bg-ink px-3 py-0.5 text-paper" style={{ transform: "rotate(-2deg)" }}>the</span> next
          </span>
          <span className="relative inline-block">
            levels
            <svg aria-hidden viewBox="0 0 240 120" className="pointer-events-none absolute left-1/2 top-1/2 h-[150%] w-[128%] -translate-x-1/2 -translate-y-1/2" fill="none">
              <path d="M120 10 C56 10 14 33 14 60 C14 89 66 110 124 110 C184 110 228 86 226 57 C224 31 178 12 130 11" stroke="rgb(var(--gold))" strokeWidth="5" strokeLinecap="round" />
            </svg>
          </span>
        </h1>
        <button type="button" onClick={go} className="mt-8 inline-flex items-center rounded-full border border-line bg-surface px-6 py-3 text-base font-semibold text-ink shadow-sm">
          Let&rsquo;s Chat <MousePointer2 size={16} className="ml-2 text-crimson" fill="currentColor" />
        </button>
        <div className="mt-6 flex items-center justify-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero/laptop.png" alt="" className="h-16 w-auto" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero/globe.png" alt="" className="h-12 w-auto" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero/book.png" alt="" className="h-12 w-auto" />
        </div>
      </div>
    </section>
  );
}

/* A headline word positioned by centre, sized in container units. */
function Word({ cx, cy, size, delay, children }: { cx: number; cy: number; size: number; delay: number; children: React.ReactNode }) {
  return (
    <motion.div className="absolute whitespace-nowrap font-semibold leading-none text-ink"
      style={{ left: `${cx}%`, top: `${cy}%`, fontSize: `${size}cqw`, transform: "translate(-50%,-50%)", zIndex: 2, ...display }}
      initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE, delay }}>
      {children}
    </motion.div>
  );
}

/* The outlined "Let's Chat" pill with its little cursor, used in the stage. */
function ChatPill() {
  return (
    <span className="relative inline-flex items-center rounded-full border border-line bg-surface px-[1em] py-[0.5em] font-semibold text-ink shadow-sm transition-transform group-hover:-translate-y-0.5"
      style={{ fontSize: "3cqw", fontFamily: "var(--font-hanken), sans-serif" }}>
      Let&rsquo;s Chat
      <MousePointer2 aria-hidden className="absolute -bottom-[1em] -right-[0.6em] rotate-6 text-crimson" style={{ width: "1.5em", height: "1.5em" }} fill="currentColor" />
    </span>
  );
}
