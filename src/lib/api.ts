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
