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
  X,
  XCircle,
} from "lucide-react";

type QuestionType = "mcq" | "structured";

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
  parts: PracticePart[];
};

type TypeMeta = {
  total: number;
  years: { year: string; count: number }[];
  variants: { variant: string; count: number }[];
  topics: { name: string; count: number }[];
};

type SubjectMeta = {
  name: string;
  types: { mcq: TypeMeta; structured: TypeMeta };
};

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

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function questionNumberValue(value: string) {
  const match = value.match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : Number.MAX_SAFE_INTEGER;
}

function sortQuestions(questions: PracticeQuestion[]) {
  return [...questions].sort(
    (a, b) =>
      a.session.localeCompare(b.session, undefined, { numeric: true }) ||
      a.paper.localeCompare(b.paper, undefined, { numeric: true }) ||
      a.variant.localeCompare(b.variant, undefined, { numeric: true }) ||
      questionNumberValue(a.questionNumber) - questionNumberValue(b.questionNumber) ||
      a.questionNumber.localeCompare(b.questionNumber, undefined, { numeric: true }),
  );
}

function matchesQuery(question: PracticeQuestion, trimmed: string) {
  if (!trimmed) return true;
  return [question.questionText, question.topic, question.theme, question.session, question.paper, question.variant, question.questionNumber]
    .concat(question.parts.map((part) => part.body))
    .some((value) => value.toLowerCase().includes(trimmed));
}

