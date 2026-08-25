"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { ArrowRight, Plus, MousePointer2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
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

/* -------------------------------------------------------------------------- */
/* A colourful "sticker" character in a corner — organic blob frame in one of
   the brand accents with an emoji inside. Gentle bob; reduced-motion fades in.
   Hidden on small screens so the headline stays clean on mobile.              */
function Sticker({
  className, radius, soft, ring, emoji, rotate = 0, delay = 0, size = 104,
}: {
  className: string; radius: string; soft: string; ring: string; emoji: string; rotate?: number; delay?: number; size?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      className={`pointer-events-none absolute z-0 hidden md:flex items-center justify-center ${className}`}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1, y: reduce ? 0 : [0, -12, 0] }}
      transition={{
        opacity: { duration: 0.6, delay, ease: EASE },
        scale: { duration: 0.6, delay, ease: EASE },
        y: reduce ? {} : { duration: 4.5 + delay, repeat: Infinity, ease: "easeInOut", delay: 0.6 + delay },
      }}
    >
      <div
        className="flex items-center justify-center shadow-[0_18px_40px_-16px_rgba(0,0,0,0.35)]"
        style={{ width: size, height: size, borderRadius: radius, background: soft, border: `2px solid ${ring}`, transform: `rotate(${rotate}deg)` }}
      >
        <span style={{ fontSize: size * 0.5, lineHeight: 1, transform: `rotate(${-rotate}deg)` }}>{emoji}</span>
      </div>
    </motion.div>
  );
}

/* A small floating emoji prop (globe, book, bulb) — lighter than a Sticker. */
function Prop({ className, emoji, size = 44, rotate = 0, delay = 0 }: { className: string; emoji: string; size?: number; rotate?: number; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      aria-hidden
      className={`pointer-events-none absolute z-0 hidden md:block ${className}`}
      style={{ fontSize: size, lineHeight: 1 }}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1, y: reduce ? 0 : [0, -9, 0], rotate }}
      transition={{
        opacity: { duration: 0.6, delay, ease: EASE },
        scale: { duration: 0.6, delay, ease: EASE },
        y: reduce ? {} : { duration: 4 + delay, repeat: Infinity, ease: "easeInOut", delay: 0.5 + delay },
      }}
    >
      {emoji}
    </motion.span>
  );
}

/* A scattered confetti dot. */
function Dot({ className, color, size = 10 }: { className: string; color: string; size?: number }) {
  return <span aria-hidden className={`pointer-events-none absolute rounded-full ${className}`} style={{ width: size, height: size, background: color }} />;
}

