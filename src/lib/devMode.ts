/**
 * Dev mode client helpers. A shared password (verified server-side) unlocks a
 * short-lived token that authorises in-place edits to the live question bank.
 * The token lives in localStorage; every editor call sends it as x-dev-token
 * (Clerk auth is added by apiCall).
 */
import { apiCall } from "./api";

const TOKEN_KEY = "propel_dev_token";

export function getDevToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setDevToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
    window.dispatchEvent(new Event("propel:dev-change"));
  } catch {
    /* ignore */
  }
}

export function clearDevToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.dispatchEvent(new Event("propel:dev-change"));
  } catch {
    /* ignore */
  }
}

export function isDevUnlocked(): boolean {
  return Boolean(getDevToken());
}

export async function devStatus(): Promise<{ passwordSet: boolean }> {
  const res = await apiCall("/dev/status");
  if (!res.ok) return { passwordSet: false };
  return res.json();
}

/** Set (first time) or change (needs current) the shared dev password. */
export async function setDevPassword(password: string, currentPassword?: string): Promise<void> {
  const res = await apiCall("/dev/password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password, currentPassword }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not set password");
  if (data.token) setDevToken(data.token);
}

/** Verify the password and store the returned dev token. */
export async function unlockDev(password: string): Promise<void> {
  const res = await apiCall("/dev/unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Incorrect password");
  if (data.token) setDevToken(data.token);
}

async function devSend(path: string, method: string, body?: unknown): Promise<Record<string, unknown>> {
  const token = getDevToken();
  if (!token) throw new Error("Dev mode is locked");
  const res = await apiCall(path, {
    method,
    headers: { "Content-Type": "application/json", "x-dev-token": token },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    clearDevToken();
    throw new Error("Dev session expired — unlock again");
  }
  if (!res.ok) throw new Error((data as { error?: string }).error || "Save failed");
  return data as Record<string, unknown>;
}

const devPatch = (path: string, patch: Record<string, unknown>) => devSend(path, "PATCH", patch);

export type DevImage = { role?: string; caption?: string | null; width?: number | null; height?: number | null; data_url: string };

export type QuestionPatch = {
  question_text?: string;
  marking_scheme?: string;
  correct_option?: string | null;
  options?: Record<string, string>;
  images?: DevImage[];
  stem_answerable?: boolean | null;
};

export const patchQuestion = (uid: string, patch: QuestionPatch) => devPatch(`/dev/questions/${uid}`, patch);
export const patchPart = (uid: string, patch: { body?: string; marks?: number | null; answer?: string; label?: string; order_index?: number }) =>
  devPatch(`/dev/parts/${uid}`, patch);

/** A part as sent to the bulk-replace endpoint. */
export type DevPart = { label: string; body: string; marks: number | null; answer: string | null; images?: DevImage[] };
/** Saved part echoed back with its new DB id + resolved order. */
export type SavedPart = DevPart & { id: string; order_index: number; images?: DevImage[] };

/** Replace a question's entire ordered part list (add / delete / rename / reorder in one save). */
export async function replaceParts(questionUid: string, parts: DevPart[]): Promise<SavedPart[]> {
  const data = await devSend(`/dev/questions/${questionUid}/parts`, "PUT", { parts });
  return (data.parts as SavedPart[]) || [];
}

/** Permanently delete a whole question and its parts. */
export const deleteQuestion = (uid: string) => devSend(`/dev/questions/${uid}`, "DELETE");

/** Read a file input as a data URL for image add/replace. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read file"));
    r.readAsDataURL(file);
  });
}
