"use client";
import React from "react";
import { ArrowRight, BookOpen, Sparkles } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useClerkAuth } from "@/lib/useClerkAuth";
import Image from "next/image";

export function DashboardHeader() {
    const { user } = useUser();
    const { profile } = useClerkAuth();
    const name = profile?.full_name || user?.firstName || "Student";
    const photoUrl = user?.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;
    const subjects: string[] = profile?.selected_subjects || [];

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 17) return "Good afternoon";
        return "Good evening";
    };

    return (
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-primary/20 shadow-sm flex-shrink-0">
                    <Image src={photoUrl} alt="Profile" width={48} height={48} className="w-full h-full object-cover" />
                </div>
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold font-display text-gray-900">
                        {getGreeting()}, {name}
                    </h1>
                    <p className="text-gray-500 text-sm mt-0.5">
                        {subjects.length > 0
                            ? `Studying ${subjects.slice(0, 2).join(", ")}${subjects.length > 2 ? ` +${subjects.length - 2} more` : ""}`
                            : "Let's make today productive."}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/5 border border-primary/15 rounded-full text-xs font-semibold text-primary">
                    <Sparkles size={12} />
                    AI-Powered Learning
                </div>
            </div>
        </header>
    );
}

export function ContinueLearning() {
    const { profile } = useClerkAuth();
    const subjects: string[] = profile?.selected_subjects || [];
    const hasActivity = subjects.length > 0;

    if (!hasActivity) {
        return (
            <section className="mb-8">
                <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(136,14,79,0.3),_transparent_60%)]" />
                    <div className="relative z-10 flex flex-col md:flex-row justify-between md:items-center gap-4">
                        <div>
                            <div className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-lg text-xs font-medium mb-3">
                                <BookOpen size={12} />
                                <span>Get started</span>
                            </div>
                            <h3 className="text-xl font-bold mb-1">Start Your Exam Prep</h3>
                            <p className="text-white/70 max-w-md text-sm">Browse past papers and topical practice questions to begin preparing.</p>
                        </div>
                        <a
                            href="/student/past-papers"
                            className="flex-shrink-0 bg-white text-gray-900 px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 hover:bg-gray-100 transition-colors"
                        >
                            Browse Papers <ArrowRight size={15} />
                        </a>
                    </div>
                </div>
            </section>
        );
    }

    const firstSubject = subjects[0];

    return (
        <section className="mb-8">
            <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(136,14,79,0.3),_transparent_60%)]" />
                <div className="relative z-10 flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <div>
                        <div className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-lg text-xs font-medium mb-3">
                            <BookOpen size={12} />
                            <span>{firstSubject}</span>
                        </div>
                        <h3 className="text-xl font-bold mb-1">Continue Practicing</h3>
                        <p className="text-white/70 max-w-md text-sm">
                            Practice past papers and topicals for {firstSubject} and {subjects.length - 1} other {subjects.length - 1 === 1 ? "subject" : "subjects"}.
                        </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                        <a
                            href="/student/past-papers"
                            className="bg-white text-gray-900 px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 hover:bg-gray-100 transition-colors"
                        >
                            Past Papers <ArrowRight size={15} />
                        </a>
                    </div>
                </div>
            </div>
        </section>
    );
}
