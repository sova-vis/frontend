"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import PropelLoader from "@/components/ui/PropelLoader";

// The teacher home is now Classes. Keep this route as a redirect so old links
// and the post-login destination still resolve.
export default function TeacherDashboardRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/teacher/classes"); }, [router]);
  return <PropelLoader fullScreen label="Loading your classes…" />;
}
