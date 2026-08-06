import { apiCall } from "./api";
import { PickedQuestion } from "./questionBank";

/** Custom questions client (backend /custom-questions). Spec §5.4. */

export type CustomQuestionType = "mcq" | "structured" | "extended";

export interface Criterion {
  id?: string;
  criterion_text: string;
  marks: number;
  order_index?: number;
}

export interface CustomQuestion {
  id: string;
  owner_clerk_id: string;
  subject: string;
  syllabus_code: string | null;
  topic: string | null;
  sub_topic: string | null;
  question_text: string;
  question_type: CustomQuestionType;
  marks: number;
  shared_to_institution: boolean;
  created_at: string;
  is_owner?: boolean;
  criteria: Criterion[];
}

export interface CreateCustomQuestionInput {
  subject: string;
  syllabus_code?: string;
  topic?: string;
  sub_topic?: string;
  question_text: string;
  question_type: CustomQuestionType;
  criteria: Criterion[];
  shared_to_institution?: boolean;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export async function listCustomQuestions(subject?: string): Promise<CustomQuestion[]> {
  const q = subject ? `?subject=${encodeURIComponent(subject)}` : "";
  return json(await apiCall(`/custom-questions${q}`));
}

export async function createCustomQuestion(input: CreateCustomQuestionInput): Promise<CustomQuestion> {
  return json(
    await apiCall("/custom-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function updateCustomQuestion(id: string, patch: Partial<CreateCustomQuestionInput>): Promise<CustomQuestion> {
  return json(
    await apiCall(`/custom-questions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
  );
}

export async function deleteCustomQuestion(id: string): Promise<void> {
  await json(await apiCall(`/custom-questions/${id}`, { method: "DELETE" }));
}

export function customToPicked(q: CustomQuestion): PickedQuestion {
  return {
    key: q.id,
    source: "custom",
    custom_question_id: q.id,
    question_ref: q.id,
    questionNumber: "C",
    topic: q.topic || "",
    text: q.question_text,
    marks: q.marks,
    snapshot: {
      topic: q.topic,
      type: q.question_type,
      subject: q.subject,
      text: q.question_text.slice(0, 400),
      custom: true,
    },
  };
}
