export type PaperStatus = "goal" | "in_progress" | "completed" | "bookmarked";

export interface TrackedPaper {
  id: string;
  name: string;
  type: string;
  viewUrl?: string;
  downloadUrl?: string;
  embedUrl?: string;
  savedAt: string;
  statuses: PaperStatus[];
}

import { clerkFetch, resolveClerkToken, type GetTokenFn } from "./clerkToken";

const STORAGE_KEY = "propel_paper_states";
const LEGACY_BOOKMARKS_KEY = "propel_bookmarks";

const VALID_STATUSES: PaperStatus[] = ["goal", "in_progress", "completed", "bookmarked"];

function normalizeStatuses(input: unknown): PaperStatus[] {
  if (!Array.isArray(input)) return [];
  const deduped = new Set<PaperStatus>();
  for (const value of input) {
    if (typeof value === "string" && VALID_STATUSES.includes(value as PaperStatus)) {
      deduped.add(value as PaperStatus);
    }
  }
  return Array.from(deduped);
}

function normalizeTrackedPaper(item: any): TrackedPaper | null {
  if (!item || typeof item !== "object") return null;
  if (!item.id || !item.name || !item.type) return null;

  const statuses = normalizeStatuses(item.statuses);
  if (statuses.length === 0) return null;

  return {
    id: String(item.id),
    name: String(item.name),
    type: String(item.type),
    viewUrl: typeof item.viewUrl === "string" ? item.viewUrl : undefined,
    downloadUrl: typeof item.downloadUrl === "string" ? item.downloadUrl : undefined,
    embedUrl: typeof item.embedUrl === "string" ? item.embedUrl : undefined,
    savedAt: typeof item.savedAt === "string" ? item.savedAt : new Date().toISOString(),
    statuses,
  };
}

function sanitizeTrackedPapers(items: TrackedPaper[]): TrackedPaper[] {
  return items
    .map(normalizeTrackedPaper)
    .filter(Boolean) as TrackedPaper[];
}

function parseLegacyBookmarks(): TrackedPaper[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(LEGACY_BOOKMARKS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const converted: TrackedPaper[] = parsed
      .map((item: any) => ({ ...item, statuses: ["bookmarked"] }))
      .map(normalizeTrackedPaper)
      .filter(Boolean) as TrackedPaper[];

    return converted;
  } catch {
    return [];
  }
}

export function loadTrackedPapers(): TrackedPaper[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map(normalizeTrackedPaper)
          .filter(Boolean) as TrackedPaper[];
      }
    }
  } catch {
  }

  const legacy = parseLegacyBookmarks();
  if (legacy.length > 0) {
    saveTrackedPapers(legacy);
  }
  return legacy;
}

export function saveTrackedPapers(items: TrackedPaper[]): void {
  if (typeof window === "undefined") return;

  const sanitized = sanitizeTrackedPapers(items);

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));

  const legacyBookmarks = sanitized
    .filter((item) => item.statuses.includes("bookmarked"))
    .map(({ statuses, ...rest }) => rest);

  window.localStorage.setItem(LEGACY_BOOKMARKS_KEY, JSON.stringify(legacyBookmarks));
}

export async function loadTrackedPapersForUser(getToken?: GetTokenFn): Promise<TrackedPaper[]> {
  const local = loadTrackedPapers();

  if (!getToken) return local;

  try {
    const token = await resolveClerkToken(getToken);
    if (!token) return local;

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const response = await clerkFetch(`${baseUrl}/tracking/papers`, {
      method: "GET",
    }, getToken);

    if (!response.ok) return local;

    const payload = (await response.json()) as { items?: unknown };
    if (!Array.isArray(payload.items)) return local;

    const remote = payload.items
      .map(normalizeTrackedPaper)
      .filter(Boolean) as TrackedPaper[];

    saveTrackedPapers(remote);
    return remote;
  } catch {
    return local;
  }
}

export async function saveTrackedPapersForUser(
  items: TrackedPaper[],
  getToken?: GetTokenFn
): Promise<void> {
  const sanitized = sanitizeTrackedPapers(items);
  saveTrackedPapers(sanitized);

  if (!getToken) return;

  try {
    const token = await resolveClerkToken(getToken);
    if (!token) return;

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    await clerkFetch(`${baseUrl}/tracking/papers`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: sanitized }),
    }, getToken);
  } catch {
    // Keep local state as fallback if remote persistence fails.
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event("propel:tracking-change"));
}

export function toggleTrackedStatus(
  items: TrackedPaper[],
  paper: Omit<TrackedPaper, "savedAt" | "statuses">,
  status: PaperStatus
): TrackedPaper[] {
  const next = [...items];
  const targetIndex = next.findIndex((item) => item.id === paper.id);

  if (targetIndex === -1) {
    next.unshift({
      ...paper,
      savedAt: new Date().toISOString(),
      statuses: [status],
    });
    return next;
  }

  const target = next[targetIndex];
  const statusSet = new Set<PaperStatus>(target.statuses);
  if (statusSet.has(status)) {
    statusSet.delete(status);
  } else {
    statusSet.add(status);
    // Completing a paper should clear "in progress" automatically.
    if (status === "completed") {
      statusSet.delete("in_progress");
    }
  }

  const statuses = Array.from(statusSet);

  if (statuses.length === 0) {
    next.splice(targetIndex, 1);
    return next;
  }

  next[targetIndex] = {
    ...target,
    ...paper,
    statuses,
  };

  return next;
}

export function clearTrackedPaper(items: TrackedPaper[], id: string): TrackedPaper[] {
  return items.filter((item) => item.id !== id);
}

/**
 * Add a status if it is not already present (does not toggle off). Completing a
 * paper clears "in progress". Used when Practice grading should update the same
 * tracking the Papers library uses — dashboard "Papers solved", goals, etc.
 */
export function applyTrackedStatus(
  items: TrackedPaper[],
  paper: Omit<TrackedPaper, "savedAt" | "statuses">,
  status: PaperStatus,
): TrackedPaper[] {
  const next = [...items];
  const targetIndex = next.findIndex((item) => item.id === paper.id);
  const now = new Date().toISOString();

  if (targetIndex === -1) {
    next.unshift({ ...paper, savedAt: now, statuses: [status] });
    return next;
  }

  const target = next[targetIndex];
  const statusSet = new Set<PaperStatus>(target.statuses);
  if (status === "in_progress" && statusSet.has("completed")) return next;
  statusSet.add(status);
  if (status === "completed") statusSet.delete("in_progress");

  next[targetIndex] = { ...target, ...paper, savedAt: now, statuses: Array.from(statusSet) };
  return next;
}

/** Record that a practice paper was started or marked, using the existing tracking store. */
export async function syncPracticePaperTracking(
  meta: { paperKey: string; subject: string; year: string; session: string; paper: string; variant: string },
  status: Extract<PaperStatus, "in_progress" | "completed">,
  getToken?: GetTokenFn,
): Promise<void> {
  const un = (value: string) => value.replace(/_/g, " ");
  const name = [meta.subject, meta.year, un(meta.session), un(meta.paper), un(meta.variant).replace(/^Variant /, "V")]
    .filter(Boolean)
    .join(" · ");
  const current = await loadTrackedPapersForUser(getToken);
  const next = applyTrackedStatus(current, {
    id: `practice:${meta.paperKey}`,
    name,
    type: meta.paper || "Paper",
  }, status);
  await saveTrackedPapersForUser(next, getToken);
}
