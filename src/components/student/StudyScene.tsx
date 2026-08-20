"use client";

import { Book, BookOpen, Leaf, Sprout } from "lucide-react";

// Purely decorative: gently bobbing books and drifting leaves that fill the
// empty space beside the greeting. aria-hidden + pointer-events:none so it's
// invisible to assistive tech and never blocks clicks.
const LEAVES = [
  { left: "10%", size: 20, dur: 9, delay: 0, color: "var(--amber-deep)" },
  { left: "26%", size: 16, dur: 11, delay: 2.5, color: "var(--coral-bright)" },
  { left: "44%", size: 22, dur: 10, delay: 1.2, color: "var(--teal-deep)" },
  { left: "62%", size: 15, dur: 12, delay: 4, color: "var(--amber-deep)" },
  { left: "78%", size: 19, dur: 9.5, delay: 3.2, color: "var(--coral-bright)" },
  { left: "34%", size: 14, dur: 13, delay: 6, color: "var(--crimson)" },
];

export default function StudyScene() {
  return (
    <div aria-hidden style={{ position: "relative", width: "100%", minHeight: 260, overflow: "hidden", pointerEvents: "none", marginTop: 8 }}>
      <style>{`
        @keyframes pplLeafFall {
          0%   { transform: translate(0,-24px) rotate(0deg); opacity: 0; }
          8%   { opacity: .85; }
          50%  { transform: translate(26px,120px) rotate(180deg); }
          92%  { opacity: .85; }
          100% { transform: translate(-14px,250px) rotate(360deg); opacity: 0; }
        }
        @keyframes pplBookBob {
          0%,100% { transform: translateY(0) rotate(-5deg); }
          50%     { transform: translateY(-13px) rotate(5deg); }
        }
        @keyframes pplBookBob2 {
          0%,100% { transform: translateY(0) rotate(6deg); }
          50%     { transform: translateY(-16px) rotate(-4deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ppl-anim { animation: none !important; }
        }
      `}</style>

      {/* Floating books */}
      <div className="ppl-anim" style={{ position: "absolute", left: "12%", top: "38%", color: "var(--crimson)", animation: "pplBookBob 6s ease-in-out infinite" }}>
        <BookOpen size={72} strokeWidth={1.4} />
      </div>
      <div className="ppl-anim" style={{ position: "absolute", left: "46%", top: "56%", color: "var(--amber-deep)", animation: "pplBookBob2 7.5s ease-in-out infinite .6s" }}>
        <Book size={54} strokeWidth={1.4} />
      </div>
      <div className="ppl-anim" style={{ position: "absolute", left: "70%", top: "30%", color: "var(--teal-deep)", animation: "pplBookBob 8s ease-in-out infinite 1.2s" }}>
        <Sprout size={50} strokeWidth={1.4} />
      </div>
      <div className="ppl-anim" style={{ position: "absolute", left: "30%", top: "68%", color: "var(--purple, #7c5cbf)", animation: "pplBookBob2 6.8s ease-in-out infinite 1.8s" }}>
        <Sprout size={40} strokeWidth={1.5} />
      </div>

      {/* Drifting leaves */}
      {LEAVES.map((l, i) => (
        <div key={i} className="ppl-anim" style={{ position: "absolute", left: l.left, top: 0, color: l.color, opacity: 0.85, animation: `pplLeafFall ${l.dur}s linear ${l.delay}s infinite` }}>
          <Leaf size={l.size} strokeWidth={1.6} />
        </div>
      ))}
    </div>
  );
}
