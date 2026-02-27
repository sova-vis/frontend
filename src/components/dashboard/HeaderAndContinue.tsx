"use client";
import React from "react";
import Image from "next/image";
import { Bell, Flame, ArrowRight, BookOpen, Clock } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useClerkAuth } from "@/lib/useClerkAuth";

export function DashboardHeader() {
    const { user } = useUser();
    const { profile } = useClerkAuth();
    const name = profile?.full_name || user?.firstName || "Student";
    
    // Use Clerk photo or generated avatar
    const photoUrl = user?.imageUrl || 
                     `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;

    return (
        <header className="flex justify-between items-center mb-8">
            <div>
                <h1 className="text-3xl font-bold font-display text-gray-900">
                    Hello, {name} 👋
                </h1>
                <p className="text-gray-500">Let&apos;s make today productive.</p>
            </div>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 bg-highlight/10 text-highlight-foreground px-3 py-1.5 rounded-full text-sm font-semibold">
                    <Flame size={16} className="text-highlight" />
                    <span>12 Day Streak</span>
                </div>
                <button className="p-2 text-gray-400 hover:text-primary transition-colors relative">
                    <Bell size={24} />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                </button>
                <div className="w-10 h-10 rounded-full bg-gray-200 border-2 border-white shadow-sm overflow-hidden">
                    <Image src={photoUrl} alt="Profile" width={40} height={40} className="w-full h-full object-cover" />
                </div>
            </div>
        </header>
    );
}

export function ContinueLearning() {
    const { profile } = useClerkAuth();
    const subjects = profile?.selected_subjects || [];
    const hasActivity = subjects.length > 0;

    if (!hasActivity) {
        return (
            <section className="mb-10">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Get Started</h2>
                </div>
                <div className="bg-gradient-to-tr from-primary to-primary/80 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group cursor-pointer transition-transform hover:scale-[1.01]">
                    <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full translate-x-10 -translate-y-10 blur-3xl"></div>

                    <div className="relative z-10 flex flex-col md:flex-row justify-between md:items-end gap-4">
                        <div>
                            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-lg text-xs font-medium mb-3">
                                <BookOpen size={14} />
                                <span>Begin Your Journey</span>
                            </div>
                            <h3 className="text-2xl font-bold mb-2">Start Practicing</h3>
                            <p className="text-white/80 max-w-md text-sm">Browse past papers and topicals to begin your learning journey.</p>
                        </div>

                        <a href="/student/past-papers" className="bg-white text-primary px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors shadow-sm">
                            Browse Papers <ArrowRight size={16} />
                        </a>
                    </div>
                </div>
            </section>
        );
    }

    // Show with subject from profile
    const firstSubject = subjects[0];
    
    return (
        <section className="mb-10">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Continue Learning</h2>
            </div>
            <div className="bg-gradient-to-tr from-primary to-primary/80 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group cursor-pointer transition-transform hover:scale-[1.01]">
                <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full translate-x-10 -translate-y-10 blur-3xl"></div>

                <div className="relative z-10 flex flex-col md:flex-row justify-between md:items-end gap-4">
                    <div>
                        <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-lg text-xs font-medium mb-3">
                            <BookOpen size={14} />
                            <span>{firstSubject}</span>
                        </div>
                        <h3 className="text-2xl font-bold mb-2">Past Papers & Topicals</h3>
                        <p className="text-white/80 max-w-md text-sm">Practice questions and review past papers for {firstSubject}.</p>
                    </div>

                    <a href="/student/past-papers" className="bg-white text-primary px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors shadow-sm">
                        Start Practicing <ArrowRight size={16} />
                    </a>
                </div>
            </div>
        </section>
    );
}
