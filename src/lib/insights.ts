/* ============================================================
   PROPEL — Phase 1 performance insights (client)
   Captures every graded attempt (MCQ + written) with its concept
   (topic), verdict, marks and reason, and aggregates it into the
   Mistake Notebook + Weakness Map. Backed by /insights/attempts,
   mirrored to localStorage for instant reads.
   ============================================================ */

import type { GradedQuestion } from "./practiceProgress";

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

type GetTokenFn = () => Promise<string | null>;

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
  if (!getToken) return null;
  try { const t = await getToken(); return t ? { Authorization: `Bearer ${t}` } : null; } catch { return null; }
}

/** Persist a batch of attempts (fire-and-forget friendly); updates local mirror. */
export async function logAttempts(records: Attempt[], getToken?: GetTokenFn): Promise<void> {
  if (!records.length) return;
  writeLocal([...records, ...readLocal()]);
  const headers = await authHeader(getToken);
  if (!headers) return;
  try {
    const res = await fetch(`${apiBase()}/insights/attempts`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ items: records }),
    });
    if (res.ok) {
      const payload = (await res.json()) as { items?: Attempt[] };
      if (Array.isArray(payload.items)) writeLocal(payload.items);
    }
  } catch {}
}

/** Load all attempts (server authoritative, local fallback). */
export async function loadAttempts(getToken?: GetTokenFn): Promise<Attempt[]> {
  const local = readLocal();
  const headers = await authHeader(getToken);
  if (!headers) return local;
  try {
    const res = await fetch(`${apiBase()}/insights/attempts`, { headers });
    if (!res.ok) return local;
    const payload = (await res.json()) as { items?: Attempt[] };
    if (!Array.isArray(payload.items)) return local;
    writeLocal(payload.items);
    return payload.items;
  } catch { return local; }
}
