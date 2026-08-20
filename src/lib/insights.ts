/* ============================================================
   PROPEL — Phase 1 performance insights (client)
   Captures every graded attempt (MCQ + written) with its concept
   (topic), verdict, marks and reason, and aggregates it into the
   Mistake Notebook + Weakness Map. Backed by /insights/attempts,
   mirrored to localStorage for instant reads.
   ============================================================ */

import type { GradedQuestion } from "./practiceProgress";
import { clerkFetch, resolveClerkToken, type GetTokenFn } from "./clerkToken";

export type AttemptVerdict = "correct" | "partial" | "weak" | "unanswered" | "incorrect";

export interface Attempt {
  id: string;
  questionId: string;
  subject: string;
  topic: string;
  theme?: string;
  type: "mcq" | "structured";
  verdict: AttemptVerdict;
  earned: number;
  max: number;
  reason: string;
  year?: string;
  session?: string;
  paper?: string;
  variant?: string;
  at: string;
}

/** Minimal question shape the builders need (PracticeQuestion is assignable). */
export interface QuestionMeta {
  id: string;
  subject: string;
  topic: string;
  theme?: string;
  questionNumber?: string;
  year?: string;
  session?: string;
  paper?: string;
  variant?: string;
  marks?: number | null;
  correctOption?: string | null;
}

const STORAGE_KEY = "propel_attempts";

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
}

const nowIso = () => new Date().toISOString();
const clean = (v: string | null | undefined) => (v ?? "").toString().trim();

/* ---------------- builders ---------------- */

export function attemptFromMcq(q: QuestionMeta, chosen: string | undefined, correct: string | null | undefined): Attempt {
  const max = Math.max(1, Number(q.marks ?? 1) || 1);
  const answered = Boolean(clean(chosen));
  const isCorrect = answered && Boolean(correct) && chosen === correct;
  const at = nowIso();
  return {
    id: `${q.id}_${at}`,
    questionId: q.id,
    subject: clean(q.subject),
    topic: clean(q.topic) || "Uncategorised",
    theme: clean(q.theme) || undefined,
    type: "mcq",
    verdict: isCorrect ? "correct" : answered ? "incorrect" : "unanswered",
    earned: isCorrect ? max : 0,
    max,
    reason: isCorrect ? "" : answered ? `Chose ${chosen}, correct answer ${correct ?? "?"}` : "Not answered",
    year: clean(q.year) || undefined,
    session: clean(q.session) || undefined,
    paper: clean(q.paper) || undefined,
    variant: clean(q.variant) || undefined,
    at,
  };
}

export function attemptFromGraded(q: QuestionMeta, g: GradedQuestion): Attempt {
  const at = nowIso();
  const reason = g.verdict === "correct" ? "" : (g.missingPoints[0] || g.feedback || "").slice(0, 300);
  return {
    id: `${q.id}_${at}`,
    questionId: q.id,
    subject: clean(q.subject),
    topic: clean(q.topic) || "Uncategorised",
    theme: clean(q.theme) || undefined,
    type: "structured",
    verdict: g.verdict,
    earned: g.earned,
    max: g.max,
    reason,
    year: clean(q.year) || undefined,
    session: clean(q.session) || undefined,
    paper: clean(q.paper) || undefined,
    variant: clean(q.variant) || undefined,
    at,
  };
}

/** Join a whole-paper report's per-question grades back to their topics. */
export function attemptsFromReport(perQuestion: GradedQuestion[], questions: QuestionMeta[]): Attempt[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const out: Attempt[] = [];
  for (const g of perQuestion) {
    const q = byId.get(g.id);
    if (!q) continue;
    out.push(attemptFromGraded(q, g));
  }
  return out;
}

/* ---------------- aggregation ---------------- */

export interface WeaknessTopic {
  key: string;
  topic: string;
  subject: string;
  attempts: number;
  correct: number;
  marksEarned: number;
  marksMax: number;
  accuracy: number; // marks-weighted %
  lastAt: string;
}

export function buildWeaknessMap(attempts: Attempt[]): WeaknessTopic[] {
  const map = new Map<string, WeaknessTopic>();
  for (const a of attempts) {
    const key = `${a.subject}|${a.topic}`;
    let w = map.get(key);
    if (!w) { w = { key, topic: a.topic, subject: a.subject, attempts: 0, correct: 0, marksEarned: 0, marksMax: 0, accuracy: 0, lastAt: a.at }; map.set(key, w); }
    w.attempts += 1;
    if (a.verdict === "correct") w.correct += 1;
    w.marksEarned += a.earned;
    w.marksMax += a.max;
    if ((a.at || "") > w.lastAt) w.lastAt = a.at;
  }
  const list = Array.from(map.values());
  for (const w of list) w.accuracy = w.marksMax ? Math.round((w.marksEarned / w.marksMax) * 100) : 0;
  return list;
}

