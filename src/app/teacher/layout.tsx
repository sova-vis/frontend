"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useClerkAuth } from "@/lib/useClerkAuth";
import { hideAuthSplash } from "@/lib/authSplash";
import { useInactivityLogout } from "@/lib/useInactivityLogout";
import PropelLoader from "@/components/ui/PropelLoader";
import TeacherShell from "@/components/teacher/TeacherShell";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState(false);
    const { user, isLoaded } = useUser();
    const { profile, loading } = useClerkAuth();
    useInactivityLogout(30);

    // Destination reached → drop the post-login splash.
    useEffect(() => { if (isAuthorized) hideAuthSplash(); }, [isAuthorized]);

    useEffect(() => {
        if (!isLoaded || loading) return;

        if (!user) {
            router.replace("/");
            return;
        }

        // New account that hasn't chosen a role yet → onboarding.
        if (profile && profile.onboarding_complete === false) {
            router.replace("/onboarding");
            return;
        }

        if (!profile || profile.role !== "teacher") {
            router.replace("/");
            return;
        }

        setIsAuthorized(true);
    }, [isLoaded, loading, user, profile, router]);

    if (!isLoaded || loading || !isAuthorized) {
        return <PropelLoader fullScreen label="Verifying access…" />;
    }

    return <TeacherShell>{children}</TeacherShell>;
}
