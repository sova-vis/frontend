import { apiCall } from "./api";

/**
 * Platform-owner console API client (backend /owner routes, spec §3).
 * apiCall attaches the Supabase session token automatically.
 */

export interface SchoolLimits {
  school_id: string;
  max_teachers: number;
  max_students_per_teacher: number;
  max_classes_per_teacher: number;
  max_students_total: number;
  marking_quota_units: number;
  quota_period: "month" | "term";
  askai_allowance: number;
  subject_entitlements: string[];
  storage_cap_mb: number;
}

export interface QuotaStatus {
  used: number;
  quota: number;
  pct: number;
  state: "ok" | "warn" | "full";
  periodStart: string;
}

export interface School {
  id: string;
  name: string;
  logo_url: string | null;
  status: "active" | "suspended" | "pending";
  licence_start: string | null;
  licence_expiry: string | null;
  discount_pct: number;
  allow_admin_script_view: boolean;
  feature_flags: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SchoolUsage {
  teachers: number;
  students: number;
  marking: QuotaStatus | null;
  askai: { used: number; allowance: number };
  seats: { teachers_used: number; teachers_max: number; students_used: number; students_max: number } | null;
}

export interface SchoolFunnel {
  prompts_shown: number;
  students_prompted: number;
  conversions: number;
  rate: number;
}

export interface SchoolTotals { teachers: number; students: number; classes: number; assignments: number }

export interface SchoolWithUsage extends School {
  limits: SchoolLimits | null;
  usage: SchoolUsage;
  funnel?: SchoolFunnel | null;
  totals?: SchoolTotals | null;
}

export interface AdminResult {
  email: string;
  tempPassword: string | null;
  existed: boolean;
  mustChangePassword?: boolean;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export async function listSchools(): Promise<SchoolWithUsage[]> {
  const d = await json<{ schools: SchoolWithUsage[] }>(await apiCall("/owner/schools"));
  return d.schools;
}

export async function getSchool(id: string): Promise<SchoolWithUsage> {
  return json(await apiCall(`/owner/schools/${id}`));
}

export interface CreateSchoolInput {
  name: string;
  logo_url?: string;
  licence_start?: string;
  licence_expiry?: string;
  discount_pct?: number;
  allow_admin_script_view?: boolean;
  limits?: Partial<Omit<SchoolLimits, "school_id">>;
}

export async function createSchool(input: CreateSchoolInput): Promise<{ school: School; limits: SchoolLimits; short_code: string }> {
  return json(await apiCall("/owner/schools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }));
}

export type SchoolPatch = Partial<Pick<School, "name" | "logo_url" | "status" | "licence_start" | "licence_expiry" | "discount_pct" | "allow_admin_script_view" | "feature_flags">>;

export async function updateSchool(id: string, patch: SchoolPatch): Promise<{ school: School }> {
  return json(await apiCall(`/owner/schools/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }));
}

export async function setLimits(id: string, limits: Partial<Omit<SchoolLimits, "school_id">>): Promise<{ limits: SchoolLimits }> {
  return json(await apiCall(`/owner/schools/${id}/limits`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(limits),
  }));
}

export async function addSchoolAdmin(id: string, admin: { name: string }): Promise<{ admin: AdminResult }> {
  return json(await apiCall(`/owner/schools/${id}/admins`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(admin),
  }));
}

export interface SchoolDeleteSummary { teachers: number; admins: number; classes: number; assignments: number; studentsUnenrolled: number }

// Permanently delete a school and cascade (staff accounts + their classes/assignments/
// submissions). Enrolled students keep their accounts but are unenrolled. `confirm`
// must be the exact school name.
export async function deleteSchool(id: string, confirm: string): Promise<SchoolDeleteSummary & { ok: boolean }> {
  return json(await apiCall(`/owner/schools/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirm }),
  }));
}

// Platform-wide user roster (roles + billing), used for the owner overview stats
// and the Users tab. Served by /admin/users-billing.
export interface BillingUser {
  clerk_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  created_at: string | null;
  billing_status: string;
  is_pro: boolean;
  plan: string | null;
  days_left: number | null;
}

export async function listUsersBilling(): Promise<BillingUser[]> {
  const d = await json<{ users: BillingUser[] }>(await apiCall("/admin/users-billing"));
  return d.users;
}
