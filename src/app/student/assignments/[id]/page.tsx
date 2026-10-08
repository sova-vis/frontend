"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, ChevronLeft, Clock, Camera } from "lucide-react";
import {
  SavedAnswer,
  StartSubmissionResponse,
  saveAnswer,
  startSubmission,
  submitSubmission,
  uploadHandwritten,
} from "@/lib/submissions";
import { StudentResult, getStudentResult } from "@/lib/feedbackRelease";
import { fileToDownscaledDataUrl } from "@/lib/image";
import VoiceNote from "@/components/teacher/VoiceNote";
import AnswerAnnotator from "@/components/teacher/AnswerAnnotator";
import QuestionSolveCard, { fromStudentQuestion } from "@/components/practice/QuestionSolveCard";

interface AnswerState { answer_text: string; selected_option: string; part_answers: Record<string, string> }
type QParts = { label: string; body: string; marks: number | null }[] | undefined;

// Which parts are answerable (carry marks); if none carry marks, all are.
function answerableParts(parts: QParts): { label: string; index: number }[] {
  const list = parts ?? [];
  const withMarks = list.map((p, i) => ({ label: p.label, index: i, marks: p.marks })).filter((x) => x.marks != null);
  const chosen = withMarks.length ? withMarks : list.map((p, i) => ({ label: p.label, index: i }));
  return chosen.map((x) => ({ label: x.label, index: x.index }));
}

// Combined answer text (what the AI marks) from the per-part answers.
function combineParts(parts: QParts, pa: Record<string, string>): string {
  const segs = answerableParts(parts).map(({ label, index }) => {
    const a = (pa[String(index)] ?? "").trim();
    if (!a) return "";
    const lbl = label ? `(${label.replace(/[()]/g, "")}) ` : "";
    return `${lbl}${a}`;
  });
  return segs.filter(Boolean).join("\n\n");
}

