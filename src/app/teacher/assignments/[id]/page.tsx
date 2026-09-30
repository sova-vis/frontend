"use client";

/**
 * Assignment detail / hub (spec §5.2 manage) — rebuilt on the shared `.pr`
 * design system. Shows the assignment, its settings (incl. the new-spec answer
 * method + marking mode carried in source_meta), its questions, and a live
 * submission board. Publish / duplicate / delete + a link into the review queue.
 *
 * All reads reuse the stable APIs (getAssignment, getStatusBoard). The status
 * board here is read-only; the marking/extend/release actions live in the review
 * slice. No backend change.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Icon } from "@/components/propel/Icon";
import { Modal, useToast, EmptyState } from "@/components/propel/primitives";
import {
  Assignment, VISIBILITY_LABELS, deleteAssignment, duplicateAssignment, getAssignment, publishAssignment,
} from "@/lib/assignments";
import { StatusBoard, getStatusBoard } from "@/lib/submissions";
import { resolveName } from "@/lib/displayName";

const A_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  draft: { label: "Draft", bg: "var(--surface-2)", fg: "var(--ink-soft)" },
  scheduled: { label: "Scheduled", bg: "var(--amber-soft)", fg: "var(--amber)" },
  published: { label: "Live", bg: "var(--teal-soft)", fg: "var(--teal)" },
  closed: { label: "Closed", bg: "var(--surface-2)", fg: "var(--ink-faint)" },
};

const SUB_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  not_started: { label: "Not started", bg: "var(--surface-2)", fg: "var(--ink-faint)" },
  in_progress: { label: "In progress", bg: "var(--amber-soft)", fg: "var(--amber)" },
  submitted: { label: "Submitted", bg: "var(--teal-soft)", fg: "var(--teal)" },
  late: { label: "Late", bg: "var(--coral-soft)", fg: "var(--coral)" },
  missed: { label: "Missed", bg: "var(--crimson-soft)", fg: "var(--crimson)" },
  returned: { label: "Reopened", bg: "var(--amber-soft)", fg: "var(--amber)" },
};

const ANSWER_LABEL: Record<string, string> = { handwritten: "Handwritten", typed: "Typed", either: "Either" };
const MARKING_LABEL: Record<string, string> = { on_request: "On request", automatic: "Automatic" };

export default function AssignmentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id ?? "";
  const toast = useToast();

  const [a, setA] = useState<Assignment | null>(null);
  const [board, setBoard] = useState<StatusBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try { setLoading(true); setA(await getAssignment(id)); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to load assignment"); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (id) void load(); /* eslint-disable-next-line */ }, [id]);

  useEffect(() => {
    if (!a || (a.status !== "published" && a.status !== "closed")) { setBoard(null); return; }
    void getStatusBoard(a.id).then(setBoard).catch(() => setBoard(null));
  }, [a?.id, a?.status]);

  const publish = async () => {
    setBusy(true);
    try { setA(await publishAssignment(id)); toast("Assignment published", "check_circle"); }
    catch (err) { toast(err instanceof Error ? err.message : "Failed to publish", "alert"); }
    finally { setBusy(false); }
  };
  const duplicate = async () => {
    setBusy(true);
    try { const copy = await duplicateAssignment(id); toast("Duplicated as a draft", "check_circle"); router.push(`/teacher/assignments/${copy.id}`); }
    catch (err) { toast(err instanceof Error ? err.message : "Failed to duplicate", "alert"); setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await deleteAssignment(id); router.push("/teacher/assignments"); }
    catch (err) { toast(err instanceof Error ? err.message : "Failed to delete", "alert"); setBusy(false); setConfirmDelete(false); }
  };

  if (loading) return <div className="grid" style={{ gap: 16 }}><div className="sk" style={{ height: 120, borderRadius: 18 }} /><div className="sk" style={{ height: 260, borderRadius: 18 }} /></div>;
  if (!a) return (
    <div style={{ textAlign: "center", padding: "64px 0" }}>
      <p className="muted">{error || "Assignment not found."}</p>
      <Link href="/teacher/assignments" className="btn btn-secondary" style={{ marginTop: 16 }}>Back to assignments</Link>
    </div>
  );

  const sm = (a.source_meta ?? {}) as Record<string, unknown>;
  const answerMethod = typeof sm.answer_method === "string" ? sm.answer_method : "handwritten";
  const markingMode = typeof sm.marking_mode === "string" ? sm.marking_mode : "on_request";
  const st = A_STATUS[a.status] ?? A_STATUS.draft;
  const questions = a.questions ?? [];
  const live = a.status === "published" || a.status === "closed";

  return (
    <>
      <Link href="/teacher/assignments" className="chip" style={{ marginBottom: 18 }}><Icon name="chevron_left" size={15} /> Assignments</Link>

      {/* Header */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="row-between wrap gap-16">
          <div style={{ minWidth: 0 }}>
            <div className="flex items-center gap-10 wrap" style={{ marginBottom: 6 }}>
              <span className="chip-tag" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
              {(a.pending_reviews ?? 0) > 0 && <span className="chip-tag" style={{ background: "var(--crimson-soft)", color: "var(--crimson)" }}><Icon name="flag" size={12} /> {a.pending_reviews} to review</span>}
            </div>
            <h1 style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 26, fontWeight: 600 }}>{a.title}</h1>
            <p className="faint" style={{ fontSize: 13.5, marginTop: 4 }}>
              {questions.length} questions · {a.total_marks} marks · {a.target_all ? "whole class" : `${a.recipient_ids?.length ?? 0} students`}
            </p>
          </div>
          <div className="flex gap-8 wrap" style={{ flex: "none" }}>
            {(a.status === "draft" || a.status === "scheduled") && (
              <button className="btn btn-primary" disabled={busy} onClick={() => void publish()}><Icon name="send" size={15} /> Publish</button>
            )}
            <button className="btn btn-secondary" disabled={busy} onClick={() => void duplicate()}><Icon name="layers" size={15} /> Duplicate</button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => setConfirmDelete(true)} style={{ color: "var(--coral)" }} title="Delete"><Icon name="trash" size={15} /></button>
          </div>
        </div>
      </div>

      {/* Settings summary */}
      <div className="grid gap-12" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", marginBottom: 16 }}>
        <MetaTile icon="calendar" label="Deadline" value={a.deadline_at ? new Date(a.deadline_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "None"} />
        <MetaTile icon="clock" label="Timing" value={a.timed ? `${a.duration_minutes} min` : "Untimed"} />
        <MetaTile icon="refresh" label="Attempts" value={a.attempt_limit === null ? "Unlimited" : String(a.attempt_limit)} />
        <MetaTile icon="upload" label="Answers" value={ANSWER_LABEL[answerMethod] ?? "Handwritten"} />
        <MetaTile icon="sparkles" label="Marking" value={MARKING_LABEL[markingMode] ?? "On request"} />
        <MetaTile icon="eye" label="Mark scheme" value={VISIBILITY_LABELS[a.mark_scheme_visibility]} />
      </div>

      {/* Questions */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <h2 style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Questions</h2>
        <div className="grid" style={{ gap: 8 }}>
          {questions.map((q, i) => {
            const snap = (q.snapshot ?? {}) as Record<string, string>;
            return (
              <div key={q.id} className="flex items-center gap-12" style={{ padding: "10px 12px", borderRadius: 12, background: "var(--surface-2)" }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, flex: "none", display: "grid", placeItems: "center", background: "var(--ink)", color: "var(--canvas)", fontSize: 12, fontWeight: 700 }}>{i + 1}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{snap?.text || q.question_ref || "Question"}</p>
                  <p className="faint" style={{ fontSize: 12 }}>{[snap?.topic, snap?.year, snap?.paper].filter(Boolean).join(" · ")}</p>
                </div>
                <span className="faint" style={{ fontSize: 12.5, flex: "none" }}>{q.marks ?? "?"} marks</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Submissions */}
      {live ? <SubmissionSection board={board} /> : (
        <div className="card card-pad" style={{ textAlign: "center" }}>
          <p className="muted" style={{ fontSize: 14 }}>Publish this assignment to start tracking submissions.</p>
        </div>
      )}

      {/* Review entry */}
      {live && a.can_grade !== false && (
        <Link href={`/teacher/assignments/${a.id}/review`} className="card card-pad row-between" style={{ display: "flex", marginTop: 16 }}>
          <div className="flex items-center gap-12">
            <span style={{ width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--crimson-soft)", color: "var(--crimson)", flex: "none" }}><Icon name="check_circle" size={20} /></span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Review &amp; release</div>
              <div className="faint" style={{ fontSize: 12.5 }}>Confidence-triaged queue · per-part override · release to students</div>
            </div>
          </div>
          <Icon name="chevron_right" size={18} style={{ color: "var(--ink-faint)" }} />
        </Link>
      )}

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <h3 style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Delete assignment?</h3>
        <p className="muted" style={{ fontSize: 14, marginBottom: 20 }}>This removes “{a.title}”, its questions and every student’s submission for it. This cannot be undone.</p>
        <div className="flex gap-8" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)} disabled={busy}>Cancel</button>
          <button className="btn" style={{ background: "var(--coral)", color: "#fff" }} onClick={() => void remove()} disabled={busy}>{busy ? "Deleting…" : "Delete"}</button>
        </div>
      </Modal>
    </>
  );
}

function MetaTile({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="card" style={{ padding: "12px 14px" }}>
      <div className="flex items-center gap-6" style={{ marginBottom: 6 }}>
        <Icon name={icon} size={13} style={{ color: "var(--ink-faint)" }} />
        <span className="eyebrow">{label}</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{value}</div>
    </div>
  );
}

function SubmissionSection({ board }: { board: StatusBoard | null }) {
  if (!board) return <div className="sk" style={{ height: 200, borderRadius: 18 }} />;
  const rows = board.rows;
  const total = board.assignment.total || rows.length;
  const submitted = rows.filter((r) => r.status === "submitted" || r.status === "late").length;
  const inProgress = rows.filter((r) => r.status === "in_progress" || r.status === "returned").length;
  const released = rows.filter((r) => r.released).length;

  return (
    <div className="card card-pad">
      <div className="row-between wrap gap-12" style={{ marginBottom: 14 }}>
        <h2 style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 18, fontWeight: 600 }}>Submissions</h2>
        <span className="faint" style={{ fontSize: 13 }}>{submitted}/{total} submitted</span>
      </div>

      <div className="grid gap-8" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", marginBottom: 16 }}>
        <StatTile n={submitted} label="Submitted" tone="var(--teal)" />
        <StatTile n={inProgress} label="In progress" tone="var(--amber)" />
        <StatTile n={total - submitted - inProgress} label="Not started" tone="var(--ink-faint)" />
        <StatTile n={released} label="Released" tone="var(--crimson)" />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon="users" title="No students targeted" body="Add students to this class or the assignment's recipients." />
      ) : (
        <div className="grid" style={{ gap: 8 }}>
          {rows.map((r) => {
            const ss = SUB_STATUS[r.status] ?? SUB_STATUS.not_started;
            const name = resolveName({ full_name: r.full_name, email: r.email });
            const scored = r.total_score != null;
            return (
              <div key={r.student_clerk_id} className="flex items-center gap-12" style={{ padding: "10px 12px", borderRadius: 12, background: "var(--surface-2)" }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, flex: "none", display: "grid", placeItems: "center", background: "linear-gradient(140deg, var(--purple), #4b32a8)", color: "#fff", fontWeight: 600, fontSize: 13 }}>{(name[0] || "S").toUpperCase()}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
                  {r.submitted_at && <div className="faint" style={{ fontSize: 11.5 }}>Submitted {new Date(r.submitted_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</div>}
                </div>
                {scored && <span className="mono" style={{ fontSize: 13, fontWeight: 600, flex: "none" }}>{r.total_score}<span className="faint">/{r.total_marks ?? "?"}</span></span>}
                {r.released && <Icon name="check_circle" size={15} style={{ color: "var(--teal)", flex: "none" }} />}
                <span className="chip-tag" style={{ background: ss.bg, color: ss.fg, flex: "none" }}>{ss.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatTile({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div style={{ background: "var(--surface-2)", borderRadius: 12, padding: "12px 14px" }}>
      <div className="big-num" style={{ fontSize: 24, color: tone }}>{n}</div>
      <div className="eyebrow" style={{ marginTop: 2 }}>{label}</div>
    </div>
  );
}
