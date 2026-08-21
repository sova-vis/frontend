"use client";

import { apiCall } from "./api";
import { subjectSlug } from "./studentSubjects";
import { UserProfile } from "./useClerkAuth";

export interface StudentSubject {
  id: string;
  name: string;
}

type GetTokenFn = () => Promise<string | null>;

// The source of truth for selected subjects + the active O/A level is the
// SERVER profile (Supabase), so it follows the account to any device or browser.
// localStorage is only a synchronised mirror for instant paint — on login we
// hydrate it from the profile, and every change is written straight back to the
// server. Selected subjects are stored PER LEVEL so O-Level and A-Level (and all
// their progress views) stay independent across a switch.
const LEVEL_KEY = "propel_paper_level";
const LEGACY_KEY = "propel_selected_subjects";
const PROFILE_CACHE_PREFIX = "propel_profile_";

const LEVELS = ["olevel", "alevel"] as const;
type Lvl = (typeof LEVELS)[number];
type ByLevel = Record<Lvl, string[]>;

// Remember the level we last told the server about, so the level-change event we
// fire during hydration doesn't bounce straight back as a redundant PATCH.
let lastSyncedActiveLevel: Lvl | null = null;
// Reconcile local mirror ⇄ server at most once per signed-in user per page load.
let reconciledFor: string | null = null;

function activeLevel(): Lvl {
  if (typeof window === "undefined") return "olevel";
  return window.localStorage.getItem(LEVEL_KEY) === "alevel" ? "alevel" : "olevel";
}
function subjectsKey(level: Lvl = activeLevel()): string {
  return `propel_selected_subjects_${level}`;
}

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

// Dedup a plain array of subject names (case-insensitive, first spelling wins).
function cleanNames(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    if (typeof v !== "string") continue;
    const n = v.trim();
    if (!n) continue;
    const k = n.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(n); }
  }
  return out;
}

export function loadSelectedSubjects(): StudentSubject[] {
  if (typeof window === "undefined") return [];
  const key = subjectsKey();
  try {
    let raw = window.localStorage.getItem(key);
    // One-time migration: fold the old single list into the current level.
    if (raw == null) {
      const legacy = window.localStorage.getItem(LEGACY_KEY);
      if (legacy != null) { window.localStorage.setItem(key, legacy); window.localStorage.removeItem(LEGACY_KEY); raw = legacy; }
    }
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
    window.localStorage.setItem(subjectsKey(), JSON.stringify(sanitized));
    window.dispatchEvent(new CustomEvent("propel:selected-subjects-change", { detail: sanitized }));
  }
  return sanitized;
}

export function selectedSubjectNames(items: StudentSubject[]): string[] {
  return sanitizeSubjects(items).map((subject) => subject.name);
}

