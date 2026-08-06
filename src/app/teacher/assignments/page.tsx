"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, FileText, Plus } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/Motion";
import { Assignment, listAssignments } from "@/lib/assignments";
import { TeacherClass, listClasses } from "@/lib/teacherClasses";

const STATUS_STYLE: Record<string, string> = {
  draft: "ed-pill-clay",
  scheduled: "ed-pill-gold",
  published: "ed-pill-mint",
  closed: "bg-surface-soft text-ink-muted",
};

export default function AssignmentsPage() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState("");
  const [tab, setTab] = useState<"all" | "pending" | "done">("all");
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const [a, c] = await Promise.all([listAssignments(), listClasses()]);
        setAssignments(a);
        setClasses(c);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load assignments");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const classNameOf = (id: string) => classes.find((c) => c.id === id)?.name || "Class";
  const pendingCount = useMemo(() => assignments.filter((a) => (a.pending_reviews ?? 0) > 0).length, [assignments]);
  const visible = useMemo(() => {
    let arr = classFilter ? assignments.filter((a) => a.class_id === classFilter) : assignments;
    if (tab === "pending") arr = arr.filter((a) => (a.pending_reviews ?? 0) > 0);
    else if (tab === "done") arr = arr.filter((a) => (a.status === "published" || a.status === "closed") && (a.pending_reviews ?? 0) === 0);
    return arr;
  }, [assignments, classFilter, tab]);

  return (
    <div className="px-4 md:px-8 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">
                Your <span className="italic text-crimson">Assignments</span>
              </h1>
              <p className="text-ink-muted mt-1">{assignments.length} total</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => router.push("/teacher/questions")} className="ed-btn-ghost px-4 py-2.5">
                Custom questions
              </button>
              <button onClick={() => router.push("/teacher/assignments/new")} className="ed-btn-primary px-4 py-2.5">
                <Plus size={16} /> New assignment
              </button>
            </div>
          </div>
        </Reveal>

        {assignments.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1">
              {([
                { k: "all", label: "All" },
                { k: "pending", label: `Pending reviews${pendingCount ? ` (${pendingCount})` : ""}` },
                { k: "done", label: "Done" },
              ] as const).map((t) => (
                <button
                  key={t.k}
                  onClick={() => setTab(t.k)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${tab === t.k ? "border-crimson bg-crimson-soft text-crimson-ink" : "border-line text-ink-muted hover:bg-surface-soft"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {classes.length > 0 && (
              <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="ed-input px-3 py-2 text-sm w-auto ml-auto">
                <option value="">All classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {error && <p className="text-sm text-crimson">{error}</p>}

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 rounded-[1.25rem] bg-surface-soft animate-pulse" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="ed-card p-10 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-crimson-soft text-crimson-ink">
              <FileText size={26} />
            </div>
            <h3 className="mt-4 font-display text-xl font-semibold">No assignments yet</h3>
            <p className="mt-1 text-ink-muted">Create one from a full paper or a set of topical questions.</p>
            <button onClick={() => router.push("/teacher/assignments/new")} className="ed-btn-primary mt-5 px-5 py-2.5 mx-auto">
              <Plus size={16} /> New assignment
            </button>
          </div>
        ) : (
          <Stagger className="space-y-3">
            {visible.map((a) => (
              <StaggerItem key={a.id}>
                <Link href={`/teacher/assignments/${a.id}`} className="ed-card p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-ink truncate">{a.title}</h3>
                      <span className={`text-[0.65rem] ${STATUS_STYLE[a.status]}`}>{a.status}</span>
                      {(a.pending_reviews ?? 0) > 0 ? (
                        <span className="ed-pill-crimson text-[0.6rem]">{a.pending_reviews} to review</span>
                      ) : (a.status === "published" || a.status === "closed") ? (
                        <span className="ed-pill-mint text-[0.6rem]">Reviewed</span>
                      ) : null}
                    </div>
                    <p className="text-xs text-ink-faint mt-0.5">
                      {classNameOf(a.class_id)} · {a.question_count ?? 0} questions · {a.total_marks} marks
                    </p>
                  </div>
                  {a.deadline_at && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted shrink-0">
                      <CalendarClock size={13} />
                      {new Date(a.deadline_at).toLocaleDateString()}
                    </span>
                  )}
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </div>
    </div>
  );
}
