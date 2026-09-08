/**
 * Module-level access-token resolver. (File/name kept for import compatibility —
 * this project moved from Clerk to self-hosted Supabase Auth.) Every backend
 * call funnels through here, so pointing it at the Supabase session is all that's
 * needed to authenticate the whole app.
 */
import { supabase } from "./supabase";

export type GetTokenFn = (options?: { skipCache?: boolean }) => Promise<string | null | undefined>;

function jwtExpSeconds(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const padded = part.replace(/-/g, "+").replace(/_/g, "/") + "==".slice((part.length + 3) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

export function isClerkTokenFresh(token: string | null | undefined, minTtlSeconds = 20): boolean {
  if (!token) return false;
  const exp = jwtExpSeconds(token);
  if (exp == null) return true;
  return exp * 1000 > Date.now() + minTtlSeconds * 1000;
}

/**
 * Resolve the current Supabase access token, refreshing it if it's near expiry.
 * The `getToken` arg (a leftover from the Clerk hook API) is accepted for
 * signature compatibility but ignored — the session is the source of truth.
 */
export async function resolveClerkToken(
  _getToken?: GetTokenFn,
  options?: { force?: boolean },
): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    if (options?.force) {
      const { data } = await supabase.auth.refreshSession();
      return data.session?.access_token ?? null;
    }
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? null;
    if (isClerkTokenFresh(token, 30)) return token;
    // stale/near-expiry → refresh
    const refreshed = await supabase.auth.refreshSession();
    return refreshed.data.session?.access_token ?? token;
  } catch {
    return null;
  }
}

/** Attach a fresh token and retry once on 401 (expired token / transient blip). */
export async function clerkFetch(
  url: string,
  init: RequestInit = {},
  getToken?: GetTokenFn,
): Promise<Response> {
  const execute = async (force: boolean) => {
    const token = await resolveClerkToken(getToken, force ? { force: true } : undefined);
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    else headers.delete("Authorization");
    return fetch(url, { ...init, headers });
  };

  const first = await execute(false);
  if (first.status !== 401) return first;
  return execute(true);
}
