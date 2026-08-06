"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, ChevronLeft, Clock } from "lucide-react";
import {
  SavedAnswer,
  StartSubmissionResponse,
  StudentQuestion,
  saveAnswer,
  startSubmission,
  submitSubmission,
} from "@/lib/submissions";
import { StudentResult, getStudentResult } from "@/lib/feedbackRelease";

export default function TakeAssignmentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const assignmentId = (params?.id ?? "") as string;

  const [data, setData] = useState<StartSubmissionResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, { answer_text: string; selected_option: string }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
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
        const initial: Record<string, { answer_text: string; selected_option: string }> = {};
        for (const a of res.answers as SavedAnswer[]) {
          initial[a.assignment_question_id] = { answer_text: a.answer_text || "", selected_option: a.selected_option || "" };
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

  const persist = useCallback(
    (aqId: string, patch: { answer_text?: string; selected_option?: string }) => {
      if (!submissionId || readOnly) return;
      void saveAnswer(submissionId, aqId, patch).catch(() => {});
    },
    [submissionId, readOnly]
  );

  const setText = (aqId: string, text: string) => {
    setAnswers((prev) => ({ ...prev, [aqId]: { ...prev[aqId], answer_text: text, selected_option: prev[aqId]?.selected_option || "" } }));
  };
  const setOption = (aqId: string, option: string) => {
    setAnswers((prev) => ({ ...prev, [aqId]: { answer_text: prev[aqId]?.answer_text || "", selected_option: option } }));
    persist(aqId, { selected_option: option });
  };

  const answeredCount = useMemo(() => {
    if (!data) return 0;
    return data.questions.filter((q) => {
      const a = answers[q.assignment_question_id];
      return a && (a.answer_text.trim() || a.selected_option);
    }).length;
  }, [answers, data]);

  const submit = async () => {
    if (!submissionId) return;
    if (!window.confirm("Submit your answers? You won't be able to edit after submitting.")) return;
    setSubmitting(true);
    try {
      const seconds = Math.round((Date.now() - startRef.current) / 1000);
      const { status } = await submitSubmission(submissionId, seconds);
      router.push(`/student/assignments?submitted=${status}`);
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
        <button onClick={() => router.push("/student/assignments")} className="ed-btn-ghost mt-4 px-4 py-2 mx-auto">
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink px-4 md:px-8 py-8">
      <div className="max-w-3xl mx-auto space-y-5">
        <button onClick={() => router.push("/student/assignments")} className="text-sm text-ink-muted hover:text-ink inline-flex items-center gap-1">
          <ChevronLeft size={15} /> Assignments
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

        {result?.released && <ResultsView result={result} />}

        {!result?.released && (
        <div className="space-y-4">
          {data.questions.map((q, i) => (
            <QuestionCard
              key={q.assignment_question_id}
              index={i + 1}
              q={q}
              value={answers[q.assignment_question_id] || { answer_text: "", selected_option: "" }}
              readOnly={readOnly}
              onText={(t) => setText(q.assignment_question_id, t)}
              onTextBlur={(t) => persist(q.assignment_question_id, { answer_text: t })}
              onOption={(o) => setOption(q.assignment_question_id, o)}
            />
          ))}
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
          {q.criteria && (
            <div className="mt-2 space-y-1.5">
              {q.criteria.map((c, ci) => (
                <div key={ci} className="text-xs">
                  <div className="flex items-start gap-2">
                    <span className={c.awarded ? "text-mint-ink" : "text-crimson"}>{c.awarded ? "✓" : "✗"}</span>
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

function QuestionCard({
  index,
  q,
  value,
  readOnly,
  onText,
  onTextBlur,
  onOption,
}: {
  index: number;
  q: StudentQuestion;
  value: { answer_text: string; selected_option: string };
  readOnly: boolean;
  onText: (t: string) => void;
  onTextBlur: (t: string) => void;
  onOption: (o: string) => void;
}) {
  return (
    <div className="ed-card p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-paper text-xs font-bold shrink-0">{index}</span>
        <div className="min-w-0 flex-1">
          <p className="text-ink whitespace-pre-wrap">{q.question_text}</p>
          <p className="text-xs text-ink-faint mt-1">{q.marks} marks</p>

          {q.type === "mcq" ? (
            <div className="mt-3 space-y-2">
              {q.options.map((o) => (
                <label
                  key={o.label}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer ${
                    value.selected_option === o.label ? "border-crimson bg-crimson-soft" : "border-line"
                  } ${readOnly ? "pointer-events-none opacity-80" : ""}`}
                >
                  <input
                    type="radio"
                    name={q.assignment_question_id}
                    checked={value.selected_option === o.label}
                    onChange={() => onOption(o.label)}
                    className="accent-crimson"
                    disabled={readOnly}
                  />
                  <span className="font-mono text-xs text-ink-faint">{o.label}</span>
                  <span className="text-sm text-ink">{o.text}</span>
                </label>
              ))}
            </div>
          ) : (
            <textarea
              value={value.answer_text}
              onChange={(e) => onText(e.target.value)}
              onBlur={(e) => onTextBlur(e.target.value)}
              rows={5}
              disabled={readOnly}
              placeholder="Type your answer…"
              className="ed-input mt-3 px-3 py-2.5 text-sm resize-y disabled:opacity-80"
            />
          )}
        </div>
      </div>
    </div>
  );
}
