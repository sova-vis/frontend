import { apiCall } from "./api";
import type { SchoolLimits, QuotaStatus } from "./owner";

/**
 * School-admin console API client (backend /school-admin routes, spec §4).
 */

export interface Teacher {
  clerk_id: string;
  full_name: string | null;
  email: string | null;
  syllabus_codes: string[];
  levels: string[];
  deactivated_at: string | null;
  must_change_password: boolean;
  created_at: string;
}

export interface SchoolAdminHome {
  school: { id: string; name: string; logo_url: string | null; status: string; discount_pct: number; licence_expiry: string | null } | null;
  limits: SchoolLimits | null;
  usage: {
    teachers_used: number;
    teachers_max: number | null;
    students_used: number;
    students_max: number | null;
    marking: QuotaStatus | null;
  };
}

export interface TeacherResult {
  email: string;
  tempPassword: string | null;
  existed: boolean;
  clerkId?: string;
}

export interface BulkRow {
  email: string;
  ok: boolean;
  tempPassword?: string | null;
  existed?: boolean;
  error?: string;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export async function getHome(): Promise<SchoolAdminHome> {
  return json(await apiCall("/school-admin"));
}

export async function listTeachers(): Promise<Teacher[]> {
  const d = await json<{ teachers: Teacher[] }>(await apiCall("/school-admin/teachers"));
  return d.teachers;
}

export async function createTeacher(input: { email: string; name: string; subjects?: string[]; levels?: string[]; password?: string }): Promise<{ teacher: TeacherResult }> {
  return json(await apiCall("/school-admin/teachers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }));
}

export async function bulkTeachers(payload: { csv?: string; teachers?: Array<{ email: string; name: string; subjects?: string[]; levels?: string[] }> }): Promise<{ results: BulkRow[] }> {
  return json(await apiCall("/school-admin/teachers/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }));
}

export async function updateTeacher(clerkId: string, patch: { subjects?: string[]; levels?: string[]; full_name?: string; active?: boolean }): Promise<{ teacher: Teacher }> {
  return json(await apiCall(`/school-admin/teachers/${clerkId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }));
}
