"use client";

import { TrendingUp, BookOpen, ArrowRight } from "lucide-react";
import { useClerkAuth } from "@/lib/useClerkAuth";
import Link from "next/link";

const SUBJECT_COLORS: Record<string, string> = {
    "Physics": "bg-blue-500",
    "Chemistry": "bg-emerald-500",
    "Biology": "bg-green-500",
    "Mathematics": "bg-violet-500",
    "English Language": "bg-sky-500",
    "Islamiyat": "bg-teal-500",
    "Pakistan Studies": "bg-orange-500",
    "Computer Science": "bg-indigo-500",
    "Economics": "bg-amber-500",
    "Geography": "bg-lime-500",
    "History": "bg-rose-500",
    "Accounting": "bg-cyan-500",
    "Additional Mathematics": "bg-purple-500",
};

function getSubjectColor(name: string): string {
    for (const [key, color] of Object.entries(SUBJECT_COLORS)) {
        if (name.toLowerCase().includes(key.toLowerCase())) return color;
    }
    return "bg-primary";
}

export default function ProgressSnapshot() {
    const { profile } = useClerkAuth();
    const subjects: string[] = profile?.selected_subjects || [];

    if (subjects.length === 0) {
        return (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-full flex flex-col">
                <div className="flex items-center gap-2 mb-6">
                    <TrendingUp size={18} className="text-primary" />
                    <h3 className="font-bold text-gray-900">Your Subjects</h3>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                        <BookOpen size={20} className="text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-500 mb-4">No subjects added yet. Go to Settings to select your subjects.</p>
                    <Link
                        href="/student/settings"
                        className="text-sm font-semibold text-primary hover:underline"
                    >
                        Add subjects →
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <TrendingUp size={18} className="text-primary" />
                    Your Subjects
                </h3>
                <Link href="/student/progress" className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
                    Progress <ArrowRight size={12} />
                </Link>
            </div>

            <div className="space-y-4 flex-1">
                {subjects.map((subject) => (
                    <div key={subject} className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getSubjectColor(subject)}`} />
                        <span className="text-sm font-medium text-gray-800 flex-1 truncate">{subject}</span>
                        <Link
                            href="/student/past-papers"
                            className="text-xs text-gray-400 hover:text-primary transition-colors font-medium"
                        >
                            Practice
                        </Link>
                    </div>
                ))}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-50">
                <p className="text-xs text-gray-400 text-center">
                    {subjects.length} subject{subjects.length > 1 ? "s" : ""} selected &middot; Practice to track progress
                </p>
            </div>
        </div>
    );
}
