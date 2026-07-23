/* ============================================================
   PROPEL — Practice-paper progress client
   Answers, solve mode, timer state and handwritten uploads are
   autosaved per (student, paper) so a session can resume from any
   device. Backed by /practice/progress on the API (Clerk auth),
   mirrored to localStorage as an offline fallback.
   ============================================================ */

export type SolveMode = "digital" | "handwritten";
export type PracticeStatus = "in_progress" | "completed";

export interface PracticeUpload {
  path: string;
  name: string;
  size: number;
  type: string;
  at: string;
  /** short-lived signed URL for viewing (present on server responses) */
  url?: string;
}

export interface PracticeProgress {
  paperKey: string;
  subject: string;
  year: string;
  session: string;   // "May_June"
  paper: string;     // "Paper_2"
  variant: string;   // "Variant_1"
  isMcq: boolean;
  solveMode: SolveMode;
  status: PracticeStatus;
  answers: { mcq: Record<string, string>; parts: Record<string, string> };
  uploads: PracticeUpload[];
  answeredCount: number;
  totalCount: number;
  timerDurationSeconds: number;
  timerElapsedSeconds: number;
  startedAt: string;
  updatedAt: string;
}

type GetTokenFn = () => Promise<string | null>;

const STORAGE_KEY = "propel_practice_progress";

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
}

export function makePaperKey(subject: string, year: string, session: string, paper: string, variant: string): string {
  return [subject, year, session, paper, variant].join("|");
}

/** Deep link that reopens this paper (and its saved state) in Practice. */
export function practiceHref(p: Pick<PracticeProgress, "subject" | "year" | "session" | "paper" | "variant">): string {
  const params = new URLSearchParams({
    subject: p.subject,
    year: p.year,
    session: p.session,
    paper: p.paper,
    variant: p.variant,
  });
  return `/student/paper-practice?${params.toString()}`;
}

export function prettyPaperName(p: Pick<PracticeProgress, "subject" | "year" | "session" | "paper" | "variant">): string {
  const un = (value: string) => value.replace(/_/g, " ");
  return [p.subject, p.year, un(p.session), un(p.paper), un(p.variant).replace(/^Variant /, "V")]
    .filter(Boolean)
    .join(" · ");
}

export function progressPercent(p: PracticeProgress): number {
  if (p.status === "completed") return 100;
  if (p.solveMode === "handwritten") return p.uploads.length > 0 ? 60 : 5;
  if (p.totalCount <= 0) return 0;
  return Math.min(100, Math.round((p.answeredCount / p.totalCount) * 100));
}

/* ---------------- localStorage mirror ---------------- */

function readLocal(): Record<string, PracticeProgress> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, PracticeProgress>) : {};
  } catch {
    return {};
  }
}

function writeLocal(map: Record<string, PracticeProgress>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

function mirrorItem(item: PracticeProgress): void {
  const map = readLocal();
  map[item.paperKey] = item;
  writeLocal(map);
}

/* ---------------- API calls ---------------- */

async function authHeader(getToken?: GetTokenFn): Promise<Record<string, string> | null> {
  if (!getToken) return null;
  try {
    const token = await getToken();
    return token ? { Authorization: `Bearer ${token}` } : null;
  } catch {
    return null;
  }
}

/** All practice sessions for the student, newest first (remote, local fallback). */
export async function loadPracticeProgressList(getToken?: GetTokenFn): Promise<PracticeProgress[]> {
  const local = Object.values(readLocal()).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  const headers = await authHeader(getToken);
  if (!headers) return local;

  try {
    const response = await fetch(`${apiBase()}/practice/progress`, { headers });
    if (!response.ok) return local;
    const payload = (await response.json()) as { items?: PracticeProgress[] };
    if (!Array.isArray(payload.items)) return local;
    const map: Record<string, PracticeProgress> = {};
    for (const item of payload.items) map[item.paperKey] = item;
    writeLocal(map);
    return payload.items;
  } catch {
    return local;
  }
}

/** Upsert one session; resolves to the server copy (or the input on failure). */
export async function savePracticeProgress(
  doc: PracticeProgress,
  getToken?: GetTokenFn,
  options?: { keepalive?: boolean; tokenOverride?: string | null },
): Promise<PracticeProgress> {
  mirrorItem(doc);
  const headers =
    options?.tokenOverride != null
      ? { Authorization: `Bearer ${options.tokenOverride}` }
      : await authHeader(getToken);
  if (!headers) return doc;

  try {
    const response = await fetch(`${apiBase()}/practice/progress/${encodeURIComponent(doc.paperKey)}`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(doc),
      keepalive: options?.keepalive,
    });
    if (!response.ok) return doc;
    const payload = (await response.json()) as { item?: PracticeProgress };
    if (payload.item) {
      mirrorItem(payload.item);
      return payload.item;
    }
  } catch {}
  return doc;
}

export async function deletePracticeProgress(paperKey: string, getToken?: GetTokenFn): Promise<void> {
  const map = readLocal();
  delete map[paperKey];
  writeLocal(map);

  const headers = await authHeader(getToken);
  if (!headers) return;
  try {
    await fetch(`${apiBase()}/practice/progress/${encodeURIComponent(paperKey)}`, { method: "DELETE", headers });
  } catch {}
}

/** Attach one handwritten file; resolves to the updated session document. */
export async function uploadPracticeFile(
  paperKey: string,
  file: File,
  getToken?: GetTokenFn,
): Promise<PracticeProgress | null> {
  const headers = await authHeader(getToken);
  if (!headers) return null;
  const body = new FormData();
  body.append("file", file, file.name);
  const response = await fetch(`${apiBase()}/practice/progress/${encodeURIComponent(paperKey)}/uploads`, {
    method: "POST",
    headers,
    body,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || "Upload failed");
  }
  const payload = (await response.json()) as { item?: PracticeProgress };
  if (payload.item) mirrorItem(payload.item);
  return payload.item ?? null;
}

export async function removePracticeUpload(
  paperKey: string,
  path: string,
  getToken?: GetTokenFn,
): Promise<PracticeProgress | null> {
  const headers = await authHeader(getToken);
  if (!headers) return null;
  const response = await fetch(`${apiBase()}/practice/progress/${encodeURIComponent(paperKey)}/uploads`, {
    method: "DELETE",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { item?: PracticeProgress };
  if (payload.item) mirrorItem(payload.item);
  return payload.item ?? null;
}
