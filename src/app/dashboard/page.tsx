"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useClerkAuth } from "@/lib/useClerkAuth";

// Legacy route. Some auth flows still land here — bounce to the real, role-based
// dashboard so nobody gets stuck on a placeholder.
export default function DashboardRedirect() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { profile, loading } = useClerkAuth();

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      router.replace("/");
      return;
    }

    let resolved: { role?: string; onboarding_complete?: boolean } | null = !loading ? profile : null;
    if (!resolved && typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(`propel_profile_${user.id}`);
        if (raw) resolved = JSON.parse(raw);
      } catch {
        /* ignore */
      }
    }

    // Wait for the profile before deciding — routing on an unknown profile would
    // send the wrong role to the wrong dashboard (and looked like a flash).
    if (!resolved && loading) return;

    if (resolved && resolved.onboarding_complete === false) {
      router.replace("/onboarding");
      return;
    }

    const metadataRole = typeof user.publicMetadata?.role === "string" ? user.publicMetadata.role : null;
    const role = resolved?.role || metadataRole || "student";
    router.replace(role === "teacher" ? "/teacher/dashboard" : role === "admin" ? "/admin/dashboard" : "/student/dashboard");
  }, [isLoaded, user, loading, profile, router]);

  return (
    <div className="min-h-screen grid place-items-center bg-paper">
      <div className="flex items-center gap-3 text-ink-muted">
        <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-crimson" />
        <span className="text-sm font-semibold">Loading your dashboard…</span>
      </div>
    </div>
  );
}
