"use client";

/**
 * Landing-page hero — a faithful React port of the Claude Design "Hero.dc.html".
 * A floating, 3-beat "intelligence" card that loops:
 *   0. a marked answer  →  progress stats
 *   1. strengths vs weaknesses (topic map + "Focus next")
 *   2. a generated study plan  →  a practice question
 * The subject is picked at RANDOM on every mount, so a different subject
 * (Physics, Chemistry, Biology, Maths, Economics, Computer Science, …) shows
 * each time the hero opens. Colours use the app's themed CSS vars (light + dark),
 * and everything degrades to a clean static first-frame under reduced-motion.
 */

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

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

const HEADLINE = "Practice. See every mark. Improve.";
const BEAT_MS = 3800;

// ---------------------------------------------------------------------------
// Subject pool — one is chosen at random on each mount. Each carries the copy
// for all three beats so the whole card is coherent to that subject.
// ---------------------------------------------------------------------------
type Status = "full" | "partial" | "miss";
type Level = "weak" | "mid" | "strong";
interface Subject {
  code: string;
  name: string;
  paper: string;
  question: string;
  rows: [string, number, Status][];
  ringNum: number;
  ringTotal: number;
  topics: [string, number, Level][];
  focus: string[];
  plan: string[];
  practiceTag: string;
  practiceQ: string;
}

