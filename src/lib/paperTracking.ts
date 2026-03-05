export type PaperStatus = "in_progress" | "completed" | "important" | "bookmarked";

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

const STORAGE_KEY = "propel_paper_states";
const LEGACY_BOOKMARKS_KEY = "propel_bookmarks";

const VALID_STATUSES: PaperStatus[] = ["in_progress", "completed", "important", "bookmarked"];

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

  const sanitized = items
    .map(normalizeTrackedPaper)
    .filter(Boolean) as TrackedPaper[];

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));

  const legacyBookmarks = sanitized
    .filter((item) => item.statuses.includes("bookmarked"))
    .map(({ statuses, ...rest }) => rest);

  window.localStorage.setItem(LEGACY_BOOKMARKS_KEY, JSON.stringify(legacyBookmarks));
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
