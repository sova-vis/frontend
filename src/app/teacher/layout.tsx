"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useClerkAuth } from "@/lib/useClerkAuth";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState(false);
    const { user, isLoaded } = useUser();
    const { profile, loading } = useClerkAuth();

    useEffect(() => {
        if (!isLoaded || loading) return;

        if (!user) {
            router.replace("/sign-in");
            return;
        }

        if (!profile || profile.role !== "teacher") {
            router.replace("/");
            return;
        }

        setIsAuthorized(true);
    }, [isLoaded, loading, user, profile, router]);

    if (!isLoaded || loading || !isAuthorized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-paper">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-crimson mx-auto mb-4"></div>
                    <p className="text-ink-muted">Verifying access...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
