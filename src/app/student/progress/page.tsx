"use client";

import { useEffect, useMemo, useState } from "react";
import { Award, CheckCircle2, Target, TrendingUp } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { loadTrackedPapersForUser, TrackedPaper } from "@/lib/paperTracking";

export default function ProgressPage() {
    const { getToken } = useAuth();
    const [trackedPapers, setTrackedPapers] = useState<TrackedPaper[]>([]);

    useEffect(() => {
        let active = true;

        const load = async () => {
            const items = await loadTrackedPapersForUser(getToken);
            if (!active) return;
            setTrackedPapers(items);
        };

        void load();

        return () => {
            active = false;
        };
    }, [getToken]);

    const goalPapers = useMemo(() => trackedPapers.filter((paper) => paper.statuses.includes("goal")), [trackedPapers]);
    const completedGoals = useMemo(() => goalPapers.filter((paper) => paper.statuses.includes("completed")), [goalPapers]);
    const inProgress = useMemo(() => trackedPapers.filter((paper) => paper.statuses.includes("in_progress")), [trackedPapers]);
    const progressPercent = goalPapers.length === 0 ? 0 : Math.round((completedGoals.length / goalPapers.length) * 100);

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold font-display text-gray-900">Your Progress</h1>
                <p className="text-gray-500 mt-1">Track past paper goals and completion momentum.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-amber-50 text-amber-700 rounded-xl">
                            <Target size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Goal Papers</p>
                            <h3 className="text-2xl font-bold text-gray-900">{goalPapers.length}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                            <CheckCircle2 size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Goals Completed</p>
                            <h3 className="text-2xl font-bold text-gray-900">{completedGoals.length}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">In Progress</p>
                            <h3 className="text-2xl font-bold text-gray-900">{inProgress.length}</h3>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-gray-900">Goal Achievement</h3>
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <Award size={16} className="text-amber-600" />
                        {progressPercent}% complete
                    </div>
                </div>
                <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden mb-6">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${progressPercent}%` }} />
                </div>
                {goalPapers.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center">
                        <p className="text-sm text-gray-500 mb-4">No paper goals have been set yet.</p>
                        <a href="/student/goals" className="inline-flex px-5 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-semibold">
                            Set goals
                        </a>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {goalPapers.slice(0, 10).map((paper) => (
                            <div key={paper.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-3">
                                <div className="min-w-0">
                                    <p className={`text-sm font-medium truncate ${paper.statuses.includes("completed") ? "text-gray-400 line-through" : "text-gray-800"}`}>{paper.name}</p>
                                    <p className="text-xs text-gray-400">{paper.type}</p>
                                </div>
                                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${paper.statuses.includes("completed") ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                                    {paper.statuses.includes("completed") ? "Done" : "Goal"}
                                </span>
                            </div>
                        ))}
                        {goalPapers.length > 10 && (
                            <p className="text-center text-xs text-gray-400">+{goalPapers.length - 10} more goals</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
