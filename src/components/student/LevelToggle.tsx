"use client";

import { LEVEL_LABEL, PaperLevel, usePaperLevel } from "@/lib/paperLevel";

const OPTIONS: PaperLevel[] = ["olevel", "alevel"];

/**
 * O Levels / A Levels segmented toggle shown in the navbar while the
 * Past Papers section is open. A single sliding "thumb" glides between
 * the two options, matching the pill styling of the main nav.
 */
export default function LevelToggle({ className = "" }: { className?: string }) {
  const { level, setLevel } = usePaperLevel();
  const activeIndex = OPTIONS.indexOf(level);

  return (
    <div
      role="group"
      aria-label="Exam level"
      className={`relative grid shrink-0 animate-scale-in grid-cols-2 rounded-full border border-[#1C1714]/[.09] bg-white/70 p-0.5 shadow-sm backdrop-blur ${className}`}
    >
      {/* sliding thumb */}
      <span
        aria-hidden
        className="absolute bottom-0.5 left-0.5 top-0.5 w-[calc(50%-2px)] rounded-full bg-gradient-to-br from-crimson to-crimson-deep shadow-crimson transition-transform duration-300 ease-out"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLevel(option)}
          aria-pressed={level === option}
          className={`relative z-10 whitespace-nowrap rounded-full px-2.5 py-1.5 text-center text-xs font-semibold transition-colors duration-200 ${
            level === option ? "text-white" : "text-ink-muted hover:text-ink"
          }`}
        >
          {LEVEL_LABEL[option]}
        </button>
      ))}
    </div>
  );
}
