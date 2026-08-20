"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { CheckCircle2, Clock, School, XCircle } from "lucide-react";
import { apiCall } from "@/lib/api";
import { BrandLogo } from "@/components/ui/Logo";

type JoinState =
  | { kind: "loading" }
  | { kind: "need-signin" }
  | { kind: "done"; status: "active" | "pending"; className?: string }
  | { kind: "error"; message: string };

// Student join-by-link (spec §3.2). A branded landing that resolves the same
// enrolment as the code/QR, then drops the student straight into their Classroom
// — no onboarding survey, since we already know their class.
export default function JoinPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = (params?.code ?? "") as string;
  const { isLoaded, isSignedIn, user } = useUser();
  const [state, setState] = useState<JoinState>({ kind: "loading" });

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setState({ kind: "need-signin" });
      return;
    }
    void (async () => {
      try {
        const res = await apiCall("/classes/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const body = await res.json();
        if (!res.ok) {
          setState({ kind: "error", message: body.error || "Could not join this class." });
          return;
        }
        // We're a classroom member now: default the workspace to Classroom and
        // drop the stale profile cache so the app sees onboarding as complete.
        try {
          window.localStorage.setItem("propel_mode", "classroom");
          if (user?.id) window.localStorage.removeItem(`propel_profile_${user.id}`);
        } catch { /* ignore storage errors */ }
        setState({ kind: "done", status: body.status, className: body.class_name });
      } catch {
        setState({ kind: "error", message: "Something went wrong. Please try again." });
      }
    })();
  }, [isLoaded, isSignedIn, code, user?.id]);

  return (
    <div className="min-h-screen bg-paper text-ink grid place-items-center px-4 relative overflow-hidden">
      {/* soft brand backdrop */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-crimson-soft blur-3xl opacity-60" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-gold-soft blur-3xl opacity-50" />

      <div className="relative w-full max-w-md">
        <div className="flex items-center justify-center mb-6">
          <BrandLogo size={40} labelClassName="text-3xl" />
        </div>

        <div className="ed-card p-8 text-center">
          <p className="ed-label">You&apos;ve been invited to join</p>
          <p className="font-display text-3xl font-bold tracking-[0.3em] mt-1">{String(code).toUpperCase()}</p>

          <div className="mt-7">
            {state.kind === "loading" && (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crimson mx-auto" />
            )}

            {state.kind === "need-signin" && (
              <>
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-crimson-soft text-crimson-ink"><School size={26} /></div>
                <p className="mt-4 font-display text-lg font-semibold">Sign in to join your class</p>
                <p className="text-ink-muted text-sm mt-1">Use your Google account — it takes a second, no setup needed.</p>
                <button
                  onClick={() => router.push(`/sign-in?redirect_url=/join/${code}`)}
                  className="ed-btn-primary mt-5 px-6 py-2.5 mx-auto"
                >
                  Continue
                </button>
              </>
            )}

            {state.kind === "done" && state.status === "active" && (
              <>
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-mint-soft text-mint-ink"><CheckCircle2 size={28} /></div>
                <p className="mt-4 font-display text-lg font-semibold">You&apos;re in{state.className ? ` — ${state.className}` : ""}!</p>
                <p className="text-ink-muted text-sm mt-1">Your assignments and class are ready in your Classroom.</p>
                <button onClick={() => router.push("/student/classroom")} className="ed-btn-primary mt-5 px-6 py-2.5 mx-auto">
                  <School size={16} /> Go to my classroom
                </button>
              </>
            )}

            {state.kind === "done" && state.status === "pending" && (
              <>
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gold-soft text-gold-ink"><Clock size={26} /></div>
                <p className="mt-4 font-display text-lg font-semibold">Request sent</p>
                <p className="text-ink-muted text-sm mt-1">Your teacher needs to approve you — you&apos;ll get access the moment they do.</p>
                <button onClick={() => router.push("/student/classroom")} className="ed-btn-primary mt-5 px-6 py-2.5 mx-auto">
                  <School size={16} /> Go to my classroom
                </button>
              </>
            )}

            {state.kind === "error" && (
              <>
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-crimson-soft text-crimson-ink"><XCircle size={26} /></div>
                <p className="mt-4 text-ink-muted">{state.message}</p>
                <button onClick={() => router.push("/student/classroom")} className="ed-btn-ghost mt-5 px-6 py-2.5 mx-auto">
                  Go to my classroom
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
