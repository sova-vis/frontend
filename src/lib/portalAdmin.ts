import { apiCall } from "./api";

/** Settings (§17), notifications (§16), institution/permissions (§14–18) client. */

export interface TeacherSettings {
  auto_approve_threshold: number;
  auto_approve_floor: number | null;
  default_mark_scheme_visibility: string;
  default_release_content: Record<string, boolean>;
  notif_prefs: Record<string, boolean>;
  digest_frequency: string;
  timezone: string | null;
}

export interface PortalNotification {
  type: string;
  body: string;
  class_id?: string;
  assignment_id?: string;
}

export interface Institution {
  id: string;
  name: string;
  status: string;
  address: string | null;
  country: string | null;
  contact_email: string | null;
  logo_url: string | null;
  auto_approve_floor: number | null;
  academic_year_start: string | null;
  academic_year_end: string | null;
  retention_policy: Record<string, number>;
  seat_usage: { teachers: number; students: number; seat_limit_teachers: number | null; seat_limit_students: number | null };
}

export interface TeacherRow {
  clerk_id: string;
  full_name: string | null;
  email: string | null;
  deactivated: boolean;
  classes: number;
  assignments: number;
}

export interface ScopeGrant {
  id: string;
  user_clerk_id: string;
  filter_subjects: string[];
  filter_levels: string[];
  capabilities: string[];
  label: string | null;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

// ---- Settings ----
export async function getSettings(): Promise<TeacherSettings> {
  return json(await apiCall("/settings"));
}
export async function patchSettings(patch: Partial<TeacherSettings>): Promise<TeacherSettings> {
  return json(await apiCall("/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }));
}
export async function getNotifications(): Promise<PortalNotification[]> {
  return json(await apiCall("/settings/notifications"));
}

// ---- Institution ----
export async function getInstitution(): Promise<Institution> {
  return json(await apiCall("/institution"));
}
export async function patchInstitution(patch: Record<string, unknown>): Promise<Institution> {
  return json(await apiCall("/institution", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }));
}
export async function getTeachers(): Promise<TeacherRow[]> {
  return json(await apiCall("/institution/teachers"));
}
export async function setTeacherActive(clerkId: string, active: boolean): Promise<void> {
  await json(await apiCall(`/institution/teachers/${clerkId}/deactivate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active }) }));
}
export async function getSchoolPerformance(): Promise<{ id: string; name: string; subject: string; level: string; students: number; avg: number | null }[]> {
  return json(await apiCall("/institution/performance"));
}
export async function getScopeGrants(): Promise<ScopeGrant[]> {
  return json(await apiCall("/institution/scope-grants"));
}
export async function addScopeGrant(input: { email: string; filter_subjects: string[]; filter_levels: string[]; capabilities: string[]; label: string }): Promise<ScopeGrant> {
  return json(await apiCall("/institution/scope-grants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }));
}
export async function removeScopeGrant(id: string): Promise<void> {
  await json(await apiCall(`/institution/scope-grants/${id}`, { method: "DELETE" }));
}
export async function getActivityLog(): Promise<{ id: string; event_type: string; actor_clerk_id: string; created_at: string; detail: Record<string, unknown> }[]> {
  return json(await apiCall("/institution/activity-log"));
}
