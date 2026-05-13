"use client";

import { apiCall } from "./api";
import { UserProfile } from "./useClerkAuth";

export interface StudentSubject {
  id: string;
  name: string;
}

type GetTokenFn = () => Promise<string | null>;

const STORAGE_KEY = "propel_selected_subjects";
const PROFILE_CACHE_PREFIX = "propel_profile_";

function normalizeSubject(input: unknown): StudentSubject | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Record<string, unknown>;
  const id = typeof item.id === "string" ? item.id.trim() : "";
  const name = typeof item.name === "string" ? item.name.trim() : "";
  if (!id || !name) return null;
  return { id, name };
}

export function sanitizeSubjects(items: StudentSubject[]): StudentSubject[] {
  const seen = new Set<string>();
  const next: StudentSubject[] = [];

  for (const item of items) {
    const normalized = normalizeSubject(item);
    if (!normalized || seen.has(normalized.id)) continue;
    seen.add(normalized.id);
    next.push(normalized);
  }

  return next;
}

export function loadSelectedSubjects(): StudentSubject[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeSubject).filter(Boolean) as StudentSubject[];
  } catch {
    return [];
  }
}

export function saveSelectedSubjects(items: StudentSubject[]): StudentSubject[] {
  const sanitized = sanitizeSubjects(items);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    window.dispatchEvent(new CustomEvent("propel:selected-subjects-change", { detail: sanitized }));
  }
  return sanitized;
}

export function selectedSubjectNames(items: StudentSubject[]): string[] {
  return sanitizeSubjects(items).map((subject) => subject.name);
}

export function hydrateSubjectsFromProfile(profile: UserProfile | null): StudentSubject[] {
  if (!profile?.selected_subjects?.length) return loadSelectedSubjects();
  const existing = loadSelectedSubjects();
  const byName = new Map(existing.map((subject) => [subject.name.toLowerCase(), subject]));
  const hydrated = profile.selected_subjects.map((name) => {
    const current = byName.get(name.toLowerCase());
    return current ?? { id: name, name };
  });
  return saveSelectedSubjects(hydrated);
}

export async function saveSelectedSubjectsForUser(
  items: StudentSubject[],
  getToken?: GetTokenFn,
  clerkId?: string
): Promise<StudentSubject[]> {
  const sanitized = saveSelectedSubjects(items);
  if (!getToken) return sanitized;

  try {
    const token = await getToken();
    if (!token) return sanitized;

    const response = await apiCall("/auth/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ selected_subjects: selectedSubjectNames(sanitized) }),
    });

    if (response.ok && clerkId && typeof window !== "undefined") {
      const updated = (await response.json()) as UserProfile;
      window.localStorage.setItem(`${PROFILE_CACHE_PREFIX}${clerkId}`, JSON.stringify(updated));
    }
  } catch {
    // Local personalization still works if profile sync is unavailable.
  }

  return sanitized;
}

