/**
 * Question-bank client for the teacher portal. Wraps the existing
 * /api/paper-practice route (schema-v2 `questions` bank) so assignment creation
 * can browse past papers and topics. Filters by the class's subject.
 */

export interface TypeMeta {
  total: number;
  years: { year: string; count: number }[];
  variants: { variant: string; count: number }[];
  topics: { name: string; count: number }[];
}

export interface SubjectMeta {
  name: string;
  types: { mcq: TypeMeta; structured: TypeMeta };
}

export interface PaperOption {
  year: string;
  session: string;
  paper: string;
  variant: string;
  count: number;
  isMcq: boolean;
  key: string;
  label: string;
}

export interface BankQuestionPart {
  label: string;
  body: string;
  marks: number | null;
  answer: string | null;
}

export interface BankQuestion {
  uid: string; // public.questions.id (uuid) — the assignment reference
  id: string; // human question_id
  subject: string;
  type: "mcq" | "structured";
  year: string;
  session: string;
  paper: string;
  variant: string;
  questionNumber: string;
  topic: string;
  theme: string;
  questionText: string;
  marks: number | null;
  options: { label: string; text: string }[];
  correctOption: string | null;
  markingScheme: string;
  images: { src: string; alt: string }[];
  parts: BankQuestionPart[];
}

async function bankFetch(params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/paper-practice?${qs}`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Bank request failed (${res.status})`);
  }
  return res.json();
}

export async function getSubjectMeta(subject: string): Promise<SubjectMeta | null> {
  const data = await bankFetch({ subject });
  return (data.subject as SubjectMeta) ?? null;
}

export async function getPapers(subject: string, type?: "mcq" | "structured", year?: string): Promise<PaperOption[]> {
  const params: Record<string, string> = { subject, papers: "1" };
  if (type) params.type = type;
  if (year) params.year = year;
  const data = await bankFetch(params);
  return (data.papers as PaperOption[]) ?? [];
}

export async function getWholePaper(
  subject: string,
  year: string,
  session: string,
  paper: string,
  variant: string
): Promise<BankQuestion[]> {
  const params: Record<string, string> = { subject, year, session, paper };
  if (variant) params.variant = variant;
  const data = await bankFetch(params);
  return (data.questions as BankQuestion[]) ?? [];
}

export async function getTopicQuestions(
  subject: string,
  type: "mcq" | "structured",
  topic: string,
  limit = 40,
  offset = 0
): Promise<{ questions: BankQuestion[]; total: number }> {
  const data = await bankFetch({
    subject,
    mode: "topic",
    type,
    topic,
    limit: String(limit),
    offset: String(offset),
  });
  return { questions: (data.questions as BankQuestion[]) ?? [], total: data.total ?? 0 };
}

/**
 * A question chosen for an assignment — unifies bank and custom sources so the
 * builder cart holds one shape (§5.4 — custom questions assign like bank ones).
 */
export interface PickedQuestion {
  key: string; // cart key: bank uid or custom id
  source: "bank" | "custom";
  question_uid?: string;
  custom_question_id?: string;
  question_ref?: string;
  questionNumber: string;
  topic: string;
  text: string;
  marks: number;
  snapshot: Record<string, unknown>;
}

export function bankToPicked(q: BankQuestion): PickedQuestion {
  return {
    key: q.uid,
    source: "bank",
    question_uid: q.uid,
    question_ref: q.id,
    questionNumber: q.questionNumber,
    topic: q.topic,
    text: q.questionText,
    marks: q.marks ?? 0,
    snapshot: questionSnapshot(q),
  };
}

/** Snapshot stored alongside an assignment question for display resilience. */
export function questionSnapshot(q: BankQuestion) {
  return {
    question_number: q.questionNumber,
    topic: q.topic,
    type: q.type,
    subject: q.subject,
    year: q.year,
    session: q.session,
    paper: q.paper,
    variant: q.variant,
    text: q.questionText.slice(0, 400),
  };
}

export function prettyPaperLabel(q: BankQuestion): string {
  return [q.year, q.session?.replace(/_/g, " "), q.paper?.replace(/_/g, " "), q.variant?.replace(/_/g, " ")]
    .filter(Boolean)
    .join(" · ");
}