export default function TakeAssignmentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const assignmentId = (params?.id ?? "") as string;

  const [data, setData] = useState<StartSubmissionResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<StudentResult | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => {
    void (async () => {
      try {
        const res = await startSubmission(assignmentId);
        setData(res);
        if (res.read_only) {
          // Marking may have been released — show results if so.
          getStudentResult(assignmentId).then(setResult).catch(() => {});
        }
        const initial: Record<string, AnswerState> = {};
        for (const a of res.answers as SavedAnswer[]) {
          initial[a.assignment_question_id] = {
            answer_text: a.answer_text || "",
            selected_option: a.selected_option || "",
            part_answers: (a.part_answers as Record<string, string>) || {},
          };
        }
        setAnswers(initial);
        startRef.current = Date.now();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to open assignment");
      } finally {
        setLoading(false);
      }
    })();
  }, [assignmentId]);

  const readOnly = data?.read_only ?? false;
  const submissionId = data?.submission.id;
  // §5.3 handwritten-first: when the teacher set the assignment to handwritten,
  // each question opens in photo/upload mode by default (the student can still
  // switch to typing per question as a fallback).
  const defaultMode: "type" | "upload" = data?.assignment.answer_method === "handwritten" ? "upload" : "type";

  const persist = useCallback(
    (aqId: string, patch: { answer_text?: string; selected_option?: string; part_answers?: Record<string, string> }) => {
      if (!submissionId || readOnly) return;
      void saveAnswer(submissionId, aqId, patch).catch(() => {});
    },
    [submissionId, readOnly]
  );

  const blank = (aqId: string): AnswerState => answers[aqId] || { answer_text: "", selected_option: "", part_answers: {} };

  const setText = (aqId: string, text: string) => {
    setAnswers((prev) => ({ ...prev, [aqId]: { ...(prev[aqId] || { selected_option: "", part_answers: {} }), answer_text: text } as AnswerState }));
  };
  const setOption = (aqId: string, option: string) => {
    setAnswers((prev) => ({ ...prev, [aqId]: { ...(prev[aqId] || { answer_text: "", part_answers: {} }), selected_option: option } as AnswerState }));
    persist(aqId, { selected_option: option });
  };

  // Per-part answering (like Practice): each part keeps its own text; answer_text
  // stays the combined text (what the AI marks), rebuilt as parts change.
  const setPart = (aqId: string, parts: QParts, key: string, value: string) => {
    setAnswers((prev) => {
      const cur = prev[aqId] || { answer_text: "", selected_option: "", part_answers: {} };
      const nextParts = { ...cur.part_answers, [key]: value };
      return { ...prev, [aqId]: { ...cur, part_answers: nextParts, answer_text: combineParts(parts, nextParts) } };
    });
  };
  const persistPart = (aqId: string, parts: QParts, key: string, value: string) => {
    const nextParts = { ...blank(aqId).part_answers, [key]: value };
    persist(aqId, { answer_text: combineParts(parts, nextParts), part_answers: nextParts });
  };

  // Handwritten upload → OCR (per theory question).
  const [mode, setMode] = useState<Record<string, "type" | "upload">>({});
  const [uploads, setUploads] = useState<Record<string, { thumb?: string; confidence?: number; status?: string; busy?: boolean }>>({});

  const handleUpload = async (aqId: string, file: File) => {
    if (!submissionId) return;
    setUploads((u) => ({ ...u, [aqId]: { ...(u[aqId] || {}), busy: true } }));
    // Downscale before upload: a raw phone photo (several MB) exceeds the API body
    // limit and is rejected with 413 before it can be stored, so the teacher never
    // gets it and the student sees "couldn't read". A bounded JPEG fixes both.
    let dataUrl: string;
    try {
      dataUrl = await fileToDownscaledDataUrl(file);
    } catch {
      setUploads((u) => ({ ...u, [aqId]: { status: "failed", busy: false } }));
      return;
    }
    setUploads((u) => ({ ...u, [aqId]: { thumb: dataUrl, busy: true } }));
    try {
      const r = await uploadHandwritten(submissionId, aqId, dataUrl);
      setText(aqId, r.ocr_text || "");
      setUploads((u) => ({ ...u, [aqId]: { thumb: dataUrl, confidence: r.ocr_confidence, status: r.ocr_status, busy: false } }));
    } catch {
      // Keep the thumb so the student sees their photo is attached even if the
      // auto-read failed; the image is still submitted for the teacher to review.
      setUploads((u) => ({ ...u, [aqId]: { thumb: dataUrl, status: "failed", busy: false } }));
    }
  };

  const answeredCount = useMemo(() => {
    if (!data) return 0;
    return data.questions.filter((q) => {
      const a = answers[q.assignment_question_id];
      // An uploaded photo counts as an answer even if auto-transcription failed —
      // the teacher reviews the image itself.
      const hasUpload = Boolean(uploads[q.assignment_question_id]?.thumb);
      if (!a) return hasUpload;
      const partsAnswered = Object.values(a.part_answers || {}).some((v) => v.trim());
      return Boolean(a.answer_text.trim() || a.selected_option || partsAnswered || hasUpload);
    }).length;
  }, [answers, data, uploads]);

  // Return to wherever the student opened this from (their classroom or the
  // assignments list) instead of always dumping them on the orphan list page;
  // fall back to the classroom so this is never a dead-end.
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/student/classroom");
  };

  // Submit now asks for confirmation in a centered on-page modal (not a native
  // browser confirm that pops at the top of the window).
  const submit = () => {
    if (!submissionId || submitting) return;
    setConfirmOpen(true);
  };

  const doSubmit = async () => {
    if (!submissionId) return;
    setConfirmOpen(false);
    setSubmitting(true);
    try {
      const seconds = Math.round((Date.now() - startRef.current) / 1000);
      await submitSubmission(submissionId, seconds);
      // Show the success modal, then drop back into the classroom.
      try { window.localStorage.setItem("propel_mode", "classroom"); } catch { /* ignore */ }
      setSubmitted(true);
      setTimeout(() => router.push("/student/classroom"), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-paper px-4 py-8 max-w-3xl mx-auto space-y-4">
        <div className="h-20 rounded-[1.25rem] bg-surface-soft animate-pulse" />
        <div className="h-64 rounded-[1.25rem] bg-surface-soft animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-paper px-4 py-16 text-center text-ink">
        <p className="text-ink-muted">{error || "Assignment not available."}</p>
        <button onClick={goBack} className="ed-btn-ghost mt-4 px-4 py-2 mx-auto">
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink px-4 md:px-8 py-8">
      {submitted && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-ink/50 backdrop-blur-sm p-4">
          <div className="ed-card p-8 text-center max-w-sm w-full">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-mint-soft text-mint-ink">
              <CheckCircle2 size={38} />
            </div>
            <h2 className="font-display text-xl font-semibold mt-4">Submitted!</h2>
            <p className="text-ink-muted text-sm mt-1">Your answers are in. Your teacher will review them and release your feedback.</p>
            <button onClick={() => router.push("/student/classroom")} className="ed-btn-primary mt-5 px-5 py-2.5 mx-auto">
              Back to classroom
            </button>
          </div>
        </div>
      )}
      {confirmOpen && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-ink/50 backdrop-blur-sm p-4" onClick={() => setConfirmOpen(false)}>
          <div className="ed-card p-6 text-center max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-crimson-soft text-crimson-ink">
              <CheckCircle2 size={30} />
            </div>
            <h2 className="font-display text-lg font-semibold mt-4">Submit your answers?</h2>
            <p className="text-ink-muted text-sm mt-1">You won&apos;t be able to edit after submitting.</p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setConfirmOpen(false)} className="ed-btn-ghost flex-1 justify-center py-2.5">Cancel</button>
              <button onClick={() => void doSubmit()} disabled={submitting} className="ed-btn-primary flex-1 justify-center py-2.5">{submitting ? "Submitting…" : "Submit"}</button>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-3xl mx-auto space-y-5">
        <button onClick={goBack} className="text-sm text-ink-muted hover:text-ink inline-flex items-center gap-1">
          <ChevronLeft size={15} /> Back
        </button>

        <div className="ed-card p-5 flex flex-wrap items-center justify-between gap-3 sticky top-2 z-10">
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight">{data.assignment.title}</h1>
            <p className="text-sm text-ink-muted">
              {answeredCount}/{data.questions.length} answered
              {data.assignment.deadline_at && ` · due ${new Date(data.assignment.deadline_at).toLocaleString()}`}
            </p>
          </div>
          {readOnly ? (
            <span className="ed-pill-mint inline-flex items-center gap-1">
              <CheckCircle2 size={14} /> Submitted
            </span>
          ) : (
            <button onClick={() => void submit()} disabled={submitting} className="ed-btn-primary px-5 py-2.5">
              {submitting ? "Submitting…" : "Submit"}
            </button>
          )}
        </div>

        {error && <p className="text-sm text-crimson">{error}</p>}
        {data.assignment.timed && data.assignment.duration_minutes && !readOnly && (
          <p className="text-sm text-ink-muted inline-flex items-center gap-1">
            <Clock size={14} /> Timed: {data.assignment.duration_minutes} minutes
          </p>
        )}
        {data.assignment.answer_method === "handwritten" && !readOnly && (
          <div className="ed-card-soft flex items-start gap-2 p-3 text-sm text-ink-muted">
            <Camera size={16} className="mt-0.5 flex-none text-crimson" />
            <span>This is a <strong className="text-ink">handwritten</strong> assignment — photograph your working for each question and we&apos;ll read it automatically. Prefer typing? Switch any question to type.</span>
          </div>
        )}

        {result?.released && <ResultsView result={result} />}

        {!result?.released && (
        <div className="space-y-4">
          {data.questions.map((q, i) => {
            const aq = q.assignment_question_id;
            const v = answers[aq] || { answer_text: "", selected_option: "", part_answers: {} };
            const hasParts = (q.parts?.length ?? 0) > 0;
            return (
              <QuestionSolveCard
                key={aq}
                index={i + 1}
                question={fromStudentQuestion(q)}
                readOnly={readOnly}
                selectedOption={v.selected_option}
                onSelectOption={(o) => setOption(aq, o)}
                answerText={v.answer_text}
                onAnswerText={(t) => setText(aq, t)}
                onAnswerBlur={(t) => persist(aq, { answer_text: t })}
                partAnswers={v.part_answers}
                onPartAnswer={hasParts ? (k, val) => setPart(aq, q.parts, k, val) : undefined}
                onPartAnswerBlur={hasParts ? (k, val) => persistPart(aq, q.parts, k, val) : undefined}
                answerMode={mode[aq] || defaultMode}
                onAnswerMode={(m) => setMode((prev) => ({ ...prev, [aq]: m }))}
                upload={uploads[aq]}
                onUpload={(f) => handleUpload(aq, f)}
              />
            );
          })}
        </div>
        )}

        {!readOnly && (
          <div className="flex justify-end pt-2">
            <button onClick={() => void submit()} disabled={submitting} className="ed-btn-primary px-6 py-2.5">
              {submitting ? "Submitting…" : "Submit assignment"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultsView({ result }: { result: StudentResult }) {
  return (
    <div className="space-y-4">
      {(result.total_score != null || result.overall_feedback) && (
        <div className="ed-card p-5">
          {result.total_score != null && (
            <p className="font-display text-3xl font-semibold">
              {result.total_score}
              <span className="text-ink-faint text-lg">/{result.total_available}</span>
            </p>
          )}
          {result.overall_feedback && <p className="text-sm text-ink mt-2 whitespace-pre-wrap">{result.overall_feedback}</p>}
        </div>
      )}

      {(result.questions ?? []).map((q, i) => (
        <div key={i} className="ed-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">
              {q.number ? `Q${q.number}` : `Question ${i + 1}`}
              {q.topic ? <span className="text-ink-faint font-normal"> · {q.topic}</span> : null}
            </p>
            <span className="text-sm font-semibold">{q.score}/{q.available}</span>
          </div>
          {q.question_text && <p className="text-xs text-ink-muted mt-1 whitespace-pre-wrap">{q.question_text}</p>}
          {(q.your_answer || q.your_option || (q.your_images && q.your_images.length > 0)) && (
            <div className="ed-card-soft p-2.5 mt-2">
              <p className="ed-label mb-1">Your answer</p>
              <AnswerAnnotator annotations={q.annotations ?? []}>
                {q.your_option && <p className="text-sm text-ink">Selected: <span className="font-mono font-bold">{q.your_option}</span></p>}
                {q.your_answer && <p className="text-sm text-ink whitespace-pre-wrap">{q.your_answer}</p>}
                {q.your_images && q.your_images.length > 0 && (
                  <div className="flex flex-col gap-2 mt-1">
                    {q.your_images.map((img, k) =>
                      img?.data_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={k} src={img.data_url} alt="your work" style={{ width: "100%", maxWidth: 560, height: "auto", display: "block" }} className="rounded-lg border border-line" />
                      ) : null
                    )}
                  </div>
                )}
              </AnswerAnnotator>
            </div>
          )}
          {q.voice_note && (
            <div className="mt-2">
              <p className="text-xs text-ink-faint mb-1">Voice note from your teacher</p>
              <VoiceNote value={q.voice_note} readOnly />
            </div>
          )}
          {q.criteria && (
            <div className="mt-2 space-y-1.5">
              {q.criteria.map((c, ci) => (
                <div key={ci} className="text-xs">
                  <div className="flex items-start gap-2">
                    <span className={c.awarded ? "text-mint-ink" : "text-clay-ink"}>{c.awarded ? "✓" : "✗"}</span>
                    <span className="flex-1 text-ink-muted">
                      {c.criterion_text || (c.awarded ? "Criterion met" : "Criterion not met")}
                      <span className="text-ink-faint"> ({c.marks_awarded}/{c.marks_available})</span>
                    </span>
                  </div>
                  {c.reasoning && <p className="ml-5 text-ink-faint italic">{c.reasoning}</p>}
                  {c.comment && <p className="ml-5 text-crimson">{c.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

