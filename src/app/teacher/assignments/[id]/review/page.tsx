"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Flag, Keyboard, Layers, Zap } from "lucide-react";
import {
  QueueItem,
  QueueResponse,
  approveMark,
  bulkApprove,
  flagMark,
  getQueue,
  overrideMark,
  approveRemainder,
  sampleAssignment,
  saveVoiceNote,
  setThreshold as saveThreshold,
} from "@/lib/review";
import { applyMissedGuidance, saveCriterionComment } from "@/lib/feedbackRelease";
import CommentBankButton from "@/components/teacher/CommentBankButton";
import VoiceNote from "@/components/teacher/VoiceNote";

type Filter = "all" | "below_threshold" | "ocr_failed" | "overridden" | "flagged";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "below_threshold", label: "Below threshold" },
  { key: "ocr_failed", label: "OCR failed" },
  { key: "overridden", label: "Overridden" },
  { key: "flagged", label: "Flagged" },
];

export default function ReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const assignmentId = (params?.id ?? "") as string;

  const [data, setData] = useState<QueueResponse | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [index, setIndex] = useState(0);
  const [awarded, setAwarded] = useState<boolean[]>([]);
  const [comments, setComments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Sampling mode (§9.7): restrict the queue to a genuinely random subset.
  const [sample, setSample] = useState<{ ids: Set<string>; size: number; total: number; rate: number } | null>(null);
  // Optional focus on a single student (opened from the submission board).
  const [studentFilter, setStudentFilter] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window !== "undefined") setStudentFilter(new URLSearchParams(window.location.search).get("student"));
  }, []);

  const load = useCallback(
    async (f: Filter, keepIndex = false) => {
      try {
        setLoading(true);
        const res = await getQueue(assignmentId, f);
        setData(res);
        if (!keepIndex) setIndex(0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load review queue");
      } finally {
        setLoading(false);
      }
    },
    [assignmentId]
  );

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  const allItems = data?.items ?? [];
  const items = useMemo(() => {
    let arr = allItems;
    if (studentFilter) arr = arr.filter((it) => it.student_clerk_id === studentFilter);
    if (sample) arr = arr.filter((it) => sample.ids.has(it.mark_id));
    return arr;
  }, [allItems, sample, studentFilter]);
  const current: QueueItem | undefined = items[index];

  // Initialise the local awarded-state from the teacher's final marks if present,
  // else the AI marks, whenever the current item changes.
  useEffect(() => {
    if (!current) {
      setAwarded([]);
      return;
    }
    const base = current.final_criteria ?? current.ai_criteria;
    setAwarded(base.map((c) => c.awarded));
    setComments(base.map((_, i) => current.criterion_comments?.find((cm) => cm.index === i)?.text ?? ""));
  }, [current]);

  const threshold = data?.threshold ?? 0.85;

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

  const advance = useCallback(() => {
    setIndex((i) => Math.min(i + 1, items.length - 1));
  }, [items.length]);

  const markLocal = (markId: string, patch: Partial<QueueItem>) => {
    setData((d) => (d ? { ...d, items: d.items.map((it) => (it.mark_id === markId ? { ...it, ...patch } : it)) } : d));
  };

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

  // Keyboard flow (§9.3): a approve, f flag, n/→ next, p/← prev, 1–9 toggle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA" || (e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "a") { e.preventDefault(); void approveCurrent(); }
      else if (e.key === "f") { e.preventDefault(); void flagCurrent(); }
      else if (e.key === "n" || e.key === "ArrowRight") { e.preventDefault(); advance(); }
      else if (e.key === "p" || e.key === "ArrowLeft") { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
      else if (/^[1-9]$/.test(e.key)) {
        const idx = Number(e.key) - 1;
        setAwarded((prev) => prev.map((a, i) => (i === idx ? !a : a)));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [approveCurrent, flagCurrent, advance]);

  const doBulkApprove = async () => {
    const ready = data?.counts.ready_bulk ?? 0;
    if (!window.confirm(`Approve ${ready} answer${ready === 1 ? "" : "s"} at or above ${Math.round(threshold * 100)}% confidence?`)) return;
    setBusy(true);
    try {
      const { approved } = await bulkApprove(assignmentId);
      window.alert(`Approved ${approved} answers.`);
      await load(filter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to bulk approve");
    } finally {
      setBusy(false);
    }
  };

  const startSample = async (rate: number) => {
    setBusy(true);
    try {
      const { sample_ids, total, sample_size } = await sampleAssignment(assignmentId, rate);
      if (sample_ids.length === 0) {
        window.alert("No answers awaiting review to sample.");
        return;
      }
      setSample({ ids: new Set(sample_ids), size: sample_size, total, rate });
      setIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start sampling");
    } finally {
      setBusy(false);
    }
  };

  const finishSample = async () => {
    if (!sample) return;
    const overridden = items.filter((it) => it.status === "overridden").length;
    const overrideRate = sample.size > 0 ? overridden / sample.size : 0;
    if (overrideRate > 0.2 && !window.confirm(
      `You overrode ${Math.round(overrideRate * 100)}% of the sample — above 20%. The AI may be miscalibrated on this assignment; full review is recommended. Approve the rest anyway?`
    )) return;
    const remaining = (data?.counts.needs_review ?? 0) - sample.size;
    if (!window.confirm(`Approve the remaining ~${Math.max(0, remaining)} unreviewed answers based on the sample?`)) return;
    setBusy(true);
    try {
      await approveRemainder(assignmentId, sample.rate, overrideRate);
      setSample(null);
      await load(filter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve remainder");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 md:px-8 py-8 max-w-6xl mx-auto space-y-4">
        <div className="h-16 rounded-[1.25rem] bg-surface-soft animate-pulse" />
        <div className="h-96 rounded-[1.25rem] bg-surface-soft animate-pulse" />
      </div>
    );
  }

  const counts = data?.counts ?? {};
  const reviewed = (counts.approved ?? 0) + (counts.overridden ?? 0);

  return (
    <div className="px-4 md:px-8 py-6">
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button onClick={() => router.push(`/teacher/assignments/${assignmentId}`)} className="text-sm text-ink-muted hover:text-ink inline-flex items-center gap-1">
            <ChevronLeft size={15} /> {data?.assignment.title || "Assignment"}
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-ink-muted">
              {reviewed}/{counts.total ?? 0} reviewed
            </span>
            <ThresholdControl
              value={threshold}
              onSave={async (v) => {
                try {
                  await saveThreshold(v);
                  await load(filter, true);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to set threshold");
                }
              }}
            />
            {!sample && (
              <button onClick={() => void startSample(0.1)} disabled={busy || !(counts.needs_review ?? 0)} className="ed-btn-ghost px-3 py-2 text-sm">
                <Layers size={14} /> Sample 10%
              </button>
            )}
            <button onClick={() => void doBulkApprove()} disabled={busy || !(counts.ready_bulk ?? 0)} className="ed-btn-primary px-3 py-2 text-sm">
              <Zap size={14} /> Bulk approve ({counts.ready_bulk ?? 0})
            </button>
          </div>
        </div>

        {sample && (
          <div className="ed-card-soft p-3 flex flex-wrap items-center justify-between gap-3 border-l-4 border-gold">
            <p className="text-sm text-ink">
              Reviewing a random <span className="font-semibold">{Math.round(sample.rate * 100)}% sample</span> — {sample.size} of {sample.total} answers.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setSample(null)} className="ed-btn-ghost px-3 py-1.5 text-xs">Exit sampling</button>
              <button onClick={() => void finishSample()} disabled={busy} className="ed-btn-primary px-3 py-1.5 text-xs">
                Approve remainder
              </button>
            </div>
          </div>
        )}

        {/* Filters + progress bar */}
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                filter === f.key ? "border-crimson bg-crimson-soft text-crimson-ink" : "border-line text-ink-muted hover:bg-surface-soft"
              }`}
            >
              {f.label}
              {f.key === "below_threshold" && counts.below_threshold ? ` (${counts.below_threshold})` : ""}
              {f.key === "ocr_failed" && counts.ocr_failed ? ` (${counts.ocr_failed})` : ""}
              {f.key === "flagged" && counts.flagged ? ` (${counts.flagged})` : ""}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-crimson">{error}</p>}

        {items.length === 0 ? (
          <div className="ed-card p-10 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-mint-soft text-mint-ink">
              <Check size={26} />
            </div>
            <p className="mt-4 text-ink-muted">Nothing to review in this filter.</p>
          </div>
        ) : !current ? null : (
          <div className="grid lg:grid-cols-[240px_1fr] gap-5">
            {/* Queue rail */}
            <aside className="ed-card p-2 h-fit max-h-[70vh] overflow-y-auto hidden lg:block">
              {items.map((it, i) => (
                <button
                  key={it.mark_id}
                  onClick={() => setIndex(i)}
                  className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs ${
                    i === index ? "bg-crimson-soft" : "hover:bg-surface-soft"
                  }`}
                >
                  <ConfidenceDot confidence={it.confidence} threshold={threshold} />
                  <span className="truncate flex-1 text-ink">{it.student_name}</span>
                  <StatusTick status={it.status} />
                </button>
              ))}
            </aside>

            {/* Review item */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-ink-muted">
                    {current.student_name} · Q{String(current.question.number)} · {current.question.marks} marks
                    {current.question.topic ? ` · ${current.question.topic}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <ConfidenceBadge confidence={current.confidence} threshold={threshold} />
                  <span className="text-xs text-ink-faint capitalize">{current.status.replace("_", " ")}</span>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Student answer panel */}
                <div className="ed-card p-4">
                  <p className="ed-label mb-2">Student answer</p>
                  {current.question.text && <p className="text-xs text-ink-faint mb-3 whitespace-pre-wrap">{current.question.text}</p>}
                  {current.answer.ocr_status === "failed" && (
                    <p className="ed-pill-crimson text-[0.65rem] mb-2">OCR failed — original image required</p>
                  )}
                  {current.question.type === "mcq" ? (
                    <p className="text-sm text-ink">Selected: <span className="font-mono font-bold">{current.answer.selected_option || "—"}</span></p>
                  ) : (
                    <p className="text-sm text-ink whitespace-pre-wrap">
                      {current.answer.text || current.answer.ocr_text || <span className="text-ink-faint">No answer.</span>}
                    </p>
                  )}
                  {/* Original handwritten image(s), retained for review (§8.2) */}
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

                {/* Criteria + AI marks panel with per-criterion override */}
                <div className="ed-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="ed-label">Mark scheme &amp; AI marks</p>
                    <span className="font-display text-lg font-semibold">
                      {total.earned}<span className="text-ink-faint text-sm">/{total.available}</span>
                    </span>
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
                            className={`shrink-0 mt-0.5 grid h-5 w-5 place-items-center rounded border ${
                              awarded[i] ? "bg-mint text-paper border-mint" : "border-line"
                            }`}
                            aria-label="Toggle criterion"
                          >
                            {awarded[i] && <Check size={12} />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-ink">{c.criterion_text || `Criterion ${i + 1}`}</p>
                            <p className="text-xs text-ink-faint mt-0.5">
                              <span className="font-mono">{i + 1}</span> · {c.marks_available} mark{c.marks_available === 1 ? "" : "s"}
                              {c.confidence !== null && ` · ${Math.round(c.confidence * 100)}% conf`}
                            </p>
                            {c.reasoning && <p className="text-xs text-ink-muted mt-1 italic">{c.reasoning}</p>}
                            <div className="mt-2 flex items-center gap-1.5">
                              <input
                                value={comments[i] ?? ""}
                                onChange={(e) => setComments((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
                                onBlur={(e) => {
                                  if (current) void saveCriterionComment(current.mark_id, i, e.target.value).catch(() => {});
                                }}
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

              {/* Voice note for this answer */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="ed-label">Voice note</span>
                <VoiceNote
                  value={current.voice_note}
                  onChange={async (audio) => {
                    markLocal(current.mark_id, { voice_note: audio });
                    try { await saveVoiceNote(current.mark_id, audio); } catch { /* ignore */ }
                  }}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <button onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} className="ed-btn-ghost px-3 py-2">
                    <ChevronLeft size={15} />
                  </button>
                  <span className="text-sm text-ink-muted">{index + 1} / {items.length}</span>
                  <button onClick={advance} disabled={index >= items.length - 1} className="ed-btn-ghost px-3 py-2">
                    <ChevronRight size={15} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => void flagCurrent()} className={`ed-btn-ghost px-3 py-2 text-sm ${current.flagged ? "text-crimson" : ""}`}>
                    <Flag size={14} /> {current.flagged ? "Flagged" : "Flag"}
                  </button>
                  <button onClick={() => void approveCurrent()} disabled={busy} className="ed-btn-primary px-5 py-2.5">
                    <Check size={15} /> {dirty ? "Save & next" : "Approve & next"}
                  </button>
                </div>
              </div>

              <p className="text-xs text-ink-faint inline-flex items-center gap-1.5">
                <Keyboard size={13} /> <span className="font-mono">a</span> approve · <span className="font-mono">1–9</span> toggle criterion · <span className="font-mono">f</span> flag · <span className="font-mono">← →</span> navigate
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ThresholdControl({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [pct, setPct] = useState(String(Math.round(value * 100)));
  useEffect(() => setPct(String(Math.round(value * 100))), [value]);
  const commit = () => {
    const n = Math.max(0, Math.min(100, Number(pct)));
    if (n / 100 !== value) onSave(n / 100);
  };
  return (
    <label className="flex items-center gap-1.5 text-xs text-ink-muted">
      Auto-approve ≥
      <input
        value={pct}
        onChange={(e) => setPct(e.target.value.replace(/[^0-9]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="ed-input px-2 py-1 text-xs w-12 text-center"
      />
      %
    </label>
  );
}

function ConfidenceDot({ confidence, threshold }: { confidence: number | null; threshold: number }) {
  const color = confidence === null ? "bg-ink-faint" : confidence < threshold ? "bg-crimson" : "bg-mint";
  return <span className={`h-2 w-2 rounded-full shrink-0 ${color}`} />;
}

function StatusTick({ status }: { status: string }) {
  if (status === "approved" || status === "auto_approved") return <Check size={12} className="text-mint-ink" />;
  if (status === "overridden") return <Layers size={12} className="text-gold-ink" />;
  return null;
}

function ConfidenceBadge({ confidence, threshold }: { confidence: number | null; threshold: number }) {
  if (confidence === null) return <span className="ed-pill-clay text-[0.65rem]">No AI mark</span>;
  const pct = Math.round(confidence * 100);
  const cls = confidence < threshold ? "ed-pill-crimson" : "ed-pill-mint";
  return <span className={`${cls} text-[0.65rem]`}>{pct}% confidence</span>;
}
