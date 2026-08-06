"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { apiCall } from "@/lib/api";

type JoinState =
  | { kind: "loading" }
  | { kind: "need-signin" }
  | { kind: "done"; status: "active" | "pending"; className?: string }
  | { kind: "error"; message: string };

// Student join-by-link (spec §3.2). Resolves the same enrolment as the code/QR.
export default function JoinPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = (params?.code ?? "") as string;
  const { isLoaded, isSignedIn } = useUser();
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
          body: JSON.stringify({ code: code }),
        });
        const body = await res.json();
        if (!res.ok) {
          setState({ kind: "error", message: body.error || "Could not join this class." });
          return;
        }
        setState({ kind: "done", status: body.status, className: body.class_name });
      } catch {
        setState({ kind: "error", message: "Something went wrong. Please try again." });
      }
    })();
  }, [isLoaded, isSignedIn, code]);

  return (
    <div className="min-h-screen bg-paper text-ink grid place-items-center px-4">
      <div className="ed-card p-8 max-w-md w-full text-center">
        <p className="ed-label">Class code</p>
        <p className="font-display text-3xl font-bold tracking-[0.3em] mt-1">{String(code).toUpperCase()}</p>

        <div className="mt-6">
          {state.kind === "loading" && (
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crimson mx-auto" />
          )}

          {state.kind === "need-signin" && (
            <>
              <p className="text-ink-muted">Sign in to join this class.</p>
              <button
                onClick={() => router.push(`/sign-in?redirect_url=/join/${code}`)}
                className="ed-btn-primary mt-4 px-5 py-2.5 mx-auto"
              >
                Sign in
              </button>
            </>
          )}

          {state.kind === "done" && state.status === "active" && (
            <>
              <CheckCircle2 className="text-mint-ink mx-auto" size={40} />
              <p className="mt-3 font-semibold">You&apos;re in{state.className ? ` — ${state.className}` : ""}!</p>
              <button onClick={() => router.push("/student/dashboard")} className="ed-btn-primary mt-4 px-5 py-2.5 mx-auto">
                Go to dashboard
              </button>
            </>
          )}

          {state.kind === "done" && state.status === "pending" && (
            <>
              <Clock className="text-gold-ink mx-auto" size={40} />
              <p className="mt-3 font-semibold">Request sent</p>
              <p className="text-ink-muted text-sm mt-1">Your teacher needs to approve you. You&apos;ll get access once they do.</p>
              <button onClick={() => router.push("/student/dashboard")} className="ed-btn-ghost mt-4 px-5 py-2.5 mx-auto">
                Back to dashboard
              </button>
            </>
          )}

          {state.kind === "error" && (
            <>
              <XCircle className="text-crimson mx-auto" size={40} />
              <p className="mt-3 text-ink-muted">{state.message}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
