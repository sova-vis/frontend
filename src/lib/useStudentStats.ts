"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import { loadTrackedPapersForUser, TrackedPaper } from "./paperTracking";

export interface StudentStats {
  loading: boolean;
  papers: TrackedPaper[];
  /** real counts derived from /tracking/papers */
  completedCount: number;
  inProgressCount: number;
  bookmarkedCount: number;
  goalsTotal: number;
  goalsDone: number;
  /** most recent in-progress paper, for the "resume" card */
  resume: TrackedPaper | null;
  /** recent tracking events, newest first */
  activity: { paper: TrackedPaper; status: string; at: string }[];
  refresh: () => void;
}

const STATUS_RANK: Record<string, number> = { completed: 0, in_progress: 1, goal: 2, bookmarked: 3 };

export function useStudentStats(): StudentStats {
  const { getToken } = useAuth();
  const [papers, setPapers] = useState<TrackedPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadTrackedPapersForUser(() => getToken())
      .then((items) => { if (!cancelled) setPapers(items); })
      .catch(() => { if (!cancelled) setPapers([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [getToken, nonce]);

  const has = (p: TrackedPaper, s: string) => p.statuses.includes(s as never);
  const completed = papers.filter((p) => has(p, "completed"));
  const inProgress = papers.filter((p) => has(p, "in_progress"));
  const bookmarked = papers.filter((p) => has(p, "bookmarked"));
  const goals = papers.filter((p) => has(p, "goal"));
  const goalsDone = goals.filter((p) => has(p, "completed")).length;

  const resume =
    [...inProgress].sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""))[0] || null;

  const activity = [...papers]
    .sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""))
    .slice(0, 6)
    .map((p) => {
      const status = [...p.statuses].sort((a, b) => (STATUS_RANK[a] ?? 9) - (STATUS_RANK[b] ?? 9))[0];
      return { paper: p, status, at: p.savedAt };
    });

  return {
    loading,
    papers,
    completedCount: completed.length,
    inProgressCount: inProgress.length,
    bookmarkedCount: bookmarked.length,
    goalsTotal: goals.length,
    goalsDone,
    resume,
    activity,
    refresh,
  };
}

/** "2h ago" style relative time from an ISO string. */
export function timeAgo(iso: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
