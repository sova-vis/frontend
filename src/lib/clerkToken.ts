/** Clerk session JWTs in development expire in ~60s. Cached getToken() calls
 *  then 401 the API. Always send a token that still has TTL left. */

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

async function fromClerkJs(skipCache: boolean): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const clerk = (window as unknown as {
      Clerk?: { session?: { getToken: (options?: { skipCache?: boolean }) => Promise<string | null> } };
    }).Clerk;
    if (!clerk?.session) return null;
    return (await clerk.session.getToken(skipCache ? { skipCache: true } : undefined)) ?? null;
  } catch {
    return null;
  }
}

export async function resolveClerkToken(
  getToken?: GetTokenFn,
  options?: { force?: boolean },
): Promise<string | null> {
  const read = async (skipCache: boolean): Promise<string | null> => {
    if (getToken) {
      try {
        const token = await getToken(skipCache ? { skipCache: true } : undefined);
        // Wrappers like `() => getToken()` ignore skipCache and can hand back a
        // stale JWT. Only accept it when it still has TTL; otherwise refresh via Clerk JS.
        if (token && (!skipCache || isClerkTokenFresh(token))) return token;
      } catch {
        /* fall through to Clerk JS */
      }
    }
    return fromClerkJs(skipCache);
  };

  if (!options?.force) {
    const cached = await read(false);
    if (isClerkTokenFresh(cached)) return cached;
  }

  const refreshed = await read(true);
  if (isClerkTokenFresh(refreshed, 5)) return refreshed;
  return fromClerkJs(true);
}

/** Attach a fresh Clerk JWT and retry once on 401 (expired token or JWKS blip). */
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
