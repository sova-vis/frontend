"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpenCheck,
  CheckCircle2,
  FileQuestion,
  FileText,
  Layers,
  Loader2,
  RefreshCcw,
  Search,
  Sparkles,
  XCircle,
} from "lucide-react";

type QuestionType = "mcq" | "structured";
type PracticeMode = "topic" | "paper";

type PracticeImage = {
  role: string;
  option?: string | null;
  src?: string | null;
  alt: string;
  caption?: string | null;
  width?: number | null;
  height?: number | null;
};

type PracticeOption = { label: string; text: string };
type PracticePart = { label: string; body: string; marks: number | null; answer: string | null };
type PracticeSource = {
  label: string | null;
  reference: string | null;
  translation: string | null;
  image: { src: string; width: number | null; height: number | null } | null;
};

type PracticeQuestion = {
  id: string;
  subject: string;
  type: QuestionType;
  year: string;
  session: string;
  paper: string;
  variant: string;
  questionNumber: string;
  topic: string;
  theme: string;
  questionText: string;
  marks: number | null;
  options: PracticeOption[];
  correctOption: string | null;
  markingScheme: string;
  requiresDiagram: boolean;
  images: PracticeImage[];
  reference: Record<string, unknown> | null;
  sources: PracticeSource[];
  sourceNote: string | null;
  dedupGroup: string | null;
  parts: PracticePart[];
};

type TypeMeta = {
  total: number;
  years: { year: string; count: number }[];
  variants: { variant: string; count: number }[];
  topics: { name: string; count: number }[];
};

type SubjectMeta = { name: string; types: { mcq: TypeMeta; structured: TypeMeta } };

type AvailablePaper = {
  key: string;
  label: string;
  year: string;
  session: string;
  paper: string;
  variant: string;
  count: number;
  isMcq: boolean;
};

const preferredSubjects = ["Physics", "Chemistry", "Mathematics"];
const TOPIC_PAGE = 24;

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function questionNumberValue(value: string) {
  const match = value.match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : Number.MAX_SAFE_INTEGER;
}

function matchesQuery(question: PracticeQuestion, trimmed: string) {
  if (!trimmed) return true;
  return [question.questionText, question.topic, question.theme, question.session, question.paper, question.variant, question.questionNumber, question.year]
    .concat(question.parts.map((part) => part.body))
    .some((value) => value.toLowerCase().includes(trimmed));
}

// Mark-scheme answers can be images (e.g. Mathematics answer_image). Keep those
// behind the reveal toggle; everything else is part of the question itself.
const questionImagesOf = (images: PracticeImage[]) => images.filter((image) => image.role !== "answer");
const answerImagesOf = (images: PracticeImage[]) => images.filter((image) => image.role === "answer");

function SourceNote({ note }: { note: string | null }) {
  if (!note) return null;
  return (
    <p className="rounded-md border border-[#1C1714]/[.08] bg-[#FAF6F0] px-3 py-2 text-xs italic leading-5 text-[#9A8D83]">{note}</p>
  );
}

