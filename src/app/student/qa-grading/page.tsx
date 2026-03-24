"use client";

import { useMemo, useState } from "react";
import { Award, CheckCircle2, CircleAlert, Loader2, Sparkles, Upload, FileImage, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
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
  if (status === "accepted") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "review_required") return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "failed") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-gray-50 text-gray-700 border-gray-200";
}

function gradePillClass(grade?: string): string {
  if (grade === "fully_correct") return "bg-emerald-100 text-emerald-800";
  if (grade === "partially_correct") return "bg-amber-100 text-amber-800";
  if (grade === "weak") return "bg-rose-100 text-rose-800";
  return "bg-gray-100 text-gray-700";
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
    <div className="min-h-full bg-gradient-to-b from-rose-50/70 via-white to-slate-50 p-4 md:p-8">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-rose-100/80 bg-white/90 p-6 shadow-sm backdrop-blur md:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Q/A Grading</h1>
              <p className="mt-2 max-w-2xl text-sm text-gray-600 md:text-base">
                Submit a question, the student answer, and the marking scheme answer to get instant grading with
                feedback, expected points, and missing points.
              </p>
            </div>
            <div className="hidden rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 md:block">
              Student Tool
            </div>
          </div>

          <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setMode("typed");
                setPreview(null);
              }}
              className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                mode === "typed"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
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
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Upload Image/PDF (Mode A)
            </button>
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Subject (optional)</label>
              <Input
                value={form.subject}
                onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
                placeholder="e.g., Physics 1016"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">Year (optional)</label>
                <Input
                  value={form.year}
                  onChange={(event) => setForm((prev) => ({ ...prev, year: event.target.value }))}
                  placeholder="e.g., 2023"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">Session (optional)</label>
                <Input
                  value={form.session}
                  onChange={(event) => setForm((prev) => ({ ...prev, session: event.target.value }))}
                  placeholder="e.g., May/June"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">Paper (optional)</label>
                <Input
                  value={form.paper}
                  onChange={(event) => setForm((prev) => ({ ...prev, paper: event.target.value }))}
                  placeholder="e.g., 1"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">Variant (optional)</label>
                <Input
                  value={form.variant}
                  onChange={(event) => setForm((prev) => ({ ...prev, variant: event.target.value }))}
                  placeholder="e.g., 2"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Question ID (optional)</label>
              <Input
                value={form.questionId}
                onChange={(event) => setForm((prev) => ({ ...prev, questionId: event.target.value }))}
                placeholder="Dataset question ID"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.debug}
                onChange={(event) => setForm((prev) => ({ ...prev, debug: event.target.checked }))}
                className="h-4 w-4 rounded border-gray-300"
              />
              Enable debug information
            </label>

            {mode === "typed" ? (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">Question</label>
                  <Textarea
                    value={form.question}
                    onChange={(event) => setForm((prev) => ({ ...prev, question: event.target.value }))}
                    rows={4}
                    placeholder="Paste or type the exam question"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">Student Answer</label>
                  <Textarea
                    value={form.studentAnswer}
                    onChange={(event) => setForm((prev) => ({ ...prev, studentAnswer: event.target.value }))}
                    rows={5}
                    placeholder="Write your answer here"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                    Marking Scheme Answer (optional when pipeline service is running)
                  </label>
                  <Textarea
                    value={form.markingSchemeAnswer}
                    onChange={(event) => setForm((prev) => ({ ...prev, markingSchemeAnswer: event.target.value }))}
                    rows={5}
                    placeholder="Paste official marking points (optional for full dataset-based pipeline grading)"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">Upload file (PDF/Image)</label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                    <Upload className="h-4 w-4" />
                    Choose File
                    <input
                      type="file"
                      className="hidden"
                      accept="application/pdf,image/png,image/jpeg,image/jpg"
                      onChange={onFileChange}
                    />
                  </label>
                  <span className="text-sm text-gray-600">
                    {uploadFile ? uploadFile.name : "No file selected"}
                  </span>
                </div>

                <div className="max-w-[180px]">
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">Page Number</label>
                  <Input
                    value={uploadPageNumber}
                    onChange={(event) => setUploadPageNumber(event.target.value)}
                    placeholder="1"
                  />
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500">
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
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
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
              <div className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-sky-800">Preview Extracted Content</h3>
                  <span className="text-xs font-semibold text-sky-700">
                    OCR Confidence: {(preview.vision_confidence * 100).toFixed(1)}%
                  </span>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">Question (editable)</label>
                  <Textarea
                    value={previewQuestion}
                    onChange={(event) => setPreviewQuestion(event.target.value)}
                    rows={4}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">Student Answer (editable)</label>
                  <Textarea
                    value={previewStudentAnswer}
                    onChange={(event) => setPreviewStudentAnswer(event.target.value)}
                    rows={4}
                  />
                </div>

                {preview.vision_warnings?.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
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

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-gray-900">Result</h2>
          </div>

          {!result ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-8 text-center text-sm text-gray-500">
              Submit the form to see grading details.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Score</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">{result.score_percent.toFixed(1)}%</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</p>
                  <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusPillClass(result.status)}`}>
                    {result.status.replace("_", " ")}
                  </span>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Grade</p>
                  <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${gradePillClass(result.grade_label)}`}>
                    {result.grade_label.replace("_", " ")}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Award className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-gray-900">Feedback</h3>
                </div>
                <p className="text-sm leading-6 text-gray-700">{result.feedback}</p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                  <h3 className="mb-2 text-sm font-semibold text-emerald-800">Expected Points</h3>
                  <ul className="space-y-1.5 text-sm text-emerald-900">
                    {result.expected_points.length > 0 ? (
                      result.expected_points.map((point, idx) => (
                        <li key={`exp-${idx}`} className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                          <span>{point}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-emerald-700/80">No expected points returned.</li>
                    )}
                  </ul>
                </div>

                <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                  <h3 className="mb-2 text-sm font-semibold text-amber-800">Missing Points</h3>
                  <ul className="space-y-1.5 text-sm text-amber-900">
                    {result.missing_points.length > 0 ? (
                      result.missing_points.map((point, idx) => (
                        <li key={`miss-${idx}`} className="flex gap-2">
                          <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
                          <span>{point}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-amber-700/80">No missing points detected.</li>
                    )}
                  </ul>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-xs text-gray-600">
                <p>
                  Grading source: <span className="font-semibold text-gray-800">{result.grading_source}</span>
                </p>
                {result.grading_model && (
                  <p className="mt-1">
                    Model: <span className="font-semibold text-gray-800">{result.grading_model}</span>
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
