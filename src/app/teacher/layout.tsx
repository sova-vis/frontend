"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
<<<<<<< HEAD
import { useUser } from "@clerk/nextjs";
import { useClerkAuth } from "@/lib/useClerkAuth";
=======
>>>>>>> c74dca7 (Initial foundation for an O/A Level exam-prep platform combining structured past papers, practice workflows, progress tracking, and future-ready AI evaluation and teacher support features)

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState(false);
<<<<<<< HEAD
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
=======

    useEffect(() => {
        // Check if user is logged in and has teacher role
        const checkAuth = async () => {
            // For now, we'll use a simple localStorage check
            // In production, verify with backend
            const userRole = localStorage.getItem("userRole");

            if (userRole !== "teacher") {
                router.push("/login");
                return;
            }

            setIsAuthorized(true);
        };

        checkAuth();
    }, [router]);

    if (!isAuthorized) {
>>>>>>> c74dca7 (Initial foundation for an O/A Level exam-prep platform combining structured past papers, practice workflows, progress tracking, and future-ready AI evaluation and teacher support features)
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-gray-600">Verifying access...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
