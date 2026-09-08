"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/ui/Logo";
import { Mail } from "lucide-react";
import {
  useUser,
  signInWithPassword,
  signUpWithPassword,
  signInWithGoogle,
} from "@/lib/auth";

function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.4 5.4 2.5 13.2l7.9 6.1C12.2 13.3 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7C43.7 37.9 46.5 31.8 46.5 24.5z" />
      <path fill="#FBBC05" d="M10.4 28.3c-.5-1.5-.8-3-.8-4.8s.3-3.3.8-4.8l-7.9-6.1C.9 15.7 0 19.7 0 23.5s.9 7.8 2.5 10.9l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.6l-7.3-5.7c-2 1.4-4.7 2.3-7.9 2.3-6.4 0-11.8-3.8-13.6-9.8l-7.9 6.1C6.4 42.6 14.6 48 24 48z" />
    </svg>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { isLoaded, isSignedIn } = useUser();
  const [mode, setMode] = useState<"signin" | "signup">(params?.get("mode") === "signup" ? "signup" : "signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Already signed in → let the role-router send them on.
  useEffect(() => { if (isLoaded && isSignedIn) router.replace("/dashboard"); }, [isLoaded, isSignedIn, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (mode === "signup") {
        if (password.length < 8) throw new Error("Password must be at least 8 characters.");
        await signUpWithPassword(email, password, fullName);
      } else {
        await signInWithPassword(email, password);
      }
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  async function google() {
    setError("");
    try { await signInWithGoogle("/dashboard"); }
    catch { setError("Google sign-in isn't set up yet — use email instead."); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4 text-ink">
      <div className="w-full max-w-sm rounded-[1.5rem] border border-line bg-surface p-7 shadow-2xl">
        <div className="flex justify-center"><BrandLogo size={38} labelClassName="text-2xl" /></div>
        <h1 className="mt-4 text-center font-display text-xl font-semibold tracking-tight">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-1 text-center text-sm text-ink-muted">
          {mode === "signup" ? "Start practising in seconds." : "Log in to continue."}
        </p>

        <button
          onClick={() => void google()}
          className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-full border border-line bg-surface px-5 py-3 font-semibold text-ink shadow-card transition-colors hover:bg-surface-soft"
        >
          <GoogleG size={18} /> Continue with Google
        </button>

        <div className="my-4 flex items-center gap-3 text-xs text-ink-faint">
          <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          {mode === "signup" && (
            <input
              type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name" autoComplete="name"
              className="h-12 rounded-xl border border-line bg-surface px-4 text-sm outline-none focus:border-crimson"
            />
          )}
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="Email" autoComplete="email"
            className="h-12 rounded-xl border border-line bg-surface px-4 text-sm outline-none focus:border-crimson"
          />
          <input
            type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Password" autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className="h-12 rounded-xl border border-line bg-surface px-4 text-sm outline-none focus:border-crimson"
          />
          <button
            type="submit" disabled={busy}
            className="mt-1 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-crimson font-semibold text-white shadow-crimson transition-colors hover:bg-crimson-deep disabled:opacity-60"
          >
            <Mail size={18} /> {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Log in"}
          </button>
        </form>

        {error && <p className="mt-3 text-center text-sm text-crimson">{error}</p>}

        <p className="mt-5 text-center text-sm text-ink-muted">
          {mode === "signup" ? "Already have an account? " : "New to Propel? "}
          <button
            onClick={() => { setError(""); setMode(mode === "signup" ? "signin" : "signup"); }}
            className="font-semibold text-crimson hover:underline"
          >
            {mode === "signup" ? "Log in" : "Create one"}
          </button>
        </p>
        <p className="mt-4 text-center text-xs text-ink-faint">
          <Link href="/" className="hover:underline">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
