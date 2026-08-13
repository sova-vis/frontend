import { apiCall } from "./api";

/**
 * Teacher Portal — class & enrolment API client (backend /classes routes).
 * apiCall attaches the Clerk token automatically.
 */

export interface TeacherClass {
  id: string;
  institution_id: string;
  owner_clerk_id: string;
  name: string;
  subject: string;
  syllabus_code: string;
  level: "O" | "A";
  year_group: string | null;
  description: string | null;
  join_code: string | null;
  join_enabled: boolean;
  auto_approve_joins: boolean;
  exam_series: string | null;
  archived: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  student_count?: number;
  pending_count?: number;
  is_owner?: boolean;
  can_grade?: boolean;
}

export interface Enrollment {
  id: string;
  student_clerk_id: string;
  status: "pending" | "active" | "rejected" | "removed";
  joined_via: string;
  requested_at: string;
  approved_at: string | null;
  removed_at: string | null;
  full_name: string | null;
  email: string | null;
}

export interface CoTeacher {
  id: string;
  teacher_clerk_id: string;
  can_grade: boolean;
  invited_email: string | null;
  created_at: string;
  full_name: string | null;
  email: string | null;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export interface CreateClassInput {
  name: string;
  subject: string;
  syllabus_code: string;
  level: "O" | "A";
  year_group?: string;
  description?: string;
}

export async function listClasses(includeArchived = false): Promise<TeacherClass[]> {
  return json(await apiCall(`/classes?includeArchived=${includeArchived}`));
}

export async function createClass(input: CreateClassInput): Promise<TeacherClass> {
  return json(
    await apiCall("/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function getClass(id: string): Promise<TeacherClass> {
  return json(await apiCall(`/classes/${id}`));
}

export async function updateClass(id: string, patch: Partial<CreateClassInput> & { exam_series?: string; auto_approve_joins?: boolean }): Promise<TeacherClass> {
  return json(
    await apiCall(`/classes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
  );
}

export async function archiveClass(id: string, archived: boolean): Promise<TeacherClass> {
  return json(await apiCall(`/classes/${id}/${archived ? "archive" : "restore"}`, { method: "POST" }));
}

export async function deleteClass(id: string): Promise<{ ok: boolean }> {
  return json(await apiCall(`/classes/${id}/delete`, { method: "POST" }));
}

export async function regenerateJoinCode(id: string): Promise<TeacherClass> {
  return json(await apiCall(`/classes/${id}/join-code/regenerate`, { method: "POST" }));
}

export async function setJoinEnabled(id: string, enabled: boolean): Promise<TeacherClass> {
  return json(
    await apiCall(`/classes/${id}/join-code`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    })
  );
}

export async function listEnrollments(id: string, status?: string): Promise<Enrollment[]> {
  const q = status ? `?status=${status}` : "";
  return json(await apiCall(`/classes/${id}/enrollments${q}`));
}

export async function decideEnrollments(
  id: string,
  studentClerkIds: string[],
  decision: "approve" | "reject"
): Promise<{ updated: number }> {
  return json(
    await apiCall(`/classes/${id}/enrollments/${decision}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_clerk_ids: studentClerkIds }),
    })
  );
}

export async function listCoTeachers(id: string): Promise<CoTeacher[]> {
  return json(await apiCall(`/classes/${id}/co-teachers`));
}

export async function addCoTeacher(id: string, email: string, canGrade: boolean): Promise<CoTeacher> {
  return json(
    await apiCall(`/classes/${id}/co-teachers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, can_grade: canGrade }),
    })
  );
}

export async function removeCoTeacher(id: string, teacherClerkId: string): Promise<void> {
  await json(await apiCall(`/classes/${id}/co-teachers/${teacherClerkId}`, { method: "DELETE" }));
}

// ---- Student management (§4.2 profile, §4.3 provisioning, §4.5 add/remove/transfer) ----

export interface ProvisionedCredential {
  name: string;
  username: string;
  password: string;
}

export interface StudentProfileResponse {
  profile: {
    clerk_id: string;
    full_name: string | null;
    email: string | null;
    username: string | null;
    is_provisioned: boolean;
  };
  enrollment: {
    id: string;
    status: string;
    joined_via: string;
    requested_at: string;
    approved_at: string | null;
    removed_at: string | null;
  };
  class: { id: string; name: string; subject: string; syllabus_code: string; level: "O" | "A" };
  sibling_classes: { id: string; name: string; subject: string; syllabus_code: string }[];
  metrics: null | Record<string, number>;
  topic_mastery: { topic: string; mastery: number }[];
  attempts: { id: string; name: string; date: string; status: string; mark: number | null }[];
}

export async function provisionStudents(
  classId: string,
  students: { name: string; email?: string }[]
): Promise<{ created: ProvisionedCredential[] }> {
  return json(
    await apiCall(`/classes/${classId}/students/provision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ students }),
    })
  );
}

export async function addExistingStudent(classId: string, email: string): Promise<{ ok: boolean }> {
  return json(
    await apiCall(`/classes/${classId}/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
  );
}

export async function getStudent(classId: string, studentClerkId: string): Promise<StudentProfileResponse> {
  return json(await apiCall(`/classes/${classId}/students/${studentClerkId}`));
}

export async function removeStudent(classId: string, studentClerkId: string): Promise<void> {
  await json(await apiCall(`/classes/${classId}/students/${studentClerkId}/remove`, { method: "POST" }));
}

export async function transferStudent(
  classId: string,
  studentClerkId: string,
  targetClassId: string
): Promise<void> {
  await json(
    await apiCall(`/classes/${classId}/students/${studentClerkId}/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_class_id: targetClassId }),
    })
  );
}

/** Public join link for a class code (resolves to the student join flow). */
export function joinLink(code: string): string {
  if (typeof window === "undefined") return `/join/${code}`;
  return `${window.location.origin}/join/${code}`;
}
