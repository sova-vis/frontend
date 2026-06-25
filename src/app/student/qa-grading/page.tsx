"use client";

import { useMemo, useState } from "react";
import { Award, CheckCircle2, CircleAlert, Loader2, Sparkles, Upload, FileImage, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Reveal } from "@/components/ui/Motion";
import {
  confirmQaGradingFromImage,
  gradeQaAnswer,
  previewQaGradingFromImage,
  QaGradingResponse,
  QaModeAPreviewResponse,
} from "@/lib/api";

type FormState = {
  subject: string;
  question: string;
  studentAnswer: string;
  markingSchemeAnswer: string;
  year: string;
  session: string;
  paper: string;
  variant: string;
  questionId: string;
  debug: boolean;
};

type InputMode = "typed" | "upload";

const SAMPLE_FORM: FormState = {
  subject: "Chemistry 1011",
  question: "Why does increasing temperature usually increase the rate of reaction?",
  studentAnswer:
    "It increases kinetic energy so particles move faster and collide more often. More collisions have enough energy.",
  markingSchemeAnswer:
    "Higher temperature gives particles more kinetic energy; collision frequency increases; a greater fraction of collisions exceed activation energy; therefore reaction rate increases.",
  year: "",
  session: "",
  paper: "",
  variant: "",
  questionId: "",
  debug: true,
};

function statusPillClass(status?: string): string {
  if (status === "accepted") return "bg-mint-soft text-mint-ink border-mint/20";
  if (status === "review_required") return "bg-gold-soft text-gold-ink border-gold/20";
  if (status === "failed") return "bg-crimson-soft text-crimson-ink border-crimson/20";
  return "bg-surface-soft text-ink-muted border-line";
}

function gradePillClass(grade?: string): string {
  if (grade === "fully_correct") return "bg-mint-soft text-mint-ink";
  if (grade === "partially_correct") return "bg-gold-soft text-gold-ink";
  if (grade === "weak") return "bg-crimson-soft text-crimson-ink";
  return "bg-surface-soft text-ink-muted";
}