/** Weakest concepts first (lowest accuracy), needing at least `min` attempts. */
export function weakestTopics(attempts: Attempt[], min = 1): WeaknessTopic[] {
  return buildWeaknessMap(attempts)
    .filter((w) => w.attempts >= min && w.topic && w.topic !== "Uncategorised")
    .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts);
}

/** The mistake notebook: non-correct attempts, newest first. */
export function mistakeList(attempts: Attempt[]): Attempt[] {
  return attempts
    .filter((a) => a.verdict !== "correct")
    .sort((a, b) => (b.at || "").localeCompare(a.at || ""));
}

/* ---------------- Phase 2 — momentum, spaced repetition, daily plan ---------------- */

const DAY = 86_400_000;
const dayKey = (iso: string) => (Number.isNaN(new Date(iso).getTime()) ? "" : new Date(iso).toISOString().slice(0, 10));

/** Soft consistency score (0-100) that decays gently — one missed day barely hurts. */
export function momentumScore(attempts: Attempt[], now = Date.now()): { score: number; activeDays: number; label: string } {
  const active = new Set(attempts.map((a) => dayKey(a.at)).filter(Boolean));
  const decay = 0.92;
  const window = 21;
  let score = 0;
  let recentActive = 0;
  for (let i = 0; i < window; i++) {
    const key = new Date(now - i * DAY).toISOString().slice(0, 10);
    if (active.has(key)) { score += Math.pow(decay, i); if (i < 14) recentActive += 1; }
  }
  const maxScore = (1 - Math.pow(decay, window)) / (1 - decay);
  const pct = Math.round(Math.min(100, (score / maxScore) * 100));
  const label = pct >= 70 ? "On fire" : pct >= 40 ? "Steady" : pct >= 15 ? "Warming up" : "Let's begin";
  return { score: pct, activeDays: recentActive, label };
}

/** Leitner-style spaced repetition intervals (days) by box. */
const SRS_INTERVALS = [1, 3, 7, 21, 60];

export interface RevisionItem {
  key: string;
  topic: string;
  subject: string;
  box: number;         // 1..5 mastery level
  lastAt: string;
  nextDueAt: string;
  due: boolean;
}

export function buildRevisionSchedule(attempts: Attempt[], now = Date.now()): RevisionItem[] {
  const byTopic = new Map<string, Attempt[]>();
  for (const a of attempts) {
    if (!a.topic || a.topic === "Uncategorised") continue;
    const key = `${a.subject}|${a.topic}`;
    const list = byTopic.get(key) ?? [];
    list.push(a);
    byTopic.set(key, list);
  }
  const items: RevisionItem[] = [];
  for (const [key, list] of Array.from(byTopic.entries())) {
    const ordered = list.slice().sort((a, b) => (a.at || "").localeCompare(b.at || ""));
    let box = 0;
    for (const a of ordered) box = a.verdict === "correct" ? Math.min(box + 1, SRS_INTERVALS.length) : 0;
    if (box < 1) continue; // only schedule topics mastered at least once
    const last = ordered[ordered.length - 1];
    const interval = SRS_INTERVALS[Math.min(box - 1, SRS_INTERVALS.length - 1)];
    const nextDueAt = new Date(new Date(last.at).getTime() + interval * DAY).toISOString();
    items.push({ key, topic: list[0].topic, subject: list[0].subject, box, lastAt: last.at, nextDueAt, due: new Date(nextDueAt).getTime() <= now });
  }
  return items.sort((a, b) => (a.nextDueAt || "").localeCompare(b.nextDueAt || ""));
}

export function dueRevisions(attempts: Attempt[], now = Date.now()): RevisionItem[] {
  return buildRevisionSchedule(attempts, now).filter((r) => r.due);
}

export interface PlanItem {
  kind: "practice" | "revise" | "mistakes";
  label: string;
  detail: string;
  minutes: number;
  href: string;
  icon: string;
}

