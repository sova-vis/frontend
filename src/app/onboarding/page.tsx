"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { GraduationCap, School } from "lucide-react";
import { apiCall } from "@/lib/api";
import { useClerkAuth } from "@/lib/useClerkAuth";

// One-time role selection at onboarding: Student or Teacher (spec §1.1). The
// choice sets the account's role and routes to the matching workspace.
export default function OnboardingPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { profile, loading } = useClerkAuth();
  const [saving, setSaving] = useState<"student" | "teacher" | null>(null);
  const [error, setError] = useState("");

  // If this account already chose a role, don't show onboarding again.
  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      router.replace("/sign-in");
      return;
    }
    if (!loading && profile?.onboarding_complete) {
      router.replace(profile.role === "teacher" ? "/teacher/dashboard" : profile.role === "admin" ? "/admin/dashboard" : "/student/dashboard");
    }
  }, [isLoaded, user, loading, profile, router]);

  const choose = async (role: "student" | "teacher") => {
    setSaving(role);
    setError("");
    try {
      const res = await apiCall("/auth/select-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Could not set your role");
      }
      // Clear the cached profile so the fresh role is fetched on the next load.
      if (typeof window !== "undefined" && user?.id) {
        window.localStorage.removeItem(`propel_profile_${user.id}`);
      }
      // Full navigation so the new role is re-fetched cleanly.
      window.location.href = role === "teacher" ? "/teacher/dashboard" : "/student/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(null);
    }
  };

  const firstName = user?.firstName || "";

  return (
    <div className="min-h-screen bg-paper text-ink grid place-items-center px-4 py-10">
      <div className="w-full max-w-2xl text-center">
        <p className="ed-eyebrow">Welcome{firstName ? `, ${firstName}` : ""}</p>
        <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mt-2">
          How will you use <span className="italic text-crimson">Propel</span>?
        </h1>
        <p className="text-ink-muted mt-2">Choose your role to get set up. This is a one-time choice.</p>

        <div className="grid sm:grid-cols-2 gap-4 mt-8">
          <button
            onClick={() => void choose("student")}
            disabled={saving !== null}
            className="ed-card p-8 text-left hover:shadow-lg transition-shadow disabled:opacity-60 group"
          >
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-mint-soft text-mint-ink group-hover:scale-105 transition-transform">
              <GraduationCap size={28} />
            </span>
            <h2 className="font-display text-xl font-semibold mt-4">I&apos;m a Student</h2>
            <p className="text-ink-muted text-sm mt-1">Practise past papers, take assignments, and track your progress.</p>
            <span className="inline-block mt-4 text-sm font-semibold text-crimson">{saving === "student" ? "Setting up…" : "Continue as student →"}</span>
          </button>

          <button
            onClick={() => void choose("teacher")}
            disabled={saving !== null}
            className="ed-card p-8 text-left hover:shadow-lg transition-shadow disabled:opacity-60 group"
          >
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-crimson-soft text-crimson-ink group-hover:scale-105 transition-transform">
              <School size={28} />
            </span>
            <h2 className="font-display text-xl font-semibold mt-4">I&apos;m a Teacher</h2>
            <p className="text-ink-muted text-sm mt-1">Create classes, set assignments, mark with AI, and release results.</p>
            <span className="inline-block mt-4 text-sm font-semibold text-crimson">{saving === "teacher" ? "Setting up…" : "Continue as teacher →"}</span>
          </button>
        </div>

        {error && <p className="text-sm text-crimson mt-4">{error}</p>}
      </div>
    </div>
  );
}
