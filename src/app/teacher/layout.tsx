"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/auth";
import { useClerkAuth } from "@/lib/useClerkAuth";
import { hideAuthSplash } from "@/lib/authSplash";
import { useInactivityLogout } from "@/lib/useInactivityLogout";
import PropelLoader from "@/components/ui/PropelLoader";
import PortalShell from "@/components/portal/PortalShell";

// Rebuilt teacher portal (Sept 2026 spec) on the shared .pr design system.
// Classes is the home; Assignments is the teach→mark→release loop (§5.2+).
const TEACHER_NAV = [
  { name: "Classes", href: "/teacher/classes", icon: "users" },
  { name: "Assignments", href: "/teacher/assignments", icon: "file_text" },
  { name: "Insights", href: "/teacher/insights", icon: "chart" },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);
  const { user, isLoaded } = useUser();
  const { profile, loading } = useClerkAuth();
  useInactivityLogout(30);

  useEffect(() => { if (ok) hideAuthSplash(); }, [ok]);

  useEffect(() => {
    if (!isLoaded || loading) return;
    if (!user) { router.replace("/"); return; }
    if (profile && profile.onboarding_complete === false) { router.replace("/onboarding"); return; }
    if (!profile || profile.role !== "teacher") { router.replace("/"); return; }
    setOk(true);
  }, [isLoaded, loading, user, profile, router]);

  if (!isLoaded || loading || !ok) return <PropelLoader fullScreen label="Verifying access…" />;

  return <PortalShell nav={TEACHER_NAV} kicker="Teacher">{children}</PortalShell>;
}
