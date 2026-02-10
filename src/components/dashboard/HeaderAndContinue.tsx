<<<<<<< HEAD
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
=======
import React from "react";
import { Bell, Flame } from "lucide-react";

export function DashboardHeader() {
    const [name, setName] = React.useState("Student");

    React.useEffect(() => {
        const storedName = localStorage.getItem("studentName");
        if (storedName) setName(storedName);
    }, []);
>>>>>>> c74dca7 (Initial foundation for an O/A Level exam-prep platform combining structured past papers, practice workflows, progress tracking, and future-ready AI evaluation and teacher support features)

    return (
        <header className="flex justify-between items-center mb-8">
            <div>
                <h1 className="text-3xl font-bold font-display text-gray-900">
                    Hello, {name} 👋
                </h1>
<<<<<<< HEAD
                <p className="text-gray-500">Let&apos;s make today productive.</p>
=======
                <p className="text-gray-500">Let's make today productive.</p>
>>>>>>> c74dca7 (Initial foundation for an O/A Level exam-prep platform combining structured past papers, practice workflows, progress tracking, and future-ready AI evaluation and teacher support features)
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
<<<<<<< HEAD
                    <Image src={photoUrl} alt="Profile" width={40} height={40} className="w-full h-full object-cover" />
=======
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`} alt="Profile" />
>>>>>>> c74dca7 (Initial foundation for an O/A Level exam-prep platform combining structured past papers, practice workflows, progress tracking, and future-ready AI evaluation and teacher support features)
                </div>
            </div>
        </header>
    );
}

<<<<<<< HEAD
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
    
=======
import { ArrowRight, BookOpen, Clock } from "lucide-react";

export function ContinueLearning() {
>>>>>>> c74dca7 (Initial foundation for an O/A Level exam-prep platform combining structured past papers, practice workflows, progress tracking, and future-ready AI evaluation and teacher support features)
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
<<<<<<< HEAD
                            <span>{firstSubject}</span>
                        </div>
                        <h3 className="text-2xl font-bold mb-2">Past Papers & Topicals</h3>
                        <p className="text-white/80 max-w-md text-sm">Practice questions and review past papers for {firstSubject}.</p>
                    </div>

                    <a href="/student/past-papers" className="bg-white text-primary px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors shadow-sm">
                        Start Practicing <ArrowRight size={16} />
                    </a>
=======
                            <span>Mathematics 9709</span>
                        </div>
                        <h3 className="text-2xl font-bold mb-2">Integration Techniques</h3>
                        <p className="text-white/80 max-w-md text-sm">You were practicing past paper questions from Summer 2023. 5 questions remaining.</p>
                    </div>

                    <button className="bg-white text-primary px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors shadow-sm">
                        Resume Session <ArrowRight size={16} />
                    </button>
>>>>>>> c74dca7 (Initial foundation for an O/A Level exam-prep platform combining structured past papers, practice workflows, progress tracking, and future-ready AI evaluation and teacher support features)
                </div>
            </div>
        </section>
    );
}