export default function QaGradingPage() {
  const [mode, setMode] = useState<InputMode>("typed");
  const [form, setForm] = useState<FormState>({
    subject: "",
    question: "",
    studentAnswer: "",
    markingSchemeAnswer: "",
    year: "",
    session: "",
    paper: "",
    variant: "",
    questionId: "",
    debug: true,
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPageNumber, setUploadPageNumber] = useState("1");
  const [preview, setPreview] = useState<QaModeAPreviewResponse | null>(null);
  const [previewQuestion, setPreviewQuestion] = useState("");
  const [previewStudentAnswer, setPreviewStudentAnswer] = useState("");
  const [result, setResult] = useState<QaGradingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (mode === "upload") {
      return Boolean(uploadFile) && !loading;
    }

    return (
      form.question.trim().length > 0 &&
      form.studentAnswer.trim().length > 0 &&
      !loading
    );
  }, [form.question, form.studentAnswer, loading, mode, uploadFile]);

  const parsedYear = useMemo(() => {
    const trimmed = form.year.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isInteger(parsed) ? parsed : undefined;
  }, [form.year]);

  const parsedPage = useMemo(() => {
    const parsed = Number(uploadPageNumber);
    if (!Number.isInteger(parsed) || parsed <= 0) return 1;
    return parsed;
  }, [uploadPageNumber]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      if (mode === "typed") {
        const response = await gradeQaAnswer({
          subject: form.subject.trim() || undefined,
          year: parsedYear,
          session: form.session.trim() || undefined,
          paper: form.paper.trim() || undefined,
          variant: form.variant.trim() || undefined,
          question_id: form.questionId.trim() || undefined,
          debug: form.debug,
          question: form.question.trim(),
          student_answer: form.studentAnswer.trim(),
          marking_scheme_answer: form.markingSchemeAnswer.trim() || undefined,
        });
        setResult(response);
      } else {
        if (!uploadFile) {
          throw new Error("Please upload a PDF/image file first.");
        }

        const payload = new FormData();
        payload.append("file", uploadFile);
        payload.append("page_number", String(parsedPage));
        payload.append("debug", String(form.debug));

        const subject = form.subject.trim();
        if (subject) payload.append("subject", subject);
        if (typeof parsedYear === "number") payload.append("year", String(parsedYear));
        if (form.session.trim()) payload.append("session", form.session.trim());
        if (form.paper.trim()) payload.append("paper", form.paper.trim());
        if (form.variant.trim()) payload.append("variant", form.variant.trim());
        if (form.questionId.trim()) payload.append("question_id", form.questionId.trim());

        const previewResponse = await previewQaGradingFromImage(payload);
        setPreview(previewResponse);
        setPreviewQuestion(
          previewResponse.normalized_question_text || previewResponse.extracted_question_text || ""
        );
        setPreviewStudentAnswer(
          previewResponse.normalized_student_answer || previewResponse.extracted_student_answer || ""
        );
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to grade answer");
    } finally {
      setLoading(false);
    }
  };

  const onConfirmPreview = async () => {
    if (!previewQuestion.trim()) {
      setError("Question text is required before confirming.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await confirmQaGradingFromImage({
        question_text: previewQuestion.trim(),
        student_answer: previewStudentAnswer.trim(),
        subject: form.subject.trim() || undefined,
        year: parsedYear,
        session: form.session.trim() || undefined,
        paper: form.paper.trim() || undefined,
        variant: form.variant.trim() || undefined,
        question_id: form.questionId.trim() || undefined,
        debug: form.debug,
      });
      setResult(response);
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Failed to confirm grading");
    } finally {
      setLoading(false);
    }
  };

  const applySample = () => {
    setForm(SAMPLE_FORM);
    setError(null);
    setPreview(null);
    setResult(null);
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setUploadFile(file);
    setPreview(null);
    setResult(null);
  };

  return (
    <div className="min-h-full bg-transparent p-4 md:p-8">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="ed-card p-6 md:p-8">
          <Reveal>
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-3xl">
                Q/A <span className="italic text-crimson">Grading</span>
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-ink-muted md:text-base">
                Submit a question and the student answer to get instant grading with feedback, expected points,
                and missing points.
              </p>
            </div>
            <div className="hidden rounded-2xl border border-crimson/20 bg-crimson-soft px-3 py-2 text-xs font-semibold text-crimson-ink md:block">
              Student Tool
            </div>
          </div>
          </Reveal>

          <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setMode("typed");
                setPreview(null);
              }}
              className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                mode === "typed"
                  ? "border-crimson bg-crimson/10 text-crimson"
                  : "border-line bg-surface text-ink-muted hover:bg-surface-soft"
              }`}
            >
              Typed Question (Mode B)
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("upload");
                setResult(null);
              }}
              className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                mode === "upload"
                  ? "border-crimson bg-crimson/10 text-crimson"
                  : "border-line bg-surface text-ink-muted hover:bg-surface-soft"
              }`}
            >
              Upload Image/PDF (Mode A)
            </button>
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            {mode === "typed" ? (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-ink-muted">Question</label>
                  <Textarea
                    value={form.question}
                    onChange={(event) => setForm((prev) => ({ ...prev, question: event.target.value }))}
                    rows={4}
                    placeholder="Paste or type the exam question"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-ink-muted">Student Answer</label>
                  <Textarea
                    value={form.studentAnswer}
                    onChange={(event) => setForm((prev) => ({ ...prev, studentAnswer: event.target.value }))}
                    rows={5}
                    placeholder="Write your answer here"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-3 rounded-2xl border border-line bg-surface-soft p-4">
                <label className="mb-1.5 block text-sm font-semibold text-ink-muted">Upload file (PDF/Image)</label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink-muted hover:bg-surface-soft">
                    <Upload className="h-4 w-4" />
                    Choose File
                    <input
                      type="file"
                      className="hidden"
                      accept="application/pdf,image/png,image/jpeg,image/jpg"
                      onChange={onFileChange}
                    />
                  </label>
                  <span className="text-sm text-ink-muted">
                    {uploadFile ? uploadFile.name : "No file selected"}
                  </span>
                </div>

                <div className="max-w-[180px]">
                  <label className="mb-1.5 block text-sm font-semibold text-ink-muted">Page Number</label>
                  <Input
                    value={uploadPageNumber}
                    onChange={(event) => setUploadPageNumber(event.target.value)}
                    placeholder="1"
                  />
                </div>

                <div className="flex items-center gap-2 text-xs text-ink-faint">
                  {uploadFile?.type === "application/pdf" ? (
                    <FileText className="h-4 w-4" />
                  ) : (
                    <FileImage className="h-4 w-4" />
                  )}
                  Supported: PDF, PNG, JPG, JPEG (max 20MB)
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-crimson/20 bg-crimson-soft px-3 py-2 text-sm text-crimson-ink">
                <CircleAlert className="mt-0.5 h-4 w-4" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="button" variant="outline" onClick={applySample}>
                Load Sample
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {mode === "typed" ? "Grading..." : "Extracting..."}
                  </>
                ) : (
                  mode === "typed" ? "Grade Answer" : "Preview Extracted Q/A"
                )}
              </Button>
            </div>

            {mode === "upload" && preview && (
              <div className="space-y-3 rounded-2xl border border-mint/20 bg-mint-soft p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-mint-ink">Preview Extracted Content</h3>
                  <span className="text-xs font-semibold text-mint-ink">
                    OCR Confidence: {(preview.vision_confidence * 100).toFixed(1)}%
                  </span>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-ink-muted">Question (editable)</label>
                  <Textarea
                    value={previewQuestion}
                    onChange={(event) => setPreviewQuestion(event.target.value)}
                    rows={4}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-ink-muted">Student Answer (editable)</label>
                  <Textarea
                    value={previewStudentAnswer}
                    onChange={(event) => setPreviewStudentAnswer(event.target.value)}
                    rows={4}
                  />
                </div>

                {preview.vision_warnings?.length > 0 && (
                  <div className="rounded-lg border border-gold/20 bg-gold-soft p-3 text-xs text-gold-ink">
                    Warnings: {preview.vision_warnings.join(", ")}
                  </div>
                )}

                <Button type="button" onClick={onConfirmPreview} disabled={loading || !previewQuestion.trim()}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    "Confirm and Grade"
                  )}
                </Button>
              </div>
            )}
          </form>
        </section>

        <section className="ed-card p-6 md:p-8">
          <Reveal delay={0.1}>
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-crimson" />
            <h2 className="font-display text-xl font-semibold tracking-tight text-ink">Result</h2>
          </div>
          </Reveal>

          {!result ? (
            <div className="rounded-2xl border border-dashed border-line bg-surface-soft px-5 py-8 text-center text-sm text-ink-faint">
              Submit the form to see grading details.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-line bg-surface-soft p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Score</p>
                  <p className="mt-2 font-display text-2xl font-semibold text-ink">{result.score_percent.toFixed(1)}%</p>
                </div>
                <div className="rounded-2xl border border-line bg-surface-soft p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Status</p>
                  <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusPillClass(result.status)}`}>
                    {result.status.replace("_", " ")}
                  </span>
                </div>
                <div className="rounded-2xl border border-line bg-surface-soft p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Grade</p>
                  <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${gradePillClass(result.grade_label)}`}>
                    {result.grade_label.replace("_", " ")}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-surface p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Award className="h-4 w-4 text-crimson" />
                  <h3 className="text-sm font-semibold text-ink">Feedback</h3>
                </div>
                <p className="text-sm leading-6 text-ink-muted">{result.feedback}</p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-mint/20 bg-mint-soft p-4">
                  <h3 className="mb-2 text-sm font-semibold text-mint-ink">Expected Points</h3>
                  <ul className="space-y-1.5 text-sm text-mint-ink">
                    {result.expected_points.length > 0 ? (
                      result.expected_points.map((point, idx) => (
                        <li key={`exp-${idx}`} className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                          <span>{point}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-mint-ink/80">No expected points returned.</li>
                    )}
                  </ul>
                </div>

                <div className="rounded-2xl border border-gold/20 bg-gold-soft p-4">
                  <h3 className="mb-2 text-sm font-semibold text-gold-ink">Missing Points</h3>
                  <ul className="space-y-1.5 text-sm text-gold-ink">
                    {result.missing_points.length > 0 ? (
                      result.missing_points.map((point, idx) => (
                        <li key={`miss-${idx}`} className="flex gap-2">
                          <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
                          <span>{point}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-gold-ink/80">No missing points detected.</li>
                    )}
                  </ul>
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-surface-soft p-4 text-xs text-ink-muted">
                <p>
                  Grading source: <span className="font-semibold text-ink">{result.grading_source}</span>
                </p>
                {result.grading_model && (
                  <p className="mt-1">
                    Model: <span className="font-semibold text-ink">{result.grading_model}</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
