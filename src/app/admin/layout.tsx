"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useClerkAuth } from "@/lib/useClerkAuth";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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

        if (!profile || profile.role !== "admin") {
            router.replace("/");
            return;
        }

        setIsAuthorized(true);
    }, [isLoaded, loading, profile, router, user]);

    if (!isLoaded || loading || !isAuthorized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Verifying admin access...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
