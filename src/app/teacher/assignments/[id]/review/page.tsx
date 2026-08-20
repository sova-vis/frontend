"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Flag } from "lucide-react";
import {
  QueueItem,
  QueueResponse,
  approveMark,
  flagMark,
  getQueue,
  overrideMark,
  saveVoiceNote,
} from "@/lib/review";
import { applyMissedGuidance, releaseOne, saveCriterionComment } from "@/lib/feedbackRelease";
import { Send } from "lucide-react";
import CommentBankButton from "@/components/teacher/CommentBankButton";
import VoiceNote from "@/components/teacher/VoiceNote";

const REVIEWED = ["approved", "overridden", "auto_approved"];

interface StudentRow {
  clerkId: string;
  name: string;
  items: QueueItem[];
  count: number;
  reviewed: number;
  earned: number;
  total: number;
  done: boolean;
}

export default function ReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const assignmentId = (params?.id ?? "") as string;

  const [data, setData] = useState<QueueResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null); // student clerkId in focus, null = table
  const [index, setIndex] = useState(0);
  const [awarded, setAwarded] = useState<boolean[]>([]);
  const [comments, setComments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Optional deep-link straight into one student's review (from the status board).
  useEffect(() => {
    if (typeof window !== "undefined") {
      const s = new URLSearchParams(window.location.search).get("student");
      if (s) setSelected(s);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setData(await getQueue(assignmentId, "all"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load review queue");
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => { void load(); }, [load]);

  const allItems = data?.items ?? [];

  const students: StudentRow[] = useMemo(() => {
    const map = new Map<string, StudentRow>();
    for (const it of allItems) {
      const e = map.get(it.student_clerk_id) ?? { clerkId: it.student_clerk_id, name: it.student_name, items: [], count: 0, reviewed: 0, earned: 0, total: 0, done: false };
      e.items.push(it);
      map.set(it.student_clerk_id, e);
    }
    return Array.from(map.values())
      .map((s) => {
        const total = s.items.reduce((sum, it) => sum + (it.ai_marks_available ?? it.question.marks ?? 0), 0);
        const earned = s.items.reduce((sum, it) => sum + (it.final_score ?? it.ai_score ?? 0), 0);
        const reviewed = s.items.filter((it) => REVIEWED.includes(it.status)).length;
        return { ...s, count: s.items.length, reviewed, earned, total, done: reviewed === s.items.length && s.items.length > 0 };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allItems]);

  const focusItems = useMemo(() => (selected ? allItems.filter((it) => it.student_clerk_id === selected) : []), [allItems, selected]);
  const current: QueueItem | undefined = focusItems[index];

  useEffect(() => {
    if (!current) { setAwarded([]); setComments([]); return; }
    const base = current.final_criteria ?? current.ai_criteria;
    setAwarded(base.map((c) => c.awarded));
    setComments(base.map((_, i) => current.criterion_comments?.find((cm) => cm.index === i)?.text ?? ""));
  }, [current]);

  const markLocal = (markId: string, patch: Partial<QueueItem>) => {
    setData((d) => (d ? { ...d, items: d.items.map((it) => (it.mark_id === markId ? { ...it, ...patch } : it)) } : d));
  };

  const total = useMemo(() => {
    if (!current) return { earned: 0, available: 0 };
    const available = current.ai_criteria.reduce((s, c) => s + c.marks_available, 0);
    const earned = current.ai_criteria.reduce((s, c, i) => s + (awarded[i] ? c.marks_available : 0), 0);
    return { earned, available };
  }, [current, awarded]);

  const dirty = useMemo(() => {
    if (!current) return false;
    const base = current.final_criteria ?? current.ai_criteria;
    return awarded.some((a, i) => a !== base[i]?.awarded);
  }, [current, awarded]);

  const openStudent = (clerkId: string) => { setSelected(clerkId); setIndex(0); setError(""); };
  const backToTable = () => { setSelected(null); setIndex(0); };

  const advance = useCallback(() => {
    setIndex((i) => {
      if (i + 1 >= focusItems.length) { setSelected(null); return 0; } // finished this student → back to table
      return i + 1;
    });
  }, [focusItems.length]);

  const approveCurrent = useCallback(async () => {
    if (!current || busy) return;
    setBusy(true);
    try {
      if (dirty) {
        const { final_score } = await overrideMark(current.mark_id, awarded.map((a) => ({ awarded: a })));
        markLocal(current.mark_id, { status: "overridden", final_score });
      } else {
        await approveMark(current.mark_id);
        markLocal(current.mark_id, { status: "approved", final_score: current.ai_score });
      }
      advance();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }, [current, busy, dirty, awarded, advance]);

  const flagCurrent = useCallback(async () => {
    if (!current) return;
    try {
      await flagMark(current.mark_id, !current.flagged);
      markLocal(current.mark_id, { flagged: !current.flagged });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to flag");
    }
  }, [current]);

  // Approve every not-yet-reviewed answer for one student in one click.
  const approveAllForStudent = async (row: StudentRow) => {
    const pending = row.items.filter((it) => !REVIEWED.includes(it.status));
    if (pending.length === 0) return;
    if (!window.confirm(`Approve ${pending.length} answer${pending.length === 1 ? "" : "s"} for ${row.name}?`)) return;
    setBusy(true);
    try {
      for (const it of pending) {
        await approveMark(it.mark_id);
        markLocal(it.mark_id, { status: "approved", final_score: it.ai_score });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setBusy(false);
    }
  };

  // Check the current answer (if needed) and release this student's whole result.
  const checkAndRelease = async () => {
    if (!current || busy) return;
    setBusy(true);
    try {
      if (dirty) {
        const { final_score } = await overrideMark(current.mark_id, awarded.map((a) => ({ awarded: a })));
        markLocal(current.mark_id, { status: "overridden", final_score });
      } else if (!REVIEWED.includes(current.status)) {
        await approveMark(current.mark_id);
        markLocal(current.mark_id, { status: "approved", final_score: current.ai_score });
      }
      await releaseOne(current.submission_id);
      backToTable();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to release results");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 md:px-8 py-8 max-w-5xl mx-auto space-y-4">
        <div className="h-16 rounded-[1.25rem] bg-surface-soft animate-pulse" />
        <div className="h-96 rounded-[1.25rem] bg-surface-soft animate-pulse" />
      </div>
    );
  }

  const reviewedStudents = students.filter((s) => s.done).length;

  // ---------------- TABLE VIEW ----------------
  if (!selected) {
    return (
      <div className="px-4 md:px-8 py-6">
        <div className="max-w-5xl mx-auto space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button onClick={() => router.push(`/teacher/assignments/${assignmentId}`)} className="text-sm text-ink-muted hover:text-ink inline-flex items-center gap-1">
              <ChevronLeft size={15} /> {data?.assignment.title || "Assignment"}
            </button>
            <span className="text-sm text-ink-muted">{reviewedStudents}/{students.length} students reviewed</span>
          </div>

          {error && <p className="text-sm text-crimson">{error}</p>}

          {students.length === 0 ? (
            <div className="ed-card p-10 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-mint-soft text-mint-ink"><Check size={26} /></div>
              <p className="mt-4 text-ink-muted">No submissions to review yet.</p>
            </div>
          ) : (
            <div className="ed-card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-ink-faint border-b border-line">
                      <th className="font-semibold px-4 py-3">Student</th>
                      <th className="font-semibold px-4 py-3">Progress</th>
                      <th className="font-semibold px-4 py-3">Score</th>
                      <th className="font-semibold px-4 py-3">Status</th>
                      <th className="font-semibold px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.clerkId} className="border-b border-line last:border-0 hover:bg-surface-soft/60">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-crimson-soft text-crimson-ink text-xs font-bold">{s.name.slice(0, 2).toUpperCase()}</span>
                            <span className="font-medium text-ink">{s.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ink-muted">{s.reviewed}/{s.count} marked</td>
                        <td className="px-4 py-3 font-semibold text-ink">{s.earned}<span className="text-ink-faint font-normal">/{s.total}</span></td>
                        <td className="px-4 py-3">
                          {s.done
                            ? <span className="ed-pill-mint text-[0.65rem]">Reviewed</span>
                            : <span className="ed-pill-gold text-[0.65rem]">{s.count - s.reviewed} pending</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {!s.done && (
                              <button onClick={() => void approveAllForStudent(s)} disabled={busy} className="ed-btn-ghost px-3 py-1.5 text-xs">
                                <Check size={13} /> Approve all
                              </button>
                            )}
                            <button onClick={() => openStudent(s.clerkId)} className="ed-btn-primary px-3 py-1.5 text-xs">
                              {s.done ? "View" : "Review"} <ChevronRight size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------------- FOCUS VIEW (one student) ----------------
  const focusName = focusItems[0]?.student_name ?? "Student";
  if (!current) {
    return (
      <div className="px-4 md:px-8 py-6 max-w-4xl mx-auto space-y-4">
        <button onClick={backToTable} className="text-sm text-ink-muted hover:text-ink inline-flex items-center gap-1"><ChevronLeft size={15} /> All students</button>
        <div className="ed-card p-10 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-mint-soft text-mint-ink"><Check size={26} /></div>
          <p className="mt-4 text-ink-muted">Nothing to review for {focusName}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button onClick={backToTable} className="text-sm text-ink-muted hover:text-ink inline-flex items-center gap-1">
            <ChevronLeft size={15} /> All students
          </button>
          <span className="text-sm font-semibold text-ink">{focusName}</span>
        </div>

        {error && <p className="text-sm text-crimson">{error}</p>}

        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-muted">
            Q{String(current.question.number)} · {current.question.marks} marks{current.question.topic ? ` · ${current.question.topic}` : ""}
          </p>
          {current.ai_score === null && current.question.type !== "mcq" && (
            <span className="ed-pill-gold text-[0.65rem]">Needs marking</span>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Student answer */}
          <div className="ed-card p-4">
            <p className="ed-label mb-2">Student answer</p>
            {current.question.text && <p className="text-xs text-ink-faint mb-2 whitespace-pre-wrap">{current.question.text}</p>}
            {/* Full question figures + structured parts so the marker sees exactly what the student saw. */}
            {current.question.images && current.question.images.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {current.question.images.map((im, k) => im.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={k} src={im.src} alt={im.alt || "Figure"} className="max-h-40 rounded-lg border border-line object-contain bg-white" />
                ) : null)}
              </div>
            )}
            {current.question.parts && current.question.parts.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {current.question.parts.map((p, k) => (
                  <div key={k} className="text-xs text-ink-muted"><b className="text-ink">{p.label}</b> {p.body}{p.marks != null ? ` [${p.marks}]` : ""}</div>
                ))}
              </div>
            )}
            {current.answer.ocr_status === "failed" && <p className="ed-pill-crimson text-[0.65rem] mb-2">OCR failed — original image required</p>}
            {current.question.type === "mcq" ? (
              <p className="text-sm text-ink">Selected: <span className="font-mono font-bold">{current.answer.selected_option || "—"}</span></p>
            ) : (
              <p className="text-sm text-ink whitespace-pre-wrap">
                {current.answer.text || current.answer.ocr_text || <span className="text-ink-faint">No answer.</span>}
              </p>
            )}
            {Array.isArray(current.answer.images) && current.answer.images.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {(current.answer.images as { data_url?: string }[]).map((img, i) =>
                  img?.data_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={img.data_url} alt="handwritten answer" className="h-32 rounded-lg border border-line object-cover" />
                  ) : null
                )}
              </div>
            )}
          </div>

          {/* Mark scheme + per-criterion override */}
          <div className="ed-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="ed-label">Mark scheme</p>
              <span className="font-display text-lg font-semibold">{total.earned}<span className="text-ink-faint text-sm">/{total.available}</span></span>
            </div>
            {current.examiner_note && (
              <div className="ed-card-soft p-2.5 mb-2 border-l-2 border-gold">
                <p className="ed-label text-gold-ink">Examiner report — common mistakes</p>
                <p className="text-xs text-ink-muted mt-1">{current.examiner_note}</p>
                <p className="text-[0.65rem] text-ink-faint mt-1">Teacher-facing · never shown to students</p>
              </div>
            )}
            <div className="space-y-2">
              {current.ai_criteria.map((c, i) => (
                <div key={i} className={`rounded-xl border p-3 ${awarded[i] ? "border-mint/40 bg-mint-soft/40" : "border-line"}`}>
                  <div className="flex items-start gap-2">
                    <button
                      onClick={() => setAwarded((prev) => prev.map((a, idx) => (idx === i ? !a : a)))}
                      className={`shrink-0 mt-0.5 grid h-5 w-5 place-items-center rounded border ${awarded[i] ? "bg-mint text-paper border-mint" : "border-line"}`}
                      aria-label="Toggle criterion"
                    >
                      {awarded[i] && <Check size={12} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">{c.criterion_text || `Criterion ${i + 1}`}</p>
                      <p className="text-xs text-ink-faint mt-0.5">{c.marks_available} mark{c.marks_available === 1 ? "" : "s"}</p>
                      {c.reasoning && (
                        <p className="text-xs text-ink-muted mt-1">
                          <span className="font-mono text-[0.6rem] font-medium uppercase tracking-[.13em] text-purple-ink">AI</span>{" "}
                          {c.reasoning}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-1.5">
                        <input
                          value={comments[i] ?? ""}
                          onChange={(e) => setComments((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
                          onBlur={(e) => { if (current) void saveCriterionComment(current.mark_id, i, e.target.value).catch(() => {}); }}
                          placeholder="Add a comment for this criterion…"
                          className="ed-input px-2.5 py-1.5 text-xs flex-1"
                        />
                        <CommentBankButton
                          topic={current.question.topic}
                          currentText={comments[i] ?? ""}
                          onInsert={(t) => {
                            setComments((prev) => prev.map((v, idx) => (idx === i ? t : v)));
                            if (current) void saveCriterionComment(current.mark_id, i, t).catch(() => {});
                          }}
                        />
                      </div>
                      {!awarded[i] && (comments[i] ?? "").trim() && (
                        <button
                          onClick={async () => {
                            if (!current) return;
                            const { applied } = await applyMissedGuidance(assignmentId, current.assignment_question_id, i, comments[i]);
                            window.alert(`Applied to ${applied} student${applied === 1 ? "" : "s"} who missed this criterion.`);
                          }}
                          className="text-[0.7rem] text-crimson hover:underline mt-1"
                        >
                          Apply to all who missed this criterion
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Voice note */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="ed-label">Voice note</span>
          <VoiceNote
            value={current.voice_note}
            onChange={async (audio) => {
              markLocal(current.mark_id, { voice_note: audio });
              try { await saveVoiceNote(current.mark_id, audio); setError(""); }
              catch (e) { setError(e instanceof Error ? e.message : "Voice note failed to save — try a shorter recording."); }
            }}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} className="ed-btn-ghost px-3 py-2"><ChevronLeft size={15} /></button>
            <span className="text-sm text-ink-muted">{index + 1} / {focusItems.length}</span>
            <button onClick={advance} className="ed-btn-ghost px-3 py-2"><ChevronRight size={15} /></button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => void flagCurrent()} className={`ed-btn-ghost px-3 py-2 text-sm ${current.flagged ? "text-crimson" : ""}`}>
              <Flag size={14} /> {current.flagged ? "Flagged" : "Flag"}
            </button>
            {index >= focusItems.length - 1 ? (
              // On the last answer, one button checks it and releases the whole
              // result straight to the student (marks, comments, voice notes, all).
              <button
                onClick={() => void checkAndRelease()}
                disabled={busy}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white bg-mint disabled:opacity-60"
              >
                <Send size={15} /> Check &amp; release to {focusName.split(" ")[0]}
              </button>
            ) : (
              <button onClick={() => void approveCurrent()} disabled={busy} className="ed-btn-primary px-5 py-2.5">
                <Check size={15} /> {dirty ? "Save & next" : "Checked & next"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
