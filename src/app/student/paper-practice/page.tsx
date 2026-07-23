"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Icon } from "@/components/propel/Icon";
import { Segmented, EmptyState, Bar } from "@/components/propel/primitives";
import {
  PracticeProgress, PracticeUpload, SolveMode, PracticeStatus,
  loadPracticeProgressList, savePracticeProgress, deletePracticeProgress,
  uploadPracticeFile, removePracticeUpload, makePaperKey,
} from "@/lib/practiceProgress";
import { paperDurationSeconds, durationLabel, clockLabel } from "@/lib/paperDurations";

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

const questionImagesOf = (images: PracticeImage[]) => images.filter((image) => image.role !== "answer");
const answerImagesOf = (images: PracticeImage[]) => images.filter((image) => image.role === "answer");

/* ---- deep-link helpers (past-papers → practice) -------------------------- */
// Canonical session token from any naming ("May/Jun", "May_June", "Oct_Nov"…)
function sessionToken(value: string): string {
  const t = value.toLowerCase();
  if (/may|jun/.test(t)) return "mj";
  if (/oct|nov/.test(t)) return "on";
  if (/feb|mar/.test(t)) return "fm";
  return t;
}
const digitsOf = (value: string) => value.match(/\d+/)?.[0] ?? "";

// Drive folder names vs question-bank names ("English" → "English Language")
const SUBJECT_ALIASES: Record<string, string> = {
  english: "english language",
  maths: "mathematics",
  math: "mathematics",
  "add maths": "additional mathematics",
  "additional maths": "additional mathematics",
};
const normSubject = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");
function resolveSubjectName(subjects: SubjectMeta[], wanted: string): string | null {
  const target = SUBJECT_ALIASES[normSubject(wanted)] ?? normSubject(wanted);
  const exact = subjects.find((s) => normSubject(s.name) === target);
  if (exact) return exact.name;
  const partial = subjects.find((s) => normSubject(s.name).includes(target) || target.includes(normSubject(s.name)));
  return partial?.name ?? null;
}

const pruneAnswers = (record: Record<string, string>) =>
  Object.fromEntries(Object.entries(record).filter(([, value]) => value && value.trim()));

// A "header" part is a lead-in that introduces sub-parts (e.g. "(a)" whose text
// says "look at the graph and describe the following:", followed by "(a)(i)",
// "(a)(ii)"). Its answer is given in the sub-parts, so it gets no answer box.
const isHeaderPart = (parts: PracticePart[], label: string) =>
  Boolean(label) && parts.some((p) => p.label && p.label !== label && p.label.startsWith(label) && p.label.length > label.length);

