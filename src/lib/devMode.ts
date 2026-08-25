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

async function devPatch(path: string, patch: Record<string, unknown>): Promise<void> {
  const token = getDevToken();
  if (!token) throw new Error("Dev mode is locked");
  const res = await apiCall(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-dev-token": token },
    body: JSON.stringify(patch),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    clearDevToken();
    throw new Error("Dev session expired — unlock again");
  }
  if (!res.ok) throw new Error(data.error || "Save failed");
}

export type QuestionPatch = {
  question_text?: string;
  marking_scheme?: string;
  correct_option?: string | null;
  options?: Record<string, string>;
  images?: Array<{ role?: string; caption?: string | null; width?: number | null; height?: number | null; data_url: string }>;
};

export const patchQuestion = (uid: string, patch: QuestionPatch) => devPatch(`/dev/questions/${uid}`, patch);
export const patchPart = (uid: string, patch: { body?: string; marks?: number | null; answer?: string }) =>
  devPatch(`/dev/parts/${uid}`, patch);

/** Read a file input as a data URL for image add/replace. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read file"));
    r.readAsDataURL(file);
  });
}
