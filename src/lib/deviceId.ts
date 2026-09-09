/**
 * A stable per-device id used as a SOFT anti-abuse signal for the free trial
 * (so a brand-new account on a device that already trialed doesn't get a fresh
 * 10 days). This is best-effort only — the strong guard is Google-only login.
 *
 * Implementation: a random UUID persisted in localStorage. Honest and light; a
 * determined user can clear it, which is an acceptable trade-off for a student app.
 */
const KEY = 'propel_device_id';

export function getDeviceHash(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}
