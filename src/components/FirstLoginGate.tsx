"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useClerkAuth } from "@/lib/useClerkAuth";

/**
 * Forces a freshly-issued staff account (owner / school-admin / teacher) to set a
 * new password on first sign-in before using the app (spec §3.1). Mounted once in
 * the root layout; renders nothing. The flag lives on the profile
 * (must_change_password) and is cleared by /change-password.
 */
export default function FirstLoginGate() {
  const { user, profile, loading } = useClerkAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading || !user) return;
    if (profile?.must_change_password && pathname !== "/change-password") {
      router.replace("/change-password");
    }
  }, [loading, user, profile, pathname, router]);

  return null;
}
