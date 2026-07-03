/* ============================================================
   PROPEL — Subject palette
   Maps a real subject name/code to a consistent color + icon,
   used across the dashboard, papers and practice tabs.
   ============================================================ */

export interface SubjectStyle {
  color: string;
  icon: string;
}

const BY_KEY: Record<string, SubjectStyle> = {
  physics: { color: "#A8123C", icon: "atom" },
  chemistry: { color: "#16876B", icon: "beaker" },
  biology: { color: "#6B4BC4", icon: "dna" },
  "add maths": { color: "#D9852A", icon: "function" },
  "additional mathematics": { color: "#D9852A", icon: "function" },
  "computer science": { color: "#2A6FB0", icon: "code" },
  computer: { color: "#2A6FB0", icon: "code" },
  mathematics: { color: "#0E7C86", icon: "hash" },
  maths: { color: "#0E7C86", icon: "hash" },
  "business studies": { color: "#B5123F", icon: "briefcase" },
  business: { color: "#B5123F", icon: "briefcase" },
  english: { color: "#5A6B2A", icon: "edit" },
  "pakistan studies": { color: "#8A4F12", icon: "globe" },
  economics: { color: "#0E7C86", icon: "chart" },
  accounting: { color: "#B5123F", icon: "briefcase" },
  islamiyat: { color: "#16876B", icon: "book" },
};

const FALLBACK_COLORS = ["#A8123C", "#16876B", "#6B4BC4", "#D9852A", "#2A6FB0", "#0E7C86", "#B5123F", "#5A6B2A", "#8A4F12"];

/** Deterministic style for any subject string (name or code). */
export function subjectStyle(name: string | null | undefined): SubjectStyle {
  if (!name) return { color: FALLBACK_COLORS[0], icon: "book" };
  const key = name.trim().toLowerCase();
  if (BY_KEY[key]) return BY_KEY[key];
  // partial match (e.g. "Physics 5054")
  for (const k of Object.keys(BY_KEY)) {
    if (key.includes(k)) return BY_KEY[k];
  }
  // stable hash → fallback color
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return { color: FALLBACK_COLORS[h % FALLBACK_COLORS.length], icon: "book" };
}
