"use client";

/**
 * Global post-login splash. After sign-in the app routes landing → onboarding →
 * dashboard, and each is a separate mount, which used to flash the intermediate
 * pages. This tiny store lets a splash that lives in the ROOT layout persist
 * across those client navigations and stay up until the real destination's
 * content is ready. Backed by sessionStorage so it survives a hard OAuth
 * redirect too, and auto-clears after a safety timeout so it can never stick.
 */

const KEY = "propel_auth_splash";
const MAX_MS = 9000;

let active = false;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<(v: boolean) => void>();

function emit() {
  listeners.forEach((l) => l(active));
}

export function showAuthSplash() {
  active = true;
  try { sessionStorage.setItem(KEY, "1"); } catch { /* ignore */ }
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => hideAuthSplash(), MAX_MS);
  emit();
}

export function hideAuthSplash() {
  if (!active && !readFlag()) return;
  active = false;
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  if (timer) { clearTimeout(timer); timer = null; }
  emit();
}

function readFlag(): boolean {
  try { return sessionStorage.getItem(KEY) === "1"; } catch { return false; }
}

export function isAuthSplashActive(): boolean {
  return active || readFlag();
}

export function subscribeAuthSplash(cb: (v: boolean) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
