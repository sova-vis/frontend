"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import PropelLoader from "@/components/ui/PropelLoader";

// Retired: the admin console is now the Owner console at /owner (Schools, Users,
// Pro Requests, Payments & QR). This route just forwards there.
export default function AdminDashboardRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/owner"); }, [router]);
  return <PropelLoader fullScreen label="Opening the owner console…" />;
}