function SourceNote({ note }: { note: string | null }) {
  if (!note) return null;
  return <p style={{ borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface-2)", padding: "8px 12px", fontSize: 12, fontStyle: "italic", color: "var(--ink-faint)" }}>{note}</p>;
}

function Passages({ sources }: { sources: PracticeSource[] }) {
  if (!sources.length) return null;
  return (
    <div className="flex-col gap-12" style={{ display: "flex" }}>
      {sources.map((source, index) => (
        <figure key={index} style={{ borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface-2)", padding: 12 }}>
          {(source.label || source.reference) && (
            <figcaption className="flex wrap items-center gap-8" style={{ fontSize: 12, fontWeight: 700, color: "var(--crimson)" }}>
              {source.label && <span>{source.label}</span>}
              {source.reference && <span style={{ fontWeight: 600, color: "var(--ink-faint)" }}>{source.reference}</span>}
            </figcaption>
          )}
          {source.image?.src && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={source.image.src} alt={source.label || "passage"} style={{ margin: "8px auto 0", maxHeight: 300, width: "100%", maxWidth: 640, objectFit: "contain" }} loading="lazy" />
          )}
          {source.translation && <p style={{ marginTop: 8, whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.7 }}>{source.translation}</p>}
        </figure>
      ))}
    </div>
  );
}

function QuestionImage({ image }: { image: PracticeImage }) {
  if (!image.src) return null;
  return (
    <figure style={{ borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface-2)", padding: 12 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.src} alt={image.alt} style={{ margin: "0 auto", maxHeight: 520, width: "100%", maxWidth: 760, objectFit: "contain" }} loading="lazy" />
      {image.caption && <figcaption style={{ marginTop: 8, textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--ink-faint)" }}>{image.caption}</figcaption>}
    </figure>
  );
}

function McqBody({ question, answer, checked, showScheme, onAnswer, readOnly }: {
  question: PracticeQuestion; answer?: string; checked: boolean; showScheme: boolean; onAnswer: (value: string) => void; readOnly?: boolean;
}) {
  const correct = question.correctOption;
  const isAnswered = Boolean(answer?.trim());
  return (
    <div className="flex-col gap-16" style={{ display: "flex", padding: "4px 2px" }}>
      <p style={{ whiteSpace: "pre-wrap", fontSize: 18, lineHeight: 1.5, fontFamily: "Fraunces, serif" }}>{question.questionText}</p>
      <SourceNote note={question.sourceNote} />
      <Passages sources={question.sources} />
      {questionImagesOf(question.images).length > 0 && (
        <div className="flex-col gap-12" style={{ display: "flex" }}>
          {questionImagesOf(question.images).map((image, index) => <QuestionImage key={`${question.id}-img-${index}`} image={image} />)}
        </div>
      )}

      {question.options.length >= 2 ? (
        <div className="flex-col gap-10">
          {question.options.map((option) => {
            const selected = answer === option.label;
            const optionCorrect = checked && correct === option.label;
            const optionWrong = checked && selected && correct !== option.label;
            const border = optionCorrect ? "var(--teal)" : optionWrong ? "var(--coral-bright)" : selected && !checked ? "var(--crimson)" : "var(--line-strong)";
            const bg = optionCorrect ? "var(--teal-soft)" : optionWrong ? "var(--coral-soft)" : selected && !checked ? "var(--crimson-soft)" : "var(--surface)";
            return (
              <label key={option.label} className="flex items-center gap-12"
                style={{ padding: "13px 15px", borderRadius: 13, cursor: readOnly ? "default" : "pointer", border: `1.5px solid ${border}`, background: bg, transition: "all .14s" }}>
                <input type="radio" name={question.id} value={option.label} checked={selected} disabled={readOnly} onChange={() => !readOnly && onAnswer(option.label)} style={{ display: "none" }} />
                <span style={{ width: 26, height: 26, borderRadius: 8, display: "grid", placeItems: "center", flex: "none", fontWeight: 600, fontSize: 13,
                  border: `1.5px solid ${selected || optionCorrect ? border : "var(--line-strong)"}`, color: selected || optionCorrect ? border : "var(--ink-faint)" }}>{option.label}</span>
                <span style={{ fontSize: 14.5, flex: 1 }}>{option.text}</span>
                {optionCorrect && <Icon name="check_circle" size={18} style={{ color: "var(--teal-deep)", flex: "none" }} />}
              </label>
            );
          })}
        </div>
      ) : (
        <p style={{ borderRadius: 12, border: "1px dashed var(--line-strong)", background: "var(--surface-2)", padding: 12, fontSize: 12.5, fontWeight: 600, color: "var(--ink-faint)" }}>
          The answer options for this question are shown in the figure above.
        </p>
      )}

      {checked && correct && (
        <div className={"badge " + (isAnswered && answer === correct ? "teal" : isAnswered ? "coral" : "amber")} style={{ fontSize: 13.5, padding: "8px 12px" }}>
          <Icon name={isAnswered && answer === correct ? "check_circle" : isAnswered ? "x" : "alert"} size={16} />
          Correct option: {correct}
        </div>
      )}

      {showScheme && question.markingScheme && (
        <div style={{ borderRadius: 12, border: "1px solid var(--amber-soft)", background: "var(--amber-soft)", padding: 12, fontSize: 14, lineHeight: 1.5, color: "var(--amber-deep)" }}>{question.markingScheme}</div>
      )}
    </div>
  );
}

function StructuredBody({ question, answers, showScheme, onAnswer, readOnly }: {
  question: PracticeQuestion; answers: Record<string, string>; showScheme: boolean; onAnswer: (partKey: string, value: string) => void; readOnly?: boolean;
}) {
  return (
    <div className="flex-col gap-16" style={{ display: "flex", padding: "4px 2px" }}>
      {question.questionText && <p style={{ whiteSpace: "pre-wrap", fontSize: 18, lineHeight: 1.5, fontFamily: "Fraunces, serif" }}>{question.questionText}</p>}
      <SourceNote note={question.sourceNote} />
      {questionImagesOf(question.images).length > 0 && (
        <div className="flex-col gap-12" style={{ display: "flex" }}>
          {questionImagesOf(question.images).map((image, index) => <QuestionImage key={`${question.id}-img-${index}`} image={image} />)}
        </div>
      )}
      <Passages sources={question.sources} />

      {question.parts.length > 0 ? (
        <div className="flex-col gap-16" style={{ display: "flex" }}>
          {question.parts.map((part, index) => {
            const partKey = `${question.id}::${index}`;
            // Lead-in header: introduces the sub-parts below, so no answer box.
            if (isHeaderPart(question.parts, part.label)) {
              return (
                <p key={partKey} style={{ whiteSpace: "pre-wrap", fontSize: 14, fontWeight: 600, lineHeight: 1.5, padding: "0 2px" }}>
                  {part.label && <span style={{ marginRight: 4, color: "var(--crimson)" }}>{part.label}</span>}
                  {part.body}
                </p>
              );
            }
            return (
              <div key={partKey} style={{ borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface-2)", padding: 13 }}>
                <div className="row-between" style={{ alignItems: "baseline" }}>
                  <p style={{ whiteSpace: "pre-wrap", fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>
                    {part.label && <span style={{ marginRight: 4, color: "var(--crimson)" }}>{part.label}</span>}
                    {part.body}
                  </p>
                  {part.marks !== null && <span className="faint" style={{ flex: "none", fontSize: 12, fontWeight: 700 }}>[{part.marks}]</span>}
                </div>
                {!readOnly && (
                  <textarea value={answers[partKey] ?? ""} onChange={(e) => onAnswer(partKey, e.target.value)} placeholder="Write your answer…"
                    className="textarea" style={{ marginTop: 8, minHeight: 90 }} />
                )}
                {showScheme && part.answer && (
                  <div style={{ marginTop: 8, borderRadius: 10, border: "1px solid var(--amber-soft)", background: "var(--amber-soft)", padding: 8, fontSize: 12.5, lineHeight: 1.4, color: "var(--amber-deep)" }}>{part.answer}</div>
                )}
              </div>
            );
          })}
        </div>
      ) : !readOnly ? (
        <textarea value={answers[`${question.id}::0`] ?? ""} onChange={(e) => onAnswer(`${question.id}::0`, e.target.value)} placeholder="Write your answer…" className="textarea" />
      ) : null}

      {showScheme && question.markingScheme && (
        <div style={{ borderRadius: 12, border: "1px solid var(--amber-soft)", background: "var(--amber-soft)", padding: 12, fontSize: 14, lineHeight: 1.5, color: "var(--amber-deep)" }}>{question.markingScheme}</div>
      )}

      {showScheme && answerImagesOf(question.images).length > 0 && (
        <div className="flex-col gap-8" style={{ display: "flex", borderRadius: 12, border: "1px solid var(--amber-soft)", background: "var(--amber-soft)", padding: 12 }}>
          <p className="eyebrow" style={{ color: "var(--amber-deep)" }}>Mark scheme</p>
          {answerImagesOf(question.images).map((image, index) => <QuestionImage key={`${question.id}-ans-${index}`} image={image} />)}
        </div>
      )}
    </div>
  );
}

function QuestionCard(props: {
  question: PracticeQuestion; showYear: boolean; mcqAnswer?: string; partAnswers: Record<string, string>;
  checked: boolean; showScheme: boolean; onMcqAnswer: (value: string) => void; onPartAnswer: (partKey: string, value: string) => void;
  readOnly?: boolean;
}) {
  const { question } = props;
  return (
    <article className="card card-pad flex-col gap-16">
      <div className="row-between wrap" style={{ gap: 10 }}>
        <div className="flex gap-8 wrap items-center">
          <span className="chip-tag badge neutral">Q{question.questionNumber}</span>
          {question.topic && <span className="chip-tag" style={{ background: "var(--crimson-soft)", color: "var(--crimson)" }}><Icon name="hash" size={12} /> {question.topic}</span>}
          {question.theme && <span className="chip-tag badge teal">{question.theme}</span>}
        </div>
        <div className="flex gap-8 items-center faint" style={{ fontSize: 12.5 }}>
          {props.showYear && question.year && <span style={{ fontWeight: 700, color: "var(--crimson)" }}>{question.year}</span>}
          {question.marks !== null && <span>{question.marks} mark{question.marks === 1 ? "" : "s"}</span>}
          {question.session && <span>{question.session.replace(/_/g, " ")}</span>}
          {question.paper && <span>{question.paper.replace(/_/g, " ")}</span>}
        </div>
      </div>
      {question.type === "mcq" ? (
        <McqBody question={question} answer={props.mcqAnswer} checked={props.checked} showScheme={props.showScheme} onAnswer={props.onMcqAnswer} readOnly={props.readOnly} />
      ) : (
        <StructuredBody question={question} answers={props.partAnswers} showScheme={props.showScheme} onAnswer={props.onPartAnswer} readOnly={props.readOnly} />
      )}
    </article>
  );
}

const selectStyle: React.CSSProperties = {
  height: 42, width: "100%", borderRadius: 12, border: "1px solid var(--line-strong)", background: "var(--surface)",
  padding: "0 12px", fontSize: 13.5, fontWeight: 500, color: "var(--ink)", outline: "none",
};

// ---------------------------------------------------------------------------
function PracticeInner() {
  const searchParams = useSearchParams();
  const { getToken } = useAuth();

  const [subjects, setSubjects] = useState<SubjectMeta[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [questionType, setQuestionType] = useState<QuestionType>("mcq");
  const [practiceMode, setPracticeMode] = useState<PracticeMode>("topic");

  // ---- deep link (?subject&year&session&paper&variant) — consumed once ----
  const deepLinkRef = useRef<{ subject: string; year: string; session: string; paper: string; variant: string } | null>(null);
  const deepLinkDoneRef = useRef(false);
  if (!deepLinkDoneRef.current && deepLinkRef.current === null) {
    const subject = searchParams?.get("subject"), year = searchParams?.get("year"),
      session = searchParams?.get("session"), paper = searchParams?.get("paper"), variant = searchParams?.get("variant");
    if (subject && year && session && paper && variant) deepLinkRef.current = { subject, year, session, paper, variant };
    else deepLinkDoneRef.current = true;
  }
  const [openingLink, setOpeningLink] = useState(Boolean(deepLinkRef.current));

  // ---- per-paper practice session (autosaved, resumable) ----
  const [progressMap, setProgressMap] = useState<Map<string, PracticeProgress> | null>(null); // null = still loading
  const [solveMode, setSolveMode] = useState<SolveMode>("digital");
  const [paperStatus, setPaperStatus] = useState<PracticeStatus>("in_progress");
  const [uploads, setUploads] = useState<PracticeUpload[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerDuration, setTimerDuration] = useState(0);
  const [timerStartElapsed, setTimerStartElapsed] = useState(0);
  const [timerNonce, setTimerNonce] = useState(0);
  const timerElapsedRef = useRef(0);
  const restoredKeyRef = useRef<string | null>(null);
  const interactedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtRef = useRef<string | null>(null);
  const hasRowRef = useRef(false);
  const tokenRef = useRef<string | null>(null);

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
    return () => { mounted = false; };
  }, []);

  // ---- saved practice sessions (remote, local fallback) ----
  useEffect(() => {
    let mounted = true;
    loadPracticeProgressList(getToken).then((items) => {
      if (mounted) setProgressMap(new Map(items.map((item) => [item.paperKey, item])));
    });
    getToken().then((token) => { tokenRef.current = token; }).catch(() => {});
    return () => { mounted = false; };
  }, [getToken]);

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
    // reset the per-paper session shell; the restore effect re-hydrates it
    setSolveMode("digital");
    setPaperStatus("in_progress");
    setUploads([]);
    setTimerRunning(false);
    setSavingState("idle");
    restoredKeyRef.current = null;
    interactedRef.current = false;
  }

  // ---- TOPIC mode ----
  useEffect(() => {
    if (practiceMode !== "topic" || !selectedSubject || !selectedTopic) return;
    let mounted = true;
    (async () => {
      setLoadingQuestions(true);
      setError("");
      clearQuestions();
      setTopicTotal(0);
      try {
        const params = new URLSearchParams({ subject: selectedSubject, type: questionType, topic: selectedTopic, mode: "topic", limit: String(TOPIC_PAGE), offset: "0" });
        const response = await fetch(`/api/paper-practice?${params.toString()}`);
        if (!response.ok) throw new Error("Could not load topic questions.");
        const data = (await response.json()) as { questions: PracticeQuestion[]; total: number };
        if (mounted) { setQuestions(data.questions ?? []); setTopicTotal(data.total ?? 0); }
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : "Could not load topic questions.");
      } finally {
        if (mounted) setLoadingQuestions(false);
      }
    })();
    return () => { mounted = false; };
  }, [practiceMode, selectedSubject, questionType, selectedTopic]);

  async function loadMoreTopic() {
    setLoadingMore(true);
    setError("");
    try {
      const params = new URLSearchParams({ subject: selectedSubject, type: questionType, topic: selectedTopic, mode: "topic", limit: String(TOPIC_PAGE), offset: String(questions.length) });
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

  // ---- PAPER mode: available papers ----
  useEffect(() => {
    if (practiceMode !== "paper" || !selectedSubject || !selectedYear) { setPapers([]); return; }
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
    return () => { mounted = false; };
  }, [practiceMode, selectedSubject, questionType, selectedYear]);

  // ---- PAPER mode: load paper ----
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
        const params = new URLSearchParams({ subject: selectedSubject, year: paper.year, session: paper.session, paper: paper.paper, variant: paper.variant });
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
    return () => { mounted = false; };
  }, [practiceMode, selectedPaperKey, papers, selectedSubject]);

  // ---- deep link from Papers: resolve subject + exact paper, then open it ----
  useEffect(() => {
    const link = deepLinkRef.current;
    if (!link || deepLinkDoneRef.current || loadingMeta || subjects.length === 0) return;
    deepLinkDoneRef.current = true;
    (async () => {
      const subjectName = resolveSubjectName(subjects, link.subject);
      if (!subjectName) {
        setOpeningLink(false);
        setError(`"${link.subject}" isn't in the practice bank yet — pick a subject below.`);
        return;
      }
      setSelectedSubject(subjectName);
      setPracticeMode("paper");
      setSelectedYear(link.year);
      try {
        const params = new URLSearchParams({ subject: subjectName, year: link.year, papers: "1" });
        const response = await fetch(`/api/paper-practice?${params.toString()}`);
        const data = response.ok ? ((await response.json()) as { papers: AvailablePaper[] }) : { papers: [] };
        const pool = data.papers ?? [];
        const sameSessionPaper = (p: AvailablePaper) =>
          sessionToken(p.session) === sessionToken(link.session) && digitsOf(p.paper) === digitsOf(link.paper);
        // exact variant first; fall back to session+paper when the bank has no
        // matching variant split (e.g. subjects ingested without variants)
        const match = pool.find((p) => sameSessionPaper(p) && digitsOf(p.variant) === digitsOf(link.variant))
          ?? pool.find(sameSessionPaper);
        if (!match) {
          setOpeningLink(false);
          setError("That exact paper isn't in the practice bank yet — pick one below.");
          return;
        }
        setQuestionType(match.isMcq ? "mcq" : "structured");
        setSelectedPaperKey(match.key);
        setOpeningLink(false);
      } catch {
        setOpeningLink(false);
        setError("Could not open that paper automatically — pick it below.");
      }
    })();
  }, [loadingMeta, subjects]);

  const displayQuestions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const filtered = questions.filter((q) => matchesQuery(q, trimmed));
    return [...filtered].sort((a, b) => {
      if (practiceMode === "topic") {
        return Number.parseInt(b.year, 10) - Number.parseInt(a.year, 10) || questionNumberValue(a.questionNumber) - questionNumberValue(b.questionNumber);
      }
      return questionNumberValue(a.questionNumber) - questionNumberValue(b.questionNumber) || a.questionNumber.localeCompare(b.questionNumber, undefined, { numeric: true });
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
  const hasScheme = displayQuestions.some((q) => q.markingScheme || q.parts.some((p) => p.answer) || q.images.some((i) => i.role === "answer"));

  const ready = practiceMode === "topic" ? Boolean(selectedSubject && selectedTopic) : Boolean(selectedSubject && selectedPaperKey);
  const selectedPaper = papers.find((p) => p.key === selectedPaperKey) ?? null;

  /* ================= per-paper practice session ================= */

  const currentPaperKey = practiceMode === "paper" && selectedPaper && selectedSubject
    ? makePaperKey(selectedSubject, selectedPaper.year, selectedPaper.session, selectedPaper.paper, selectedPaper.variant)
    : null;

  // answerable units for the progress bar (header parts introduce sub-parts, so they don't count)
  const { totalUnits, answeredUnits } = useMemo(() => {
    let total = 0, answered = 0;
    for (const q of questions) {
      if (q.type === "mcq") {
        total += 1;
        if (mcqAnswers[q.id]?.trim()) answered += 1;
      } else if (q.parts.length) {
        q.parts.forEach((part, index) => {
          if (isHeaderPart(q.parts, part.label)) return;
          total += 1;
          if (partAnswers[`${q.id}::${index}`]?.trim()) answered += 1;
        });
      } else {
        total += 1;
        if (partAnswers[`${q.id}::0`]?.trim()) answered += 1;
      }
    }
    return { totalUnits: total, answeredUnits: answered };
  }, [questions, mcqAnswers, partAnswers]);

  const buildDoc = useCallback((overrides?: Partial<Pick<PracticeProgress, "status" | "solveMode">>): PracticeProgress | null => {
    if (!currentPaperKey || !selectedPaper || !selectedSubject) return null;
    return {
      paperKey: currentPaperKey,
      subject: selectedSubject,
      year: selectedPaper.year,
      session: selectedPaper.session,
      paper: selectedPaper.paper,
      variant: selectedPaper.variant,
      isMcq: selectedPaper.isMcq,
      solveMode: overrides?.solveMode ?? solveMode,
      status: overrides?.status ?? paperStatus,
      answers: { mcq: pruneAnswers(mcqAnswers), parts: pruneAnswers(partAnswers) },
      uploads, // informational — the server keeps its own copy authoritative
      answeredCount: answeredUnits,
      totalCount: totalUnits,
      timerDurationSeconds: timerDuration,
      timerElapsedSeconds: timerElapsedRef.current,
      startedAt: startedAtRef.current ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [currentPaperKey, selectedPaper, selectedSubject, solveMode, paperStatus, mcqAnswers, partAnswers, uploads, answeredUnits, totalUnits, timerDuration]);

  const doSave = useCallback(async (overrides?: Partial<Pick<PracticeProgress, "status" | "solveMode">>) => {
    const doc = buildDoc(overrides);
    if (!doc) return;
    setSavingState("saving");
    getToken().then((token) => { tokenRef.current = token; }).catch(() => {});
    try {
      const saved = await savePracticeProgress(doc, getToken);
      startedAtRef.current = saved.startedAt;
      hasRowRef.current = true;
      setUploads(saved.uploads ?? []);
      setProgressMap((prev) => { const next = new Map(prev ?? []); next.set(saved.paperKey, saved); return next; });
      setSavingState("saved");
    } catch {
      setSavingState("error");
    }
  }, [buildDoc, getToken]);

  // restore a saved session (or start a fresh one) once the paper's questions arrive
  useEffect(() => {
    if (practiceMode !== "paper" || !currentPaperKey || loadingQuestions || questions.length === 0) return;
    if (progressMap === null) return; // wait for the saved-session list
    if (restoredKeyRef.current === currentPaperKey) return;
    restoredKeyRef.current = currentPaperKey;
    interactedRef.current = false;

    const saved = progressMap.get(currentPaperKey);
    const fallbackDuration = paperDurationSeconds(selectedSubject, selectedPaper?.paper ?? "", selectedPaper?.isMcq ?? false);
    if (saved) {
      setMcqAnswers(saved.answers?.mcq ?? {});
      setPartAnswers(saved.answers?.parts ?? {});
      setSolveMode(saved.solveMode);
      setPaperStatus(saved.status);
      setUploads(saved.uploads ?? []);
      setTimerDuration(saved.timerDurationSeconds || fallbackDuration);
      timerElapsedRef.current = saved.timerElapsedSeconds || 0;
      setTimerStartElapsed(saved.timerElapsedSeconds || 0);
      setTimerRunning(saved.status !== "completed" && saved.solveMode === "digital");
      startedAtRef.current = saved.startedAt;
      hasRowRef.current = true;
      setSavingState("saved");
    } else {
      setTimerDuration(fallbackDuration);
      timerElapsedRef.current = 0;
      setTimerStartElapsed(0);
      setTimerRunning(true); // the paper is open — the exam clock starts
      startedAtRef.current = null;
      hasRowRef.current = false;
      setSavingState("idle");
    }
    setTimerNonce((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceMode, currentPaperKey, loadingQuestions, questions, progressMap]);

  // debounced autosave whenever the student's work changes
  useEffect(() => {
    if (!currentPaperKey || restoredKeyRef.current !== currentPaperKey || !interactedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { void doSave(); }, 900);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [mcqAnswers, partAnswers, solveMode, paperStatus, currentPaperKey, doSave]);

  // persist the ticking clock every 30s while running (only once a row exists)
  useEffect(() => {
    if (!timerRunning || !currentPaperKey) return;
    const id = setInterval(() => { if (hasRowRef.current) void doSave(); }, 30_000);
    return () => clearInterval(id);
  }, [timerRunning, currentPaperKey, doSave]);

  // flush on tab close / hide so nothing typed is ever lost
  useEffect(() => {
    const flush = () => {
      if (!currentPaperKey || restoredKeyRef.current !== currentPaperKey) return;
      if (!interactedRef.current && !hasRowRef.current) return;
      const doc = buildDoc();
      if (doc) void savePracticeProgress(doc, undefined, { keepalive: true, tokenOverride: tokenRef.current });
    };
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [buildDoc, currentPaperKey]);

  function changeSolveMode(mode: SolveMode) {
    if (mode === solveMode) return;
    interactedRef.current = true;
    setSolveMode(mode);
    setTimerRunning(mode === "digital" && paperStatus !== "completed");
    void doSave({ solveMode: mode });
  }

  function toggleCompleted() {
    interactedRef.current = true;
    const next: PracticeStatus = paperStatus === "completed" ? "in_progress" : "completed";
    setPaperStatus(next);
    setTimerRunning(next !== "completed" && solveMode === "digital");
    void doSave({ status: next });
  }

  function handleTimerToggle() {
    const next = !timerRunning;
    setTimerRunning(next);
    if (!next && hasRowRef.current) void doSave();
  }

  async function handleFiles(list: FileList | null) {
    if (!list || !currentPaperKey) return;
    const files = Array.from(list).slice(0, 6);
    setUploadBusy(true);
    setError("");
    try {
      for (const file of files) {
        if (file.size > 15 * 1024 * 1024) throw new Error(`${file.name} is larger than 15 MB`);
        const item = await uploadPracticeFile(currentPaperKey, file, getToken);
        if (item) {
          setUploads(item.uploads ?? []);
          setProgressMap((prev) => { const next = new Map(prev ?? []); next.set(item.paperKey, item); return next; });
          hasRowRef.current = true;
          startedAtRef.current = item.startedAt;
          setSavingState("saved");
        }
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  }

  async function handleRemoveUpload(path: string) {
    if (!currentPaperKey) return;
    setUploads((prev) => prev.filter((u) => u.path !== path));
    const item = await removePracticeUpload(currentPaperKey, path, getToken);
    if (item) {
      setUploads(item.uploads ?? []);
      setProgressMap((prev) => { const next = new Map(prev ?? []); next.set(item.paperKey, item); return next; });
    }
  }

  function handleSubjectChange(name: string) { setSelectedSubject(name); setSelectedTopic(""); setSelectedYear(""); setSelectedPaperKey(""); setQuery(""); clearQuestions(); }
  function handleTypeChange(type: QuestionType) { setQuestionType(type); setSelectedTopic(""); setSelectedYear(""); setSelectedPaperKey(""); setQuery(""); clearQuestions(); }
  function handleModeChange(mode: PracticeMode) { setPracticeMode(mode); setSelectedTopic(""); setSelectedYear(""); setSelectedPaperKey(""); setQuery(""); clearQuestions(); }
  function handleYearChange(year: string) { setSelectedYear(year); setSelectedPaperKey(""); setQuery(""); clearQuestions(); }

  function resetPractice() {
    const wipesSaved = practiceMode === "paper" && currentPaperKey && hasRowRef.current;
    if (wipesSaved && !window.confirm("Clear your answers and saved progress for this paper?")) return;
    setMcqAnswers({}); setPartAnswers({}); setChecked(false); setShowScheme(false);
    if (practiceMode === "paper" && currentPaperKey) {
      setPaperStatus("in_progress");
      setTimerDuration(paperDurationSeconds(selectedSubject, selectedPaper?.paper ?? "", selectedPaper?.isMcq ?? false));
      timerElapsedRef.current = 0;
      setTimerStartElapsed(0);
      setTimerNonce((n) => n + 1);
      setTimerRunning(solveMode === "digital");
      interactedRef.current = false;
      if (hasRowRef.current) {
        void deletePracticeProgress(currentPaperKey, getToken);
        setProgressMap((prev) => { const next = new Map(prev ?? []); next.delete(currentPaperKey); return next; });
        hasRowRef.current = false;
        startedAtRef.current = null;
        setUploads([]);
        setSavingState("idle");
      }
    }
  }

  const summary = practiceMode === "topic"
    ? `${selectedSubject} · ${questionType === "mcq" ? "MCQs" : "Paper questions"} · ${selectedTopic}`
    : selectedPaper
      ? `${selectedSubject} · ${selectedPaper.year} · ${selectedPaper.session.replace(/_/g, " ")} · ${selectedPaper.paper.replace(/_/g, " ")} · ${selectedPaper.variant.replace(/_/g, " ")}`
      : `${selectedSubject} · ${selectedYear || "—"}`;

  return (
    <div className="pr">
      <div className="main flex-col gap-24">
        {/* Header */}
        <div className="row-between wrap" style={{ gap: 14, alignItems: "flex-end" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 12 }}>O-Level question bank</div>
            <h1 style={{ fontSize: "clamp(26px,3.5vw,36px)" }}>Practice</h1>
            <p className="muted mt-6" style={{ maxWidth: 560 }}>
              Drill every unique question across all years by topic, or load a complete past paper exactly as it was sat.
            </p>
          </div>

          {ready && (
            <div className="card" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", padding: 6, gap: 2 }}>
              {[
                { label: "Questions", value: practiceMode === "topic" ? topicTotal : displayQuestions.length },
                { label: "Answered", value: answeredCount },
                { label: "Score", value: questionType === "mcq" && checked ? `${score}/${gradable.length}` : "—" },
              ].map((stat) => (
                <div key={stat.label} style={{ padding: "8px 14px" }}>
                  <div className="eyebrow">{stat.label}</div>
                  <div className="big-num" style={{ fontSize: 22 }}>{stat.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="badge coral" style={{ fontSize: 13.5, padding: "10px 14px", alignSelf: "flex-start" }}>
            <Icon name="alert" size={16} /> {error}
          </div>
        )}

        {/* Filter card */}
        <div className="card card-pad">
          {loadingMeta ? (
            <div className="flex items-center justify-center gap-8" style={{ minHeight: 120, color: "var(--ink-faint)", display: "flex" }}>
              <Icon name="refresh" size={16} className="spin" /> Loading practice library…
            </div>
          ) : (
            <div className="flex-col gap-16">
              <div className="flex gap-12 wrap items-end">
                {/* Subject */}
                <label style={{ flex: "1 1 200px", minWidth: 180 }}>
                  <span className="eyebrow" style={{ marginBottom: 6 }}>Subject</span>
                  <select value={selectedSubject} onChange={(e) => handleSubjectChange(e.target.value)} style={selectStyle}>
                    <option value="">Select subject</option>
                    {subjects.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </select>
                </label>

                {/* Type */}
                <div>
                  <span className="eyebrow" style={{ marginBottom: 6, display: "block" }}>Question type</span>
                  <Segmented value={questionType} onChange={(v) => handleTypeChange(v)}
                    options={[{ value: "structured", label: "Questions", icon: "file_text" }, { value: "mcq", label: "MCQs", icon: "list" }]} />
                </div>

                {/* Mode */}
                <div>
                  <span className="eyebrow" style={{ marginBottom: 6, display: "block" }}>Practice mode</span>
                  <Segmented value={practiceMode} onChange={(v) => handleModeChange(v)}
                    options={[{ value: "topic", label: "By topic", icon: "sparkles" }, { value: "paper", label: "Full paper", icon: "book" }]} />
                </div>
              </div>

              <div className="flex gap-12 wrap items-end">
                {/* Mode-specific selectors */}
                {practiceMode === "topic" ? (
                  <label style={{ flex: "1 1 240px", minWidth: 200 }}>
                    <span className="eyebrow" style={{ marginBottom: 6 }}>Topic</span>
                    <select value={selectedTopic} onChange={(e) => setSelectedTopic(e.target.value)} disabled={!currentSubject || loadingQuestions} style={selectStyle}>
                      <option value="">Select a topic</option>
                      {availableTopics.map((t) => <option key={t.name} value={t.name}>{t.name} ({t.count})</option>)}
                    </select>
                  </label>
                ) : (
                  <>
                    <label style={{ flex: "0 0 130px" }}>
                      <span className="eyebrow" style={{ marginBottom: 6 }}>Year</span>
                      <select value={selectedYear} onChange={(e) => handleYearChange(e.target.value)} disabled={!currentSubject} style={selectStyle}>
                        <option value="">Year</option>
                        {availableYears.map((y) => <option key={y.year} value={y.year}>{y.year}</option>)}
                      </select>
                    </label>
                    <label style={{ flex: "1 1 220px", minWidth: 180 }}>
                      <span className="eyebrow" style={{ marginBottom: 6 }}>Paper</span>
                      <select value={selectedPaperKey} onChange={(e) => setSelectedPaperKey(e.target.value)} disabled={!selectedYear || papers.length === 0 || loadingQuestions} style={selectStyle}>
                        <option value="">{selectedYear ? "Select paper" : "Pick year first"}</option>
                        {papers.map((p) => <option key={p.key} value={p.key}>{p.session.replace(/_/g, " ")} · {p.paper.replace(/_/g, " ")} · {p.variant.replace(/_/g, " ")} ({p.count})</option>)}
                      </select>
                    </label>
                  </>
                )}

                {/* Search */}
                <label style={{ flex: "1 1 200px", minWidth: 180 }}>
                  <span className="eyebrow" style={{ marginBottom: 6 }}>Find</span>
                  <div className="search">
                    <Icon name="search" size={16} className="faint" />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} disabled={!ready || loadingQuestions} placeholder="Search questions" />
                  </div>
                </label>
              </div>

              {ready && (
                <div className="row-between wrap" style={{ gap: 12, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
                  <p className="flex items-center gap-8 muted" style={{ fontSize: 13.5 }}>
                    <Icon name={practiceMode === "topic" ? "sparkles" : "file_text"} size={15} style={{ color: "var(--crimson)" }} />
                    {summary}
                    {practiceMode === "topic"
                      ? topicTotal > 0 && <span className="faint">· {displayQuestions.length} of {topicTotal} unique across all years</span>
                      : displayQuestions.length > 0 && <span className="faint">· {displayQuestions.length} question{displayQuestions.length === 1 ? "" : "s"}</span>}
                  </p>
                  <div className="flex gap-8 wrap items-center">
                    {questionType === "mcq" && (
                      <button onClick={() => setChecked(true)} disabled={gradable.length === 0} className="btn btn-primary">
                        <Icon name="check_circle" size={16} /> Check
                      </button>
                    )}
                    <button onClick={resetPractice} className="icon-btn" title="Reset answers" style={{ border: "1px solid var(--line-strong)" }}>
                      <Icon name="rotate" size={17} />
                    </button>
                    {hasScheme && (
                      <button onClick={() => setShowScheme((v) => !v)} className={"btn " + (showScheme ? "btn-soft" : "btn-secondary")}>
                        <Icon name="shield" size={15} /> {questionType === "mcq" ? "Marking scheme" : "Answers"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Paper session bar — solve-mode toggle, exam timer, progress, completion */}
        {practiceMode === "paper" && ready && selectedPaper && !loadingQuestions && displayQuestions.length > 0 && (
          <div className="card" style={{ position: "sticky", top: 8, zIndex: 30, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", padding: "10px 16px" }}>
            <div className="flex items-center gap-12 wrap">
              <Segmented value={solveMode} onChange={changeSolveMode}
                options={[{ value: "digital", label: "Solve here", icon: "pencil" }, { value: "handwritten", label: "Upload handwritten", icon: "upload" }]} />
              <TimerChip key={`${currentPaperKey}|${timerNonce}`} running={timerRunning} durationSeconds={timerDuration}
                initialElapsed={timerStartElapsed} onToggle={handleTimerToggle} onTick={(value) => { timerElapsedRef.current = value; }} />
            </div>
            <div className="flex items-center gap-12 wrap">
              {solveMode === "digital" ? (
                <div className="flex items-center gap-8">
                  <span className="faint" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{answeredUnits}/{totalUnits} answered</span>
                  <div style={{ width: 72 }}><Bar value={totalUnits ? Math.round((answeredUnits / totalUnits) * 100) : 0} tone="teal" height={6} /></div>
                </div>
              ) : (
                <span className="faint" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{uploads.length} file{uploads.length === 1 ? "" : "s"} uploaded</span>
              )}
              <span className="faint" style={{ fontSize: 11.5, minWidth: 54, textAlign: "right" }}>
                {savingState === "saving" ? "Saving…" : savingState === "saved" ? "Saved ✓" : savingState === "error" ? "Offline" : ""}
              </span>
              {paperStatus === "completed" ? (
                <button className="btn btn-soft btn-sm" onClick={toggleCompleted} title="Mark as in progress again">
                  <Icon name="check_circle" size={14} /> Completed
                </button>
              ) : (
                <button className="btn btn-primary btn-sm" onClick={toggleCompleted}>
                  <Icon name="check_circle" size={14} /> Mark completed
                </button>
              )}
            </div>
          </div>
        )}

        {/* Handwritten mode — upload the solved paper instead of typing */}
        {practiceMode === "paper" && ready && solveMode === "handwritten" && !loadingQuestions && displayQuestions.length > 0 && (
          <div className="card card-pad flex-col gap-12" style={{ display: "flex" }}>
            <div className="flex items-center gap-10">
              <div style={{ width: 38, height: 38, borderRadius: 11, background: "var(--crimson-soft)", color: "var(--crimson)", display: "grid", placeItems: "center" }}>
                <Icon name="camera" size={19} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14.5 }}>Handwritten attempt</div>
                <div className="faint" style={{ fontSize: 12.5 }}>Solve on paper, then photograph or scan your full attempt and upload it — it stays attached to this paper.</div>
              </div>
            </div>
            <label className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-start", cursor: uploadBusy ? "wait" : "pointer" }}>
              <input type="file" accept="image/*,application/pdf" multiple style={{ display: "none" }} disabled={uploadBusy}
                onChange={(e) => { void handleFiles(e.target.files); e.currentTarget.value = ""; }} />
              {uploadBusy ? <><Icon name="refresh" size={14} className="spin" /> Uploading…</> : <><Icon name="upload" size={14} /> Add photos / PDF</>}
            </label>
            {uploads.length > 0 && (
              <div className="flex-col" style={{ gap: 6 }}>
                {uploads.map((file) => (
                  <div key={file.path} className="flex items-center gap-10" style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface-2)" }}>
                    <Icon name="file_text" size={16} style={{ color: "var(--crimson)", flex: "none" }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
                    <span className="faint" style={{ fontSize: 11.5, flex: "none" }}>{Math.max(1, Math.round(file.size / 1024))} KB</span>
                    {file.url && (
                      <a href={file.url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ flex: "none", padding: "4px 8px" }}>
                        <Icon name="eye" size={14} /> View
                      </a>
                    )}
                    <button className="icon-btn" aria-label={`Remove ${file.name}`} onClick={() => void handleRemoveUpload(file.path)}
                      style={{ width: 28, height: 28, flex: "none" }}>
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Questions */}
        <div className="flex-col gap-16">
          {openingLink ? (
            <div className="card flex items-center justify-center gap-8" style={{ minHeight: 320, color: "var(--ink-faint)", display: "flex" }}>
              <Icon name="refresh" size={16} className="spin" /> Opening your paper…
            </div>
          ) : loadingQuestions ? (
            <div className="card flex items-center justify-center gap-8" style={{ minHeight: 320, color: "var(--ink-faint)", display: "flex" }}>
              <Icon name="refresh" size={16} className="spin" /> Loading questions…
            </div>
          ) : !ready ? (
            <div className="card">
              <EmptyState icon="file_text" title="Nothing selected yet"
                body={practiceMode === "topic" ? "Pick a subject, question type and topic to start drilling." : "Pick a subject, year and a paper to load the full paper."} />
            </div>
          ) : displayQuestions.length > 0 ? (
            <>
              {practiceMode === "topic" && (
                <div className="flex items-center gap-8 card" style={{ padding: "10px 16px", fontSize: 12.5, color: "var(--ink-soft)" }}>
                  <Icon name="layers" size={14} style={{ color: "var(--crimson)" }} />
                  Deduplicated — each unique question is shown once, even if it appeared in several years or variants.
                </div>
              )}
              {displayQuestions.map((question) => (
                <QuestionCard key={question.id} question={question} showYear={practiceMode === "topic"}
                  mcqAnswer={mcqAnswers[question.id]} partAnswers={partAnswers} checked={checked} showScheme={showScheme}
                  readOnly={practiceMode === "paper" && solveMode === "handwritten"}
                  onMcqAnswer={(value) => { interactedRef.current = true; setMcqAnswers((c) => ({ ...c, [question.id]: value })); }}
                  onPartAnswer={(partKey, value) => { interactedRef.current = true; setPartAnswers((c) => ({ ...c, [partKey]: value })); }} />
              ))}

              {practiceMode === "topic" && questions.length < topicTotal && !query.trim() && (
                <button onClick={loadMoreTopic} disabled={loadingMore} className="btn btn-secondary btn-block" style={{ height: 48 }}>
                  {loadingMore ? <><Icon name="refresh" size={16} className="spin" /> Loading…</> : `Load more (${questions.length} of ${topicTotal})`}
                </button>
              )}
            </>
          ) : (
            <div className="card">
              <EmptyState icon="search" title="No questions found" body="Try another topic, paper, or search term." />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- exam countdown chip: ticks locally, reports elapsed via onTick ---- */
function TimerChip({ running, durationSeconds, initialElapsed, onToggle, onTick }: {
  running: boolean; durationSeconds: number; initialElapsed: number;
  onToggle: () => void; onTick: (elapsed: number) => void;
}) {
  const [elapsed, setElapsed] = useState(initialElapsed);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((current) => { const next = current + 1; onTick(next); return next; }), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const remaining = durationSeconds - elapsed;
  const over = remaining < 0;
  const tone = over ? "var(--coral-bright)" : "var(--crimson)";
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 38, padding: "0 6px 0 12px", borderRadius: 12,
      border: `1px solid ${over ? "var(--coral-bright)" : "var(--line-strong)"}`, background: over ? "var(--coral-soft)" : "var(--surface)" }}>
      <Icon name="clock" size={15} style={{ color: tone }} />
      <span style={{ fontWeight: 700, fontSize: 14, fontVariantNumeric: "tabular-nums", color: over ? "var(--coral-bright)" : "var(--ink)" }}>
        {over ? `+${clockLabel(-remaining)}` : clockLabel(remaining)}
      </span>
      <span className="faint" style={{ fontSize: 11, whiteSpace: "nowrap" }}>/ {durationLabel(durationSeconds)}</span>
      <button className="icon-btn" onClick={onToggle} aria-label={running ? "Pause timer" : "Start timer"}
        style={{ width: 26, height: 26, border: "1px solid var(--line)" }}>
        <Icon name={running ? "pause" : "play"} size={12} />
      </button>
    </div>
  );
}

export default function PaperPracticePage() {
  return (
    <Suspense fallback={null}>
      <PracticeInner />
    </Suspense>
  );
}
