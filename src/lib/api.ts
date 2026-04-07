/**
 * Helper to get the API base URL from environment or fallback to localhost
 */
export function getApiUrl(): string {
  if (typeof window !== "undefined") {
    // Client-side
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  }
  // Server-side
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
}

/**
 * Fetch wrapper that uses the correct API URL
 */
export async function apiCall(
  endpoint: string,
  options?: RequestInit
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = `${baseUrl}${endpoint}`;
  return fetch(url, options);
}

export interface QaGradingRequest {
  question: string;
  student_answer: string;
  marking_scheme_answer?: string;
  subject?: string;
  year?: number;
  session?: string;
  paper?: string;
  variant?: string;
  question_id?: string;
  debug?: boolean;
}

export interface QaGradingResponse {
  status: "accepted" | "review_required" | "failed";
  score: number;
  score_percent: number;
  grade_label: "fully_correct" | "partially_correct" | "weak";
  feedback: string;
  expected_points: string[];
  missing_points: string[];
  student_option: string | null;
  correct_option: string | null;
  grading_source: "grok" | "deterministic" | "pipeline";
  grading_model: string | null;
  question: string;
  student_answer: string;
  marking_scheme_answer: string;
  subject: string | null;
  timestamp: string;
}

export interface QaModeAPreviewResponse {
  request_id: string;
  extracted_question_text: string;
  extracted_student_answer: string;
  normalized_question_text: string;
  normalized_student_answer: string;
  vision_confidence: number;
  vision_warnings: string[];
  match_confidence: number;
  top1_top2_margin: number;
  auto_accept_eligible: boolean;
  auto_accept_reason: string;
  top_alternatives: Array<{
    question_id: string;
    match_confidence: number;
    question_text: string;
    source_paper_reference: string;
  }>;
  debug_run_id?: string | null;
}

export interface QaModeAConfirmRequest {
  question_text: string;
  student_answer?: string;
  subject?: string;
  year?: number;
  session?: string;
  paper?: string;
  variant?: string;
  question_id?: string;
  debug?: boolean;
}

async function parseJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("Invalid JSON response from server");
  }
}

