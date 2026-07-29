/* ============================================================
   PROPEL — AI Paper Generator (Phase 5)
   Randomly samples real past-paper questions (weighted to the
   student's weak topics), sized to a time budget, then sends them
   to Grok to be lightly polished so the paper reads cleanly.
   ============================================================ */

type GetTokenFn = () => Promise<string | null>;

export interface GenPart { label: string; body: string; marks: number | null; answer: string | null }
export interface GenOption { label: string; text: string }
export interface GenQuestion {
  id: string;
  type: "mcq" | "structured";
  subject: string;
  topic: string;
  questionText: string;
  marks: number | null;
  options: GenOption[];
  correctOption: string | null;
  markingScheme: string;
  parts: GenPart[];
}

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const estMinutes = (q: GenQuestion) => (q.type === "mcq" ? 1 : Math.max(2, Math.round((q.marks || 4) * 1.2)));

type ApiQuestion = {
  id: string; type: "mcq" | "structured"; subject?: string; topic?: string; questionText?: string; marks?: number | null;
  options?: GenOption[]; correctOption?: string | null; markingScheme?: string; parts?: GenPart[];
};

function toGen(q: ApiQuestion, subject: string): GenQuestion {
  return {
    id: q.id,
    type: q.type,
    subject: q.subject || subject,
    topic: q.topic || "",
    questionText: q.questionText || "",
    marks: q.marks ?? null,
    options: Array.isArray(q.options) ? q.options : [],
    correctOption: q.correctOption ?? null,
    markingScheme: q.markingScheme || "",
    parts: Array.isArray(q.parts) ? q.parts : [],
  };
}

async function fetchTopics(subject: string): Promise<{ structured: string[]; mcq: string[] }> {
  try {
    const res = await fetch(`/api/paper-practice?subject=${encodeURIComponent(subject)}`);
    if (!res.ok) return { structured: [], mcq: [] };
    const data = (await res.json()) as { subject?: { types: { structured: { topics: { name: string }[] }; mcq: { topics: { name: string }[] } } } };
    return {
      structured: (data.subject?.types.structured.topics ?? []).map((t) => t.name),
      mcq: (data.subject?.types.mcq.topics ?? []).map((t) => t.name),
    };
  } catch { return { structured: [], mcq: [] }; }
}

async function fetchTopicQuestions(subject: string, type: "structured" | "mcq", topic: string): Promise<GenQuestion[]> {
  try {
    const params = new URLSearchParams({ subject, type, topic, mode: "topic", limit: "8", offset: "0" });
    const res = await fetch(`/api/paper-practice?${params.toString()}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { questions?: ApiQuestion[] };
    return (data.questions ?? []).map((q) => toGen(q, subject));
  } catch { return []; }
}

async function polish(questions: GenQuestion[], getToken?: GetTokenFn): Promise<GenQuestion[]> {
  if (!getToken || questions.length === 0) return questions;
  try {
    const token = await getToken();
    if (!token) return questions;
    const res = await fetch(`${apiBase()}/insights/polish-paper`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ questions: questions.map((q) => ({ id: q.id, questionText: q.questionText })) }),
    });
    if (!res.ok) return questions;
    const data = (await res.json()) as { questions?: { id: string; questionText: string }[] };
    const byId = new Map((data.questions ?? []).map((q) => [q.id, q.questionText]));
    return questions.map((q) => ({ ...q, questionText: byId.get(q.id) || q.questionText }));
  } catch { return questions; }
}

export interface GeneratedPaper {
  questions: GenQuestion[];
  totalMarks: number;
  estimatedMinutes: number;
}

/** Assemble a mixed paper across subjects, weighted to weak topics, sized to a time budget, then AI-polished. */
export async function generatePaper(opts: { subjects: string[]; minutes: number; weakTopics: string[]; getToken?: GetTokenFn }): Promise<GeneratedPaper> {
  const pool: GenQuestion[] = [];
  const weakLower = opts.weakTopics.map((t) => t.toLowerCase());

  for (const subject of opts.subjects) {
    const topics = await fetchTopics(subject);
    const pick = (all: string[]) => {
      const weakFirst = all.filter((t) => weakLower.includes(t.toLowerCase()));
      return Array.from(new Set([...weakFirst, ...shuffle(all)])).slice(0, 2);
    };
    for (const topic of pick(topics.structured)) pool.push(...(await fetchTopicQuestions(subject, "structured", topic)));
    for (const topic of pick(topics.mcq)) pool.push(...(await fetchTopicQuestions(subject, "mcq", topic)));
  }

  // greedily fill the time budget from a shuffled pool, keeping a mix
  const shuffled = shuffle(pool);
  const picked: GenQuestion[] = [];
  const seen = new Set<string>();
  let minutes = 0;
  for (const q of shuffled) {
    if (seen.has(q.id) || !q.questionText.trim()) continue;
    const est = estMinutes(q);
    if (minutes + est > opts.minutes + 2 && picked.length > 0) continue;
    picked.push(q); seen.add(q.id); minutes += est;
    if (picked.length >= 20 || minutes >= opts.minutes) break;
  }
  // order: MCQs first, then structured (like a real paper section split)
  picked.sort((a, b) => (a.type === b.type ? 0 : a.type === "mcq" ? -1 : 1));

  const polished = await polish(picked, opts.getToken);
  const totalMarks = polished.reduce((s, q) => s + (q.type === "mcq" ? 1 : q.marks || (q.parts.reduce((m, p) => m + (p.marks || 0), 0) || 4)), 0);
  return { questions: polished, totalMarks, estimatedMinutes: minutes };
}
