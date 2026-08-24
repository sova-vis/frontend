"use client";

/**
 * Global post-login splash. After sign-in the app routes through the OAuth
 * callback → landing → dashboard, and each is a separate mount, which would
 * otherwise flash the intermediate pages. This store lets a splash that lives in
 * the ROOT layout persist across those client navigations (and hard OAuth
 * redirects, via sessionStorage) and stay up until the destination is ready.
 *
 * It also enforces a MINIMUM display time so the logo animation always plays for
 * ~2s — no landing flicker, then a clean hand-off to the dashboard.
 */

const KEY = "propel_auth_splash";
const AT_KEY = "propel_auth_splash_at";
const MIN_MS = 2000;   // logo animation plays for at least this long
const MAX_MS = 9000;   // safety: never stick longer than this

let active = false;
let shownAt = 0;
let maxTimer: ReturnType<typeof setTimeout> | null = null;
let pendingHide = false;
const listeners = new Set<(v: boolean) => void>();

function emit() {
  listeners.forEach((l) => l(active));
}
function readFlag(): boolean {
  try { return sessionStorage.getItem(KEY) === "1"; } catch { return false; }
}
function startedAt(): number {
  if (shownAt) return shownAt;
  try {
    const v = Number(sessionStorage.getItem(AT_KEY) || 0);
    if (v) { shownAt = v; return v; }
  } catch { /* ignore */ }
  shownAt = Date.now();
  return shownAt;
}

export function showAuthSplash() {
  active = true;
  const now = Date.now();
  shownAt = now;
  try { sessionStorage.setItem(KEY, "1"); sessionStorage.setItem(AT_KEY, String(now)); } catch { /* ignore */ }
  if (maxTimer) clearTimeout(maxTimer);
  maxTimer = setTimeout(() => forceHide(), MAX_MS);
  emit();
}

function forceHide() {
  active = false;
  shownAt = 0;
  pendingHide = false;
  try { sessionStorage.removeItem(KEY); sessionStorage.removeItem(AT_KEY); } catch { /* ignore */ }
  if (maxTimer) { clearTimeout(maxTimer); maxTimer = null; }
  emit();
}

export function hideAuthSplash() {
  if (!active && !readFlag()) return;
  const elapsed = Date.now() - startedAt();
  if (elapsed < MIN_MS) {
    // Destination is ready early — keep the logo on screen until the minimum.
    if (!pendingHide) {
      pendingHide = true;
      setTimeout(() => { pendingHide = false; hideAuthSplash(); }, MIN_MS - elapsed);
    }
    return;
  }
  forceHide();
}

export function isAuthSplashActive(): boolean {
  return active || readFlag();
}

export function subscribeAuthSplash(cb: (v: boolean) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
