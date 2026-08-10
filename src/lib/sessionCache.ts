// Tiny sessionStorage cache with TTL, for stale-while-revalidate reads across
// client navigations. Keeps expensive Drive listings instant on revisit while a
// background refresh reconciles the data.
export function cacheGet<T>(key: string, maxAgeMs = 10 * 60 * 1000): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { t: number; v: T };
    if (!parsed || typeof parsed.t !== "number") return null;
    if (Date.now() - parsed.t > maxAgeMs) return null;
    return parsed.v;
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), v: value }));
  } catch {
    /* quota / serialization — non-fatal, we just skip caching */
  }
}