/** A concrete daily study list built from weaknesses, due revisions and mistakes. */
export function buildDailyPlan(attempts: Attempt[], now = Date.now()): { items: PlanItem[]; totalMinutes: number } {
  const weak = weakestTopics(attempts, 1);
  const due = dueRevisions(attempts, now);
  const mistakes = mistakeList(attempts);
  const items: PlanItem[] = [];
  const seen = new Set<string>();

  for (const w of weak.slice(0, 2)) {
    seen.add(w.key);
    items.push({
      kind: "practice",
      label: `Practise ${w.topic}`,
      detail: `${w.subject} · currently ${w.accuracy}%`,
      minutes: 12,
      href: `/student/paper-practice?subject=${encodeURIComponent(w.subject)}&topic=${encodeURIComponent(w.topic)}`,
      icon: "sparkles",
    });
  }
  for (const r of due.slice(0, 2)) {
    if (seen.has(r.key)) continue;
    items.push({
      kind: "revise",
      label: `Revise ${r.topic}`,
      detail: `${r.subject} · due for revision`,
      minutes: 6,
      href: `/student/paper-practice?subject=${encodeURIComponent(r.subject)}&topic=${encodeURIComponent(r.topic)}`,
      icon: "rotate",
    });
  }
  if (mistakes.length > 0) {
    const n = Math.min(mistakes.length, 5);
    items.push({ kind: "mistakes", label: `Review ${n} mistake${n === 1 ? "" : "s"}`, detail: "From your notebook", minutes: n * 2, href: "/student/notebook", icon: "target" });
  }
  return { items, totalMinutes: items.reduce((s, i) => s + i.minutes, 0) };
}

/* ---------------- Phase 4 — prediction & forecasting ---------------- */

const GRADE_BANDS = [
  { grade: "A*", min: 90 }, { grade: "A", min: 80 }, { grade: "B", min: 70 },
  { grade: "C", min: 60 }, { grade: "D", min: 50 }, { grade: "E", min: 40 }, { grade: "U", min: 0 },
];

function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
function normCdf(x: number, mean: number, sd: number): number {
  return 0.5 * (1 + erf((x - mean) / (sd * Math.SQRT2)));
}

const overallPercent = (list: Attempt[]) => {
  const mx = list.reduce((s, a) => s + a.max, 0);
  return mx ? (list.reduce((s, a) => s + a.earned, 0) / mx) * 100 : 0;
};

export interface GradePrediction {
  grade: string;
  percent: number;
  confidence: number;
  borderline: boolean;
  bands: { grade: string; prob: number }[];
  sampleSize: number;
}

/** Continuously estimated grade with a probability spread across bands. */
export function predictedGrade(attempts: Attempt[]): GradePrediction | null {
  if (attempts.length < 5) return null;
  const marksMax = attempts.reduce((s, a) => s + a.max, 0);
  if (marksMax === 0) return null;
  const percent = Math.round(overallPercent(attempts));
  const idx = GRADE_BANDS.findIndex((b) => percent >= b.min);
  const band = GRADE_BANDS[idx];
  const higher = GRADE_BANDS[idx - 1];
  const borderline = Boolean(higher) && higher.min - percent <= 4;
  const grade = borderline ? `${higher.grade}/${band.grade}` : band.grade;
  const confidence = Math.min(92, 45 + Math.round(attempts.length * 1.5));

  const sigma = 8;
  const bands = GRADE_BANDS.map((b, i) => {
    const upper = i === 0 ? 101 : GRADE_BANDS[i - 1].min;
    const mass = normCdf(upper, percent, sigma) - normCdf(b.min, percent, sigma);
    return { grade: b.grade, prob: Math.max(0, mass) };
  });
  const total = bands.reduce((s, b) => s + b.prob, 0) || 1;
  bands.forEach((b) => { b.prob = Math.round((b.prob / total) * 100); });
  return { grade, percent, confidence, borderline, bands: bands.filter((b) => b.prob >= 1), sampleSize: attempts.length };
}

export interface ReadinessPoint { label: string; percent: number; }
export interface ReadinessTimeline { current: number; ratePerWeek: number; points: ReadinessPoint[]; }