export async function gradeQaAnswer(
  payload: QaGradingRequest
): Promise<QaGradingResponse> {
  const response = await apiCall("/qa-grading/evaluate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const message =
      typeof data.error === "string" && data.error.trim()
        ? data.error
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data as unknown as QaGradingResponse;
}

export async function previewQaGradingFromImage(
  payload: FormData
): Promise<QaModeAPreviewResponse> {
  const response = await apiCall("/qa-grading/evaluate-from-image/preview", {
    method: "POST",
    body: payload,
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    const message =
      typeof data.error === "string" && data.error.trim()
        ? data.error
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data as unknown as QaModeAPreviewResponse;
}

export async function confirmQaGradingFromImage(
  payload: QaModeAConfirmRequest
): Promise<QaGradingResponse> {
  const response = await apiCall("/qa-grading/evaluate-from-image/confirm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    const message =
      typeof data.error === "string" && data.error.trim()
        ? data.error
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data as unknown as QaGradingResponse;
}

export interface MentoringTeacher {
  clerk_id: string;
  full_name: string | null;
  email: string | null;
  role: "teacher";
  headline: string | null;
  bio: string | null;
  subjects: string[];
  availability: Array<{ day: string; start: string; end: string }>;
  meeting_provider: string;
  is_active: boolean;
}

export interface MentoringProfileSummary {
  clerk_id: string;
  full_name: string | null;
  email: string | null;
  role: "student" | "teacher" | "admin";
}

export interface MentoringMeeting {
  id: string;
  student_clerk_id: string;
  teacher_clerk_id: string;
  requested_at: string;
  start_time: string | null;
  end_time: string | null;
  status: "pending" | "accepted" | "scheduled" | "completed" | "cancelled" | "declined";
  agenda: string;
  note_from_student: string | null;
  teacher_notes: string | null;
  meeting_link: string | null;
  provider: string | null;
  created_at: string;
  updated_at: string;
  student_profile: MentoringProfileSummary | null;
  teacher_profile: MentoringProfileSummary | null;
}

export interface AdminUserRecord {
  clerk_id?: string;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  onboarding_complete?: boolean | null;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface MentoringConversation {
  id: string;
  student_clerk_id: string;
  teacher_clerk_id: string;
  created_at: string;
  updated_at: string;
  student_profile: MentoringProfileSummary | null;
  teacher_profile: MentoringProfileSummary | null;
}

export interface MentoringMessage {
  id: string;
  conversation_id: string;
  sender_clerk_id: string;
  sender_role: "student" | "teacher";
  body: string;
  created_at: string;
}

async function parseApiError(response: Response, fallback: string): Promise<never> {
  const payload = await response.json().catch(() => ({ error: fallback }));
  throw new Error(
    typeof payload.error === "string" && payload.error.trim() ? payload.error : fallback
  );
}

export async function getTeachers(token: string): Promise<MentoringTeacher[]> {
  const response = await apiCall("/mentoring/teachers", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    await parseApiError(response, "Failed to load teachers");
  }

  const payload = await response.json();
  return (payload.teachers ?? []) as MentoringTeacher[];
}

export async function requestMeeting(
  token: string,
  payload: {
    teacher_clerk_id: string;
    agenda: string;
    note_from_student?: string;
    preferred_start_time?: string;
    preferred_end_time?: string;
  }
): Promise<MentoringMeeting> {
  const response = await apiCall("/mentoring/meetings/request", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await parseApiError(response, "Failed to request meeting");
  }

  const body = await response.json();
  return body.meeting as MentoringMeeting;
}

export async function getMeetings(token: string, scope = "mine"): Promise<MentoringMeeting[]> {
  const response = await apiCall(`/mentoring/meetings?scope=${encodeURIComponent(scope)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    await parseApiError(response, "Failed to load meetings");
  }

  const payload = await response.json();
  return (payload.meetings ?? []) as MentoringMeeting[];
}

export async function updateMeeting(
  token: string,
  meetingId: string,
  payload: Partial<{
    status: string;
    start_time: string;
    end_time: string;
    meeting_link: string;
    provider: string;
    teacher_notes: string;
    note_from_student: string;
  }>
): Promise<MentoringMeeting> {
  const response = await apiCall(`/mentoring/meetings/${meetingId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await parseApiError(response, "Failed to update meeting");
  }

  const body = await response.json();
  return body.meeting as MentoringMeeting;
}

export async function deleteMeeting(token: string, meetingId: string): Promise<void> {
  const response = await apiCall(`/mentoring/meetings/${meetingId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    await parseApiError(response, "Failed to delete meeting");
  }
}

export async function getConversations(token: string): Promise<MentoringConversation[]> {
  const response = await apiCall("/mentoring/conversations", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    await parseApiError(response, "Failed to load conversations");
  }

  const payload = await response.json();
  return (payload.conversations ?? []) as MentoringConversation[];
}

export async function ensureConversation(token: string, partnerClerkId: string): Promise<MentoringConversation> {
  const response = await apiCall("/mentoring/conversations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ partner_clerk_id: partnerClerkId }),
  });

  if (!response.ok) {
    await parseApiError(response, "Failed to create conversation");
  }

  const payload = await response.json();
  return payload.conversation as MentoringConversation;
}

export async function getConversationMessages(token: string, conversationId: string): Promise<MentoringMessage[]> {
  const response = await apiCall(`/mentoring/conversations/${conversationId}/messages`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    await parseApiError(response, "Failed to load messages");
  }

  const payload = await response.json();
  return (payload.messages ?? []) as MentoringMessage[];
}

export async function sendConversationMessage(
  token: string,
  conversationId: string,
  message: string
): Promise<MentoringMessage> {
  const response = await apiCall(`/mentoring/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ body: message }),
  });

  if (!response.ok) {
    await parseApiError(response, "Failed to send message");
  }

  const payload = await response.json();
  return payload.message as MentoringMessage;
}

export async function deleteConversationMessage(
  token: string,
  conversationId: string,
  messageId: string
): Promise<void> {
  const response = await apiCall(`/mentoring/conversations/${conversationId}/messages/${messageId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    await parseApiError(response, "Failed to delete message");
  }
}

export async function getAdminUsers(token: string): Promise<Array<Record<string, unknown>>> {
  const response = await apiCall("/admin/users", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    await parseApiError(response, "Failed to load users");
  }

  const payload = await response.json();
  return (payload.users ?? []) as AdminUserRecord[];
}

export async function getAdminTeachers(token: string): Promise<MentoringTeacher[]> {
  const response = await apiCall("/admin/teachers", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    await parseApiError(response, "Failed to load teacher records");
  }

  const payload = await response.json();
  return (payload.teachers ?? []) as MentoringTeacher[];
}

export async function updateAdminTeacherProfile(
  token: string,
  teacherClerkId: string,
  payload: Partial<{
    headline: string;
    bio: string;
    subjects: string[];
    availability: Array<{ day: string; start: string; end: string }>;
    meeting_provider: string;
    is_active: boolean;
  }>
): Promise<Record<string, unknown>> {
  const response = await apiCall(`/admin/teacher-profile/${teacherClerkId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await parseApiError(response, "Failed to update teacher profile");
  }

  const body = await response.json();
  return body.teacher_profile as Record<string, unknown>;
}

export async function getAdminMeetings(token: string): Promise<MentoringMeeting[]> {
  const response = await apiCall("/admin/meetings", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    await parseApiError(response, "Failed to load meetings");
  }

  const payload = await response.json();
  return (payload.meetings ?? []) as MentoringMeeting[];
}
