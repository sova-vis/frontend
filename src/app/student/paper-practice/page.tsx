"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpenCheck,
  CheckCircle2,
  FileQuestion,
  Loader2,
  RefreshCcw,
  Search,
  XCircle,
} from "lucide-react";

type PracticeImage = {
  role: string;
  position: string;
  option?: string;
  path?: string | null;
  src?: string | null;
  alt: string;
  exists: boolean;
  embedded: boolean;
  width?: number | null;
  height?: number | null;
  displayMode?: "diagram" | "source-page";
  warning?: string | null;
};

type PracticeOption = {
  label: string;
  text: string;
};

type PracticeQuestion = {
  id: string;
  subject: string;
  year: string;
  session: string;
  paper: string;
  variant: string;
  questionNumber: string;
  subQuestion: string;
  marks: number | null;
  topicSyllabus: string;
  topicGeneral: string;
  stem: string;
  questionText: string;
  options: PracticeOption[];
  markingScheme: string;
  correctOption: string | null;
  requiresDiagram: boolean;
  questionKind?: string;
  sourceType?: string;
  images: PracticeImage[];
  syllabusRef: {
    syllabus_code?: string;
    topic_id?: string;
    topic_name?: string;
    section_title?: string;
  } | null;
  reference: {
    past_paper_pdf?: string;
    syllabus_document?: string;
    pdf_available?: boolean;
  } | null;
};

type TopicMeta = {
  name: string;
  general: string;
  count: number;
  years: string[];
  syllabusRef?: PracticeQuestion["syllabusRef"];
};

type SubjectMeta = {
  name: string;
  slug: string;
  years: { year: string; count: number }[];
  topics: TopicMeta[];
  totalQuestions: number;
  imageQuestions: number;
};

const preferredSubjects = ["Chemistry", "Mathematics", "Physics"];
type QuestionSource = "batch" | "mcq";

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function optionImages(images: PracticeImage[], label: string) {
  return images.filter((image) => {
    const option = image.option?.toUpperCase();
    return image.role === "option" && (option === label || image.path?.toLowerCase().includes(`opt_${label.toLowerCase()}`));
  });
}

function stemImages(images: PracticeImage[]) {
  return images.filter((image) => image.role !== "option");
}

function QuestionImage({ image }: { image: PracticeImage }) {
  if (!image.src) {
    return null;
  }

  if (image.displayMode === "source-page") {
    return (
      <details open className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
        <summary className="cursor-pointer text-sm font-bold text-amber-900">Source page image</summary>
        {image.warning && <p className="mt-2 text-xs font-semibold leading-5 text-amber-800">{image.warning}</p>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.src} alt={image.alt} className="mt-3 max-h-[560px] w-full rounded-md bg-white object-contain" loading="lazy" />
      </details>
    );
  }

  return (
    <figure className="rounded-lg border border-gray-200 bg-white p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.src} alt={image.alt} className="mx-auto max-h-[520px] w-full max-w-3xl object-contain" loading="lazy" />
    </figure>
  );
}

