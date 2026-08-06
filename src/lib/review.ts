import { apiCall } from "./api";

/** Grading review client (backend /review routes). Spec feature group 9. */

export interface ReviewCriterion {
  criterion_text: string;
  marks_available: number;
  marks_awarded: number;
  awarded: boolean;
  reasoning: string;
  confidence: number | null;
}

export interface QueueItem {
  mark_id: string;
  submission_id: string;
  assignment_question_id: string;
  student_name: string;
  question: { number: string | number; topic: string | null; marks: number | null; text: string; type: "mcq" | "theory" };
  answer: { text: string | null; selected_option: string | null; ocr_text: string | null; ocr_status: string; images: unknown[] };
  ai_criteria: ReviewCriterion[];
  final_criteria: ReviewCriterion[] | null;
  criterion_comments: { index: number; text: string }[];
  ai_score: number | null;
  ai_marks_available: number | null;
  final_score: number | null;
  confidence: number | null;
  status: string;
  flagged: boolean;
  examiner_note: string | null;
}

export interface QueueResponse {
  assignment: { id: string; title: string; can_grade: boolean };
  threshold: number;
  counts: Record<string, number>;
  items: QueueItem[];
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export async function getQueue(assignmentId: string, filter = "all"): Promise<QueueResponse> {
  return json(await apiCall(`/review/queue?assignment_id=${assignmentId}&filter=${filter}`));
}

export async function approveMark(markId: string): Promise<void> {
  await json(await apiCall(`/review/marks/${markId}/approve`, { method: "POST" }));
}

export async function overrideMark(markId: string, criteria: { awarded: boolean; marks_awarded?: number }[]): Promise<{ final_score: number }> {
  return json(
    await apiCall(`/review/marks/${markId}/override`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ criteria }),
    })
  );
}

export async function flagMark(markId: string, flagged: boolean, reason?: string): Promise<void> {
  await json(
    await apiCall(`/review/marks/${markId}/flag`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flagged, reason }),
    })
  );
}

export async function bulkApprove(assignmentId: string, threshold?: number): Promise<{ approved: number; threshold: number }> {
  return json(
    await apiCall(`/review/bulk-approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignment_id: assignmentId, threshold }),
    })
  );
}

export async function sampleAssignment(assignmentId: string, rate: number): Promise<{ total: number; sample_size: number; rate: number; sample_ids: string[] }> {
  return json(
    await apiCall(`/review/sample`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignment_id: assignmentId, rate }),
    })
  );
}

export async function approveRemainder(assignmentId: string, rate: number, overrideRate: number): Promise<{ approved: number }> {
  return json(
    await apiCall(`/review/approve-remainder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignment_id: assignmentId, rate, override_rate: overrideRate }),
    })
  );
}

export async function getReviewSettings(): Promise<{ auto_approve_threshold: number; floor: number | null }> {
  return json(await apiCall(`/review/settings`));
}

export async function setThreshold(value: number): Promise<{ auto_approve_threshold: number; floor: number | null }> {
  return json(
    await apiCall(`/review/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auto_approve_threshold: value }),
    })
  );
}
