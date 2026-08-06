"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, ClipboardCheck, MessageSquare, RotateCcw, Sparkles, X } from "lucide-react";
import {
  STATUS_LABELS,
  STATUS_STYLE,
  StatusBoard,
  extendDeadline,
  getStatusBoard,
  reopenSubmission,
} from "@/lib/submissions";
import { draftOverallFeedback, saveOverallFeedback } from "@/lib/feedbackRelease";
import CommentBankButton from "@/components/teacher/CommentBankButton";

// Submission status board (spec §7.1) with deadline extension (§7.3) and
// reopen (§7.4).
export default function SubmissionBoard({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [board, setBoard] = useState<StatusBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendValue, setExtendValue] = useState("");
  const [feedbackFor, setFeedbackFor] = useState<{ submissionId: string; name: string } | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setBoard(await getStatusBoard(assignmentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load submissions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  const reopen = async (submissionId: string) => {
    const reason = window.prompt("Reason for reopening (optional, shown to the student):") ?? undefined;
    try {
      const { withdrawn } = await reopenSubmission(submissionId, reason);
      if (withdrawn) window.alert("The released result was withdrawn and the student will be notified.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reopen");
    }
  };

  const applyExtension = async () => {
    if (!extendValue) return;
    try {
      await extendDeadline(assignmentId, new Date(extendValue).toISOString());
      setExtendOpen(false);
      setExtendValue("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extend");
    }
  };

  if (loading) return <div className="h-40 rounded-[1.25rem] bg-surface-soft animate-pulse" />;
  if (!board) return <p className="text-sm text-crimson">{error || "No data"}</p>;

  const order = ["submitted", "late", "in_progress", "returned", "not_started", "missed"];

  return (
    <section className="ed-card p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="font-display text-lg font-semibold">Submissions</h2>
        <button onClick={() => setExtendOpen((v) => !v)} className="ed-btn-ghost px-3 py-2 text-sm">
          <CalendarPlus size={14} /> Extend deadline
        </button>
      </div>

      {extendOpen && (
        <div className="ed-card-soft p-3 mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-muted">New deadline for the whole class:</span>
          <input
            type="datetime-local"
            value={extendValue}
            onChange={(e) => setExtendValue(e.target.value)}
            className="ed-input px-3 py-1.5 text-sm w-auto"
          />
          <button onClick={() => void applyExtension()} className="ed-btn-primary px-3 py-1.5 text-sm">
            Apply
          </button>
        </div>
      )}

      {error && <p className="text-sm text-crimson mb-3">{error}</p>}

      {/* Count summary */}
      <div className="flex flex-wrap gap-2 mb-4">
        {order
          .filter((s) => board.counts[s])
          .map((s) => (
            <span key={s} className={`text-[0.7rem] ${STATUS_STYLE[s]}`}>
              {board.counts[s]} {STATUS_LABELS[s]}
            </span>
          ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-faint border-b border-line">
              <th className="px-3 py-2.5 font-semibold">Student</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
              <th className="px-3 py-2.5 font-semibold">Submitted</th>
              <th className="px-3 py-2.5 font-semibold">Score</th>
              <th className="px-3 py-2.5 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {board.rows.map((r) => (
              <tr key={r.student_clerk_id} className="border-b border-line/60">
                <td className="px-3 py-2.5 font-medium text-ink">{r.full_name || r.email || "Student"}</td>
                <td className="px-3 py-2.5">
                  <span className={`text-[0.65rem] ${STATUS_STYLE[r.status]}`}>{STATUS_LABELS[r.status]}</span>
                </td>
                <td className="px-3 py-2.5 text-ink-faint">
                  {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "—"}
                </td>
                <td className="px-3 py-2.5 text-ink-muted">
                  {r.total_marks != null && r.total_score != null ? `${r.total_score}/${r.total_marks}` : "—"}
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  {r.submission_id && ["submitted", "late", "returned"].includes(r.status) && (
                    <>
                      <button
                        onClick={() => router.push(`/teacher/assignments/${assignmentId}/review?student=${r.student_clerk_id}`)}
                        className="ed-btn-ghost px-2 py-1 text-xs"
                        title="Review this student"
                      >
                        <ClipboardCheck size={13} />
                      </button>
                      <button
                        onClick={() => setFeedbackFor({ submissionId: r.submission_id!, name: r.full_name || r.email || "Student" })}
                        className="ed-btn-ghost px-2 py-1 text-xs"
                        title="Overall feedback"
                      >
                        <MessageSquare size={13} />
                      </button>
                      <button onClick={() => void reopen(r.submission_id!)} className="ed-btn-ghost px-2 py-1 text-xs" title="Reopen">
                        <RotateCcw size={13} />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {feedbackFor && (
        <FeedbackModal submissionId={feedbackFor.submissionId} studentName={feedbackFor.name} onClose={() => setFeedbackFor(null)} />
      )}
    </section>
  );
}

// AI-drafted overall feedback (§10.2) — drafted from marks, teacher-edited, then
// accepted. Labelled a draft until accepted.
function FeedbackModal({ submissionId, studentName, onClose }: { submissionId: string; studentName: string; onClose: () => void }) {
  const [text, setText] = useState("");
  const [isDraft, setIsDraft] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      const { draft } = await draftOverallFeedback(submissionId);
      setText(draft);
      setIsDraft(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to draft");
    } finally {
      setBusy(false);
    }
  };

  const save = async (accept: boolean) => {
    setBusy(true);
    try {
      await saveOverallFeedback(submissionId, text, !accept);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4">
      <div className="ed-card w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold">Feedback — {studentName}</h3>
          <button onClick={onClose} className="ed-btn-ghost p-2">
            <X size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => void generate()} disabled={busy} className="ed-btn-ghost px-3 py-2 text-sm">
            <Sparkles size={14} /> {busy ? "Drafting…" : "Draft with AI"}
          </button>
          <CommentBankButton currentText={text} onInsert={(t) => setText(text ? `${text}\n${t}` : t)} />
        </div>
        {isDraft && text && <p className="ed-pill-gold text-[0.65rem] mb-2">Draft — edit and accept</p>}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="Overall feedback for this student…"
          className="ed-input px-3 py-2.5 text-sm resize-none"
        />
        {error && <p className="text-sm text-crimson mt-2">{error}</p>}
        <div className="flex gap-2 mt-4">
          <button onClick={() => void save(false)} disabled={busy || !text} className="ed-btn-ghost flex-1 justify-center py-2.5">
            Save draft
          </button>
          <button onClick={() => void save(true)} disabled={busy || !text} className="ed-btn-primary flex-1 justify-center py-2.5">
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
