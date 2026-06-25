"use client";

import { useEffect, useMemo, useState } from "react";
import { Award, CheckCircle2, Target, TrendingUp } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { loadTrackedPapersForUser, TrackedPaper } from "@/lib/paperTracking";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/Motion";

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
        <div className="min-h-full bg-transparent p-4 py-6 md:p-8 max-w-6xl mx-auto">
            <Reveal>
                <header className="mb-8">
                    <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-ink">
                        Your <span className="italic text-crimson">Progress</span>
                    </h1>
                    <p className="mt-1 text-sm text-ink-muted">Track past paper goals and completion momentum.</p>
                </header>
            </Reveal>

            <Stagger className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StaggerItem className="ed-card p-5 md:p-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gold-soft text-gold-ink rounded-xl">
                            <Target size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-ink-muted">Goal Papers</p>
                            <h3 className="font-display text-2xl font-semibold tracking-tight text-ink">{goalPapers.length}</h3>
                        </div>
                    </div>
                </StaggerItem>
                <StaggerItem className="ed-card p-5 md:p-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-mint-soft text-mint-ink rounded-xl">
                            <CheckCircle2 size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-ink-muted">Goals Completed</p>
                            <h3 className="font-display text-2xl font-semibold tracking-tight text-ink">{completedGoals.length}</h3>
                        </div>
                    </div>
                </StaggerItem>
                <StaggerItem className="ed-card p-5 md:p-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-clay-soft text-clay-ink rounded-xl">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-ink-muted">In Progress</p>
                            <h3 className="font-display text-2xl font-semibold tracking-tight text-ink">{inProgress.length}</h3>
                        </div>
                    </div>
                </StaggerItem>
            </Stagger>

            <Reveal delay={0.1}>
                <div className="ed-card p-6 md:p-8">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-display text-lg font-semibold tracking-tight text-ink">Goal Achievement</h3>
                        <div className="flex items-center gap-2 text-sm font-semibold text-ink-muted">
                            <Award size={16} className="text-gold-deep" />
                            {progressPercent}% complete
                        </div>
                    </div>
                    <div className="h-4 w-full bg-surface-soft rounded-full overflow-hidden mb-6">
                        <div className="h-full bg-crimson rounded-full" style={{ width: `${progressPercent}%` }} />
                    </div>
                    {goalPapers.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-line p-6 text-center">
                            <p className="text-sm text-ink-muted mb-4">No paper goals have been set yet.</p>
                            <a href="/student/goals" className="ed-btn-ink inline-flex px-5 py-2.5 text-sm">
                                Set goals
                            </a>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {goalPapers.slice(0, 10).map((paper) => (
                                <div key={paper.id} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
                                    <div className="min-w-0">
                                        <p className={`text-sm font-medium truncate ${paper.statuses.includes("completed") ? "text-ink-faint line-through" : "text-ink"}`}>{paper.name}</p>
                                        <p className="text-xs text-ink-faint">{paper.type}</p>
                                    </div>
                                    <span className={paper.statuses.includes("completed") ? "ed-pill-mint" : "ed-pill-gold"}>
                                        {paper.statuses.includes("completed") ? "Done" : "Goal"}
                                    </span>
                                </div>
                            ))}
                            {goalPapers.length > 10 && (
                                <p className="text-center text-xs text-ink-faint">+{goalPapers.length - 10} more goals</p>
                            )}
                        </div>
                    )}
                </div>
            </Reveal>
        </div>
    );
}
