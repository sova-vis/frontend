import { apiCall } from "./api";

/** Submissions client — student take/submit + teacher tracking (FG7/FG8). */

export interface AvailableAssignment {
  id: string;
  title: string;
  deadline_at: string | null;
  timed: boolean;
  duration_minutes: number | null;
  submission_id: string | null;
  submission_status: "not_started" | "in_progress" | "submitted" | "late" | "returned";
}

export interface StudentQuestion {
  assignment_question_id: string;
  order_index: number;
  type: "mcq" | "theory";
  question_text: string;
  options: { label: string; text: string }[];
  marks: number;
}

export interface SavedAnswer {
  assignment_question_id: string;
  answer_text: string | null;
  selected_option: string | null;
  answered: boolean;
}

export interface StartSubmissionResponse {
  submission: { id: string; status: string; attempt_number: number };
  assignment: {
    id: string;
    title: string;
    deadline_at: string | null;
    timed: boolean;
    duration_minutes: number | null;
    effective_deadline: string | null;
  };
  questions: StudentQuestion[];
  answers: SavedAnswer[];
  read_only: boolean;
}

export interface StatusBoardRow {
  student_clerk_id: string;
  full_name: string | null;
  email: string | null;
  submission_id: string | null;
  status: "not_started" | "in_progress" | "submitted" | "late" | "missed" | "returned";
  submitted_at: string | null;
  extension_until: string | null;
  total_score: number | null;
  total_marks: number | null;
}

export interface StatusBoard {
  assignment: { id: string; title: string; deadline_at: string | null; total: number };
  counts: Record<string, number>;
  rows: StatusBoardRow[];
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

// ---- Student ----
export async function getAvailableAssignments(): Promise<AvailableAssignment[]> {
  return json(await apiCall("/submissions/available"));
}

export async function startSubmission(assignmentId: string): Promise<StartSubmissionResponse> {
  return json(
    await apiCall("/submissions/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignment_id: assignmentId }),
    })
  );
}

export async function saveAnswer(
  submissionId: string,
  assignmentQuestionId: string,
  answer: { answer_text?: string; selected_option?: string }
): Promise<void> {
  await json(
    await apiCall(`/submissions/${submissionId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignment_question_id: assignmentQuestionId, ...answer }),
    })
  );
}

export async function submitSubmission(submissionId: string, timeSpentSeconds?: number): Promise<{ status: string }> {
  return json(
    await apiCall(`/submissions/${submissionId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ time_spent_seconds: timeSpentSeconds }),
    })
  );
}

// ---- Teacher ----
export async function getStatusBoard(assignmentId: string): Promise<StatusBoard> {
  return json(await apiCall(`/submissions/assignment/${assignmentId}`));
}

export async function extendDeadline(
  assignmentId: string,
  extensionUntil: string,
  studentClerkIds?: string[]
): Promise<{ extended: number }> {
  return json(
    await apiCall(`/submissions/assignment/${assignmentId}/extend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extension_until: extensionUntil, student_clerk_ids: studentClerkIds }),
    })
  );
}

export async function reopenSubmission(submissionId: string, reason?: string): Promise<{ withdrawn: boolean }> {
  return json(
    await apiCall(`/submissions/${submissionId}/reopen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    })
  );
}

export const STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
  late: "Late",
  missed: "Missed",
  returned: "Reopened",
};

export const STATUS_STYLE: Record<string, string> = {
  not_started: "bg-surface-soft text-ink-muted",
  in_progress: "ed-pill-gold",
  submitted: "ed-pill-mint",
  late: "ed-pill-clay",
  missed: "ed-pill-crimson",
  returned: "ed-pill-gold",
};