export default function PlayfulHero({ user, profile, onSignUp, onExplore }: PlayfulHeroProps) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const floatY = useTransform(scrollYProgress, [0, 1], [0, 70]);

  const pop = (delay: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.9 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: 0.6, ease: EASE, delay },
  });

  const primaryHref = user ? dashboardHref(user, profile) : undefined;

  return (
    <section ref={ref} className="relative w-full overflow-hidden bg-paper pt-40 pb-24 md:pt-52 md:pb-32">
      {/* soft radial wash so the paper doesn't read flat */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[10%] h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-crimson/5 blur-[130px]" />

      {/* ---- corner character stickers + floating props (parallax) ---- */}
      <motion.div style={{ y: floatY }} className="absolute inset-0">
        <Sticker className="left-[4%] top-[26%]"  radius="46% 54% 60% 40% / 52% 44% 56% 48%" soft="rgb(var(--mint-soft))"    ring="rgb(var(--mint) / 0.5)"    emoji="🧑‍⚕️" rotate={-6} delay={0.1} />
        <Sticker className="right-[4%] top-[24%]"  radius="58% 42% 45% 55% / 46% 56% 44% 54%" soft="rgb(var(--crimson-soft))" ring="rgb(var(--crimson) / 0.45)" emoji="🤳"   rotate={5}  delay={0.35} size={112} />
        <Sticker className="left-[5%] bottom-[12%]" radius="52% 48% 44% 56% / 58% 46% 54% 42%" soft="rgb(var(--gold-soft))"   ring="rgb(var(--gold) / 0.5)"    emoji="👩‍💻" rotate={4}  delay={0.55} />
        <Sticker className="right-[5%] bottom-[11%]" radius="60% 40% 55% 45% / 44% 58% 42% 56%" soft="rgb(var(--crimson-soft))" ring="rgb(var(--crimson) / 0.45)" emoji="🧑‍🎓" rotate={-5} delay={0.75} size={110} />

        <Prop className="left-[19%] top-[30%]"  emoji="📖" size={40} rotate={-10} delay={0.5} />
        <Prop className="right-[20%] top-[34%]" emoji="💡" size={34} rotate={8}  delay={0.9} />
        <Prop className="left-[23%] bottom-[18%]" emoji="🌍" size={44} rotate={-6} delay={0.7} />
        <Prop className="right-[23%] bottom-[20%]" emoji="✏️" size={36} rotate={12} delay={1.0} />

        {/* confetti dots in the brand accents */}
        <Dot className="left-[30%] top-[24%]" color="rgb(var(--crimson))" size={12} />
        <Dot className="right-[34%] top-[26%]" color="rgb(var(--gold))" size={9} />
        <Dot className="left-[13%] top-[52%]" color="rgb(var(--mint))" size={10} />
        <Dot className="right-[12%] top-[48%]" color="rgb(var(--crimson))" size={8} />
        <Dot className="left-[34%] bottom-[16%]" color="rgb(var(--gold))" size={11} />
        <Dot className="right-[30%] bottom-[14%]" color="rgb(var(--mint))" size={9} />
        <Dot className="left-[45%] top-[20%]" color="rgb(var(--ink) / 0.35)" size={7} />
      </motion.div>

      {/* ---- centred playful headline ---- */}
      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-5 text-center">
        <h1 style={display} className="font-semibold tracking-tight text-ink text-[3.1rem] leading-[1.02] sm:text-7xl lg:text-[5.4rem]">
          {/* line 1 — with the crimson “+” app icon */}
          <motion.span className="relative inline-flex items-center justify-center gap-3" {...pop(0.15)}>
            <span aria-hidden className="hidden sm:flex items-center justify-center shadow-crimson"
              style={{ width: 52, height: 52, borderRadius: 15, background: "rgb(var(--crimson))", transform: "rotate(-8deg)" }}>
              <Plus size={30} color="#fff" strokeWidth={3} />
            </span>
            <span>Take it</span>
          </motion.span>

          {/* line 2 — “to”, with the Let's Chat pill + cursor floating in the open space to its right */}
          <motion.span className="relative mt-1 inline-flex items-center justify-center" {...pop(0.28)}>
            <span>to</span>
            <button type="button" onClick={onSignUp}
              className="pointer-events-auto absolute left-full top-1/2 ml-6 hidden -translate-y-1/2 lg:inline-flex items-center rounded-full border border-line bg-surface px-3.5 py-1.5 text-[0.9rem] font-semibold text-ink shadow-sm transition-transform hover:-translate-y-[55%]"
              style={{ fontFamily: "var(--font-hanken), sans-serif" }}>
              Let&rsquo;s Chat
              <MousePointer2 aria-hidden size={16} className="absolute -bottom-4 -right-3 rotate-6 text-crimson" fill="currentColor" />
            </button>
          </motion.span>

          {/* line 3 — the “the” chip inline before “next” */}
          <motion.span className="mt-1 flex items-center justify-center gap-3" {...pop(0.4)}>
            <span className="inline-flex items-center rounded-2xl bg-ink px-4 py-1 text-paper shadow-[0_10px_24px_-10px_rgba(0,0,0,0.5)]" style={{ transform: "rotate(-2deg)" }}>the</span>
            <span>next</span>
          </motion.span>

          {/* line 4 — “levels”, hand-drawn crimson circle around it */}
          <motion.span className="relative mt-1 inline-block" {...pop(0.52)}>
            levels
            <svg aria-hidden viewBox="0 0 240 120" className="pointer-events-none absolute left-1/2 top-1/2 h-[150%] w-[128%] -translate-x-1/2 -translate-y-1/2" fill="none">
              <path d="M120 12 C58 12 16 34 16 60 C16 88 66 108 124 108 C182 108 226 86 224 58 C222 33 178 14 132 12"
                stroke="rgb(var(--crimson))" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </motion.span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.7 }}
          className="mt-8 max-w-xl text-base leading-relaxed text-ink-muted md:text-lg"
        >
          AI marking against the official Cambridge scheme, mark-scheme feedback and
          weakness tracking — everything to take your O &amp; A Level prep further.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.85 }}
          className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
        >
          {user ? (
            <Link href={primaryHref!}>
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
