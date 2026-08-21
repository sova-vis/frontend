import { apiCall } from "./api";
import { cacheGet, cacheSet } from "./sessionCache";
import { isExcludedSubject, O_LEVEL_SUBJECTS, A_LEVEL_SUBJECTS } from "./studentSubjects";

// Subjects the student can pick come from the actual paper library, filtered by
// their level (O / A / Both). "Both" merges the two, tagging which level(s) each
// subject exists in. Excluded subjects (e.g. Additional Mathematics) are dropped.

export type Lv = "O" | "A";
export interface LevelSubject { name: string; levels: Lv[] }

interface Folder { id: string; name: string; isFolder: boolean; folderType?: string }

// Strip syllabus codes / bracketed notes so folder names show as clean subjects.
function cleanName(s: string): string {
  return s.replace(/\([^)]*\)/g, " ").replace(/\b\d{3,4}\b/g, " ").replace(/\s+/g, " ").trim();
}

async function browseSubjects(lv: Lv): Promise<string[]> {
  const key = `lib:subjects:${lv}`;
  const cached = cacheGet<string[]>(key, 30 * 60 * 1000);
  // An empty array is truthy — never treat a cached-empty as a hit, or a single
  // failed load would stick (and stop us re-fetching) for the whole TTL.
  if (cached && cached.length) return cached;
  try {
    const res = await apiCall(`/papers/browse?level=${lv === "A" ? "alevel" : "olevel"}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: Folder[] };
    let folders = (data.items ?? []).filter((i) => i.isFolder);
    if (folders.length === 1 && folders[0].folderType === "category") {
      const inner = await apiCall(`/papers/browse/${folders[0].id}`);
      if (inner.ok) folders = ((await inner.json()) as { items?: Folder[] }).items?.filter((i) => i.isFolder) ?? [];
    }
    const names = folders.map((f) => cleanName(f.name)).filter((n) => n && !isExcludedSubject(n));
    // Never cache an empty result — a transient failure shouldn't stick for 30m.
    if (names.length) cacheSet(key, names);
    return names;
  } catch {
    return [];
  }
}

/** Level choice string as stored ("O Level" | "A Level" | "Both"). */
export function levelsFor(choice: string | null | undefined): Lv[] {
  if (choice && /both/i.test(choice)) return ["O", "A"];
  if (choice && /a level/i.test(choice)) return ["A"];
  return ["O"];
}

export async function loadLevelSubjects(choice: string | null | undefined): Promise<LevelSubject[]> {
  const want = levelsFor(choice);
  const byName = new Map<string, { name: string; levels: Set<Lv> }>();
  for (const lv of want) {
    const names = await browseSubjects(lv);
    for (const n of names) {
      const key = n.toLowerCase();
      if (!byName.has(key)) byName.set(key, { name: n, levels: new Set() });
      byName.get(key)!.levels.add(lv);
    }
  }
  const result = Array.from(byName.values())
    .map((v) => ({ name: v.name, levels: Array.from(v.levels).sort() as Lv[] }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Fallback: if the Drive returned nothing (API/CORS/config hiccup), still offer
  // per-level lists so O and A stay distinct and the student is never stuck.
  if (result.length === 0) {
    const fb = new Map<string, { name: string; levels: Set<Lv> }>();
    for (const lv of want) {
      const list = lv === "A" ? A_LEVEL_SUBJECTS : O_LEVEL_SUBJECTS;
      for (const n of list) {
        if (isExcludedSubject(n)) continue;
        const k = n.toLowerCase();
        if (!fb.has(k)) fb.set(k, { name: n, levels: new Set() });
        fb.get(k)!.levels.add(lv);
      }
    }
    return Array.from(fb.values())
      .map((v) => ({ name: v.name, levels: Array.from(v.levels).sort() as Lv[] }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  return result;
}
