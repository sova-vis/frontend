/* ============================================================
   PROPEL — Exam durations for the practice timer
   Structured papers follow the real Cambridge O-Level durations
   per subject/paper; every MCQ paper gets a fixed 30-minute
   sprint (house rule). Unknown combinations fall back to 2h.
   ============================================================ */

const MCQ_MINUTES = 30;
const DEFAULT_STRUCTURED_MINUTES = 120;

/** minutes, keyed by normalized subject -> paper number */
const STRUCTURED_MINUTES: Record<string, Record<string, number>> = {
  chemistry: { "2": 105, "3": 90, "4": 60 },
  physics: { "2": 105, "3": 120, "4": 60 },
  biology: { "2": 105, "3": 75, "6": 60 },
  mathematics: { "1": 120, "2": 150 },
  "additional mathematics": { "1": 120, "2": 120 },
  "english language": { "1": 90, "2": 105 },
  islamiyat: { "1": 90, "2": 90 },
  "pakistan studies": { "1": 90, "2": 90 },
  economics: { "2": 135 },
  accounting: { "2": 120 },
  commerce: { "2": 120 },
  sociology: { "1": 105, "2": 105 },
  statistics: { "1": 135, "2": 135 },
  geography: { "1": 105, "2": 90 },
  history: { "1": 120, "2": 120 },
  "environmental management": { "1": 90, "2": 90 },
  "religious studies": { "1": 120, "2": 120 },
};

function normalizeSubject(subject: string): string {
  return subject.trim().toLowerCase();
}

/** "Paper_2" / "P2" / "2" -> "2" */
function paperNumber(paper: string): string {
  const match = paper.match(/\d+/);
  return match ? match[0] : "";
}

export function paperDurationSeconds(subject: string, paper: string, isMcq: boolean): number {
  if (isMcq) return MCQ_MINUTES * 60;
  const minutes = STRUCTURED_MINUTES[normalizeSubject(subject)]?.[paperNumber(paper)] ?? DEFAULT_STRUCTURED_MINUTES;
  return minutes * 60;
}

/** "1h 45m" style label for a duration in seconds. */
export function durationLabel(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/** mm:ss (or h:mm:ss) clock string from seconds. */
export function clockLabel(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