function QuestionCard({
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
  const hasOptions = question.options.length >= 2;
  const correct = question.correctOption;
  const isAnswered = Boolean(answer?.trim());
  const isCorrect = checked && correct && answer === correct;
  const isWrong = checked && correct && isAnswered && answer !== correct;

  return (
    <article className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-500">
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700">Q{question.questionNumber}{question.subQuestion}</span>
          {question.marks !== null && <span>{question.marks} mark{question.marks === 1 ? "" : "s"}</span>}
          {question.session && <span>{question.session.replace(/_/g, " ")}</span>}
          {question.paper && <span>{question.paper.replace(/_/g, " ")}</span>}
          {question.variant && <span>{question.variant.replace(/_/g, " ")}</span>}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {question.topicSyllabus && (
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{question.topicSyllabus}</span>
          )}
          {question.topicGeneral && (
            <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-700">{question.topicGeneral}</span>
          )}
          {question.syllabusRef?.topic_id && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
              {question.syllabusRef.syllabus_code} {question.syllabusRef.topic_id}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <p className="whitespace-pre-wrap text-[15px] leading-7 text-gray-900">{question.stem || question.questionText}</p>

        {stemImages(question.images).length > 0 && (
          <div className="space-y-3">
            {stemImages(question.images).map((image, imageIndex) => (
              <QuestionImage key={`${question.id}-stem-${imageIndex}`} image={image} />
            ))}
          </div>
        )}

        {hasOptions ? (
          <div className="grid grid-cols-1 gap-2">
            {question.options.map((option) => {
              const selected = answer === option.label;
              const optionCorrect = checked && correct === option.label;
              const optionWrong = checked && selected && correct !== option.label;

              return (
                <label
                  key={option.label}
                  className={classNames(
                    "flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors",
                    selected && !checked && "border-primary bg-primary/5",
                    !selected && !checked && "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
                    optionCorrect && "border-emerald-300 bg-emerald-50",
                    optionWrong && "border-red-300 bg-red-50",
                    checked && !optionCorrect && !optionWrong && "border-gray-200 bg-gray-50",
                  )}
                >
                  <input
                    type="radio"
                    name={question.id}
                    value={option.label}
                    checked={selected}
                    onChange={() => onAnswer(option.label)}
                    className="mt-1 h-4 w-4 accent-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-white text-xs font-bold text-gray-700 shadow-sm">
                        {option.label}
                      </span>
                      <span className="text-sm leading-6 text-gray-800">{option.text}</span>
                    </div>
                    {optionImages(question.images, option.label).map((image, imageIndex) => (
                      <div key={`${question.id}-${option.label}-${imageIndex}`} className="mt-3">
                        <QuestionImage image={image} />
                      </div>
                    ))}
                  </div>
                </label>
              );
            })}
          </div>
        ) : (
          <textarea
            value={answer ?? ""}
            onChange={(event) => onAnswer(event.target.value)}
            placeholder="Type your answer..."
            className="min-h-[120px] w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
        )}

        {checked && correct && (
          <div
            className={classNames(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold",
              isCorrect && "bg-emerald-50 text-emerald-700",
              isWrong && "bg-red-50 text-red-700",
              !isAnswered && "bg-amber-50 text-amber-700",
            )}
          >
            {isCorrect ? <CheckCircle2 size={17} /> : isWrong ? <XCircle size={17} /> : <AlertCircle size={17} />}
            Correct option: {correct}
          </div>
        )}

        {showScheme && question.markingScheme && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
            {question.markingScheme}
          </div>
        )}
      </div>
    </article>
  );
}

export default function PaperPracticePage() {
  const [subjects, setSubjects] = useState<SubjectMeta[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("all");
  const [questionSource, setQuestionSource] = useState<QuestionSource>("batch");
  const [practiceMode, setPracticeMode] = useState<"topic" | "paper">("topic");
  const [selectedPaperKey, setSelectedPaperKey] = useState("all");
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState(false);
  const [showScheme, setShowScheme] = useState(false);
  const [query, setQuery] = useState("");

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

        const sorted = [...data.subjects].sort((a, b) => {
          const aPreferred = preferredSubjects.indexOf(a.name);
          const bPreferred = preferredSubjects.indexOf(b.name);
          if (aPreferred !== -1 || bPreferred !== -1) {
            return (aPreferred === -1 ? 99 : aPreferred) - (bPreferred === -1 ? 99 : bPreferred);
          }
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

  const currentSubject = useMemo(
    () => subjects.find((subject) => subject.name === selectedSubject) ?? null,
    [selectedSubject, subjects],
  );

  const availableTopics = useMemo(() => {
    const topics = new Map<string, { name: string; general: string; count: number }>();

    for (const question of questions) {
      const name = question.topicSyllabus || question.topicGeneral || "Uncategorised";
      const key = name.toLowerCase();
      const current = topics.get(key) ?? { name, general: question.topicGeneral, count: 0 };
      current.count += 1;
      if (!current.general) current.general = question.topicGeneral;
      topics.set(key, current);
    }

    return Array.from(topics.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [questions]);

  const paperOptions = useMemo(() => {
    const options = new Map<string, { key: string; label: string; count: number }>();

    for (const question of questions) {
      const key = [question.session, question.paper, question.variant].filter(Boolean).join("|");
      if (!key) continue;
      const label = [question.session, question.paper, question.variant]
        .filter(Boolean)
        .map((value) => value.replace(/_/g, " "))
        .join(" / ");
      const current = options.get(key);
      options.set(key, { key, label, count: (current?.count ?? 0) + 1 });
    }

    return Array.from(options.values()).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  }, [questions]);

  useEffect(() => {
    if (!selectedSubject || !selectedYear) {
      setQuestions([]);
      setAnswers({});
      setChecked(false);
      setSelectedTopic("all");
      setSelectedPaperKey("all");
      return;
    }

    let mounted = true;

    async function loadQuestions() {
      setLoadingQuestions(true);
      setError("");
      setChecked(false);
      setAnswers({});

      try {
        const params = new URLSearchParams({
          subject: selectedSubject,
          year: selectedYear,
          topic: "all",
          source: questionSource,
        });
        const response = await fetch(`/api/paper-practice?${params.toString()}`);
        if (!response.ok) throw new Error("Could not load questions.");
        const data = (await response.json()) as { questions: PracticeQuestion[] };
        if (mounted) {
          setQuestions(data.questions);
          setSelectedPaperKey("all");
        }
      } catch (loadError) {
        if (mounted) {
          setQuestions([]);
          setError(loadError instanceof Error ? loadError.message : "Could not load questions.");
        }
      } finally {
        if (mounted) setLoadingQuestions(false);
      }
    }

    loadQuestions();
    return () => {
      mounted = false;
    };
  }, [questionSource, selectedSubject, selectedYear]);

  const activeQuestions = useMemo(() => {
    if (practiceMode === "topic") {
      if (selectedTopic === "all") return questions;
      return questions.filter((question) => {
        const topic = question.topicSyllabus || question.topicGeneral || "Uncategorised";
        return topic.toLowerCase() === selectedTopic.toLowerCase();
      });
    }

    if (selectedPaperKey === "all") return questions;

    return questions.filter((question) => {
      const key = [question.session, question.paper, question.variant].filter(Boolean).join("|");
      return key === selectedPaperKey;
    });
  }, [practiceMode, questions, selectedPaperKey, selectedTopic]);

  const filteredQuestions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return activeQuestions;

    return activeQuestions.filter((question) => {
      return [
        question.stem,
        question.topicSyllabus,
        question.topicGeneral,
        question.session,
        question.paper,
        question.variant,
        question.questionNumber,
      ].some((value) => value.toLowerCase().includes(trimmed));
    });
  }, [activeQuestions, query]);

  const answeredCount = activeQuestions.filter((question) => Boolean(answers[question.id]?.trim())).length;
  const gradableQuestions = activeQuestions.filter((question) => question.correctOption);
  const score = gradableQuestions.filter((question) => answers[question.id] === question.correctOption).length;
  const hasSelection = Boolean(selectedSubject && selectedYear);

  function handleSubjectChange(subjectName: string) {
    setSelectedSubject(subjectName);
    setSelectedYear("");
    setSelectedTopic("all");
    setQuestionSource("batch");
    setPracticeMode("topic");
    setSelectedPaperKey("all");
    setQuery("");
    setQuestions([]);
    setAnswers({});
    setChecked(false);
    setShowScheme(false);
  }

  function handleYearChange(year: string) {
    setSelectedYear(year);
    setSelectedTopic("all");
    setSelectedPaperKey("all");
    setQuery("");
    setQuestions([]);
    setAnswers({});
    setChecked(false);
    setShowScheme(false);
  }

  function handleQuestionSourceChange(source: QuestionSource) {
    setQuestionSource(source);
    setSelectedTopic("all");
    setSelectedPaperKey("all");
    setQuery("");
    setQuestions([]);
    setAnswers({});
    setChecked(false);
    setShowScheme(false);
  }

  function resetPractice() {
    setAnswers({});
    setChecked(false);
    setShowScheme(false);
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 pb-16 md:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-primary">
              <BookOpenCheck size={14} />
              O Level question bank
            </div>
            <h1 className="mt-3 font-display text-3xl font-bold text-gray-950">Paper Practice</h1>
            <p className="mt-1 max-w-xl text-sm leading-6 text-gray-500">Choose a subject and year to begin.</p>
          </div>

          {hasSelection && (
            <div className="grid grid-cols-3 gap-2 rounded-lg border border-gray-200 bg-white p-2 shadow-sm sm:min-w-[360px]">
              <div className="px-3 py-2">
                <p className="text-xs font-semibold text-gray-400">Questions</p>
                <p className="text-xl font-bold text-gray-950">{activeQuestions.length}</p>
              </div>
              <div className="px-3 py-2">
                <p className="text-xs font-semibold text-gray-400">Answered</p>
                <p className="text-xl font-bold text-gray-950">{answeredCount}</p>
              </div>
              <div className="px-3 py-2">
                <p className="text-xs font-semibold text-gray-400">Score</p>
                <p className="text-xl font-bold text-gray-950">{checked ? `${score}/${gradableQuestions.length}` : "-"}</p>
              </div>
            </div>
          )}
        </header>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          {loadingMeta ? (
            <div className="flex min-h-[160px] items-center justify-center text-sm font-semibold text-gray-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading practice library...
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[210px_150px_190px_160px_minmax(210px,1fr)_minmax(210px,1fr)]">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Subject</span>
                  <select
                    value={selectedSubject}
                    onChange={(event) => handleSubjectChange(event.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  >
                    <option value="">Select subject</option>
                    {subjects.map((subject) => (
                      <option key={subject.name} value={subject.name}>
                        {subject.name} ({subject.totalQuestions})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Year</span>
                  <select
                    value={selectedYear}
                    onChange={(event) => handleYearChange(event.target.value)}
                    disabled={!currentSubject}
                    className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">Select year</option>
                    {currentSubject?.years.map((year) => (
                      <option key={year.year} value={year.year}>
                        {year.year} ({year.count})
                      </option>
                    ))}
                  </select>
                </label>

                <div className="block">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Question Type</span>
                  <select
                    value={questionSource}
                    onChange={(event) => handleQuestionSourceChange(event.target.value as QuestionSource)}
                    disabled={!hasSelection || loadingQuestions}
                    className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="batch">Paper questions</option>
                    <option value="mcq">MCQs</option>
                  </select>
                </div>

                <div className="block">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Mode</span>
                  <div className={classNames("grid h-11 grid-cols-2 rounded-lg border border-gray-200 bg-gray-50 p-1", !hasSelection && "opacity-60")}>
                    <button
                      onClick={() => setPracticeMode("topic")}
                      disabled={!hasSelection}
                      className={classNames(
                        "rounded-md text-sm font-bold transition-colors disabled:cursor-not-allowed",
                        practiceMode === "topic" ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-800",
                      )}
                    >
                      Topic
                    </button>
                    <button
                      onClick={() => setPracticeMode("paper")}
                      disabled={!hasSelection}
                      className={classNames(
                        "rounded-md text-sm font-bold transition-colors disabled:cursor-not-allowed",
                        practiceMode === "paper" ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-800",
                      )}
                    >
                      Paper
                    </button>
                  </div>
                </div>

                {practiceMode === "topic" ? (
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Topic</span>
                    <select
                      value={selectedTopic}
                      onChange={(event) => setSelectedTopic(event.target.value)}
                      disabled={!hasSelection || loadingQuestions}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                    >
                      <option value="all">All topics ({questions.length})</option>
                      {availableTopics.map((topic) => (
                        <option key={topic.name} value={topic.name}>
                          {topic.name} ({topic.count})
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Full Paper</span>
                    <select
                      value={selectedPaperKey}
                      onChange={(event) => setSelectedPaperKey(event.target.value)}
                      disabled={!hasSelection || loadingQuestions}
                      className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                    >
                      <option value="all">Whole year ({questions.length})</option>
                      {paperOptions.map((paper) => (
                        <option key={paper.key} value={paper.key}>
                          {paper.label} ({paper.count})
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Find</span>
                  <div
                    className={classNames(
                      "flex h-11 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10",
                      (!hasSelection || loadingQuestions) && "bg-gray-50",
                    )}
                  >
                    <Search size={16} className="text-gray-400" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      disabled={!hasSelection || loadingQuestions}
                      placeholder="Search questions"
                      className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-gray-800 outline-none disabled:cursor-not-allowed disabled:text-gray-400"
                    />
                  </div>
                </label>
              </div>

              {hasSelection && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                  <p className="text-sm font-semibold text-gray-500">
                    {selectedSubject} / {selectedYear} / {questionSource === "mcq" ? "MCQs" : "Paper questions"}
                    {activeQuestions.length > 0 && <span> / {activeQuestions.length} question{activeQuestions.length === 1 ? "" : "s"}</span>}
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setChecked(true)}
                      disabled={gradableQuestions.length === 0}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 text-sm font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      <CheckCircle2 size={17} />
                      Check
                    </button>
                    <button
                      onClick={resetPractice}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-50"
                      title="Reset"
                    >
                      <RefreshCcw size={17} />
                    </button>
                    <button
                      onClick={() => setShowScheme((value) => !value)}
                      className={classNames(
                        "inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-bold transition",
                        showScheme ? "border-amber-300 bg-amber-50 text-amber-800" : "border-gray-200 text-gray-600 hover:bg-gray-50",
                      )}
                    >
                      Scheme
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="space-y-4">
          {loadingQuestions ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-500 shadow-sm">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading questions...
            </div>
          ) : !hasSelection ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm">
              <FileQuestion className="mx-auto h-10 w-10 text-gray-300" />
              <h2 className="mt-3 text-lg font-bold text-gray-950">Nothing selected yet</h2>
              <p className="mt-1 text-sm text-gray-500">Select a subject and year from the dropdowns above.</p>
            </div>
          ) : filteredQuestions.length > 0 ? (
            filteredQuestions.map((question) => (
              <QuestionCard
                key={question.id}
                question={question}
                answer={answers[question.id]}
                checked={checked}
                showScheme={showScheme}
                onAnswer={(value) =>
                  setAnswers((current) => ({
                    ...current,
                    [question.id]: value,
                  }))
                }
              />
            ))
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-10 text-center shadow-sm">
              <FileQuestion className="mx-auto h-10 w-10 text-gray-300" />
              <h2 className="mt-3 text-lg font-bold text-gray-950">No questions found</h2>
              <p className="mt-1 text-sm text-gray-500">Try another topic, full paper, or search term.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