// Read one level's saved subject NAMES straight from the local mirror.
function readLevelNames(level: Lvl): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`propel_selected_subjects_${level}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return cleanNames((parsed.map(normalizeSubject).filter(Boolean) as StudentSubject[]).map((s) => s.name));
  } catch {
    return [];
  }
}
function writeLevelNames(level: Lvl, names: string[]): void {
  if (typeof window === "undefined") return;
  const items = sanitizeSubjects(cleanNames(names).map((n) => ({ id: subjectSlug(n), name: n })));
  window.localStorage.setItem(`propel_selected_subjects_${level}`, JSON.stringify(items));
}
function readBothLevels(): ByLevel {
  return { olevel: readLevelNames("olevel"), alevel: readLevelNames("alevel") };
}
function unionNames(byLevel: ByLevel): string[] {
  return cleanNames([...byLevel.olevel, ...byLevel.alevel]);
}

// Mirror the server's personalization into local storage and tell every consumer
// (level toggle, dashboard weak-spots, Practice, Papers, datesheet…) to refresh.
function applyPersonalizationToLocal(byLevel: ByLevel, active: Lvl | null): void {
  if (typeof window === "undefined") return;
  writeLevelNames("olevel", byLevel.olevel);
  writeLevelNames("alevel", byLevel.alevel);
  if (active) {
    window.localStorage.setItem(LEVEL_KEY, active);
    lastSyncedActiveLevel = active; // already matches the server — don't re-PATCH
  }
  window.dispatchEvent(new CustomEvent("propel:selected-subjects-change"));
  if (active) window.dispatchEvent(new CustomEvent("propel:level-change", { detail: active }));
}

async function patchProfile(getToken: GetTokenFn, payload: Record<string, unknown>): Promise<UserProfile | null> {
  try {
    const token = await getToken();
    if (!token) return null;
    const response = await apiCall("/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return null;
    return (await response.json()) as UserProfile;
  } catch {
    return null;
  }
}

export function hydrateSubjectsFromProfile(profile: UserProfile | null): StudentSubject[] {
  const existing = loadSelectedSubjects();
  // Per-level local selections win; only seed the current level from the profile
  // when there's nothing stored for it yet (fresh device / first load).
  if (existing.length || !profile?.selected_subjects?.length) return existing;
  return saveSelectedSubjects(profile.selected_subjects.map((name) => ({ id: subjectSlug(name), name })));
}

/**
 * Reconcile the local mirror with the server profile, once per user per load.
 * - If the server has per-level personalization, it's authoritative → mirror it
 *   down to this device (this is what makes another computer show the same thing).
 * - If the server has none yet (first load after this shipped), migrate whatever
 *   this device has — or the legacy flat list — UP to the server so it's saved
 *   everywhere from now on.
 */
export async function reconcilePersonalizationWithProfile(
  profile: UserProfile | null,
  getToken: GetTokenFn
): Promise<void> {
  if (!profile || typeof window === "undefined") return;
  if (reconciledFor === profile.clerk_id) return;
  reconciledFor = profile.clerk_id;

  const serverBy: ByLevel = {
    olevel: cleanNames(profile.subjects_by_level?.olevel),
    alevel: cleanNames(profile.subjects_by_level?.alevel),
  };
  const serverActive: Lvl | null =
    profile.active_level === "alevel" ? "alevel" : profile.active_level === "olevel" ? "olevel" : null;
  const serverHasAny = serverBy.olevel.length > 0 || serverBy.alevel.length > 0;

  if (serverHasAny || serverActive) {
    applyPersonalizationToLocal(serverBy, serverActive);
    return;
  }

  // Server has nothing yet → migrate this device's state up (once).
  let source: ByLevel = readBothLevels();
  let active = activeLevel();

  if (!source.olevel.length && !source.alevel.length) {
    // No per-level local data either → fall back to the legacy flat profile list,
    // bucketed by the onboarding level.
    const flat = cleanNames(profile.selected_subjects);
    if (!flat.length) return; // nothing anywhere to migrate
    active = /a level/i.test(String(profile.level ?? "")) ? "alevel" : "olevel";
    source = active === "alevel" ? { olevel: [], alevel: flat } : { olevel: flat, alevel: [] };
    applyPersonalizationToLocal(source, active);
  }

  lastSyncedActiveLevel = active;
  await patchProfile(getToken, {
    subjects_by_level: source,
    active_level: active,
    selected_subjects: unionNames(source),
  });
}

/** Persist an O/A toggle to the server (skips the hydration echo). */
export async function persistActiveLevel(level: Lvl, getToken: GetTokenFn): Promise<void> {
  if (level === lastSyncedActiveLevel) return;
  lastSyncedActiveLevel = level;
  await patchProfile(getToken, { active_level: level });
}

export async function saveSelectedSubjectsForUser(
  items: StudentSubject[],
  getToken?: GetTokenFn,
  clerkId?: string
): Promise<StudentSubject[]> {
  const sanitized = saveSelectedSubjects(items); // writes the ACTIVE level + notifies consumers
  if (!getToken) return sanitized;

  // Send the full per-level picture so the server stays authoritative for both
  // levels, plus the active level and the flat union (for datesheet/mentoring).
  const byLevel = readBothLevels();
  const active = activeLevel();
  lastSyncedActiveLevel = active;

  const updated = await patchProfile(getToken, {
    subjects_by_level: byLevel,
    active_level: active,
    selected_subjects: unionNames(byLevel),
  });

  if (updated && clerkId && typeof window !== "undefined") {
    window.localStorage.setItem(`${PROFILE_CACHE_PREFIX}${clerkId}`, JSON.stringify(updated));
  }

  return sanitized;
}
