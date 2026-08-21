"use client";

import { BookStack, OpenBook, Pencil, Pen, Leaf } from "@/components/ui/StudyObjects";

// Purely decorative: 3D books + pens bobbing gently while a flurry of autumn
// leaves drifts down past them. aria-hidden + pointer-events:none so it's
// invisible to assistive tech and never blocks clicks.

// A generous scatter of leaves — varied colour, size, speed and drift so it
// reads as a natural fall rather than a loop.
const LEAF_PALETTE: [string, string][] = [
  ["#F5C542", "#C77E00"], // gold
  ["#F27A5E", "#C1361B"], // coral
  ["#5FD3B3", "#137A5C"], // teal
  ["#C41E4A", "#7A0D2C"], // crimson
  ["#F0A63C", "#B96A0C"], // amber
  ["#8FBF6A", "#4E7C34"], // green
];
const LEAVES = [
  { left: "6%", size: 22, dur: 9.5, delay: 0, drift: 30, pal: 0 },
  { left: "14%", size: 15, dur: 12, delay: 3.4, drift: -22, pal: 1 },
  { left: "22%", size: 19, dur: 10.5, delay: 1.6, drift: 26, pal: 2 },
  { left: "31%", size: 13, dur: 13.5, delay: 5.2, drift: -16, pal: 4 },
  { left: "39%", size: 24, dur: 9, delay: 2.3, drift: 34, pal: 0 },
  { left: "47%", size: 16, dur: 11.5, delay: 6.4, drift: -28, pal: 3 },
  { left: "55%", size: 20, dur: 10, delay: 0.8, drift: 22, pal: 5 },
  { left: "63%", size: 14, dur: 12.8, delay: 4.1, drift: -20, pal: 1 },
  { left: "71%", size: 23, dur: 9.4, delay: 2.9, drift: 30, pal: 2 },
  { left: "79%", size: 15, dur: 11.8, delay: 5.8, drift: -24, pal: 4 },
  { left: "87%", size: 18, dur: 10.6, delay: 1.2, drift: 18, pal: 0 },
  { left: "93%", size: 13, dur: 13, delay: 3.9, drift: -14, pal: 3 },
  { left: "35%", size: 17, dur: 11, delay: 7.5, drift: 24, pal: 5 },
];

export default function StudyScene() {
  return (
    <div aria-hidden style={{ position: "relative", width: "100%", minHeight: 280, overflow: "hidden", pointerEvents: "none", marginTop: 8 }}>
      <style>{`
        @keyframes pplLeafFall {
          0%   { transform: translate(0,-30px) rotate(0deg) scale(.95); opacity: 0; }
          10%  { opacity: 1; }
          50%  { transform: translate(var(--dx,24px),150px) rotate(200deg) scale(1); }
          90%  { opacity: 1; }
          100% { transform: translate(calc(var(--dx,24px) * -0.5),300px) rotate(400deg) scale(.9); opacity: 0; }
        }
        @keyframes pplBob   { 0%,100% { transform: translateY(0) rotate(-5deg); } 50% { transform: translateY(-14px) rotate(4deg); } }
        @keyframes pplBob2  { 0%,100% { transform: translateY(0) rotate(6deg); }  50% { transform: translateY(-17px) rotate(-4deg); } }
        @keyframes pplBob3  { 0%,100% { transform: translateY(0) rotate(-38deg); } 50% { transform: translateY(-12px) rotate(-30deg); } }
        @media (prefers-reduced-motion: reduce) { .ppl-anim { animation: none !important; } }
      `}</style>

      {/* soft ground glow for depth */}
      <div style={{ position: "absolute", left: "10%", right: "10%", bottom: 6, height: 40, background: "radial-gradient(50% 100% at 50% 100%, rgba(168,18,60,0.10), transparent)", filter: "blur(6px)" }} />

      {/* 3D books + pens */}
      <div className="ppl-anim" style={{ position: "absolute", left: "9%", top: "34%", animation: "pplBob 6s ease-in-out infinite" }}>
        <BookStack size={96} />
      </div>
      <div className="ppl-anim" style={{ position: "absolute", left: "43%", top: "50%", animation: "pplBob2 7.6s ease-in-out infinite .5s" }}>
        <OpenBook size={82} />
      </div>
      <div className="ppl-anim" style={{ position: "absolute", left: "68%", top: "30%", animation: "pplBob3 7s ease-in-out infinite 1.1s" }}>
        <Pencil size={72} />
      </div>
      <div className="ppl-anim" style={{ position: "absolute", left: "30%", top: "60%", animation: "pplBob3 6.8s ease-in-out infinite 1.9s" }}>
        <Pen size={62} />
      </div>

      {/* Drifting leaves */}
      {LEAVES.map((l, i) => {
        const [c1, c2] = LEAF_PALETTE[l.pal];
        return (
          <div
            key={i}
            className="ppl-anim"
            style={{ position: "absolute", left: l.left, top: 0, ["--dx" as string]: `${l.drift}px`, animation: `pplLeafFall ${l.dur}s linear ${l.delay}s infinite` }}
          >
            <Leaf size={l.size} c1={c1} c2={c2} />
          </div>
        );
      })}
    </div>
  );
}