const SUBJECTS: Subject[] = [
  {
    code: "9702", name: "Physics", paper: "Paper 2",
    question: "Q4 (b) Explain why the field between the plates is uniform.",
    rows: [
      ["Field lines parallel and equally spaced", 1, "full"],
      ["States E = V / d", 1, "full"],
      ["Correct substitution of values", 1, "full"],
      ["Answer to 2 s.f. with unit", 1, "full"],
      ["Direction stated (+ to −)", 1, "partial"],
      ["Assumption of edge effects", 0, "miss"],
    ],
    ringNum: 5, ringTotal: 6,
    topics: [
      ["Electric fields", 34, "weak"], ["Circular motion", 41, "weak"],
      ["Waves", 58, "mid"], ["Kinematics", 74, "strong"],
      ["Forces & momentum", 86, "strong"], ["Thermal physics", 91, "strong"],
    ],
    focus: ["Electric fields", "Circular motion"],
    plan: ["Electric fields — 12 questions, Paper 2", "Circular motion — mark scheme drill, 20 min", "Waves — timed set"],
    practiceTag: "Electric fields · Q1",
    practiceQ: "A charged oil drop is held stationary between two plates. Calculate the field strength.",
  },
  {
    code: "9701", name: "Chemistry", paper: "Paper 2",
    question: "Q3 (a) Explain the trend in atomic radius across Period 3.",
    rows: [
      ["Nuclear charge increases", 1, "full"],
      ["Same shell / similar shielding", 1, "full"],
      ["Stronger attraction on electrons", 1, "full"],
      ["Atomic radius decreases", 1, "full"],
      ["Correct reference to electrons", 1, "partial"],
      ["Mentions electron repulsion", 0, "miss"],
    ],
    ringNum: 5, ringTotal: 6,
    topics: [
      ["Redox", 36, "weak"], ["Organic mechanisms", 44, "weak"],
      ["Equilibria", 60, "mid"], ["Atomic structure", 78, "strong"],
      ["Chemical bonding", 85, "strong"], ["Stoichiometry", 90, "strong"],
    ],
    focus: ["Redox", "Organic mechanisms"],
    plan: ["Redox — 15 questions, Paper 2", "Organic mechanisms — mark scheme drill", "Equilibria — timed set"],
    practiceTag: "Redox reactions · Q1",
    practiceQ: "Balance the half-equation for the reduction of MnO₄⁻ in acidic solution.",
  },
  {
    code: "9700", name: "Biology", paper: "Paper 2",
    question: "Q6 (c) Describe how a resting potential is maintained across the membrane.",
    rows: [
      ["Na⁺ / K⁺ pump moves ions", 1, "full"],
      ["3 Na⁺ out for 2 K⁺ in", 1, "full"],
      ["Membrane more permeable to K⁺", 1, "full"],
      ["Inside negative to outside", 1, "full"],
      ["Reference to ATP used", 1, "partial"],
      ["States value ≈ −70 mV", 0, "miss"],
    ],
    ringNum: 5, ringTotal: 6,
    topics: [
      ["Gas exchange", 33, "weak"], ["Immunity", 42, "weak"],
      ["Enzymes", 57, "mid"], ["Cell structure", 76, "strong"],
      ["Transport in mammals", 84, "strong"], ["Biological molecules", 92, "strong"],
    ],
    focus: ["Gas exchange", "Immunity"],
    plan: ["Gas exchange — 12 questions, Paper 2", "Immunity — mark scheme drill", "Enzymes — timed set"],
    practiceTag: "Cell membranes · Q1",
    practiceQ: "Explain how the structure of a phospholipid bilayer relates to its function.",
  },
  {
    code: "9709", name: "Mathematics", paper: "Paper 3",
    question: "Q7 Show that the equation has a root between x = 1 and x = 2.",
    rows: [
      ["Evaluates f(1)", 1, "full"],
      ["Evaluates f(2)", 1, "full"],
      ["Change of sign identified", 1, "full"],
      ["Correct conclusion drawn", 1, "full"],
      ["States f is continuous", 1, "partial"],
      ["Accuracy to required s.f.", 0, "miss"],
    ],
    ringNum: 5, ringTotal: 6,
    topics: [
      ["Vectors", 35, "weak"], ["Complex numbers", 43, "weak"],
      ["Integration", 59, "mid"], ["Differentiation", 77, "strong"],
      ["Trigonometry", 85, "strong"], ["Algebra", 90, "strong"],
    ],
    focus: ["Vectors", "Complex numbers"],
    plan: ["Vectors — 10 questions, Paper 3", "Complex numbers — mark scheme drill", "Integration — timed set"],
    practiceTag: "Vectors · Q1",
    practiceQ: "Find the acute angle between the lines with equations r = a + t·b and r = c + s·d.",
  },
  {
    code: "9708", name: "Economics", paper: "Paper 2",
    question: "Q1 (d) Discuss whether a minimum wage always reduces employment.",
    rows: [
      ["Defines minimum wage", 1, "full"],
      ["Explains with a diagram", 1, "full"],
      ["Considers the monopsony case", 1, "full"],
      ["Uses the data provided", 1, "full"],
      ["Reaches a judgement", 1, "partial"],
      ["Evaluates short vs long run", 0, "miss"],
    ],
    ringNum: 5, ringTotal: 6,
    topics: [
      ["Market failure", 34, "weak"], ["Exchange rates", 45, "weak"],
      ["Elasticity", 58, "mid"], ["Demand & supply", 77, "strong"],
      ["Costs & revenue", 84, "strong"], ["Macro policy", 90, "strong"],
    ],
    focus: ["Market failure", "Exchange rates"],
    plan: ["Market failure — 8 questions, Paper 2", "Exchange rates — data-response drill", "Elasticity — timed set"],
    practiceTag: "Market failure · Q1",
    practiceQ: "Explain, using a diagram, how a negative externality leads to market failure.",
  },
  {
    code: "9618", name: "Computer Science", paper: "Paper 1",
    question: "Q2 (c) Describe how two's complement represents a negative number.",
    rows: [
      ["Inverts all the bits", 1, "full"],
      ["Adds one to the result", 1, "full"],
      ["MSB is the sign bit", 1, "full"],
      ["Correct worked example", 1, "full"],
      ["States the value range", 1, "partial"],
      ["Mentions overflow", 0, "miss"],
    ],
    ringNum: 5, ringTotal: 6,
    topics: [
      ["Networking", 36, "weak"], ["Boolean algebra", 44, "weak"],
      ["Databases", 59, "mid"], ["Data representation", 77, "strong"],
      ["Algorithms", 85, "strong"], ["Programming", 91, "strong"],
    ],
    focus: ["Networking", "Boolean algebra"],
    plan: ["Networking — 10 questions, Paper 1", "Boolean algebra — mark scheme drill", "Databases — timed set"],
    practiceTag: "Data representation · Q1",
    practiceQ: "Convert the denary number 200 into 8-bit binary and then into hexadecimal.",
  },
];

