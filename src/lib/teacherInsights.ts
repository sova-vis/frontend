import { apiCall } from "./api";

/** Dashboard (§2) + insights (§12) + export (§13) client. */

export interface DashboardData {
  action_queue: { low_confidence: number; ready_bulk: number; ocr_failed: number; reviewed_unreleased: number };
  active_assignments: { id: string; title: string; class_name: string; submitted: number; total: number; late: number; deadline_at: string | null }[];
  class_pulse: { class_id: string; class_name: string; subject: string; avg: number | null; weakest_topics: { topic: string; mastery: number }[]; topics_attempted: number }[];
  needs_attention: { clerk_id: string; name: string; class_id: string; reason: string }[];
}

export interface Heatmap {
  topics: string[];
  rows: { student: string; cells: (number | null)[] }[];
  class_average: (number | null)[];
}

export interface Difficulty {
  questions: { topic: string; number: string; pct: number }[];
}

export interface Progress {
  points: { date: string; title: string; pct: number; is_full_paper: boolean }[];
}

export interface Predicted {
  enough_data: boolean;
  reason?: string;
  completed?: number;
  topics?: number;
  rolling_pct?: number;
  grade?: string | null;
  marks_to_next_pct?: number | null;
  session_used?: string;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export async function getDashboard(): Promise<DashboardData> {
  return json(await apiCall("/teacher-insights/dashboard"));
}
export async function getHeatmap(classId: string): Promise<Heatmap> {
  return json(await apiCall(`/teacher-insights/class/${classId}/heatmap`));
}
export async function getDifficulty(classId: string): Promise<Difficulty> {
  return json(await apiCall(`/teacher-insights/class/${classId}/difficulty`));
}
export async function getProgress(classId: string, clerkId: string): Promise<Progress> {
  return json(await apiCall(`/teacher-insights/class/${classId}/student/${clerkId}/progress`));
}
export async function getPredicted(classId: string, clerkId: string): Promise<Predicted> {
  return json(await apiCall(`/teacher-insights/class/${classId}/student/${clerkId}/predicted`));
}
export async function getMastery(classId: string, clerkId: string): Promise<{ mastery: { topic: string; mastery: number }[] }> {
  return json(await apiCall(`/teacher-insights/class/${classId}/student/${clerkId}/mastery`));
}

export async function downloadCsv(classId: string, from?: string, to?: string): Promise<void> {
  const params = new URLSearchParams({ class_id: classId });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const res = await apiCall(`/teacher-insights/export/csv?${params.toString()}`);
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "class-export.csv";
  a.click();
  URL.revokeObjectURL(url);
}
