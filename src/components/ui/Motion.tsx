"use client";

import { motion, useInView, type Variants, type HTMLMotionProps } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

/* Shared easing — a soft, premium ease-out used across the app */
export const EASE = [0.22, 1, 0.36, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.6, ease: EASE } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.55, ease: EASE } },
};

export const staggerContainer = (stagger = 0.08, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren: delay } },
});

/** Common polymorphic tags we animate. */
type MotionTag = "div" | "section" | "article" | "header" | "ul" | "li";

type RevealProps = HTMLMotionProps<"div"> & {
  children: ReactNode;
  /** delay in seconds */
  delay?: number;
  y?: number;
  once?: boolean;
  as?: MotionTag;
};

/**
 * Reveal — fade + rise an element as it scrolls into view.
 * Drop-in replacement for a <div>; accepts className, an `as` tag, and motion props.
 */
export function Reveal({ children, delay = 0, y = 22, once = true, as = "div", ...rest }: RevealProps) {
  const Tag = motion[as] as typeof motion.div;
  return (
    <Tag
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-80px" }}
      transition={{ duration: 0.6, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

type StaggerProps = HTMLMotionProps<"div"> & {
  children: ReactNode;
  stagger?: number;
  delay?: number;
  once?: boolean;
  as?: MotionTag;
};

/** Stagger — animate children in sequence as the group scrolls into view. */
export function Stagger({ children, stagger = 0.08, delay = 0, once = true, as = "div", ...rest }: StaggerProps) {
  const Tag = motion[as] as typeof motion.div;
  return (
    <Tag
      variants={staggerContainer(stagger, delay)}
      initial="hidden"
      whileInView="show"
      viewport={{ once, margin: "-80px" }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** StaggerItem — a single item inside <Stagger>. */
export function StaggerItem({ children, ...rest }: HTMLMotionProps<"div"> & { children: ReactNode }) {
  return (
    <motion.div variants={fadeUp} {...rest}>
      {children}
    </motion.div>
  );
}

/** CountUp — animates a number from 0 → `to` the first time it scrolls into view. */
export function CountUp({
  to,
  suffix = "",
  prefix = "",
  duration = 1.6,
  className,
}: {
  to: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    let startTs = 0;
    const step = (now: number) => {
      if (!startTs) startTs = now;
      const p = Math.min(1, (now - startTs) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(to * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {val.toLocaleString()}
      {suffix}
    </span>
  );
}

/** Marquee — an infinite horizontal ribbon that loops seamlessly. */
export function Marquee({
  children,
  speed = 32,
  className,
  reverse = false,
}: {
  children: ReactNode;
  speed?: number;
  className?: string;
  reverse?: boolean;
}) {
  return (
    <div className={`relative flex overflow-hidden ${className ?? ""}`}>
      <motion.div
        className="flex shrink-0 items-center"
        animate={{ x: reverse ? ["-50%", "0%"] : ["0%", "-50%"] }}
        transition={{ duration: speed, repeat: Infinity, ease: "linear" }}
      >
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden>{children}</div>
      </motion.div>
    </div>
  );
}
