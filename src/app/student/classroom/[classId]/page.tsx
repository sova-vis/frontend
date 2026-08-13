"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, CheckCircle2, Clock, GraduationCap, LogOut, School } from "lucide-react";
import { AvailableAssignment, Classroom, getAvailableAssignments, getMyClassrooms, leaveClass } from "@/lib/submissions";

export default function StudentClassPage() {
  const params = useParams<{ classId: string }>();
  const router = useRouter();
  const classId = (params?.classId ?? "") as string;
  const [cls, setCls] = useState<Classroom | null>(null);
  const [assignments, setAssignments] = useState<AvailableAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [cs, as] = await Promise.all([getMyClassrooms(), getAvailableAssignments().catch(() => [])]);
        setCls(cs.find((c) => c.class_id === classId) || null);
        setAssignments(as.filter((a) => a.class_id === classId));
      } finally {
        setLoading(false);
      }
    })();
  }, [classId]);

  const todo = useMemo(() => assignments.filter((a) => !a.released && ["not_started", "in_progress", "returned"].includes(a.submission_status)), [assignments]);
  const submitted = useMemo(() => assignments.filter((a) => !a.released && ["submitted", "late"].includes(a.submission_status)), [assignments]);
  const reviewed = useMemo(() => assignments.filter((a) => a.released), [assignments]);

  const leave = async () => {
    if (!window.confirm(`Leave ${cls?.class_name || "this class"}? You'll stop seeing its assignments.`)) return;
    setLeaving(true);
    try { await leaveClass(classId); router.push("/student/classroom"); }
    catch { setLeaving(false); }
  };

  const open = (id: string) => router.push(`/student/assignments/${id}`);

  return (
    <div className="min-h-screen bg-paper text-ink px-4 md:px-8 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <button onClick={() => router.push("/student/classroom")} className="text-sm text-ink-muted hover:text-ink inline-flex items-center gap-1">
          <ArrowLeft size={15} /> Classroom
        </button>

        {loading ? (
          <div className="h-40 rounded-[1.25rem] bg-surface-soft animate-pulse" />
        ) : !cls ? (
          <div className="ed-card p-10 text-center text-ink-muted">Class not found — you may have left it.</div>
        ) : (
          <>
            <div className="ed-card p-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-crimson-soft text-crimson-ink"><School size={22} /></span>
                <div className="min-w-0">
                  <h1 className="font-display text-xl md:text-2xl font-semibold truncate">{cls.class_name}</h1>
                  <p className="text-sm text-ink-faint truncate">{cls.teacher_name}{cls.subject ? ` · ${cls.subject}` : ""}{cls.enrollment_status === "pending" ? " · pending approval" : ""}</p>
                </div>
              </div>
              <button onClick={() => void leave()} disabled={leaving} className="ed-btn-ghost px-3 py-2 text-sm text-crimson">
                <LogOut size={14} /> {leaving ? "Leaving…" : "Leave class"}
              </button>
            </div>

            {cls.enrollment_status === "pending" ? (
              <div className="ed-card p-8 text-center text-ink-muted">Waiting for your teacher to approve you — assignments will appear once you&apos;re in.</div>
            ) : (
              <div className="space-y-6">
                <Group title="To do" icon={BookOpen} items={todo} onOpen={open} cta="Start" empty="You're all caught up. 🎉" />
                {submitted.length > 0 && <Group title="Submitted · awaiting review" icon={Clock} items={submitted} onOpen={open} cta="View" muted />}
                {reviewed.length > 0 && <Group title="Reviewed" icon={CheckCircle2} items={reviewed} onOpen={open} cta="See feedback" mint />}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Group({ title, icon: Icon, items, onOpen, cta, empty, muted, mint }: {
  title: string; icon: typeof BookOpen; items: AvailableAssignment[]; onOpen: (id: string) => void; cta: string; empty?: string; muted?: boolean; mint?: boolean;
}) {
  return (
    <section className="ed-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className={mint ? "text-mint-ink" : muted ? "text-ink-faint" : "text-crimson"} />
        <h2 className="font-semibold text-ink text-sm">{title}</h2>
        <span className="text-xs text-ink-faint">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-ink-faint">{empty}</p>
      ) : (
        <div className="space-y-2">
          {items.map((a) => (
            <div key={a.id} className="ed-card-soft p-3 flex items-center gap-3">
              <GraduationCap size={16} className="text-ink-faint shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink truncate">{a.title}</p>
                <p className="text-xs text-ink-faint truncate">{a.deadline_at ? `Due ${new Date(a.deadline_at).toLocaleDateString()}` : "No deadline"}</p>
              </div>
              <button onClick={() => onOpen(a.id)} className={`px-3 py-1.5 text-xs font-semibold rounded-full shrink-0 ${mint ? "bg-mint-soft text-mint-ink" : "ed-btn-primary"}`}>{cta}</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
