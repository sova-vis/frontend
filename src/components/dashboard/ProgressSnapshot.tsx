"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, ArrowRight, FileText } from "lucide-react";
import Link from "next/link";
import { loadTrackedPapers, TrackedPaper } from "@/lib/paperTracking";

export default function ProgressSnapshot() {
    const [trackedPapers, setTrackedPapers] = useState<TrackedPaper[]>([]);

    useEffect(() => {
        setTrackedPapers(loadTrackedPapers());
    }, []);

    const inProgressPapers = useMemo(
        () => trackedPapers.filter((paper) => paper.statuses.includes("in_progress")),
        [trackedPapers]
    );

    const visiblePapers = inProgressPapers.slice(0, 6);

    if (inProgressPapers.length === 0) {
        return (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-full flex flex-col">
                <div className="flex items-center gap-2 mb-6">
                    <Clock3 size={18} className="text-primary" />
                    <h3 className="font-bold text-gray-900">In Progress Papers</h3>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                        <FileText size={20} className="text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-500 mb-4">
                        No papers marked in progress yet.
                        <br />
                        Use the clock icon on student past papers.
                    </p>
                    <Link
                        href="/student/past-papers"
                        className="text-sm font-semibold text-primary hover:underline"
                    >
                        Open past papers →
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <Clock3 size={18} className="text-primary" />
                    In Progress Papers
                </h3>
                <Link href="/student/bookmarks" className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
                    All tracked <ArrowRight size={12} />
                </Link>
            </div>

            <div className="space-y-4 flex-1">
                {visiblePapers.map((paper) => (
                    <div key={paper.id} className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full flex-shrink-0 bg-primary" />
                        <span className="text-sm font-medium text-gray-800 flex-1 truncate">{paper.name}</span>
                        <Link
                            href="/student/bookmarks"
                            className="text-xs text-gray-400 hover:text-primary transition-colors font-medium"
                        >
                            Open
                        </Link>
                    </div>
                ))}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-50">
                <p className="text-xs text-gray-400 text-center">
                    {inProgressPapers.length} paper{inProgressPapers.length > 1 ? "s" : ""} in progress
                </p>
            </div>
        </div>
    );
}
