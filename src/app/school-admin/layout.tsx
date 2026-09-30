"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/auth";
import { useClerkAuth } from "@/lib/useClerkAuth";
import { hideAuthSplash } from "@/lib/authSplash";
import { useInactivityLogout } from "@/lib/useInactivityLogout";
import PropelLoader from "@/components/ui/PropelLoader";
import PortalShell from "@/components/portal/PortalShell";

const SA_NAV = [
  { name: "Overview", href: "/school-admin", icon: "dashboard" },
  { name: "Teachers", href: "/school-admin/teachers", icon: "users" },
];

export default function SchoolAdminLayout({ children }: { children: React.ReactNode }) {
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
    if (!profile || profile.role !== "school_admin") { router.replace("/"); return; }
    setOk(true);
  }, [isLoaded, loading, user, profile, router]);

  if (!isLoaded || loading || !ok) return <PropelLoader fullScreen label="Verifying access…" />;

  return <PortalShell nav={SA_NAV} kicker="School Admin">{children}</PortalShell>;
}
