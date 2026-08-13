"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ClipboardCheck, Copy, Rocket, Trash2 } from "lucide-react";
import { Reveal } from "@/components/ui/Motion";
import SubmissionBoard from "@/components/teacher/SubmissionBoard";
import {
  Assignment,
  VISIBILITY_LABELS,
  deleteAssignment,
  duplicateAssignment,
  getAssignment,
  publishAssignment,
} from "@/lib/assignments";

const STATUS_STYLE: Record<string, string> = {
  draft: "ed-pill-clay",
  scheduled: "ed-pill-gold",
  published: "ed-pill-mint",
  closed: "bg-surface-soft text-ink-muted",
};

export default function AssignmentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = (params?.id ?? "") as string;

  const [a, setA] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setA(await getAssignment(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load assignment");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const publish = async () => {
    setBusy(true);
    try {
      setA(await publishAssignment(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async () => {
    setBusy(true);
    try {
      const copy = await duplicateAssignment(id);
      router.push(`/teacher/assignments/${copy.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to duplicate");
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this assignment? This removes its questions and every student's submission for it. This cannot be undone.")) return;
    setBusy(true);
    try {
      await deleteAssignment(id);
      router.push("/teacher/assignments");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 md:px-8 py-8 max-w-4xl mx-auto space-y-4">
        <div className="h-28 rounded-[1.25rem] bg-surface-soft animate-pulse" />
        <div className="h-64 rounded-[1.25rem] bg-surface-soft animate-pulse" />
      </div>
    );
  }

  if (!a) {
    return (
      <div className="px-4 md:px-8 py-16 text-center">
        <p className="text-ink-muted">{error || "Assignment not found."}</p>
        <button onClick={() => router.push("/teacher/assignments")} className="ed-btn-ghost mt-4 px-4 py-2 mx-auto">
          Back to assignments
        </button>
      </div>
    );
  }

  const questions = a.questions ?? [];

  return (
    <div className="px-4 md:px-8 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <button onClick={() => router.push("/teacher/assignments")} className="text-sm text-ink-muted hover:text-ink inline-flex items-center gap-1">
          <ChevronLeft size={15} /> Assignments
        </button>

        <Reveal>
          <section className="ed-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-2xl font-semibold tracking-tight">{a.title}</h1>
                  <span className={`text-[0.65rem] ${STATUS_STYLE[a.status]}`}>{a.status}</span>
                </div>
                <p className="text-ink-muted text-sm mt-1">
                  {questions.length} questions · {a.total_marks} marks
                  {a.target_all ? " · whole class" : ` · ${a.recipient_ids?.length ?? 0} students`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(a.status === "draft" || a.status === "scheduled") && (
                  <button onClick={() => void publish()} disabled={busy} className="ed-btn-primary px-4 py-2.5">
                    <Rocket size={15} /> Publish
                  </button>
                )}
                <button onClick={() => void duplicate()} disabled={busy} className="ed-btn-ghost px-4 py-2.5">
                  <Copy size={15} /> Duplicate
                </button>
                <button onClick={() => void remove()} disabled={busy} className="ed-btn-ghost px-4 py-2.5 text-crimson" title="Delete assignment">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </section>
        </Reveal>

        {error && <p className="text-sm text-crimson">{error}</p>}

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Info label="Deadline" value={a.deadline_at ? new Date(a.deadline_at).toLocaleString() : "None"} />
          <Info label="Timing" value={a.timed ? `${a.duration_minutes} min` : "Untimed"} />
          <Info label="Attempts" value={a.attempt_limit === null ? "Unlimited" : String(a.attempt_limit)} />
          <Info label="Mark scheme" value={VISIBILITY_LABELS[a.mark_scheme_visibility]} />
        </div>

        <section className="ed-card p-6">
          <h2 className="font-display text-lg font-semibold mb-3">Questions</h2>
          <div className="space-y-2">
            {questions.map((q, i) => {
              const snap = q.snapshot as Record<string, string>;
              return (
                <div key={q.id} className="ed-card-soft p-3 flex items-center gap-3">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-paper text-xs font-bold shrink-0">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink truncate">{snap?.text || q.question_ref || "Question"}</p>
                    <p className="text-xs text-ink-faint">
                      {[snap?.topic, snap?.year, snap?.paper].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="text-xs text-ink-muted shrink-0">{q.marks ?? "?"} marks</span>
                </div>
              );
            })}
          </div>
        </section>

        {a.status === "published" || a.status === "closed" ? (
          <SubmissionBoard assignmentId={a.id} />
        ) : (
          <section className="ed-card-soft p-6 text-center">
            <p className="text-ink-muted">Publish this assignment to start tracking submissions.</p>
          </section>
        )}

        {(a.status === "published" || a.status === "closed") && a.can_grade !== false && (
          <button
            onClick={() => router.push(`/teacher/assignments/${a.id}/review`)}
            className="ed-card p-5 w-full flex items-center justify-between hover:shadow-md transition-shadow text-left"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-crimson-soft text-crimson-ink">
                <ClipboardCheck size={18} />
              </span>
              <div>
                <p className="font-semibold text-ink">Review marking</p>
                <p className="text-xs text-ink-faint">Confidence-triaged queue · per-criterion override · bulk approve</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-ink-faint" />
          </button>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="ed-card p-4">
      <p className="ed-label">{label}</p>
      <p className="text-sm font-semibold text-ink mt-1">{value}</p>
    </div>
  );
}
