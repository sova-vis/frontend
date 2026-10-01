import { apiCall } from "./api";

/** Assignments API client (backend /assignments routes). */

export type SourceMode = "full_paper" | "selected" | "topic";
export type AssignmentStatus = "draft" | "scheduled" | "published" | "closed";
export type MarkSchemeVisibility = "never" | "after_submission" | "after_deadline" | "after_release";

export interface AssignmentRules {
  deadline_at?: string | null;
  timed?: boolean;
  duration_minutes?: number | null;
  attempt_limit?: number | null;
  mark_scheme_visibility?: MarkSchemeVisibility;
}

export interface AssignmentQuestionInput {
  source?: "bank" | "custom";
  question_uid?: string;
  custom_question_id?: string;
  question_ref?: string;
  marks?: number | null;
  order_index?: number;
  excluded?: boolean;
  snapshot?: Record<string, unknown>;
}

export interface Assignment {
  id: string;
  class_id: string;
  owner_clerk_id: string;
  title: string;
  source_mode: SourceMode;
  source_meta: Record<string, unknown>;
  status: AssignmentStatus;
  deadline_at: string | null;
  timed: boolean;
  duration_minutes: number | null;
  attempt_limit: number | null;
  mark_scheme_visibility: MarkSchemeVisibility;
  total_marks: number;
  target_all: boolean;
  scheduled_publish_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  question_count?: number;
  pending_reviews?: number;
  can_grade?: boolean;
  is_owner?: boolean;
  questions?: AssignmentQuestionRow[];
  recipient_ids?: string[];
}

export interface AssignmentQuestionRow {
  id: string;
  source?: "bank" | "custom";
  question_uid: string | null;
  custom_question_id?: string | null;
  question_ref: string | null;
  order_index: number;
  marks: number | null;
  excluded: boolean;
  snapshot: Record<string, unknown>;
}

export interface CreateAssignmentInput {
  class_id: string;
  title: string;
  source_mode: SourceMode;
  source_meta?: Record<string, unknown>;
  questions: AssignmentQuestionInput[];
  rules?: AssignmentRules;
  target_all?: boolean;
  recipient_ids?: string[];
  status?: "draft" | "published" | "scheduled";
  scheduled_publish_at?: string | null;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export async function listAssignments(classId?: string): Promise<Assignment[]> {
  const q = classId ? `?class_id=${classId}` : "";
  return json(await apiCall(`/assignments${q}`));
}

export async function getAssignment(id: string): Promise<Assignment> {
  return json(await apiCall(`/assignments/${id}`));
}

/** A full assignment question (text, options, every part, images, answer + scheme)
 *  for the teacher to review — shaped for fromBankQuestion(). */
export interface FullAssignmentQuestion {
  assignment_question_id: string;
  uid: string; id: string; subject: string;
  type: "mcq" | "structured";
  year: string; session: string; paper: string; variant: string;
  questionNumber: string; topic: string; theme: string;
  questionText: string; marks: number | null;
  options: { label: string; text: string }[];
  correctOption: string | null; markingScheme: string;
  images: { src: string; alt?: string; caption?: string | null; role?: string }[];
  parts: { label: string; body: string; marks: number | null; answer: string | null; images?: { src: string; alt?: string; caption?: string | null; role?: string }[] }[];
}

export async function getAssignmentFullQuestions(id: string): Promise<FullAssignmentQuestion[]> {
  const d = await json<{ questions: FullAssignmentQuestion[] }>(await apiCall(`/assignments/${id}/full-questions`));
  return d.questions;
}

export async function createAssignment(input: CreateAssignmentInput): Promise<Assignment> {
  return json(
    await apiCall("/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function updateAssignment(id: string, patch: Partial<CreateAssignmentInput>): Promise<Assignment> {
  return json(
    await apiCall(`/assignments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
  );
}

export async function publishAssignment(id: string, scheduledPublishAt?: string): Promise<Assignment> {
  return json(
    await apiCall(`/assignments/${id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduled_publish_at: scheduledPublishAt ?? null }),
    })
  );
}

export async function duplicateAssignment(
  id: string,
  opts: { target_class_id?: string; deadline_at?: string } = {}
): Promise<Assignment> {
  return json(
    await apiCall(`/assignments/${id}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    })
  );
}

export async function deleteAssignment(id: string): Promise<void> {
  await json(await apiCall(`/assignments/${id}`, { method: "DELETE" }));
}

export const VISIBILITY_LABELS: Record<MarkSchemeVisibility, string> = {
  never: "Never shown",
  after_submission: "After submission",
  after_deadline: "After deadline",
  after_release: "After results released",
};