const RING_CIRC = 238.8; // 2·π·r, r = 38
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// ---------------------------------------------------------------------------
// The animated card. Owns its own rAF beat loop so the static copy never
// re-renders. Faithful port of the design's elapsed-time interpolation.
// ---------------------------------------------------------------------------
function HeroStage({ subject }: { subject: Subject }) {
  const reduce = useReducedMotion();
  const [beat, setBeat] = useState(0);
  const [e, setE] = useState(0);
  const [w, setW] = useState(1280);

  useEffect(() => {
    setW(window.innerWidth);
    const onResize = () => setW(window.innerWidth);
    window.addEventListener("resize", onResize);
    if (reduce) {
      setE(99999);
      return () => window.removeEventListener("resize", onResize);
    }
    // A ~33ms interval drives the beat timeline. (rAF would be smoother, but it
    // is paused in some embedded/automated browsers; setInterval ticks reliably
    // everywhere and we pause it while the tab is hidden to save CPU.)
    let t0 = performance.now();
    const id = window.setInterval(() => {
      const el = performance.now() - t0;
      if (el > BEAT_MS) {
        t0 = performance.now();
        setBeat((b) => (b + 1) % 3);
        setE(0);
      } else {
        setE(el);
      }
    }, 33);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", onResize);
    };
  }, [reduce]);

  const mobile = w < 760;
  const desktop = w >= 1024;
  const shown = mobile || reduce ? (mobile ? 1 : 0) : beat;
  const p = (d: number, s: number) => clamp01((e - d) / s);

  // card scale + 3D tilt
  const avail = desktop ? Math.min(600, w * 0.44) : Math.min(520, w - 56);
  const scale = Math.max(0.56, Math.min(1.1, avail / 500));
  const stageH = Math.round(420 * scale);
  const tilt = desktop ? " perspective(1400px) rotateY(-9deg) rotateX(5deg) rotate(.4deg)" : "";
  const off = (i: number) => (shown === i ? "0px" : i < shown ? "-14px" : "14px");

  // ---- beat 0: marked answer -> stats ----
  const markRows = subject.rows.map((r, i) => {
    const on = p(360 + i * 340, 260);
    const st = r[2];
    return {
      t1: r[0],
      m: st === "miss" ? "0" : "+" + r[1],
      icon: st === "full" ? "✓" : st === "partial" ? "~" : "—",
      bg: st === "full" ? "rgb(var(--mint))" : st === "partial" ? "rgb(var(--gold))" : "rgb(var(--ink) / 0.32)",
      mc: st === "full" ? "rgb(var(--mint))" : st === "partial" ? "rgb(var(--gold))" : "rgb(var(--ink) / 0.4)",
      o: on,
      t: (1 - on) * 6 + "px",
    };
  });
  const marks = p(500, 1900) * subject.ringNum;
  const ringOffset = (RING_CIRC * (1 - marks / subject.ringTotal)).toFixed(1);
  const ringNum = Math.round(marks);
  const statO = p(2050, 400);
  const sp = p(2100, 1200);
  const stats = [
    { v: Math.round(1248 * sp).toLocaleString(), l: "marks earned" },
    { v: Math.round(78 * sp) + "%", l: "accuracy" },
    { v: Math.round(342 * sp).toString(), l: "questions done" },
  ];
  const sparkOffset = (150 * (1 - p(2300, 1200))).toFixed(0);

  // ---- beat 1: strengths vs weaknesses ----
  const topics = subject.topics.map((t, i) => {
    const f = p(220 + i * 95, 780) * (t[1] / 100);
    const c = t[2] === "weak" ? "rgb(var(--crimson))" : t[2] === "mid" ? "rgb(var(--gold))" : "rgb(var(--mint))";
    return {
      name: t[0], f: f.toFixed(3), c, label: Math.round(f * 100) + "%",
      pulse: t[2] === "weak",
    };
  });
  const focus = subject.focus.map((name, i) => {
    const o = p(1500 + i * 240, 420);
    return { name, o, t: (1 - o) * 8 + "px" };
  });
  const sumO = p(2100, 500);

  // ---- beat 2: study plan -> practice ----
  const highlight = e > 1900;
  const clicked = e > 2260 && e < 2460;
  const plan = subject.plan.map((n, i) => {
    const o = p(240 + i * 420, 380);
    const top = i === 0 && highlight;
    return {
      name: n, o, t: (1 - o) * 8 + "px", clip: (1 - p(300 + i * 420, 620)) * 100 + "%",
      border: top ? "rgb(var(--crimson))" : "rgb(var(--ink) / 0.10)",
      bg: top ? "rgb(var(--crimson) / 0.05)" : "rgb(var(--surface))",
      chipBg: top ? "rgb(var(--crimson))" : "rgb(var(--ink) / 0.06)",
      chipC: top ? "#fff" : "rgb(var(--ink) / 0.6)",
      chipS: i === 0 && clicked ? 0.86 : 1,
    };
  });
  const qO = p(2520, 420);
  const qT = (1 - qO) * 44 + "px";
  const curO = e > 1650 ? 1 : 0;
  const curPos = "translate(" + (highlight ? 372 : 210) + "px," + (highlight ? 14 : 120) + "px)";
  const curS = clicked ? 0.82 : 1;

  const dots = [0, 1, 2].map((i) => ({
    w: shown === i ? "18px" : "5px",
    bg: shown === i ? "rgb(var(--crimson))" : "rgb(var(--ink) / 0.16)",
  }));

  return (
    <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center", height: stageH }}>
      <div aria-hidden style={{ position: "absolute", width: "120%", height: "120%", left: "-10%", top: "-10%", pointerEvents: "none", background: "radial-gradient(46% 46% at 58% 40%,rgb(var(--crimson) / 0.10),transparent 70%),radial-gradient(40% 40% at 30% 74%,rgb(var(--gold) / 0.09),transparent 72%)" }} />

      <div aria-hidden className="dc-float" style={{ position: "absolute", transformOrigin: "center", willChange: "transform" }}>
        <div style={{ width: 500, height: 420, transform: `scale(${scale.toFixed(3)})${tilt}`, transformOrigin: "center" }}>
          <div style={{ position: "relative", width: 500, height: 420, boxSizing: "border-box", background: "rgb(var(--surface))", border: "1px solid rgb(var(--line) / 0.10)", borderRadius: 20, boxShadow: "0 40px 80px -40px rgb(var(--crimson-deep) / 0.30), 0 2px 6px rgb(var(--line) / 0.06)", padding: "18px 20px", overflow: "hidden" }}>

            {/* header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 18 }}>
              <span style={{ font: "500 10px/1 var(--font-sans, 'DM Sans', sans-serif)", letterSpacing: ".13em", textTransform: "uppercase", color: "rgb(var(--ink-faint))" }}>{subject.code} · {subject.name} · {subject.paper}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, font: "500 10px/1 var(--font-sans, 'DM Sans', sans-serif)", letterSpacing: ".09em", textTransform: "uppercase", color: "rgb(var(--crimson))" }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgb(var(--crimson))" }} />live</span>
            </div>

            <div style={{ position: "absolute", left: 20, right: 20, top: 48, bottom: 30 }}>

              {/* BEAT 0 */}
              <div style={{ position: "absolute", inset: 0, transition: "opacity .5s cubic-bezier(.22,1,.36,1),transform .5s cubic-bezier(.22,1,.36,1)", opacity: shown === 0 ? 1 : 0, transform: `translateY(${off(0)})`, pointerEvents: "none" }}>
                <div style={{ border: "1px solid rgb(var(--line) / 0.10)", borderRadius: 14, background: "rgb(var(--paper) / 0.55)", padding: "13px 14px", height: 196, boxSizing: "border-box", position: "relative" }}>
                  <div className="font-display" style={{ fontStyle: "italic", fontSize: 12.5, lineHeight: 1.35, color: "rgb(var(--ink-muted))", maxWidth: 290 }}>{subject.question}</div>
                  <div style={{ marginTop: 11, display: "flex", flexDirection: "column", gap: 6, maxWidth: 298 }}>
                    {markRows.map((row, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, opacity: row.o, transform: `translateY(${row.t})`, transition: "opacity .35s ease,transform .35s cubic-bezier(.22,1,.36,1)" }}>
                        <span style={{ width: 15, height: 15, flex: "none", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", font: "700 9px/1 var(--font-sans,'DM Sans',sans-serif)", color: "#fff", background: row.bg }}>{row.icon}</span>
                        <span style={{ font: "400 11px/1.25 var(--font-sans,'DM Sans',sans-serif)", color: "rgb(var(--ink-muted))", flex: 1 }}>{row.t1}</span>
                        <span style={{ font: "500 10px/1 var(--font-sans,'DM Sans',sans-serif)", color: row.mc }}>{row.m}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ position: "absolute", right: 14, top: 14, width: 96, height: 96 }}>
                    <svg width="96" height="96" viewBox="0 0 96 96" style={{ display: "block", transform: "rotate(-90deg)" }}>
                      <circle cx="48" cy="48" r="38" fill="none" stroke="rgb(var(--ink) / 0.10)" strokeWidth="7" />
                      <circle cx="48" cy="48" r="38" fill="none" stroke="rgb(var(--crimson))" strokeWidth="7" strokeLinecap="round" strokeDasharray={RING_CIRC} strokeDashoffset={ringOffset} />
                    </svg>
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1 }}>
                      <span className="font-display" style={{ fontSize: 25, lineHeight: 1, color: "rgb(var(--ink))" }}>{ringNum}<span style={{ fontSize: 14, color: "rgb(var(--ink-faint))" }}>/{subject.ringTotal}</span></span>
                      <span style={{ font: "500 8px/1 var(--font-sans,'DM Sans',sans-serif)", letterSpacing: ".12em", textTransform: "uppercase", color: "rgb(var(--ink-faint))" }}>marks</span>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 14, border: "1px solid rgb(var(--line) / 0.10)", borderRadius: 14, background: "rgb(var(--surface))", padding: "13px 15px", height: 110, boxSizing: "border-box", opacity: statO, transform: `translateY(${(1 - statO) * 10}px)`, transition: "opacity .45s ease,transform .45s cubic-bezier(.22,1,.36,1)" }}>
                  <div style={{ display: "flex", gap: 20, flex: 1 }}>
                    {stats.map((s, i) => (
                      <div key={i} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        <span className="font-display" style={{ fontSize: 26, lineHeight: 1, color: "rgb(var(--ink))" }}>{s.v}</span>
                        <span style={{ font: "500 8.5px/1.2 var(--font-sans,'DM Sans',sans-serif)", letterSpacing: ".11em", textTransform: "uppercase", color: "rgb(var(--ink-faint))" }}>{s.l}</span>
                      </div>
                    ))}
                  </div>
                  <svg width="118" height="46" viewBox="0 0 118 46" style={{ display: "block", flex: "none" }}>
                    <path d="M2,40 L24,33 L46,35 L68,22 L90,17 L116,6" fill="none" stroke="rgb(var(--gold))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="150" strokeDashoffset={sparkOffset} />
                  </svg>
                </div>
              </div>

              {/* BEAT 1 */}
              <div style={{ position: "absolute", inset: 0, transition: "opacity .5s cubic-bezier(.22,1,.36,1),transform .5s cubic-bezier(.22,1,.36,1)", opacity: shown === 1 ? 1 : 0, transform: `translateY(${off(1)})`, pointerEvents: "none" }}>
                <div className="font-display" style={{ fontSize: 17, lineHeight: 1.2, color: "rgb(var(--ink))" }}>Your weak topics, found.</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 132px", gap: 14, marginTop: 13 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                    {topics.map((tp, i) => (
                      <div key={i} className={tp.pulse ? "dc-weak" : undefined} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <span style={{ width: 104, flex: "none", font: "400 10.5px/1.2 var(--font-sans,'DM Sans',sans-serif)", color: "rgb(var(--ink-muted))", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tp.name}</span>
                        <span style={{ flex: 1, height: 7, borderRadius: 99, background: "rgb(var(--ink) / 0.08)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", borderRadius: 99, background: tp.c, transformOrigin: "left center", transform: `scaleX(${tp.f})` }} /></span>
                        <span style={{ width: 26, textAlign: "right", font: "500 10px/1 var(--font-sans,'DM Sans',sans-serif)", color: tp.c }}>{tp.label}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ border: "1px solid rgb(var(--gold) / 0.30)", background: "rgb(var(--gold) / 0.07)", borderRadius: 13, padding: "11px 11px 12px", height: "fit-content" }}>
                    <div style={{ font: "500 8.5px/1 var(--font-sans,'DM Sans',sans-serif)", letterSpacing: ".12em", textTransform: "uppercase", color: "rgb(var(--gold))" }}>Focus next</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 9 }}>
                      {focus.map((f, i) => (
                        <div key={i} style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--line) / 0.10)", borderRadius: 9, padding: "7px 9px", font: "500 10.5px/1.2 var(--font-sans,'DM Sans',sans-serif)", color: "rgb(var(--ink))", opacity: f.o, transform: `translateY(${f.t})`, transition: "opacity .4s ease,transform .4s cubic-bezier(.22,1,.36,1)" }}>{f.name}</div>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", gap: 12, border: "1px solid rgb(var(--crimson) / 0.22)", background: "rgb(var(--crimson) / 0.05)", borderRadius: 13, padding: "12px 15px", opacity: sumO, transform: `translateY(${(1 - sumO) * 10}px)`, transition: "opacity .5s ease,transform .5s cubic-bezier(.22,1,.36,1)" }}>
                  <span className="font-display" style={{ fontSize: 30, lineHeight: 1, color: "rgb(var(--crimson))" }}>2</span>
                  <span style={{ flex: 1, font: "400 11px/1.4 var(--font-sans,'DM Sans',sans-serif)", color: "rgb(var(--ink-muted))" }}>{"topics below your target grade — folded into this week's plan"}</span>
                  <span style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 6, font: "500 10.5px/1 var(--font-sans,'DM Sans',sans-serif)", color: "rgb(var(--crimson))" }}>Build plan <span aria-hidden>→</span></span>
                </div>
              </div>

              {/* BEAT 2 */}
              <div style={{ position: "absolute", inset: 0, transition: "opacity .5s cubic-bezier(.22,1,.36,1),transform .5s cubic-bezier(.22,1,.36,1)", opacity: shown === 2 ? 1 : 0, transform: `translateY(${off(2)})`, pointerEvents: "none" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                  <span className="font-display" style={{ fontSize: 17, lineHeight: 1.2, color: "rgb(var(--ink))" }}>Your plan for this week</span>
                  <span style={{ font: "500 8.5px/1 var(--font-sans,'DM Sans',sans-serif)", letterSpacing: ".12em", textTransform: "uppercase", color: "rgb(var(--ink-faint))" }}>generated</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 13 }}>
                  {plan.map((pl, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${pl.border}`, background: pl.bg, borderRadius: 12, padding: "11px 12px", opacity: pl.o, transform: `translateY(${pl.t})`, transition: "opacity .4s ease,transform .4s cubic-bezier(.22,1,.36,1),border-color .3s" }}>
                      <span style={{ width: 14, height: 14, flex: "none", borderRadius: 4, border: "1.5px solid rgb(var(--line) / 0.22)" }} />
                      <span style={{ flex: 1, font: "400 11px/1.25 var(--font-sans,'DM Sans',sans-serif)", color: "rgb(var(--ink))", whiteSpace: "nowrap", overflow: "hidden", clipPath: `inset(0 ${pl.clip} 0 0)` }}>{pl.name}</span>
                      <span style={{ flex: "none", borderRadius: 999, padding: "5px 11px", font: "500 9.5px/1 var(--font-sans,'DM Sans',sans-serif)", letterSpacing: ".04em", background: pl.chipBg, color: pl.chipC, transform: `scale(${pl.chipS})`, transition: "transform .18s ease" }}>Practise</span>
                    </div>
                  ))}
                </div>
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 96, overflow: "hidden" }}>
                  <div style={{ border: "1px solid rgb(var(--line) / 0.10)", background: "rgb(var(--surface))", borderRadius: 13, boxShadow: "0 14px 30px -18px rgb(var(--crimson-deep) / 0.4)", padding: "11px 13px", opacity: qO, transform: `translateX(${qT})`, transition: "opacity .45s ease,transform .45s cubic-bezier(.22,1,.36,1)" }}>
                    <div style={{ font: "500 8.5px/1 var(--font-sans,'DM Sans',sans-serif)", letterSpacing: ".12em", textTransform: "uppercase", color: "rgb(var(--crimson))" }}>{subject.practiceTag}</div>
                    <div className="font-display" style={{ marginTop: 7, fontStyle: "italic", fontSize: 12.5, lineHeight: 1.35, color: "rgb(var(--ink-muted))" }}>{subject.practiceQ}</div>
                  </div>
                </div>
                <div style={{ position: "absolute", left: 0, top: 0, width: 16, height: 16, opacity: curO, transform: `${curPos} scale(${curS})`, transition: "transform .8s cubic-bezier(.22,1,.36,1),opacity .3s" }}>
                  <svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 1 L2 13 L5.4 9.9 L7.6 15 L9.9 14 L7.7 9.1 L12.2 8.8 Z" fill="rgb(var(--ink))" stroke="#fff" strokeWidth="1" /></svg>
                </div>
              </div>
            </div>

            {/* progress dots */}
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 14, display: "flex", justifyContent: "center", gap: 6 }}>
              {dots.map((d, i) => (
                <span key={i} style={{ height: 5, borderRadius: 99, width: d.w, background: d.bg, transition: "width .35s cubic-bezier(.22,1,.36,1),background .35s" }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export default function ProductHero({ user, profile, onSignUp, onExplore }: ProductHeroProps) {
  const [subject, setSubject] = useState<Subject>(SUBJECTS[0]);
  useEffect(() => {
    // pick a fresh subject on every mount so a different one shows each visit
    setSubject(SUBJECTS[Math.floor(Math.random() * SUBJECTS.length)]);
  }, []);

  const primaryHref = user ? dashboardHref(user, profile) : undefined;

  return (
    <section className="relative w-full overflow-hidden bg-paper text-ink" style={{ minHeight: "100vh", boxSizing: "border-box", display: "flex", alignItems: "center", padding: "clamp(128px,17vh,184px) clamp(20px,5vw,72px) clamp(64px,9vh,104px)" }}>
      <style>{`
        @keyframes dcHeroFloat{0%,100%{transform:translateY(-6px)}50%{transform:translateY(6px)}}
        @keyframes dcHeroPulse{0%{box-shadow:0 0 0 0 rgb(var(--crimson) / .45)}70%{box-shadow:0 0 0 7px rgb(var(--crimson) / 0)}100%{box-shadow:0 0 0 0 rgb(var(--crimson) / 0)}}
        @keyframes dcHeroWeak{0%,100%{opacity:1}50%{opacity:.55}}
        .dc-float{animation:dcHeroFloat 6s ease-in-out infinite}
        .dc-pulse{animation:dcHeroPulse 2.4s ease-out infinite}
        .dc-weak{animation:dcHeroWeak 1.6s ease-in-out 1.1s 1}
        @media (prefers-reduced-motion: reduce){.dc-float,.dc-pulse,.dc-weak{animation:none !important}}
      `}</style>

      <div style={{ width: "100%", maxWidth: 1280, margin: "0 auto", display: "grid", alignItems: "center", gap: "clamp(40px,5vw,72px)" }} className="grid-cols-1 lg:grid-cols-[1fr_1.1fr]">

        {/* LEFT: copy */}
        <div className="flex max-w-[620px] flex-col items-start gap-[26px]">
          <div className="dc-pulse inline-flex items-center gap-[9px] rounded-full border border-line/[.14] bg-surface/70 py-[7px] pl-3 pr-[15px]">
            <span className="h-[7px] w-[7px] rounded-full" style={{ background: "rgb(var(--crimson))" }} />
            <span className="text-[12.5px] font-medium tracking-[.02em] text-ink-muted">Cambridge O &amp; A Level · marked to the scheme</span>
          </div>

          <h1 className="font-display m-0 font-normal tracking-[-.022em] [text-wrap:balance]" style={{ fontSize: "clamp(42px,5.4vw,70px)", lineHeight: 1.03 }}>
            {HEADLINE}
          </h1>

          <p className="m-0 max-w-[47ch] text-ink-muted [text-wrap:pretty]" style={{ fontSize: "clamp(16px,1.25vw,18.5px)", lineHeight: 1.55 }}>
            Real past papers, marked against the official Cambridge scheme — then a study plan that targets your weak topics.
          </p>

          <div className="mt-0.5 flex flex-wrap gap-3">
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
                <Button onClick={onExplore} variant="ghost" size="lg" className="h-14 rounded-full border border-line/[.22] bg-surface/60 px-7 text-base">
                  See how it works
                </Button>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-[10px] text-[13px] tracking-[.01em] text-ink-faint">
            <span><strong className="font-bold text-ink-muted">80k+</strong> questions</span>
            <span aria-hidden>·</span>
            <span><strong className="font-bold text-ink-muted">30+</strong> subjects</span>
            <span aria-hidden>·</span>
            <span>marked in <strong className="font-bold text-ink-muted">~1.8s</strong></span>
          </div>
        </div>

        {/* RIGHT: animated card */}
        <HeroStage subject={subject} />
      </div>
    </section>
  );
}
