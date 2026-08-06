"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, ClipboardList } from "lucide-react";
import { AvailableAssignment, getAvailableAssignments } from "@/lib/submissions";

const STATUS_STYLE: Record<string, string> = {
  not_started: "bg-surface-soft text-ink-muted",
  in_progress: "ed-pill-gold",
  submitted: "ed-pill-mint",
  late: "ed-pill-clay",
  returned: "ed-pill-gold",
};
const STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
  late: "Submitted late",
  returned: "Reopened",
};

export default function StudentAssignmentsPage() {
  const [assignments, setAssignments] = useState<AvailableAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        setAssignments(await getAvailableAssignments());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load assignments");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-paper text-ink px-4 md:px-8 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">
            Your <span className="italic text-crimson">Assignments</span>
          </h1>
          <p className="text-ink-muted mt-1">Assignments set by your teachers.</p>
        </div>

        {error && <p className="text-sm text-crimson">{error}</p>}

        {loading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-20 rounded-[1.25rem] bg-surface-soft animate-pulse" />
            ))}
          </div>
        ) : assignments.length === 0 ? (
          <div className="ed-card p-10 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-crimson-soft text-crimson-ink">
              <ClipboardList size={26} />
            </div>
            <p className="mt-4 text-ink-muted">No assignments right now. Check back later.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((a) => {
              const done = a.submission_status === "submitted" || a.submission_status === "late";
              return (
                <Link
                  key={a.id}
                  href={`/student/assignments/${a.id}`}
                  className="ed-card p-4 flex items-center gap-4 hover:shadow-md transition-shadow"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-ink truncate">{a.title}</h3>
                      <span className={`text-[0.65rem] ${STATUS_STYLE[a.submission_status]}`}>
                        {STATUS_LABEL[a.submission_status]}
                      </span>
                    </div>
                    {a.deadline_at && (
                      <p className="text-xs text-ink-faint mt-0.5 inline-flex items-center gap-1">
                        <CalendarClock size={12} /> Due {new Date(a.deadline_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <span className="ed-btn-ghost px-3 py-1.5 text-xs shrink-0">{done ? "Review" : "Open"}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
