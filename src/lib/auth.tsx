"use client";

/**
 * Supabase Auth compatibility layer.
 *
 * This project migrated from Clerk to self-hosted Supabase Auth. To avoid
 * touching ~30 call sites, this module re-implements the exact Clerk hook
 * shapes the app already uses (`useUser`, `useAuth`, `useClerk`) on top of
 * `supabase.auth`. Files just swap `from "@/lib/auth"` → `from "@/lib/auth"`.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User as SbUser } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { resolveClerkToken } from "./clerkToken";

// ---- Clerk-shaped user object -------------------------------------------------
export interface CompatUser {
  id: string;
  email: string | null;
  primaryEmailAddress: { emailAddress: string } | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  username: string | null;
  imageUrl: string;
  publicMetadata: Record<string, unknown>; // app role lives in profiles, not here
  update: (data: { firstName?: string; lastName?: string }) => Promise<void>;
  setProfileImage: (args: { file: File | Blob | null }) => Promise<void>;
  reload: () => Promise<void>;
}

function mapUser(u: SbUser | null | undefined): CompatUser | null {
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const full = str(meta.full_name) || str(meta.name) || null;
  const parts = full ? full.split(/\s+/) : [];
  const firstName = str(meta.first_name) || parts[0] || null;
  const lastName = str(meta.last_name) || (parts.length > 1 ? parts.slice(1).join(" ") : null);
  return {
    id: u.id,
    email: u.email ?? null,
    primaryEmailAddress: u.email ? { emailAddress: u.email } : null,
    firstName,
    lastName,
    fullName: full || [firstName, lastName].filter(Boolean).join(" ") || null,
    username: str(meta.username),
    imageUrl: str(meta.avatar_url) || "",
    publicMetadata: {},
    update: async ({ firstName: fn, lastName: ln }) => {
      const nextFull = [fn ?? firstName ?? "", ln ?? lastName ?? ""].join(" ").trim();
      await supabase.auth.updateUser({
        data: { first_name: fn, last_name: ln, full_name: nextFull || undefined, name: nextFull || undefined },
      });
    },
    // Avatar upload isn't wired to Supabase Storage yet; keep the call safe.
    setProfileImage: async () => { /* no-op (follow-up: upload to storage) */ },
    reload: async () => { await supabase.auth.getUser(); },
  };
}

// ---- provider -----------------------------------------------------------------
interface AuthState { session: Session | null; isLoaded: boolean; }
const AuthContext = createContext<AuthState>({ session: null, isLoaded: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, isLoaded: false });

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ session: data.session, isLoaded: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, isLoaded: true });
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

// ---- Clerk-compatible hooks ---------------------------------------------------
export function useUser() {
  const { session, isLoaded } = useContext(AuthContext);
  const user = useMemo(() => mapUser(session?.user), [session?.user]);
  return { isLoaded, isSignedIn: !!user, user };
}

export function useAuth() {
  const { session, isLoaded } = useContext(AuthContext);
  const userId = session?.user?.id ?? null;
  return {
    isLoaded,
    isSignedIn: !!userId,
    userId,
    // Signature matches Clerk's getToken(); resolves a fresh Supabase token.
    getToken: (opts?: { skipCache?: boolean }) => resolveClerkToken(undefined, opts?.skipCache ? { force: true } : undefined),
    signOut: (opts?: { redirectUrl?: string }) => signOutRedirect(opts?.redirectUrl),
  };
}

export function useClerk() {
  return {
    signOut: (opts?: { redirectUrl?: string }) => signOutRedirect(opts?.redirectUrl),
  };
}

// ---- auth actions (used by the login/signup pages) ----------------------------
export async function signInWithPassword(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(error.message);
}

export async function signUpWithPassword(email: string, password: string, fullName?: string) {
  const { error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: fullName ? { data: { full_name: fullName.trim(), name: fullName.trim() } } : undefined,
  });
  if (error) throw new Error(error.message);
}

/** Google OAuth via GoTrue. Requires the Google provider to be enabled on the
 *  self-hosted Supabase (client id/secret). Until then this rejects gracefully. */
export async function signInWithGoogle(redirectTo = "/dashboard") {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/sso-callback?next=${encodeURIComponent(redirectTo)}` },
  });
  if (error) throw new Error(error.message);
}

export async function signOutRedirect(redirectUrl = "/") {
  try { await supabase.auth.signOut(); } catch { /* ignore */ }
  if (typeof window !== "undefined") window.location.href = redirectUrl;
}
