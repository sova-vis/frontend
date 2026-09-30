"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/auth";
import { useClerkAuth } from "@/lib/useClerkAuth";
import { hideAuthSplash } from "@/lib/authSplash";
import { useInactivityLogout } from "@/lib/useInactivityLogout";
import PropelLoader from "@/components/ui/PropelLoader";
import PortalShell from "@/components/portal/PortalShell";

const OWNER_NAV = [
  { name: "Schools", href: "/owner", icon: "briefcase" },
  { name: "Users", href: "/owner/users", icon: "users" },
  { name: "Pro Requests", href: "/owner/pro-requests", icon: "star" },
  { name: "Payments & QR", href: "/owner/payments", icon: "file_text" },
];

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
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
    // 'admin' is the legacy platform-owner role; 'owner' is the new canonical one.
    if (!profile || (profile.role !== "owner" && profile.role !== "admin")) { router.replace("/"); return; }
    setOk(true);
  }, [isLoaded, loading, user, profile, router]);

  if (!isLoaded || loading || !ok) return <PropelLoader fullScreen label="Verifying access…" />;

  return <PortalShell nav={OWNER_NAV} kicker="Platform Owner">{children}</PortalShell>;
}
