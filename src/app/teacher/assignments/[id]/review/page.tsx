"use client";

/**
 * Review & release workspace (spec §5.5) — rebuilt on the shared `.pr` design.
 * Two views: a per-student overview (cards), and a focus view that walks one
 * student's answers with the AI marks, per-criterion override, comments +
 * comment bank, "apply to all who missed", a voice note, flag, and a single
 * "check & release" on the last answer. All actions reuse the stable
 * /review + /release APIs untouched. Marking itself is unchanged (§5.4).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Icon } from "@/components/propel/Icon";
import { EmptyState, useToast } from "@/components/propel/primitives";
import {
  QueueItem, QueueResponse, approveMark, bulkApprove, flagMark, getQueue, overrideMark, saveVoiceNote,
} from "@/lib/review";
import { applyMissedGuidance, releaseOne, saveCriterionComment } from "@/lib/feedbackRelease";
import CommentBankButton from "@/components/teacher/CommentBankButton";
import VoiceNote from "@/components/teacher/VoiceNote";

const REVIEWED = ["approved", "overridden", "auto_approved"];

interface StudentRow {
  clerkId: string; name: string; items: QueueItem[];
  count: number; reviewed: number; earned: number; total: number; done: boolean;
}

export default function ReviewPage() {
  const params = useParams<{ id: string }>();
  const assignmentId = params?.id ?? "";
  const toast = useToast();

  const [data, setData] = useState<QueueResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [awarded, setAwarded] = useState<boolean[]>([]);
  const [comments, setComments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const s = new URLSearchParams(window.location.search).get("student");
      if (s) setSelected(s);
    }
  }, []);

  const load = useCallback(async () => {
    try { setLoading(true); setData(await getQueue(assignmentId, "all")); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to load review queue"); }
    finally { setLoading(false); }
  }, [assignmentId]);
  useEffect(() => { if (assignmentId) void load(); }, [load, assignmentId]);

  const allItems = data?.items ?? [];

  const students: StudentRow[] = useMemo(() => {
    const map = new Map<string, StudentRow>();
    for (const it of allItems) {
      const e = map.get(it.student_clerk_id) ?? { clerkId: it.student_clerk_id, name: it.student_name, items: [], count: 0, reviewed: 0, earned: 0, total: 0, done: false };
      e.items.push(it);
      map.set(it.student_clerk_id, e);
    }
    return Array.from(map.values()).map((s) => {
      const total = s.items.reduce((sum, it) => sum + (it.ai_marks_available ?? it.question.marks ?? 0), 0);
      const earned = s.items.reduce((sum, it) => sum + (it.final_score ?? it.ai_score ?? 0), 0);
      const reviewed = s.items.filter((it) => REVIEWED.includes(it.status)).length;
      return { ...s, count: s.items.length, reviewed, earned, total, done: reviewed === s.items.length && s.items.length > 0 };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [allItems]);

  const focusItems = useMemo(() => (selected ? allItems.filter((it) => it.student_clerk_id === selected) : []), [allItems, selected]);
  const current: QueueItem | undefined = focusItems[index];

  useEffect(() => {
    if (!current) { setAwarded([]); setComments([]); return; }
    const base = current.final_criteria ?? current.ai_criteria;
    setAwarded(base.map((c) => c.awarded));
    setComments(base.map((_, i) => current.criterion_comments?.find((cm) => cm.index === i)?.text ?? ""));
  }, [current]);

  const markLocal = (markId: string, patch: Partial<QueueItem>) =>
    setData((d) => (d ? { ...d, items: d.items.map((it) => (it.mark_id === markId ? { ...it, ...patch } : it)) } : d));

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

  const backToTable = () => { setSelected(null); setIndex(0); };
  const advance = useCallback(() => {
    setIndex((i) => { if (i + 1 >= focusItems.length) { setSelected(null); return 0; } return i + 1; });
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
    } catch (err) { toast(err instanceof Error ? err.message : "Failed to save", "alert"); }
    finally { setBusy(false); }
  }, [current, busy, dirty, awarded, advance]);

  const flagCurrent = useCallback(async () => {
    if (!current) return;
    try { await flagMark(current.mark_id, !current.flagged); markLocal(current.mark_id, { flagged: !current.flagged }); }
    catch (err) { toast(err instanceof Error ? err.message : "Failed to flag", "alert"); }
  }, [current]);

  const approveAllForStudent = async (row: StudentRow) => {
    const pending = row.items.filter((it) => !REVIEWED.includes(it.status));
    if (pending.length === 0) return;
    setBusy(true);
    try {
      for (const it of pending) { await approveMark(it.mark_id); markLocal(it.mark_id, { status: "approved", final_score: it.ai_score }); }
      toast(`Approved ${pending.length} for ${row.name}`, "check_circle");
    } catch (err) { toast(err instanceof Error ? err.message : "Failed to approve", "alert"); }
    finally { setBusy(false); }
  };

  const approveConfident = async () => {
    setBusy(true);
    try {
      const { approved } = await bulkApprove(assignmentId);
      toast(approved > 0 ? `Approved ${approved} confident answer${approved === 1 ? "" : "s"}` : "Nothing above the confidence threshold", "check_circle");
      await load();
    } catch (err) { toast(err instanceof Error ? err.message : "Bulk approve failed", "alert"); }
    finally { setBusy(false); }
  };

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
      toast("Released to student", "send");
      backToTable();
      await load();
    } catch (err) { toast(err instanceof Error ? err.message : "Failed to release results", "alert"); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="grid" style={{ gap: 16 }}><div className="sk" style={{ height: 60, borderRadius: 16 }} /><div className="sk" style={{ height: 360, borderRadius: 18 }} /></div>;

  const reviewedStudents = students.filter((s) => s.done).length;

  // ---------------- OVERVIEW ----------------
  if (!selected) {
    return (
      <>
        <div className="row-between wrap gap-12" style={{ marginBottom: 18 }}>
          <Link href={`/teacher/assignments/${assignmentId}`} className="chip"><Icon name="chevron_left" size={15} /> {data?.assignment.title || "Assignment"}</Link>
          <div className="flex items-center gap-10 wrap">
            <span className="faint" style={{ fontSize: 13 }}>{reviewedStudents}/{students.length} reviewed</span>
            {students.some((s) => !s.done) && (
              <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void approveConfident()}>
                <Icon name="sparkles" size={14} /> Approve confident
              </button>
            )}
          </div>
        </div>

        {error && <p style={{ color: "var(--coral)", fontSize: 13, marginBottom: 12 }}>{error}</p>}

        {students.length === 0 ? (
          <EmptyState icon="check_circle" title="Nothing to review yet" body="Once students submit and their scripts are marked, they'll appear here for you to check and release." />
        ) : (
          <div className="grid" style={{ gap: 10 }}>
            {students.map((s) => (
              <div key={s.clerkId} className="card card-pad row-between wrap gap-12">
                <div className="flex items-center gap-12" style={{ minWidth: 0 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, flex: "none", display: "grid", placeItems: "center", background: "linear-gradient(140deg, var(--purple), #4b32a8)", color: "#fff", fontWeight: 600, fontSize: 14 }}>{s.name.slice(0, 2).toUpperCase()}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
                    <div className="faint" style={{ fontSize: 12.5, marginTop: 2 }}>{s.reviewed}/{s.count} marked · <b style={{ color: "var(--ink)" }}>{s.earned}</b>/{s.total}</div>
                  </div>
                </div>
                <div className="flex items-center gap-8 wrap" style={{ flex: "none" }}>
                  {s.done
                    ? <span className="chip-tag" style={{ background: "var(--teal-soft)", color: "var(--teal)" }}>Reviewed</span>
                    : <span className="chip-tag" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>{s.count - s.reviewed} pending</span>}
                  {!s.done && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void approveAllForStudent(s)}><Icon name="check_circle" size={13} /> Approve all</button>}
                  <button className="btn btn-primary btn-sm" onClick={() => { setSelected(s.clerkId); setIndex(0); setError(""); }}>{s.done ? "View" : "Review"} <Icon name="chevron_right" size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }

  // ---------------- FOCUS (one student) ----------------
  const focusName = focusItems[0]?.student_name ?? "Student";
  if (!current) {
    return (
      <>
        <button className="chip" onClick={backToTable} style={{ marginBottom: 16 }}><Icon name="chevron_left" size={15} /> All students</button>
        <EmptyState icon="check_circle" title={`Nothing to review for ${focusName}`} />
      </>
    );
  }
  const q = current.question;
  const answerImages = Array.isArray(current.answer.images) ? (current.answer.images as { data_url?: string }[]) : [];

  return (
    <>
      <style>{`.rv-panes{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}@media(min-width:900px){.rv-panes{grid-template-columns:minmax(0,1.7fr) minmax(0,1fr)}}`}</style>

      <div className="row-between wrap gap-12" style={{ marginBottom: 14 }}>
        <button className="chip" onClick={backToTable}><Icon name="chevron_left" size={15} /> All students</button>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{focusName}</span>
      </div>

      {error && <p style={{ color: "var(--coral)", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <div className="row-between" style={{ marginBottom: 12 }}>
        <p className="faint" style={{ fontSize: 13 }}>Q{String(q.number)} · {q.marks} marks{q.topic ? ` · ${q.topic}` : ""}</p>
        {current.ai_score === null && q.type !== "mcq" && <span className="chip-tag" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>Needs marking</span>}
      </div>

      <div className="rv-panes">
        {/* Student answer */}
        <div className="card card-pad">
          <p className="eyebrow" style={{ marginBottom: 10 }}>Student answer</p>
          {q.text && <p className="faint" style={{ fontSize: 12.5, marginBottom: 10, whiteSpace: "pre-wrap" }}>{q.text}</p>}
          {q.images && q.images.length > 0 && (
            <div className="flex wrap gap-8" style={{ marginBottom: 10 }}>
              {q.images.map((im, k) => im.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={k} src={im.src} alt={im.alt || "Figure"} style={{ maxHeight: 160, borderRadius: 10, border: "1px solid var(--line)", objectFit: "contain", background: "#fff" }} />
              ) : null)}
            </div>
          )}
          {q.parts && q.parts.length > 0 && (
            <div className="grid" style={{ gap: 6, marginBottom: 10 }}>
              {q.parts.map((p, k) => <div key={k} className="faint" style={{ fontSize: 12.5 }}><b style={{ color: "var(--ink)" }}>{p.label}</b> {p.body}{p.marks != null ? ` [${p.marks}]` : ""}</div>)}
            </div>
          )}
          {current.answer.ocr_status === "failed" && <span className="chip-tag" style={{ background: "var(--crimson-soft)", color: "var(--crimson)", marginBottom: 10, display: "inline-block" }}>OCR failed — original image required</span>}
          {q.type === "mcq" ? (
            <p style={{ fontSize: 14 }}>Selected: <span className="mono" style={{ fontWeight: 700 }}>{current.answer.selected_option || "—"}</span></p>
          ) : (
            <p style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{current.answer.text || current.answer.ocr_text || <span className="faint">No answer.</span>}</p>
          )}
          {answerImages.length > 0 && (
            <div className="flex wrap gap-8" style={{ marginTop: 12 }}>
              {answerImages.map((img, i) => img?.data_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={img.data_url} alt="handwritten answer" style={{ height: 128, borderRadius: 10, border: "1px solid var(--line)", objectFit: "cover" }} />
              ) : null)}
            </div>
          )}
        </div>

        {/* Mark scheme + per-criterion override */}
        <div className="card card-pad">
          <div className="row-between" style={{ marginBottom: 10 }}>
            <p className="eyebrow">Mark scheme</p>
            <span className="big-num" style={{ fontSize: 18 }}>{total.earned}<span className="faint" style={{ fontSize: 13 }}>/{total.available}</span></span>
          </div>
          {current.examiner_note && (
            <div style={{ background: "var(--surface-2)", borderRadius: 10, padding: 10, marginBottom: 10, borderLeft: "3px solid var(--amber)" }}>
              <p className="eyebrow" style={{ color: "var(--amber)" }}>Examiner report — common mistakes</p>
              <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{current.examiner_note}</p>
              <p className="faint" style={{ fontSize: 11, marginTop: 4 }}>Teacher-facing · never shown to students</p>
            </div>
          )}
          <div className="grid" style={{ gap: 8 }}>
            {current.ai_criteria.map((c, i) => (
              <div key={i} style={{ borderRadius: 12, padding: 12, border: `1px solid ${awarded[i] ? "var(--teal)" : "var(--line)"}`, background: awarded[i] ? "var(--teal-soft)" : "transparent" }}>
                <div className="flex items-start gap-8">
                  <button
                    onClick={() => setAwarded((prev) => prev.map((a, idx) => (idx === i ? !a : a)))}
                    aria-label="Toggle criterion"
                    style={{ flex: "none", marginTop: 1, width: 22, height: 22, borderRadius: 7, display: "grid", placeItems: "center", background: awarded[i] ? "var(--teal)" : "var(--surface)", color: "#fff", border: awarded[i] ? "none" : "1px solid var(--line-strong)" }}
                  >
                    {awarded[i] && <Icon name="check_circle" size={13} />}
                  </button>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: 13.5 }}>{c.criterion_text || `Criterion ${i + 1}`}</p>
                    <p className="faint" style={{ fontSize: 12, marginTop: 2 }}>{c.marks_available} mark{c.marks_available === 1 ? "" : "s"}</p>
                    {c.reasoning && (
                      <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                        <span className="mono" style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".13em", color: "var(--purple)" }}>AI</span> {c.reasoning}
                      </p>
                    )}
                    <div className="flex items-center gap-6" style={{ marginTop: 8 }}>
                      <input
                        className="input"
                        style={{ padding: "7px 10px", fontSize: 12.5, flex: 1 }}
                        value={comments[i] ?? ""}
                        onChange={(e) => setComments((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
                        onBlur={(e) => { if (current) void saveCriterionComment(current.mark_id, i, e.target.value).catch(() => {}); }}
                        placeholder="Comment for this criterion…"
                      />
                      <CommentBankButton
                        topic={current.question.topic}
                        currentText={comments[i] ?? ""}
                        onInsert={(t) => { setComments((prev) => prev.map((v, idx) => (idx === i ? t : v))); if (current) void saveCriterionComment(current.mark_id, i, t).catch(() => {}); }}
                      />
                    </div>
                    {!awarded[i] && (comments[i] ?? "").trim() && (
                      <button
                        onClick={async () => {
                          if (!current) return;
                          try { const { applied } = await applyMissedGuidance(assignmentId, current.assignment_question_id, i, comments[i]); toast(`Applied to ${applied} student${applied === 1 ? "" : "s"} who missed this`, "check_circle"); }
                          catch (e) { toast(e instanceof Error ? e.message : "Failed to apply", "alert"); }
                        }}
                        style={{ fontSize: 11.5, color: "var(--crimson)", fontWeight: 600, marginTop: 6 }}
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
      <div className="flex items-center gap-10 wrap" style={{ marginTop: 16 }}>
        <span className="eyebrow">Voice note</span>
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
      <div className="row-between wrap gap-12" style={{ marginTop: 18 }}>
        <div className="flex items-center gap-8">
          <button className="btn btn-ghost btn-sm" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}><Icon name="chevron_left" size={15} /></button>
          <span className="faint" style={{ fontSize: 13 }}>{index + 1} / {focusItems.length}</span>
          <button className="btn btn-ghost btn-sm" onClick={advance}><Icon name="chevron_right" size={15} /></button>
        </div>
        <div className="flex items-center gap-8 wrap">
          <button className="btn btn-ghost btn-sm" onClick={() => void flagCurrent()} style={current.flagged ? { color: "var(--crimson)" } : undefined}>
            <Icon name="flag" size={14} /> {current.flagged ? "Flagged" : "Flag"}
          </button>
          {index >= focusItems.length - 1 ? (
            <button className="btn" style={{ background: "var(--teal)", color: "#fff" }} disabled={busy} onClick={() => void checkAndRelease()}>
              <Icon name="send" size={15} /> Check &amp; release to {focusName.split(" ")[0]}
            </button>
          ) : (
            <button className="btn btn-primary" disabled={busy} onClick={() => void approveCurrent()}>
              <Icon name="check_circle" size={15} /> {dirty ? "Save & next" : "Checked & next"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