// ---------------------------------------------------------------------------
// Presentational pieces
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

      {question.images.length > 0 && (
        <div className="space-y-3">
          {question.images.map((image, index) => (
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

      {question.images.length > 0 && (
        <div className="space-y-3">
          {question.images.map((image, index) => (
            <QuestionImage key={`${question.id}-img-${index}`} image={image} />
          ))}
        </div>
      )}

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
    </div>
  );
}

function QuestionCard(props: {
  question: PracticeQuestion;
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
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedVariant, setSelectedVariant] = useState("all");
  const [selectedTopic, setSelectedTopic] = useState("all");
  const [query, setQuery] = useState("");

  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [papers, setPapers] = useState<AvailablePaper[]>([]);
  const [selectedPaperKey, setSelectedPaperKey] = useState("");
  const [paperQuestions, setPaperQuestions] = useState<PracticeQuestion[]>([]);

  const [mcqAnswers, setMcqAnswers] = useState<Record<string, string>>({});
  const [partAnswers, setPartAnswers] = useState<Record<string, string>>({});

  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [loadingPaper, setLoadingPaper] = useState(false);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState(false);
  const [showScheme, setShowScheme] = useState(false);

  // ---- load subjects metadata ------------------------------------------
  useEffect(() => {
    let mounted = true;
    async function loadMeta() {
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
    }
    loadMeta();
    return () => {
      mounted = false;
    };
  }, []);

  const currentSubject = useMemo(() => subjects.find((s) => s.name === selectedSubject) ?? null, [selectedSubject, subjects]);
  const currentTypeMeta = currentSubject?.types[questionType] ?? null;
  const availableYears = currentTypeMeta?.years ?? [];
  const hasSelection = Boolean(selectedSubject && selectedYear);
  const isPaperMode = Boolean(selectedPaperKey);

  // ---- load questions for the selected year ----------------------------
  useEffect(() => {
    if (!selectedSubject || !selectedYear) {
      setQuestions([]);
      setPapers([]);
      setSelectedPaperKey("");
      setPaperQuestions([]);
      setMcqAnswers({});
      setPartAnswers({});
      setChecked(false);
      return;
    }

    let mounted = true;
    async function loadYear() {
      setLoadingQuestions(true);
      setError("");
      setChecked(false);
      setMcqAnswers({});
      setPartAnswers({});
      try {
        const params = new URLSearchParams({ subject: selectedSubject, type: questionType, year: selectedYear });
        const papersParams = new URLSearchParams({ subject: selectedSubject, type: questionType, year: selectedYear, papers: "1" });
        const [questionsRes, papersRes] = await Promise.all([
          fetch(`/api/paper-practice?${params.toString()}`),
          fetch(`/api/paper-practice?${papersParams.toString()}`),
        ]);
        if (!questionsRes.ok) throw new Error("Could not load questions.");
        const data = (await questionsRes.json()) as { questions: PracticeQuestion[] };
        const papersData = papersRes.ok ? ((await papersRes.json()) as { papers: AvailablePaper[] }) : { papers: [] };
        if (!mounted) return;
        setQuestions(sortQuestions(data.questions ?? []));
        setPapers(papersData.papers ?? []);
      } catch (loadError) {
        if (mounted) {
          setQuestions([]);
          setError(loadError instanceof Error ? loadError.message : "Could not load questions.");
        }
      } finally {
        if (mounted) setLoadingQuestions(false);
      }
    }
    loadYear();
    return () => {
      mounted = false;
    };
  }, [questionType, selectedSubject, selectedYear]);

  // ---- load a whole paper via the RPC ----------------------------------
  useEffect(() => {
    if (!selectedPaperKey) {
      setPaperQuestions([]);
      return;
    }
    const paper = papers.find((p) => p.key === selectedPaperKey);
    if (!paper) return;

    let mounted = true;
    async function loadPaper() {
      setLoadingPaper(true);
      setError("");
      setChecked(false);
      try {
        const params = new URLSearchParams({
          subject: selectedSubject,
          year: paper!.year,
          session: paper!.session,
          paper: paper!.paper,
          variant: paper!.variant,
        });
        const response = await fetch(`/api/paper-practice?${params.toString()}`);
        if (!response.ok) throw new Error("Could not load the paper.");
        const data = (await response.json()) as { questions: PracticeQuestion[] };
        if (mounted) setPaperQuestions(sortQuestions(data.questions ?? []));
      } catch (loadError) {
        if (mounted) {
          setPaperQuestions([]);
          setError(loadError instanceof Error ? loadError.message : "Could not load the paper.");
        }
      } finally {
        if (mounted) setLoadingPaper(false);
      }
    }
    loadPaper();
    return () => {
      mounted = false;
    };
  }, [selectedPaperKey, papers, selectedSubject]);

  // ---- derived dropdown options + filtered list ------------------------
  const availableVariants = useMemo(() => {
    const map = new Map<string, number>();
    for (const q of questions) if (q.variant) map.set(q.variant, (map.get(q.variant) ?? 0) + 1);
    return Array.from(map, ([variant, count]) => ({ variant, count })).sort((a, b) => a.variant.localeCompare(b.variant, undefined, { numeric: true }));
  }, [questions]);

  const availableTopics = useMemo(() => {
    const map = new Map<string, number>();
    for (const q of questions) {
      const name = q.topic || "Uncategorised";
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return Array.from(map, ([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
  }, [questions]);

  const displayQuestions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (isPaperMode) return paperQuestions.filter((q) => matchesQuery(q, trimmed));
    return questions.filter((q) => {
      if (selectedVariant !== "all" && q.variant !== selectedVariant) return false;
      if (selectedTopic !== "all" && (q.topic || "Uncategorised") !== selectedTopic) return false;
      return matchesQuery(q, trimmed);
    });
  }, [isPaperMode, paperQuestions, questions, selectedVariant, selectedTopic, query]);

  const gradable = displayQuestions.filter((q) => q.type === "mcq" && q.correctOption);
  const score = gradable.filter((q) => mcqAnswers[q.id] === q.correctOption).length;
  const answeredCount = displayQuestions.filter((q) =>
    q.type === "mcq"
      ? Boolean(mcqAnswers[q.id]?.trim())
      : q.parts.length
        ? q.parts.some((_, index) => Boolean(partAnswers[`${q.id}::${index}`]?.trim()))
        : Boolean(partAnswers[`${q.id}::0`]?.trim()),
  ).length;
  const hasScheme = displayQuestions.some((q) => q.markingScheme || q.parts.some((p) => p.answer));
  const selectedPaper = papers.find((p) => p.key === selectedPaperKey) ?? null;

  // ---- handlers --------------------------------------------------------
  function resetFilters() {
    setSelectedVariant("all");
    setSelectedTopic("all");
    setSelectedPaperKey("");
    setQuery("");
    setMcqAnswers({});
    setPartAnswers({});
    setChecked(false);
    setShowScheme(false);
  }

  function handleSubjectChange(name: string) {
    setSelectedSubject(name);
    setSelectedYear("");
    resetFilters();
  }
  function handleTypeChange(type: QuestionType) {
    setQuestionType(type);
    setSelectedYear("");
    resetFilters();
  }
  function handleYearChange(year: string) {
    setSelectedYear(year);
    resetFilters();
  }
  function resetPractice() {
    setMcqAnswers({});
    setPartAnswers({});
    setChecked(false);
    setShowScheme(false);
  }

  const summary = isPaperMode
    ? selectedPaper?.label
    : `${selectedSubject} · ${selectedYear} · ${questionType === "mcq" ? "MCQs" : "Paper questions"}`;

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
              Choose a subject, switch between MCQs and paper questions, then filter by year, variant and topic — or load a complete past paper.
            </p>
          </div>

          {hasSelection && (
            <div className="grid grid-cols-3 gap-2 rounded-lg border border-[#1C1714]/[.09] bg-white p-2 shadow-sm sm:min-w-[340px]">
              {[
                { label: "Questions", value: displayQuestions.length },
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
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_210px_140px_180px_minmax(190px,1fr)_minmax(180px,1fr)]">
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

                <label className="block">
                  <span className={labelClass}>Year</span>
                  <select value={selectedYear} onChange={(e) => handleYearChange(e.target.value)} disabled={!currentSubject} className={selectClass}>
                    <option value="">Select year</option>
                    {availableYears.map((year) => (
                      <option key={year.year} value={year.year}>
                        {year.year} ({year.count})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className={labelClass}>Variant</span>
                  <select
                    value={selectedVariant}
                    onChange={(e) => setSelectedVariant(e.target.value)}
                    disabled={!hasSelection || loadingQuestions || isPaperMode}
                    className={selectClass}
                  >
                    <option value="all">All variants</option>
                    {availableVariants.map((v) => (
                      <option key={v.variant} value={v.variant}>
                        {v.variant.replace(/_/g, " ")} ({v.count})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className={labelClass}>Topic</span>
                  <select
                    value={selectedTopic}
                    onChange={(e) => setSelectedTopic(e.target.value)}
                    disabled={!hasSelection || loadingQuestions || isPaperMode}
                    className={selectClass}
                  >
                    <option value="all">All topics ({questions.length})</option>
                    {availableTopics.map((topic) => (
                      <option key={topic.name} value={topic.name}>
                        {topic.name} ({topic.count})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className={labelClass}>Find</span>
                  <div
                    className={cx(
                      "flex h-11 items-center gap-2 rounded-lg border border-[#1C1714]/[.14] bg-white px-3 transition focus-within:border-[#A8123C] focus-within:ring-2 focus-within:ring-[#A8123C]/15",
                      (!hasSelection || loadingQuestions) && "bg-[#1C1714]/[.03]",
                    )}
                  >
                    <Search size={16} className="text-[#9A8D83]" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      disabled={!hasSelection || loadingQuestions}
                      placeholder="Search questions"
                      className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#33291F] outline-none disabled:cursor-not-allowed disabled:text-[#9A8D83]"
                    />
                  </div>
                </label>
              </div>

              {/* Full-paper picker */}
              {hasSelection && papers.length > 0 && (
                <div className="flex flex-col gap-2 rounded-lg border border-[#1C1714]/[.08] bg-[#FAF6F0]/70 p-3 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.12em] text-[#9A8D83]">
                    <Layers size={15} />
                    Full paper
                  </div>
                  <select
                    value={selectedPaperKey}
                    onChange={(e) => setSelectedPaperKey(e.target.value)}
                    disabled={loadingPaper}
                    className="h-10 flex-1 rounded-lg border border-[#1C1714]/[.14] bg-white px-3 text-sm font-semibold text-[#33291F] outline-none transition focus:border-[#A8123C] focus:ring-2 focus:ring-[#A8123C]/15"
                  >
                    <option value="">Browse by filters (no full paper)</option>
                    {papers.map((paper) => (
                      <option key={paper.key} value={paper.key}>
                        {paper.label} ({paper.count})
                      </option>
                    ))}
                  </select>
                  {isPaperMode && (
                    <button
                      onClick={() => setSelectedPaperKey("")}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[#1C1714]/[.12] px-3 text-sm font-bold text-[#6B5F57] transition hover:bg-[#1C1714]/[.04]"
                    >
                      <X size={15} /> Exit paper
                    </button>
                  )}
                </div>
              )}

              {hasSelection && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#1C1714]/[.07] pt-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-[#6B5F57]">
                    {isPaperMode && <FileText size={15} className="text-[#A8123C]" />}
                    {summary}
                    {displayQuestions.length > 0 && (
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
          {loadingQuestions || loadingPaper ? (
            <div className="flex min-h-[340px] items-center justify-center rounded-lg border border-[#1C1714]/[.09] bg-white text-sm font-semibold text-[#9A8D83] shadow-sm">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {loadingPaper ? "Loading paper..." : "Loading questions..."}
            </div>
          ) : !hasSelection ? (
            <div className="rounded-lg border border-dashed border-[#1C1714]/[.18] bg-white p-10 text-center shadow-sm">
              <FileQuestion className="mx-auto h-10 w-10 text-[#C9BDB2]" />
              <h2 className="mt-3 font-display text-lg font-semibold">Nothing selected yet</h2>
              <p className="mt-1 text-sm text-[#6B5F57]">Pick a subject, question type and year to begin.</p>
            </div>
          ) : displayQuestions.length > 0 ? (
            displayQuestions.map((question) => (
              <QuestionCard
                key={question.id}
                question={question}
                mcqAnswer={mcqAnswers[question.id]}
                partAnswers={partAnswers}
                checked={checked}
                showScheme={showScheme}
                onMcqAnswer={(value) => setMcqAnswers((current) => ({ ...current, [question.id]: value }))}
                onPartAnswer={(partKey, value) => setPartAnswers((current) => ({ ...current, [partKey]: value }))}
              />
            ))
          ) : (
            <div className="rounded-lg border border-[#1C1714]/[.09] bg-white p-10 text-center shadow-sm">
              <FileQuestion className="mx-auto h-10 w-10 text-[#C9BDB2]" />
              <h2 className="mt-3 font-display text-lg font-semibold">No questions found</h2>
              <p className="mt-1 text-sm text-[#6B5F57]">Try another variant, topic, or search term.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
