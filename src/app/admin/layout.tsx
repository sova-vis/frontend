"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useClerkAuth } from "@/lib/useClerkAuth";
import { hideAuthSplash } from "@/lib/authSplash";
import { useInactivityLogout } from "@/lib/useInactivityLogout";
import PropelLoader from "@/components/ui/PropelLoader";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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

        const email = (user.primaryEmailAddress?.emailAddress || "").toLowerCase();
        const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "sovavis2025@gmail.com")
            .split(",")
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean);
        const isAdminByEmail = adminEmails.includes(email);

        if (!isAdminByEmail && (!profile || profile.role !== "admin")) {
            router.replace("/");
            return;
        }

        setIsAuthorized(true);
    }, [isLoaded, loading, profile, router, user]);

    if (!isLoaded || loading || !isAuthorized) {
        return <PropelLoader fullScreen label="Verifying admin access…" />;
    }

    return <>{children}</>;
}
