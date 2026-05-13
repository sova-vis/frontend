"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, FileText, Target } from "lucide-react";
import Link from "next/link";
import { loadTrackedPapersForUser, TrackedPaper } from "@/lib/paperTracking";
import { useAuth } from "@clerk/nextjs";

export default function ProgressSnapshot() {
  const { getToken } = useAuth();
  const [trackedPapers, setTrackedPapers] = useState<TrackedPaper[]>([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const items = await loadTrackedPapersForUser(getToken);
      if (!active) return;
      setTrackedPapers(items);
    };

    load();

    return () => {
      active = false;
    };
  }, [getToken]);

  const inProgressPapers = useMemo(
    () => trackedPapers.filter((paper) => paper.statuses.includes("in_progress")),
    [trackedPapers]
  );
  const goalPapers = useMemo(
    () => trackedPapers.filter((paper) => paper.statuses.includes("goal")),
    [trackedPapers]
  );
  const completedGoals = useMemo(
    () => goalPapers.filter((paper) => paper.statuses.includes("completed")),
    [goalPapers]
  );
  const goalProgress = goalPapers.length === 0 ? 0 : Math.round((completedGoals.length / goalPapers.length) * 100);
  const visiblePapers = inProgressPapers.slice(0, 5);

  if (inProgressPapers.length === 0 && goalPapers.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-full min-h-[560px] flex flex-col">
        <div className="flex items-center gap-2 mb-6">
          <Target size={18} className="text-primary" />
          <h3 className="font-bold text-gray-900">Paper Progress</h3>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
            <FileText size={20} className="text-gray-400" />
          </div>
          <p className="text-sm text-gray-500 mb-4">
            No paper goals yet.
            <br />
            Build a target list from your selected subjects.
          </p>
          <Link
            href="/student/goals"
            className="inline-flex items-center gap-2 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
          >
            Set paper goals <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-full min-h-[620px] flex flex-col">
      <div className="flex justify-between items-center mb-5">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <Target size={18} className="text-amber-700" />
          Paper Progress
        </h3>
        <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
          {goalPapers.length} total
        </span>
      </div>

      <Link href="/student/goals" className="rounded-2xl border border-amber-100 bg-amber-50 p-4 mb-5 block hover:bg-amber-100/70 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-amber-800">Past paper goals</span>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-900">
            {completedGoals.length}/{goalPapers.length}
            <ArrowRight size={12} />
          </span>
        </div>
        <div className="h-2.5 bg-white rounded-full overflow-hidden">
          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${goalProgress}%` }} />
        </div>
        <p className="mt-2 text-xs text-amber-900/70">{goalProgress}% completed</p>
      </Link>

      <Link
        href="/student/goals"
        className="mb-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
      >
        Open Goals Tracker <ArrowRight size={14} />
      </Link>

      {goalPapers.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-gray-900 text-sm">Current Goals</h4>
            <span className="text-xs text-gray-400">{completedGoals.length} done</span>
          </div>
          <div className="space-y-3">
            {goalPapers.slice(0, 4).map((paper) => (
              <Link key={paper.id} href="/student/goals" className="flex items-start gap-3 rounded-xl border border-gray-100 p-3 hover:border-gray-200 hover:bg-gray-50 transition-colors">
                <div className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${paper.statuses.includes("completed") ? "bg-emerald-500" : "bg-amber-500"}`} />
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate ${paper.statuses.includes("completed") ? "text-gray-400 line-through" : "text-gray-800"}`}>{paper.name}</p>
                  <p className="text-xs text-gray-400">{paper.type}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {inProgressPapers.length > 0 && (
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
            <Clock3 size={16} className="text-primary" />
            In Progress
          </h4>
          <CheckCircle2 size={15} className="text-emerald-600" />
        </div>
      )}

      <div className="space-y-4 flex-1">
        {visiblePapers.map((paper) => (
          <div key={paper.id} className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full flex-shrink-0 bg-primary" />
            <span className="text-sm font-medium text-gray-800 flex-1 truncate">{paper.name}</span>
            <Link
              href="/student/goals"
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
