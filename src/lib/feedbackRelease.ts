import { apiCall } from "./api";

/** Feedback (§10) + result release (§11) client. */

export interface ReleaseContent {
  marks: boolean;
  breakdown: boolean;
  comments: boolean;
  scheme_missed: boolean;
  ai_reasoning: boolean;
  examiner_notes: boolean;
}

export interface ReleaseStatus {
  auto_release: boolean;
  release_content: ReleaseContent;
  released_count: number;
  total: number;
  rows: { submission_id: string; student_name: string; released: boolean; withdrawn: boolean }[];
}

export interface CommentBankEntry {
  id: string;
  topic: string | null;
  text: string;
  shared_to_institution: boolean;
}

export interface StudentResult {
  released: boolean;
  assignment_title?: string;
  released_at?: string;
  total_score?: number | null;
  total_available?: number | null;
  overall_feedback?: string | null;
  questions?: {
    topic: string | null;
    number: string | number | null;
    score: number;
    available: number;
    criteria:
      | {
          criterion_text: string | null;
          awarded: boolean;
          marks_available: number;
          marks_awarded: number;
          reasoning: string | null;
          comment: string | null;
        }[]
      | null;
  }[];
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

// ---- Release ----
export async function getReleaseStatus(assignmentId: string): Promise<ReleaseStatus> {
  return json(await apiCall(`/release/assignment/${assignmentId}/status`));
}
export async function setReleaseConfig(assignmentId: string, patch: { auto_release?: boolean; release_content?: Partial<ReleaseContent> }): Promise<unknown> {
  return json(
    await apiCall(`/release/assignment/${assignmentId}/config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
  );
}
export async function releaseAll(assignmentId: string, mode: "all" | "reviewed" = "reviewed"): Promise<{ released: number }> {
  return json(
    await apiCall(`/release/assignment/${assignmentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    })
  );
}
export async function releaseOne(submissionId: string): Promise<void> {
  await json(await apiCall(`/release/submission/${submissionId}`, { method: "POST" }));
}

// ---- Feedback ----
export async function saveCriterionComment(markId: string, criterionIndex: number, text: string): Promise<void> {
  await json(
    await apiCall(`/feedback/marks/${markId}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ criterion_index: criterionIndex, text }),
    })
  );
}
export async function draftOverallFeedback(submissionId: string): Promise<{ draft: string }> {
  return json(await apiCall(`/feedback/submissions/${submissionId}/draft`, { method: "POST" }));
}
export async function saveOverallFeedback(submissionId: string, text: string, isDraft: boolean): Promise<void> {
  await json(
    await apiCall(`/feedback/submissions/${submissionId}/overall`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, is_draft: isDraft }),
    })
  );
}

// ---- Comment bank (§10.3) ----
export async function getCommentBank(topic?: string): Promise<CommentBankEntry[]> {
  const q = topic ? `?topic=${encodeURIComponent(topic)}` : "";
  return json(await apiCall(`/feedback/bank${q}`));
}
export async function addToCommentBank(text: string, topic?: string, shared = false): Promise<CommentBankEntry> {
  return json(
    await apiCall(`/feedback/bank`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, topic, shared_to_institution: shared }),
    })
  );
}

// §10.4 — apply guidance to every student who missed a criterion, in one step.
export async function applyMissedGuidance(
  assignmentId: string,
  assignmentQuestionId: string,
  criterionIndex: number,
  text: string
): Promise<{ applied: number }> {
  return json(
    await apiCall(`/feedback/assignment/${assignmentId}/question/${assignmentQuestionId}/apply-missed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ criterion_index: criterionIndex, text }),
    })
  );
}

// ---- Student results ----
export async function getStudentResult(assignmentId: string): Promise<StudentResult> {
  return json(await apiCall(`/submissions/result/${assignmentId}`));
}