/** Project readiness forward from the recent improvement trend. */
export function readinessTimeline(attempts: Attempt[], examDate: Date, now = Date.now()): ReadinessTimeline | null {
  if (attempts.length < 5) return null;
  const current = Math.round(overallPercent(attempts));
  const recent = attempts.filter((a) => now - new Date(a.at).getTime() <= 14 * DAY);
  const prior = attempts.filter((a) => { const d = now - new Date(a.at).getTime(); return d > 14 * DAY && d <= 28 * DAY; });
  let ratePerWeek = 0;
  if (recent.length >= 3 && prior.length >= 3) ratePerWeek = (overallPercent(recent) - overallPercent(prior)) / 2;
  ratePerWeek = Math.max(-5, Math.min(8, ratePerWeek));
  const project = (weeks: number) => Math.round(Math.max(0, Math.min(100, current + ratePerWeek * weeks)));
  const weeksToExam = Math.max(0, (examDate.getTime() - now) / (7 * DAY));
  const points: ReadinessPoint[] = [
    { label: "Today", percent: current },
    { label: "In 2 weeks", percent: project(2) },
    { label: "In 1 month", percent: project(4) },
  ];
  if (weeksToExam > 4.5) points.push({ label: "Exam day", percent: project(weeksToExam) });
  return { current, ratePerWeek: Math.round(ratePerWeek * 10) / 10, points };
}

export type ReadinessStatus = "mastered" | "needs-work" | "weak";
export interface TopicStatus extends WeaknessTopic { status: ReadinessStatus; }

/** Per-topic status instead of one blended percentage. */
export function topicReadiness(attempts: Attempt[]): { mastered: TopicStatus[]; needsWork: TopicStatus[]; weak: TopicStatus[] } {
  const withStatus: TopicStatus[] = buildWeaknessMap(attempts)
    .filter((w) => w.topic && w.topic !== "Uncategorised")
    .map((w) => ({ ...w, status: w.accuracy >= 75 ? "mastered" : w.accuracy >= 50 ? "needs-work" : "weak" }));
  return {
    mastered: withStatus.filter((t) => t.status === "mastered").sort((a, b) => b.accuracy - a.accuracy),
    needsWork: withStatus.filter((t) => t.status === "needs-work").sort((a, b) => a.accuracy - b.accuracy),
    weak: withStatus.filter((t) => t.status === "weak").sort((a, b) => a.accuracy - b.accuracy),
  };
}

/* ---------------- Pattern detection (Grok, cached server-side) ---------------- */

export interface PatternResult {
  patterns: { title: string; detail: string }[];
  generatedAt: string;
  basedOnCount: number;
}

export async function loadPatterns(getToken?: GetTokenFn, refresh = false): Promise<PatternResult | null> {
  const headers = await authHeader(getToken);
  if (!headers) return null;
  try {
    const res = await clerkFetch(`${apiBase()}/insights/patterns${refresh ? "?refresh=1" : ""}`, {
      method: refresh ? "POST" : "GET",
      headers,
    }, getToken);
    if (!res.ok) return null;
    return (await res.json()) as PatternResult;
  } catch { return null; }
}

/* ---------------- storage / API ---------------- */

function readLocal(): Attempt[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as Attempt[]) : [];
  } catch { return []; }
}

function writeLocal(items: Attempt[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 3000))); } catch {}
}

async function authHeader(getToken?: GetTokenFn): Promise<Record<string, string> | null> {
  const t = await resolveClerkToken(getToken);
  return t ? { Authorization: `Bearer ${t}` } : null;
}

/** Persist a batch of attempts (fire-and-forget friendly); updates local mirror. */
export async function logAttempts(records: Attempt[], getToken?: GetTokenFn): Promise<void> {
  if (!records.length) return;
  writeLocal([...records, ...readLocal()]);
  if (typeof window !== "undefined") window.dispatchEvent(new Event("propel:attempts-change"));
  const headers = await authHeader(getToken);
  if (!headers) return;
  try {
    const res = await clerkFetch(`${apiBase()}/insights/attempts`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ items: records }),
    }, getToken);
    if (res.ok) {
      const payload = (await res.json()) as { items?: Attempt[] };
      if (Array.isArray(payload.items)) {
        writeLocal(payload.items);
        if (typeof window !== "undefined") window.dispatchEvent(new Event("propel:attempts-change"));
      }
    }
  } catch {}
}

/** Synchronous read of the local mirror — for instant first paint before revalidation. */
export function loadAttemptsLocal(): Attempt[] {
  return readLocal();
}

/** Load all attempts (server authoritative, local fallback). */
export async function loadAttempts(getToken?: GetTokenFn): Promise<Attempt[]> {
  const local = readLocal();
  const headers = await authHeader(getToken);
  if (!headers) return local;
  try {
    const res = await clerkFetch(`${apiBase()}/insights/attempts`, { headers }, getToken);
    if (!res.ok) return local;
    const payload = (await res.json()) as { items?: Attempt[] };
    if (!Array.isArray(payload.items)) return local;
    writeLocal(payload.items);
    return payload.items;
  } catch { return local; }
}