// Read-only passages/sources (e.g. Islamiyat ayats): each Arabic-text image is
// shown together with its translation. These are part of the question — no answer box.
function Passages({ sources }: { sources: PracticeSource[] }) {
  if (!sources.length) return null;
  return (
    <div className="space-y-3">
      {sources.map((source, index) => (
        <figure key={index} className="rounded-lg border border-[#1C1714]/[.1] bg-[#FAF6F0]/70 p-3">
          {(source.label || source.reference) && (
            <figcaption className="flex flex-wrap items-baseline gap-2 text-xs font-bold text-[#A8123C]">
              {source.label && <span>{source.label}</span>}
              {source.reference && <span className="font-semibold text-[#9A8D83]">{source.reference}</span>}
            </figcaption>
          )}
          {source.image?.src && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={source.image.src} alt={source.label || "passage"} className="mx-auto mt-2 max-h-[300px] w-full max-w-2xl object-contain" loading="lazy" />
          )}
          {source.translation && (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#33291F]">{source.translation}</p>
          )}
        </figure>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
function QuestionImage({ image }: { image: PracticeImage }) {
  if (!image.src) return null;
  return (
    <figure className="rounded-lg border border-[#1C1714]/[.09] bg-[#FAF6F0]/70 p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.src} alt={image.alt} className="mx-auto max-h-[520px] w-full max-w-3xl object-contain" loading="lazy" />
      {image.caption && <figcaption className="mt-2 text-center text-xs font-semibold text-[#9A8D83]">{image.caption}</figcaption>}
    </figure>
  );
}

function McqBody({
  question,
  answer,
  checked,
  showScheme,
  onAnswer,
}: {
  question: PracticeQuestion;
  answer?: string;
  checked: boolean;
  showScheme: boolean;
  onAnswer: (value: string) => void;
}) {
  const correct = question.correctOption;
  const isAnswered = Boolean(answer?.trim());

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <p className="whitespace-pre-wrap text-[15px] leading-7 text-[#1C1714]">{question.questionText}</p>
      <SourceNote note={question.sourceNote} />
      <Passages sources={question.sources} />

      {questionImagesOf(question.images).length > 0 && (
        <div className="space-y-3">
          {questionImagesOf(question.images).map((image, index) => (
            <QuestionImage key={`${question.id}-img-${index}`} image={image} />
          ))}
        </div>
      )}

      {question.options.length >= 2 ? (
        <div className="grid grid-cols-1 gap-2">
          {question.options.map((option) => {
            const selected = answer === option.label;
            const optionCorrect = checked && correct === option.label;
            const optionWrong = checked && selected && correct !== option.label;
            return (
              <label
                key={option.label}
                className={cx(
                  "flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors",
                  selected && !checked && "border-[#A8123C] bg-[#F6E1E7]/60",
                  !selected && !checked && "border-[#1C1714]/[.12] hover:border-[#1C1714]/25 hover:bg-[#1C1714]/[.03]",
                  optionCorrect && "border-[#16876B] bg-[#DBEFE8]",
                  optionWrong && "border-[#CF5128] bg-[#F9E2D7]",
                  checked && !optionCorrect && !optionWrong && "border-[#1C1714]/[.1] bg-[#1C1714]/[.03]",
                )}
              >
                <input
                  type="radio"
                  name={question.id}
                  value={option.label}
                  checked={selected}
                  onChange={() => onAnswer(option.label)}
                  className="mt-1 h-4 w-4 accent-[#A8123C]"
                />
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-white text-xs font-bold text-[#6B5F57] shadow-sm">
                    {option.label}
                  </span>
                  <span className="text-sm leading-6 text-[#33291F]">{option.text}</span>
                </div>
              </label>
            );
          })}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-[#1C1714]/[.14] bg-[#FAF6F0] p-3 text-xs font-semibold text-[#9A8D83]">
          The answer options for this question are shown in the figure above.
        </p>
      )}

      {checked && correct && (
        <div
          className={cx(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold",
            isAnswered && answer === correct && "bg-[#DBEFE8] text-[#16876B]",
            isAnswered && answer !== correct && "bg-[#F9E2D7] text-[#CF5128]",
            !isAnswered && "bg-[#FFF6E9] text-[#8A4F12]",
          )}
        >
          {isAnswered && answer === correct ? <CheckCircle2 size={17} /> : isAnswered ? <XCircle size={17} /> : <AlertCircle size={17} />}
          Correct option: {correct}
        </div>
      )}

      {showScheme && question.markingScheme && (
        <div className="rounded-lg border border-[#E7C9A1] bg-[#FFF6E9] p-3 text-sm leading-6 text-[#6F4A14]">{question.markingScheme}</div>
      )}
    </div>
  );
}

function StructuredBody({
  question,
  answers,
  showScheme,
  onAnswer,
}: {
  question: PracticeQuestion;
  answers: Record<string, string>;
  showScheme: boolean;
  onAnswer: (partKey: string, value: string) => void;
}) {
  return (
    <div className="space-y-4 p-4 sm:p-5">
      {question.questionText && <p className="whitespace-pre-wrap text-[15px] leading-7 text-[#1C1714]">{question.questionText}</p>}
      <SourceNote note={question.sourceNote} />

      {questionImagesOf(question.images).length > 0 && (
        <div className="space-y-3">
          {questionImagesOf(question.images).map((image, index) => (
            <QuestionImage key={`${question.id}-img-${index}`} image={image} />
          ))}
        </div>
      )}

      <Passages sources={question.sources} />

      {question.parts.length > 0 ? (
        <div className="space-y-4">
          {question.parts.map((part, index) => {
            const partKey = `${question.id}::${index}`;
            return (
              <div key={partKey} className="rounded-lg border border-[#1C1714]/[.08] bg-[#FAF6F0]/60 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="whitespace-pre-wrap text-sm font-semibold leading-6 text-[#1C1714]">
                    {part.label && <span className="mr-1 text-[#A8123C]">{part.label}</span>}
                    {part.body}
                  </p>
                  {part.marks !== null && <span className="flex-none text-xs font-bold text-[#9A8D83]">[{part.marks}]</span>}
                </div>
                <textarea
                  value={answers[partKey] ?? ""}
                  onChange={(event) => onAnswer(partKey, event.target.value)}
                  placeholder="Write your answer..."
                  className="mt-2 min-h-[90px] w-full resize-y rounded-lg border border-[#1C1714]/[.14] bg-white px-3 py-2 text-sm text-[#1C1714] outline-none transition focus:border-[#A8123C] focus:ring-2 focus:ring-[#A8123C]/15"
                />
                {showScheme && part.answer && (
                  <div className="mt-2 rounded-lg border border-[#E7C9A1] bg-[#FFF6E9] p-2 text-xs leading-5 text-[#6F4A14]">{part.answer}</div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <textarea
          value={answers[`${question.id}::0`] ?? ""}
          onChange={(event) => onAnswer(`${question.id}::0`, event.target.value)}
          placeholder="Write your answer..."
          className="min-h-[120px] w-full resize-y rounded-lg border border-[#1C1714]/[.14] bg-white px-3 py-2 text-sm text-[#1C1714] outline-none transition focus:border-[#A8123C] focus:ring-2 focus:ring-[#A8123C]/15"
        />
      )}

      {showScheme && question.markingScheme && (
        <div className="rounded-lg border border-[#E7C9A1] bg-[#FFF6E9] p-3 text-sm leading-6 text-[#6F4A14]">{question.markingScheme}</div>
      )}

      {showScheme && answerImagesOf(question.images).length > 0 && (
        <div className="space-y-2 rounded-lg border border-[#E7C9A1] bg-[#FFF6E9] p-3">
          <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#8A4F12]">Mark scheme</p>
          {answerImagesOf(question.images).map((image, index) => (
            <QuestionImage key={`${question.id}-ans-${index}`} image={image} />
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionCard(props: {
  question: PracticeQuestion;
  showYear: boolean;
  mcqAnswer?: string;
  partAnswers: Record<string, string>;
  checked: boolean;
  showScheme: boolean;
  onMcqAnswer: (value: string) => void;
  onPartAnswer: (partKey: string, value: string) => void;
}) {
  const { question } = props;
  return (
    <article className="overflow-hidden rounded-lg border border-[#1C1714]/[.09] bg-white shadow-sm">
      <div className="border-b border-[#1C1714]/[.07] p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#9A8D83]">
          <span className="rounded-full bg-[#1C1714]/[.06] px-2.5 py-1 font-bold text-[#1C1714]">Q{question.questionNumber}</span>
          {props.showYear && question.year && <span className="font-bold text-[#A8123C]">{question.year}</span>}
          {question.marks !== null && (
            <span>
              {question.marks} mark{question.marks === 1 ? "" : "s"}
            </span>
          )}
          {question.session && <span>{question.session.replace(/_/g, " ")}</span>}
          {question.paper && <span>{question.paper.replace(/_/g, " ")}</span>}
          {question.variant && <span>{question.variant.replace(/_/g, " ")}</span>}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {question.topic && <span className="rounded-md bg-[#F6E1E7] px-2.5 py-1 text-[11px] font-bold text-[#A8123C]">{question.topic}</span>}
          {question.theme && <span className="rounded-md bg-[#DBEFE8] px-2.5 py-1 text-[11px] font-bold text-[#16876B]">{question.theme}</span>}
        </div>
      </div>

      {question.type === "mcq" ? (
        <McqBody question={question} answer={props.mcqAnswer} checked={props.checked} showScheme={props.showScheme} onAnswer={props.onMcqAnswer} />
      ) : (
        <StructuredBody question={question} answers={props.partAnswers} showScheme={props.showScheme} onAnswer={props.onPartAnswer} />
      )}
    </article>
  );
}

const selectClass =
  "h-11 w-full rounded-lg border border-[#1C1714]/[.14] bg-white px-3 text-sm font-semibold text-[#33291F] outline-none transition focus:border-[#A8123C] focus:ring-2 focus:ring-[#A8123C]/15 disabled:cursor-not-allowed disabled:bg-[#1C1714]/[.03] disabled:text-[#9A8D83]";
const labelClass = "mb-1 block text-[11px] font-bold uppercase tracking-[.12em] text-[#9A8D83]";

// ---------------------------------------------------------------------------
export default function PaperPracticePage() {
  const [subjects, setSubjects] = useState<SubjectMeta[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [questionType, setQuestionType] = useState<QuestionType>("mcq");
  const [practiceMode, setPracticeMode] = useState<PracticeMode>("topic");

  const [selectedTopic, setSelectedTopic] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [papers, setPapers] = useState<AvailablePaper[]>([]);
  const [selectedPaperKey, setSelectedPaperKey] = useState("");
  const [query, setQuery] = useState("");

  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, string>>({});
  const [partAnswers, setPartAnswers] = useState<Record<string, string>>({});

  const [topicTotal, setTopicTotal] = useState(0);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState(false);
  const [showScheme, setShowScheme] = useState(false);

  // ---- subjects metadata ----
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingMeta(true);
      setError("");
      try {
        const response = await fetch("/api/paper-practice");
        if (!response.ok) throw new Error("Could not load practice metadata.");
        const data = (await response.json()) as { subjects: SubjectMeta[] };
        if (!mounted) return;
        const sorted = [...(data.subjects ?? [])].sort((a, b) => {
          const ai = preferredSubjects.indexOf(a.name);
          const bi = preferredSubjects.indexOf(b.name);
          if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
          return a.name.localeCompare(b.name);
        });
        setSubjects(sorted);
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : "Could not load practice metadata.");
      } finally {
        if (mounted) setLoadingMeta(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const currentSubject = useMemo(() => subjects.find((s) => s.name === selectedSubject) ?? null, [selectedSubject, subjects]);
  const currentTypeMeta = currentSubject?.types[questionType] ?? null;
  const availableYears = currentTypeMeta?.years ?? [];
  const availableTopics = currentTypeMeta?.topics ?? [];

  function clearQuestions() {
    setQuestions([]);
    setMcqAnswers({});
    setPartAnswers({});
    setChecked(false);
    setShowScheme(false);
  }

  // ---- TOPIC mode: load first page of deduped questions (paginated) ----
  useEffect(() => {
    if (practiceMode !== "topic" || !selectedSubject || !selectedTopic) return;
    let mounted = true;
    (async () => {
      setLoadingQuestions(true);
      setError("");
      clearQuestions();
      setTopicTotal(0);
      try {
        const params = new URLSearchParams({
          subject: selectedSubject,
          type: questionType,
          topic: selectedTopic,
          mode: "topic",
          limit: String(TOPIC_PAGE),
          offset: "0",
        });
        const response = await fetch(`/api/paper-practice?${params.toString()}`);
        if (!response.ok) throw new Error("Could not load topic questions.");
        const data = (await response.json()) as { questions: PracticeQuestion[]; total: number };
        if (mounted) {
          setQuestions(data.questions ?? []);
          setTopicTotal(data.total ?? 0);
        }
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : "Could not load topic questions.");
      } finally {
        if (mounted) setLoadingQuestions(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [practiceMode, selectedSubject, questionType, selectedTopic]);

  async function loadMoreTopic() {
    setLoadingMore(true);
    setError("");
    try {
      const params = new URLSearchParams({
        subject: selectedSubject,
        type: questionType,
        topic: selectedTopic,
        mode: "topic",
        limit: String(TOPIC_PAGE),
        offset: String(questions.length),
      });
      const response = await fetch(`/api/paper-practice?${params.toString()}`);
      if (!response.ok) throw new Error("Could not load more questions.");
      const data = (await response.json()) as { questions: PracticeQuestion[]; total: number };
      setQuestions((prev) => [...prev, ...(data.questions ?? [])]);
      setTopicTotal((prev) => data.total ?? prev);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load more questions.");
    } finally {
      setLoadingMore(false);
    }
  }

  // ---- PAPER mode: load available papers for subject+type+year ----
  useEffect(() => {
    if (practiceMode !== "paper" || !selectedSubject || !selectedYear) {
      setPapers([]);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const params = new URLSearchParams({ subject: selectedSubject, type: questionType, year: selectedYear, papers: "1" });
        const response = await fetch(`/api/paper-practice?${params.toString()}`);
        const data = response.ok ? ((await response.json()) as { papers: AvailablePaper[] }) : { papers: [] };
        if (mounted) setPapers(data.papers ?? []);
      } catch {
        if (mounted) setPapers([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [practiceMode, selectedSubject, questionType, selectedYear]);

  // ---- PAPER mode: load the whole selected paper via the RPC ----
  useEffect(() => {
    if (practiceMode !== "paper" || !selectedPaperKey) return;
    const paper = papers.find((p) => p.key === selectedPaperKey);
    if (!paper) return;
    let mounted = true;
    (async () => {
      setLoadingQuestions(true);
      setError("");
      clearQuestions();
      try {
        const params = new URLSearchParams({
          subject: selectedSubject,
          year: paper.year,
          session: paper.session,
          paper: paper.paper,
          variant: paper.variant,
        });
        const response = await fetch(`/api/paper-practice?${params.toString()}`);
        if (!response.ok) throw new Error("Could not load the paper.");
        const data = (await response.json()) as { questions: PracticeQuestion[] };
        if (mounted) setQuestions(data.questions ?? []);
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : "Could not load the paper.");
      } finally {
        if (mounted) setLoadingQuestions(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [practiceMode, selectedPaperKey, papers, selectedSubject]);

  const displayQuestions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const filtered = questions.filter((q) => matchesQuery(q, trimmed));
    return [...filtered].sort((a, b) => {
      if (practiceMode === "topic") {
        return (
          Number.parseInt(b.year, 10) - Number.parseInt(a.year, 10) ||
          questionNumberValue(a.questionNumber) - questionNumberValue(b.questionNumber)
        );
      }
      return (
        questionNumberValue(a.questionNumber) - questionNumberValue(b.questionNumber) ||
        a.questionNumber.localeCompare(b.questionNumber, undefined, { numeric: true })
      );
    });
  }, [questions, query, practiceMode]);

  const gradable = displayQuestions.filter((q) => q.type === "mcq" && q.correctOption);
  const score = gradable.filter((q) => mcqAnswers[q.id] === q.correctOption).length;
  const answeredCount = displayQuestions.filter((q) =>
    q.type === "mcq"
      ? Boolean(mcqAnswers[q.id]?.trim())
      : q.parts.length
        ? q.parts.some((_, index) => Boolean(partAnswers[`${q.id}::${index}`]?.trim()))
        : Boolean(partAnswers[`${q.id}::0`]?.trim()),
  ).length;
  const hasScheme = displayQuestions.some(
    (q) => q.markingScheme || q.parts.some((p) => p.answer) || q.images.some((i) => i.role === "answer"),
  );

  const ready =
    practiceMode === "topic" ? Boolean(selectedSubject && selectedTopic) : Boolean(selectedSubject && selectedPaperKey);
  const selectedPaper = papers.find((p) => p.key === selectedPaperKey) ?? null;

  // ---- handlers ----
  function handleSubjectChange(name: string) {
    setSelectedSubject(name);
    setSelectedTopic("");
    setSelectedYear("");
    setSelectedPaperKey("");
    setQuery("");
    clearQuestions();
  }
  function handleTypeChange(type: QuestionType) {
    setQuestionType(type);
    setSelectedTopic("");
    setSelectedYear("");
    setSelectedPaperKey("");
    setQuery("");
    clearQuestions();
  }
  function handleModeChange(mode: PracticeMode) {
    setPracticeMode(mode);
    setSelectedTopic("");
    setSelectedYear("");
    setSelectedPaperKey("");
    setQuery("");
    clearQuestions();
  }
  function handleYearChange(year: string) {
    setSelectedYear(year);
    setSelectedPaperKey("");
    setQuery("");
    clearQuestions();
  }
  function resetPractice() {
    setMcqAnswers({});
    setPartAnswers({});
    setChecked(false);
    setShowScheme(false);
  }

  const summary =
    practiceMode === "topic"
      ? `${selectedSubject} · ${questionType === "mcq" ? "MCQs" : "Paper questions"} · ${selectedTopic}`
      : selectedPaper
        ? `${selectedSubject} · ${selectedPaper.year} · ${selectedPaper.session.replace(/_/g, " ")} · ${selectedPaper.paper.replace(/_/g, " ")} · ${selectedPaper.variant.replace(/_/g, " ")}`
        : `${selectedSubject} · ${selectedYear || "—"}`;

  return (
    <div className="min-h-full bg-[#FAF6F0] px-4 py-6 text-[#1C1714] md:px-8 md:py-8">
      <div className="mx-auto max-w-[1180px] space-y-5">
        {/* Header */}
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#F6E1E7] px-3 py-1 text-[11px] font-bold uppercase tracking-[.12em] text-[#A8123C]">
              <BookOpenCheck size={14} />
              O Level question bank
            </div>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">Paper Practice</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#6B5F57]">
              Practice by topic to drill every unique question across all years, or load a complete past paper exactly as it was sat.
            </p>
          </div>

          {ready && (
            <div className="grid grid-cols-3 gap-2 rounded-lg border border-[#1C1714]/[.09] bg-white p-2 shadow-sm sm:min-w-[340px]">
              {[
                { label: "Questions", value: practiceMode === "topic" ? topicTotal : displayQuestions.length },
                { label: "Answered", value: answeredCount },
                { label: "Score", value: questionType === "mcq" && checked ? `${score}/${gradable.length}` : "—" },
              ].map((stat) => (
                <div key={stat.label} className="px-3 py-2">
                  <p className="text-[11px] font-bold uppercase tracking-[.1em] text-[#9A8D83]">{stat.label}</p>
                  <p className="font-display text-xl font-semibold text-[#1C1714]">{stat.value}</p>
                </div>
              ))}
            </div>
          )}
        </header>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-[#E7B7B7] bg-[#F9E2D7] px-4 py-3 text-sm font-bold text-[#CF5128]">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {/* Filter card */}
        <section className="rounded-lg border border-[#1C1714]/[.09] bg-white p-4 shadow-sm md:p-5">
          {loadingMeta ? (
            <div className="flex min-h-[140px] items-center justify-center text-sm font-semibold text-[#9A8D83]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading practice library...
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_200px_220px_minmax(200px,1.2fr)_minmax(180px,1fr)]">
                {/* Subject */}
                <label className="block">
                  <span className={labelClass}>Subject</span>
                  <select value={selectedSubject} onChange={(e) => handleSubjectChange(e.target.value)} className={selectClass}>
                    <option value="">Select subject</option>
                    {subjects.map((subject) => (
                      <option key={subject.name} value={subject.name}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Type */}
                <div className="block">
                  <span className={labelClass}>Question Type</span>
                  <div className={cx("grid h-11 grid-cols-2 rounded-lg border border-[#1C1714]/[.12] bg-[#1C1714]/[.04] p-1", !currentSubject && "opacity-60")}>
                    {([
                      ["structured", "Questions"],
                      ["mcq", "MCQs"],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        onClick={() => handleTypeChange(value)}
                        disabled={!currentSubject}
                        className={cx(
                          "rounded-md text-sm font-bold transition-colors disabled:cursor-not-allowed",
                          questionType === value ? "bg-white text-[#A8123C] shadow-sm" : "text-[#6B5F57] hover:text-[#1C1714]",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mode */}
                <div className="block">
                  <span className={labelClass}>Practice mode</span>
                  <div className={cx("grid h-11 grid-cols-2 rounded-lg border border-[#1C1714]/[.12] bg-[#1C1714]/[.04] p-1", !currentSubject && "opacity-60")}>
                    {([
                      ["topic", "By topic", Sparkles],
                      ["paper", "Full paper", FileText],
                    ] as const).map(([value, label, Icon]) => (
                      <button
                        key={value}
                        onClick={() => handleModeChange(value)}
                        disabled={!currentSubject}
                        className={cx(
                          "inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-bold transition-colors disabled:cursor-not-allowed",
                          practiceMode === value ? "bg-white text-[#A8123C] shadow-sm" : "text-[#6B5F57] hover:text-[#1C1714]",
                        )}
                      >
                        <Icon size={14} />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mode-specific selector(s) */}
                {practiceMode === "topic" ? (
                  <label className="block">
                    <span className={labelClass}>Topic</span>
                    <select
                      value={selectedTopic}
                      onChange={(e) => setSelectedTopic(e.target.value)}
                      disabled={!currentSubject || loadingQuestions}
                      className={selectClass}
                    >
                      <option value="">Select a topic</option>
                      {availableTopics.map((topic) => (
                        <option key={topic.name} value={topic.name}>
                          {topic.name} ({topic.count})
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className={labelClass}>Year</span>
                      <select value={selectedYear} onChange={(e) => handleYearChange(e.target.value)} disabled={!currentSubject} className={selectClass}>
                        <option value="">Year</option>
                        {availableYears.map((year) => (
                          <option key={year.year} value={year.year}>
                            {year.year}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className={labelClass}>Paper</span>
                      <select
                        value={selectedPaperKey}
                        onChange={(e) => setSelectedPaperKey(e.target.value)}
                        disabled={!selectedYear || papers.length === 0 || loadingQuestions}
                        className={selectClass}
                      >
                        <option value="">{selectedYear ? "Select paper" : "Pick year first"}</option>
                        {papers.map((paper) => (
                          <option key={paper.key} value={paper.key}>
                            {paper.session.replace(/_/g, " ")} · {paper.paper.replace(/_/g, " ")} · {paper.variant.replace(/_/g, " ")} ({paper.count})
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}

                {/* Search */}
                <label className="block">
                  <span className={labelClass}>Find</span>
                  <div
                    className={cx(
                      "flex h-11 items-center gap-2 rounded-lg border border-[#1C1714]/[.14] bg-white px-3 transition focus-within:border-[#A8123C] focus-within:ring-2 focus-within:ring-[#A8123C]/15",
                      (!ready || loadingQuestions) && "bg-[#1C1714]/[.03]",
                    )}
                  >
                    <Search size={16} className="text-[#9A8D83]" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      disabled={!ready || loadingQuestions}
                      placeholder="Search questions"
                      className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#33291F] outline-none disabled:cursor-not-allowed disabled:text-[#9A8D83]"
                    />
                  </div>
                </label>
              </div>

              {ready && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#1C1714]/[.07] pt-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-[#6B5F57]">
                    {practiceMode === "topic" ? <Sparkles size={15} className="text-[#A8123C]" /> : <FileText size={15} className="text-[#A8123C]" />}
                    {summary}
                    {practiceMode === "topic"
                      ? topicTotal > 0 && (
                          <span className="text-[#9A8D83]">
                            · {displayQuestions.length} of {topicTotal} unique question{topicTotal === 1 ? "" : "s"} across all years
                          </span>
                        )
                      : displayQuestions.length > 0 && (
                          <span className="text-[#9A8D83]">
                            · {displayQuestions.length} question{displayQuestions.length === 1 ? "" : "s"}
                          </span>
                        )}
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    {questionType === "mcq" && (
                      <button
                        onClick={() => setChecked(true)}
                        disabled={gradable.length === 0}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#A8123C] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#760B28] disabled:cursor-not-allowed disabled:bg-[#1C1714]/20"
                      >
                        <CheckCircle2 size={17} />
                        Check
                      </button>
                    )}
                    <button
                      onClick={resetPractice}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#1C1714]/[.12] text-[#6B5F57] transition hover:bg-[#1C1714]/[.04]"
                      title="Reset answers"
                    >
                      <RefreshCcw size={17} />
                    </button>
                    {hasScheme && (
                      <button
                        onClick={() => setShowScheme((v) => !v)}
                        className={cx(
                          "inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-bold transition",
                          showScheme ? "border-[#E7C9A1] bg-[#FFF6E9] text-[#8A4F12]" : "border-[#1C1714]/[.12] text-[#6B5F57] hover:bg-[#1C1714]/[.04]",
                        )}
                      >
                        {questionType === "mcq" ? "Marking scheme" : "Answers"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Questions */}
        <section className="space-y-4">
          {loadingQuestions ? (
            <div className="flex min-h-[340px] items-center justify-center rounded-lg border border-[#1C1714]/[.09] bg-white text-sm font-semibold text-[#9A8D83] shadow-sm">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading questions...
            </div>
          ) : !ready ? (
            <div className="rounded-lg border border-dashed border-[#1C1714]/[.18] bg-white p-10 text-center shadow-sm">
              <FileQuestion className="mx-auto h-10 w-10 text-[#C9BDB2]" />
              <h2 className="mt-3 font-display text-lg font-semibold">Nothing selected yet</h2>
              <p className="mt-1 text-sm text-[#6B5F57]">
                {practiceMode === "topic"
                  ? "Pick a subject, question type and topic to start drilling."
                  : "Pick a subject, year and a paper to load the full paper."}
              </p>
            </div>
          ) : displayQuestions.length > 0 ? (
            <>
              {practiceMode === "topic" && (
                <div className="flex items-center gap-2 rounded-lg border border-[#1C1714]/[.08] bg-white px-4 py-2.5 text-xs font-semibold text-[#6B5F57] shadow-sm">
                  <Layers size={14} className="text-[#A8123C]" />
                  Deduplicated — each unique question is shown once, even if it appeared in several years or variants.
                </div>
              )}
              {displayQuestions.map((question) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  showYear={practiceMode === "topic"}
                  mcqAnswer={mcqAnswers[question.id]}
                  partAnswers={partAnswers}
                  checked={checked}
                  showScheme={showScheme}
                  onMcqAnswer={(value) => setMcqAnswers((current) => ({ ...current, [question.id]: value }))}
                  onPartAnswer={(partKey, value) => setPartAnswers((current) => ({ ...current, [partKey]: value }))}
                />
              ))}

              {practiceMode === "topic" && questions.length < topicTotal && !query.trim() && (
                <button
                  onClick={loadMoreTopic}
                  disabled={loadingMore}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-[#1C1714]/[.12] bg-white text-sm font-bold text-[#A8123C] shadow-sm transition hover:bg-[#F6E1E7]/40 disabled:cursor-not-allowed disabled:text-[#9A8D83]"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                    </>
                  ) : (
                    `Load more (${questions.length} of ${topicTotal})`
                  )}
                </button>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-[#1C1714]/[.09] bg-white p-10 text-center shadow-sm">
              <FileQuestion className="mx-auto h-10 w-10 text-[#C9BDB2]" />
              <h2 className="mt-3 font-display text-lg font-semibold">No questions found</h2>
              <p className="mt-1 text-sm text-[#6B5F57]">Try another topic, paper, or search term.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
