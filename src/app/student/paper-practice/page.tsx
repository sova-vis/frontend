"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Icon } from "@/components/propel/Icon";
import { Segmented, EmptyState, Bar } from "@/components/propel/primitives";
import {
  PracticeProgress, PracticeUpload, PracticeReport, GradedQuestion, MarkCategory, SolveMode, PracticeStatus,
  loadPracticeProgressList, savePracticeProgress, deletePracticeProgress,
  uploadPracticeFile, removePracticeUpload, makePaperKey, prettyPaperName,
} from "@/lib/practiceProgress";
import { logAttempts, attemptsFromReport, attemptFromMcq, attemptFromGraded } from "@/lib/insights";
import { gradePractice, gradeOneQuestion, gradeOneImage, downloadReport, verdictColor, GradeQuestionInput } from "@/lib/practiceGrading";
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

// Renders a mark scheme as a structured bullet list (falls back to a paragraph
// when it's a single point). Cambridge schemes separate points with ; or newlines.
function SchemeList({ text, label }: { text: string; label?: string }) {
  const raw = (text || "").trim();
  if (!raw) return null;
  const points = raw
    .split(/\r?\n+|\s*;\s+|\s*•\s*/)
    .map((p) => p.replace(/^[-•\d.)\s]+/, "").trim())
    .filter(Boolean);
  return (
    <div style={{ borderRadius: 12, border: "1px solid var(--amber-soft)", background: "var(--amber-soft)", padding: 12 }}>
      {label && <p className="eyebrow" style={{ color: "var(--amber-deep)", marginBottom: 6 }}>{label}</p>}
      {points.length > 1 ? (
        <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
          {points.map((p, i) => <li key={i} style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--amber-deep)" }}>{p}</li>)}
        </ul>
      ) : (
        <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--amber-deep)" }}>{points[0] || raw}</p>
      )}
    </div>
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
                {/* clear "your pick" marker before checking */}
                {selected && !checked && <span className="badge crimson" style={{ fontSize: 10.5, flex: "none" }}>Your pick</span>}
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
          {isAnswered && answer === correct
            ? "Correct"
            : isAnswered
              ? `Incorrect — Correct answer: ${correct}`
              : `Not answered — Correct answer: ${correct}`}
        </div>
      )}

      {/* bridge a wrong answer into Ask AI */}
      {checked && isAnswered && correct && answer !== correct && (
        <Link href={`/student/ask?q=${encodeURIComponent(`Why is the correct answer "${correct}" for this question? ${question.questionText}`)}`}
          className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }}>
          <Icon name="message" size={14} /> Ask AI why {correct} is correct
        </Link>
      )}

      {/* mark scheme stays hidden until the question is checked/submitted */}
      {showScheme && checked && question.markingScheme && <SchemeList text={question.markingScheme} />}
    </div>
  );
}

function StructuredBody({ question, answers, showScheme, onAnswer, readOnly, schemeUnlocked }: {
  question: PracticeQuestion; answers: Record<string, string>; showScheme: boolean; onAnswer: (partKey: string, value: string) => void; readOnly?: boolean;
  schemeUnlocked?: boolean;
}) {
  // the model answer / mark scheme must stay hidden until the question is marked
  const revealScheme = showScheme && schemeUnlocked;
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
                {revealScheme && part.answer && (
                  <div style={{ marginTop: 8 }}><SchemeList text={part.answer} /></div>
                )}
              </div>
            );
          })}
        </div>
      ) : !readOnly ? (
        <textarea value={answers[`${question.id}::0`] ?? ""} onChange={(e) => onAnswer(`${question.id}::0`, e.target.value)} placeholder="Write your answer…" className="textarea" />
      ) : null}

      {revealScheme && question.markingScheme && <SchemeList text={question.markingScheme} label="Mark scheme" />}

      {revealScheme && answerImagesOf(question.images).length > 0 && (
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
  readOnly?: boolean; onGradeOne?: () => void; gradeResult?: GradedQuestion; gradingOne?: boolean;
  onGradeImage?: (file: File) => void; topicMode?: "type" | "upload"; schemeUnlocked?: boolean;
  collapsed?: boolean; onToggleCollapsed?: () => void;
}) {
  const { question } = props;
  const topicUpload = Boolean(props.onGradeOne) && props.topicMode === "upload";
  const collapsed = Boolean(props.collapsed);

  // per-card status badge so a long list is scannable at a glance
  const isMcq = question.type === "mcq";
  const mcqPicked = Boolean(props.mcqAnswer?.trim());
  const anyPart = question.parts.length
    ? question.parts.some((_, i) => Boolean(props.partAnswers[`${question.id}::${i}`]?.trim()))
    : Boolean(props.partAnswers[`${question.id}::0`]?.trim());
  let statusLabel = "Unanswered", statusTone = "neutral";
  if (isMcq) {
    if (props.checked && mcqPicked) {
      const right = props.mcqAnswer === question.correctOption;
      statusLabel = right ? "Correct" : "Incorrect"; statusTone = right ? "teal" : "coral";
    } else if (mcqPicked) { statusLabel = "Answered"; statusTone = "amber"; }
  } else if (props.gradeResult) {
    statusLabel = `${props.gradeResult.earned}/${props.gradeResult.max} marks`;
    statusTone = props.gradeResult.verdict === "correct" ? "teal" : props.gradeResult.verdict === "unanswered" ? "neutral" : props.gradeResult.verdict === "partial" ? "amber" : "coral";
  } else if (anyPart) { statusLabel = "Answered"; statusTone = "amber"; }

  // answerable sub-parts (excludes lead-in headers) — for the "Mark N of M" state
  const answerableParts = question.parts.length
    ? question.parts.map((p, i) => i).filter((i) => !isHeaderPart(question.parts, question.parts[i].label))
    : [0];
  const totalParts = answerableParts.length || 1;
  const answeredParts = question.parts.length
    ? answerableParts.filter((i) => Boolean(props.partAnswers[`${question.id}::${i}`]?.trim())).length
    : (Boolean(props.partAnswers[`${question.id}::0`]?.trim()) ? 1 : 0);

  return (
    <article className="card card-pad flex-col gap-16">
      <div className="row-between wrap" style={{ gap: 10, cursor: collapsed ? "pointer" : "default" }}
        onClick={collapsed ? props.onToggleCollapsed : undefined}>
        <div className="flex gap-8 wrap items-center">
          <span className="chip-tag badge neutral">Q{question.questionNumber}</span>
          <span className={"badge " + statusTone} style={{ fontSize: 11 }}>{statusLabel}</span>
          {question.topic && <span className="chip-tag" style={{ background: "var(--crimson-soft)", color: "var(--crimson)" }}><Icon name="hash" size={12} /> {question.topic}</span>}
          {question.theme && <span className="chip-tag badge teal">{question.theme}</span>}
        </div>
        <div className="flex gap-8 items-center faint" style={{ fontSize: 12.5 }}>
          {props.showYear && question.year && <span style={{ fontWeight: 700, color: "var(--crimson)" }}>{question.year}</span>}
          {question.marks !== null && <span>{question.marks} mark{question.marks === 1 ? "" : "s"}</span>}
          {question.session && <span>{question.session.replace(/_/g, " ")}</span>}
          {question.paper && <span>{question.paper.replace(/_/g, " ")}</span>}
          {props.onToggleCollapsed && (
            <button className="icon-btn" onClick={(e) => { e.stopPropagation(); props.onToggleCollapsed?.(); }}
              aria-label={collapsed ? "Expand question" : "Collapse question"} title={collapsed ? "Expand" : "Collapse (solved)"}
              style={{ width: 28, height: 28, border: "1px solid var(--line)", flex: "none" }}>
              <Icon name={collapsed ? "chevron_right" : "chevron_down"} size={15} />
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <>
          {question.type === "mcq" ? (
            <McqBody question={question} answer={props.mcqAnswer} checked={props.checked} showScheme={props.showScheme} onAnswer={props.onMcqAnswer} readOnly={props.readOnly} />
          ) : (
            // topic upload mode hides the answer boxes — you answer by uploading a photo
            <StructuredBody question={question} answers={props.partAnswers} showScheme={props.showScheme} onAnswer={props.onPartAnswer} readOnly={props.readOnly || topicUpload} schemeUnlocked={props.schemeUnlocked} />
          )}

          {/* per-question AI marking (topic drills): solve here, or upload a photo */}
          {props.onGradeOne && (
            <div className="flex-col gap-10">
              {topicUpload ? (
                <QuestionUploadBox busy={Boolean(props.gradingOne)} onFile={(file) => props.onGradeImage?.(file)} graded={Boolean(props.gradeResult)} />
              ) : (
                <button className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-start" }} onClick={props.onGradeOne} disabled={props.gradingOne}>
                  {props.gradingOne
                    ? <><Icon name="refresh" size={14} className="spin" /> Marking…</>
                    : <><Icon name="award" size={14} /> {props.gradeResult ? "Re-mark my answer" : totalParts > 1 ? `Mark my answer · ${answeredParts}/${totalParts}` : "Mark my answer"}</>}
                </button>
              )}
            </div>
          )}

          {/* marking result — topic drill, or a reopened graded paper (D) — with part-wise model answers (C) */}
          {props.gradeResult && <QuestionResultRow q={props.gradeResult} parts={question.parts} />}
        </>
      )}
    </article>
  );
}

/* ---- small dotted upload box for a single topic question's handwritten answer ---- */
function QuestionUploadBox({ busy, graded, onFile }: { busy: boolean; graded: boolean; onFile: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pick = (files: FileList | null) => { const file = files?.[0]; if (file) onFile(file); };
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!busy) setDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
      onDrop={(e) => { e.preventDefault(); setDragging(false); if (!busy) pick(e.dataTransfer.files); }}
      onClick={() => { if (!busy) inputRef.current?.click(); }}
      style={{ width: "100%", maxWidth: 420, cursor: busy ? "wait" : "pointer", padding: "18px 20px",
        display: "grid", placeItems: "center", textAlign: "center", borderRadius: 12,
        border: `2px dashed ${dragging ? "var(--crimson)" : "var(--line-strong)"}`,
        background: dragging ? "var(--crimson-soft)" : "var(--surface)", transition: "all .15s" }}
    >
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} disabled={busy}
        onChange={(e) => { pick(e.target.files); e.currentTarget.value = ""; }} />
      <div className="flex items-center gap-8" style={{ color: "var(--ink-soft)", fontSize: 13, fontWeight: 500 }}>
        <Icon name={busy ? "refresh" : graded ? "check_circle" : "upload"} size={16} className={busy ? "spin" : ""} style={{ color: "var(--crimson)" }} />
        {busy ? "Marking your answer…" : graded ? "Upload another photo to re-mark" : "Upload a photo of your answer"}
      </div>
      <div className="faint" style={{ fontSize: 11, marginTop: 5 }}>JPG or PNG · maximum 15 MB</div>
    </div>
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
  // topic deep link (?subject&topic) from the Daily Plan / revision items
  const topicLinkRef = useRef<{ subject: string; topic: string } | null>(null);
  const topicLinkDoneRef = useRef(false);
  if (!topicLinkDoneRef.current && topicLinkRef.current === null && !deepLinkRef.current) {
    const subject = searchParams?.get("subject"), topic = searchParams?.get("topic");
    if (subject && topic) topicLinkRef.current = { subject, topic };
    else topicLinkDoneRef.current = true;
  }
  const [openingLink, setOpeningLink] = useState(Boolean(deepLinkRef.current));

  // ---- per-paper practice session (autosaved, resumable) ----
  const [progressMap, setProgressMap] = useState<Map<string, PracticeProgress> | null>(null); // null = still loading
  const [solveMode, setSolveMode] = useState<SolveMode>("digital");
  const [paperStatus, setPaperStatus] = useState<PracticeStatus>("in_progress");
  const [uploads, setUploads] = useState<PracticeUpload[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string>("");
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false); // the exam clock never auto-starts
  const [timerDuration, setTimerDuration] = useState(0);
  const [timerStartElapsed, setTimerStartElapsed] = useState(0);
  const [timerNonce, setTimerNonce] = useState(0);
  const timerElapsedRef = useRef(0);
  // AI marking
  const [grading, setGrading] = useState(false);
  const [report, setReport] = useState<PracticeReport | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [portalMounted, setPortalMounted] = useState(false);
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
  const checkedLoggedRef = useRef(false); // ensures MCQ attempts log once per check
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

  useEffect(() => setPortalMounted(true), []);

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
    checkedLoggedRef.current = false;
    setShowScheme(false);
    // reset the per-paper session shell; the restore effect re-hydrates it
    setSolveMode("digital");
    setPaperStatus("in_progress");
    setUploads([]);
    setTimerRunning(false);
    setTimerStarted(false);
    setSavingState("idle");
    setReport(null);
    setReportOpen(false);
    setOneResults({});
    setOneGrading({});
    setOpenMap({});
    collapsedInitRef.current = new Set();
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

  // ---- topic deep link (Daily Plan / revision): select subject + topic in topic mode ----
  useEffect(() => {
    const link = topicLinkRef.current;
    if (!link || topicLinkDoneRef.current || loadingMeta || subjects.length === 0) return;
    topicLinkDoneRef.current = true;
    const subjectName = resolveSubjectName(subjects, link.subject);
    if (!subjectName) return;
    const meta = subjects.find((s) => s.name === subjectName);
    const wanted = link.topic.toLowerCase();
    const findTopic = (list: { name: string }[]) =>
      list.find((t) => t.name.toLowerCase() === wanted) ||
      list.find((t) => t.name.toLowerCase().includes(wanted) || wanted.includes(t.name.toLowerCase()));
    const structMatch = findTopic(meta?.types.structured.topics ?? []);
    const mcqMatch = structMatch ? undefined : findTopic(meta?.types.mcq.topics ?? []);
    setPracticeMode("topic");
    setSelectedSubject(subjectName);
    setQuestionType(structMatch ? "structured" : mcqMatch ? "mcq" : "structured");
    const match = structMatch ?? mcqMatch;
    if (match) setSelectedTopic(match.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setSavingState("saved"); setLastSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
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
      setReport(saved.report ?? null);
      setTimerDuration(saved.timerDurationSeconds || fallbackDuration);
      timerElapsedRef.current = saved.timerElapsedSeconds || 0;
      setTimerStartElapsed(saved.timerElapsedSeconds || 0);
      // never auto-run — a resumed paper waits for the student to hit resume;
      // "started" reflects whether the clock was ever running before
      setTimerStarted((saved.timerElapsedSeconds || 0) > 0);
      setTimerRunning(false);
      startedAtRef.current = saved.startedAt;
      hasRowRef.current = true;
      setSavingState("saved"); setLastSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      // D — snapshot which questions were already fully solved or marked, so they
      // open minimized (with a dropdown) instead of cluttering the reopened paper.
      const savedMcq = saved.answers?.mcq ?? {};
      const savedParts = saved.answers?.parts ?? {};
      const markedIds = new Set((saved.report?.perQuestion ?? []).map((r) => r.id));
      const initCollapsed = new Set<string>();
      for (const q of questions) {
        const fullyAnswered = q.type === "mcq"
          ? Boolean(savedMcq[q.id]?.trim())
          : q.parts.length
            ? q.parts.every((part, i) => isHeaderPart(q.parts, part.label) || Boolean(savedParts[`${q.id}::${i}`]?.trim()))
            : Boolean(savedParts[`${q.id}::0`]?.trim());
        if (markedIds.has(q.id) || fullyAnswered) initCollapsed.add(q.id);
      }
      collapsedInitRef.current = initCollapsed;
      setOpenMap({});
    } else {
      setTimerDuration(fallbackDuration);
      timerElapsedRef.current = 0;
      setTimerStartElapsed(0);
      setTimerStarted(false); // fresh paper — the exam clock waits for Start
      setTimerRunning(false);
      startedAtRef.current = null;
      hasRowRef.current = false;
      setSavingState("idle");
      collapsedInitRef.current = new Set(); // fresh paper — nothing pre-collapsed
      setOpenMap({});
    }
    setTimerNonce((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceMode, currentPaperKey, loadingQuestions, questions, progressMap]);

  // debounced autosave whenever the student's work changes. The very first save
  // (before a row exists) fires fast so the draft is captured the moment they
  // start writing; subsequent saves debounce a little longer to batch keystrokes.
  useEffect(() => {
    if (!currentPaperKey || restoredKeyRef.current !== currentPaperKey || !interactedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const delay = hasRowRef.current ? 800 : 250;
    saveTimerRef.current = setTimeout(() => { void doSave(); }, delay);
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
    window.addEventListener("blur", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("blur", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [buildDoc, currentPaperKey]);

  function changeSolveMode(mode: SolveMode) {
    if (mode === solveMode) return;
    interactedRef.current = true;
    setSolveMode(mode);
    void doSave({ solveMode: mode });
  }

  function toggleCompleted() {
    interactedRef.current = true;
    const next: PracticeStatus = paperStatus === "completed" ? "in_progress" : "completed";
    setPaperStatus(next);
    if (next === "completed") setTimerRunning(false); // stop the clock; un-completing leaves it paused
    void doSave({ status: next });
  }

  // the student explicitly starts the exam clock (it never auto-runs)
  function startTimer() {
    setTimerStarted(true);
    setTimerRunning(true);
  }

  function handleTimerToggle() {
    const next = !timerRunning;
    if (next) setTimerStarted(true);
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
          setSavingState("saved"); setLastSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
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
  function resetFilters() { setSelectedSubject(""); setSelectedTopic(""); setSelectedYear(""); setSelectedPaperKey(""); setQuery(""); clearQuestions(); }
  // "Check" MCQs and log each as an attempt (Phase 1 backbone) — once per check
  function checkMcqs() {
    setChecked(true);
    if (checkedLoggedRef.current) return;
    checkedLoggedRef.current = true;
    const records = displayQuestions
      .filter((q) => q.type === "mcq" && q.correctOption)
      .map((q) => attemptFromMcq(q, mcqAnswers[q.id], q.correctOption));
    void logAttempts(records, getToken);
  }
  // one-click jump into a subject/type/mode, so the blank state isn't a dead end
  function quickStart(subject: string, type: QuestionType, mode: PracticeMode) {
    setPracticeMode(mode); setQuestionType(type); setSelectedSubject(subject);
    setSelectedTopic(""); setSelectedYear(""); setSelectedPaperKey(""); setQuery(""); clearQuestions();
  }
  const quickPresets = ([
    { subject: "Physics", type: "mcq" as QuestionType, mode: "topic" as PracticeMode },
    { subject: "Chemistry", type: "structured" as QuestionType, mode: "topic" as PracticeMode },
    { subject: "Mathematics", type: "structured" as QuestionType, mode: "topic" as PracticeMode },
    { subject: "Biology", type: "mcq" as QuestionType, mode: "topic" as PracticeMode },
  ]).filter((p) => subjects.some((s) => s.name === p.subject));
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
      setTimerRunning(false);
      setTimerStarted(false); // reset → clock waits for Start again
      interactedRef.current = false;
      if (hasRowRef.current) {
        void deletePracticeProgress(currentPaperKey, getToken);
        setProgressMap((prev) => { const next = new Map(prev ?? []); next.delete(currentPaperKey); return next; });
        hasRowRef.current = false;
        startedAtRef.current = null;
        setUploads([]);
        setSavingState("idle");
      }
      setReport(null);
      setReportOpen(false);
    }
  }

  // ---- AI marking (whole paper, and single questions in topic mode) ----
  const maxMarksOf = (q: PracticeQuestion): number => {
    if (typeof q.marks === "number" && q.marks > 0) return q.marks;
    const partsSum = q.parts.reduce((sum, part) => sum + (part.marks ?? 0), 0);
    return partsSum > 0 ? partsSum : 1;
  };

  const toGradeInput = useCallback((q: PracticeQuestion): GradeQuestionInput => {
    if (q.type === "mcq") {
      return {
        id: q.id, questionNumber: q.questionNumber, type: "mcq", questionText: q.questionText,
        maxMarks: maxMarksOf(q), correctOption: q.correctOption, markingScheme: q.markingScheme || null,
        studentOption: mcqAnswers[q.id] || null,
      };
    }
    const studentParts: Record<string, string> = {};
    if (q.parts.length) {
      q.parts.forEach((part, index) => {
        if (isHeaderPart(q.parts, part.label)) return;
        const value = partAnswers[`${q.id}::${index}`];
        if (value && value.trim()) studentParts[part.label || `Part ${index + 1}`] = value.trim();
      });
    } else {
      const value = partAnswers[`${q.id}::0`];
      if (value && value.trim()) studentParts["Answer"] = value.trim();
    }
    return {
      id: q.id, questionNumber: q.questionNumber, type: "structured", questionText: q.questionText,
      maxMarks: maxMarksOf(q), markingScheme: q.markingScheme || null,
      parts: q.parts.map((part) => ({ label: part.label, body: part.body, marks: part.marks, answer: part.answer })),
      studentParts,
    };
  }, [mcqAnswers, partAnswers]);

  const buildGradeQuestions = (): GradeQuestionInput[] => questions.map(toGradeInput);

  // per-question grading (topic drills): id -> result, and in-flight ids
  const [oneResults, setOneResults] = useState<Record<string, GradedQuestion>>({});
  const [oneGrading, setOneGrading] = useState<Record<string, boolean>>({});

  // D — collapse solved/marked questions when a paper is reopened. collapsedInitRef
  // is a snapshot of which questions were already solved/marked at load; openMap
  // holds the student's manual expand/collapse overrides for this paper.
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const collapsedInitRef = useRef<Set<string>>(new Set());
  const isQuestionOpen = (id: string) => openMap[id] ?? !collapsedInitRef.current.has(id);
  const toggleQuestionOpen = (id: string) =>
    setOpenMap((prev) => ({ ...prev, [id]: !(prev[id] ?? !collapsedInitRef.current.has(id)) }));

  // paper-mode per-question results, keyed by question id (from the saved report)
  const resultById = useMemo(() => {
    const map: Record<string, GradedQuestion> = {};
    for (const r of report?.perQuestion ?? []) map[r.id] = r;
    return map;
  }, [report]);
  // topic drills: solve every question on screen, or upload a photo per question
  const [topicSolveMode, setTopicSolveMode] = useState<SolveMode>("digital");
  // schemes/answers can only be revealed once at least one question has been submitted
  const schemesUnlockable = practiceMode === "paper" ? Boolean(report) : (checked || Object.keys(oneResults).length > 0);

  async function gradeOne(q: PracticeQuestion) {
    if (!selectedSubject || oneGrading[q.id]) return;
    setOneGrading((prev) => ({ ...prev, [q.id]: true }));
    setError("");
    try {
      const result = await gradeOneQuestion(selectedSubject, toGradeInput(q), getToken);
      setOneResults((prev) => ({ ...prev, [q.id]: result }));
      void logAttempts([attemptFromGraded(q, result)], getToken);
    } catch (gradeError) {
      setError(gradeError instanceof Error ? gradeError.message : "Grading failed. Please try again.");
    } finally {
      setOneGrading((prev) => ({ ...prev, [q.id]: false }));
    }
  }

  async function gradeOneFromImage(q: PracticeQuestion, file: File) {
    if (!selectedSubject || oneGrading[q.id]) return;
    if (file.size > 15 * 1024 * 1024) { setError(`${file.name} is larger than 15 MB`); return; }
    setOneGrading((prev) => ({ ...prev, [q.id]: true }));
    setError("");
    try {
      const result = await gradeOneImage(selectedSubject, toGradeInput(q), file, getToken);
      setOneResults((prev) => ({ ...prev, [q.id]: result }));
      void logAttempts([attemptFromGraded(q, result)], getToken);
    } catch (gradeError) {
      setError(gradeError instanceof Error ? gradeError.message : "Grading failed. Please try again.");
    } finally {
      setOneGrading((prev) => ({ ...prev, [q.id]: false }));
    }
  }

  const hasAnyAnswer = useMemo(() => {
    if (solveMode === "handwritten") return uploads.length > 0;
    return questions.some((q) =>
      q.type === "mcq"
        ? Boolean(mcqAnswers[q.id]?.trim())
        : q.parts.length
          ? q.parts.some((_, index) => Boolean(partAnswers[`${q.id}::${index}`]?.trim()))
          : Boolean(partAnswers[`${q.id}::0`]?.trim()));
  }, [solveMode, uploads, questions, mcqAnswers, partAnswers]);

  async function gradePaper() {
    if (!currentPaperKey || !selectedPaper || !selectedSubject || grading) return;
    setGrading(true);
    setError("");
    // make sure the latest typed answers are on the server before grading
    if (solveMode === "digital" && interactedRef.current) await doSave();
    try {
      const { report: graded, item } = await gradePractice(
        {
          paperKey: currentPaperKey, subject: selectedSubject, year: selectedPaper.year,
          session: selectedPaper.session, paper: selectedPaper.paper, variant: selectedPaper.variant,
          isMcq: selectedPaper.isMcq, solveMode, questions: buildGradeQuestions(),
        },
        getToken,
      );
      setReport(graded);
      setReportOpen(true);
      setPaperStatus("completed");
      setTimerRunning(false);
      // Phase 1 — log every graded question to the attempts backbone
      void logAttempts(attemptsFromReport(graded.perQuestion, questions), getToken);
      setUploads(item.uploads ?? []);
      hasRowRef.current = true;
      setProgressMap((prev) => { const next = new Map(prev ?? []); next.set(item.paperKey, item); return next; });
    } catch (gradeError) {
      setError(gradeError instanceof Error ? gradeError.message : "Grading failed. Please try again.");
    } finally {
      setGrading(false);
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

          <div className="flex-col gap-10" style={{ display: "flex", alignItems: "flex-end" }}>
            <div className="flex gap-8 wrap" style={{ justifyContent: "flex-end" }}>
              {/* generate a timed mixed paper from the bank */}
              <Link href="/student/generate" className="btn btn-secondary btn-sm" style={{ whiteSpace: "nowrap" }}>
                <Icon name="bolt" size={14} /> Generate a paper
              </Link>
              {/* separate flow: upload your own solved work and have Grok mark it */}
              <Link href="/student/upload-check" className="btn btn-secondary btn-sm" style={{ whiteSpace: "nowrap" }}>
                <Icon name="upload" size={14} /> Upload &amp; mark
              </Link>
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
                      <option value="">{currentSubject ? "Select a topic" : "Select a subject first"}</option>
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
                    <input value={query} onChange={(e) => setQuery(e.target.value)} disabled={!ready || loadingQuestions}
                      placeholder={selectedSubject ? `Search questions in ${selectedSubject.trim()}…` : "Search questions"} />
                  </div>
                </label>
              </div>

              {ready && (
                <div className="row-between wrap" style={{ gap: 12, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
                  <p className="flex items-center gap-8 muted wrap" style={{ fontSize: 13.5 }}>
                    <Icon name={practiceMode === "topic" ? "sparkles" : "file_text"} size={15} style={{ color: "var(--crimson)" }} />
                    {summary}
                    {practiceMode === "topic"
                      ? topicTotal > 0 && <span className="faint">· {displayQuestions.length} of {topicTotal} unique across all years</span>
                      : displayQuestions.length > 0 && <span className="faint">· {displayQuestions.length} question{displayQuestions.length === 1 ? "" : "s"}</span>}
                    {/* live progress, counted by answerable sub-part (not whole question) */}
                    {totalUnits > 0 && <span className="badge neutral" style={{ fontSize: 11.5 }}>{answeredUnits}/{totalUnits} answered</span>}
                  </p>
                  <div className="flex gap-8 wrap items-center">
                    {practiceMode === "topic" && questionType === "structured" && (
                      <Segmented value={topicSolveMode} onChange={setTopicSolveMode}
                        options={[{ value: "digital", label: "Solve here", icon: "pencil" }, { value: "handwritten", label: "Upload handwritten", icon: "upload" }]} />
                    )}
                    {questionType === "mcq" && (
                      <button onClick={checkMcqs} disabled={gradable.length === 0} className="btn btn-primary">
                        <Icon name="check_circle" size={16} /> Check
                      </button>
                    )}
                    <button onClick={resetPractice} className="icon-btn" title="Reset answers" style={{ border: "1px solid var(--line-strong)" }}>
                      <Icon name="rotate" size={17} />
                    </button>
                    <button onClick={resetFilters} className="btn btn-ghost btn-sm" title="Clear subject, topic and filters">
                      <Icon name="x" size={14} /> Reset filters
                    </button>
                    {/* reveal is only offered once something is submitted — schemes stay hidden until then */}
                    {hasScheme && schemesUnlockable && (
                      <button onClick={() => setShowScheme((v) => !v)} className={"btn " + (showScheme ? "btn-soft" : "btn-secondary")}
                        title="Reveal the marking scheme for questions you've already checked">
                        <Icon name="shield" size={15} /> {showScheme ? "Hide answers" : questionType === "mcq" ? "Marking scheme" : "Answers"}
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
              {paperStatus !== "completed" && !timerStarted ? (
                <button className="btn btn-primary btn-sm" onClick={startTimer} title={`Start the ${durationLabel(timerDuration)} exam clock`}>
                  <Icon name="play" size={13} fill="#fff" stroke={0} /> Start paper · {durationLabel(timerDuration)}
                </button>
              ) : (
                <TimerChip key={`${currentPaperKey}|${timerNonce}`} running={timerRunning} durationSeconds={timerDuration}
                  initialElapsed={timerStartElapsed} onToggle={handleTimerToggle} onTick={(value) => { timerElapsedRef.current = value; }} />
              )}
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
                {savingState === "saving" ? "Saving…" : savingState === "saved" ? `Draft saved${lastSavedAt ? " · " + lastSavedAt : ""}` : savingState === "error" ? "Offline" : ""}
              </span>
              {report && (
                <span className="badge teal" title="Latest marks" style={{ whiteSpace: "nowrap" }}>
                  <Icon name="award" size={13} /> {report.earned}/{report.total}
                </span>
              )}
              {report ? (
                <button className="btn btn-secondary btn-sm" onClick={() => setReportOpen(true)}>
                  <Icon name="file_text" size={14} /> View report
                </button>
              ) : (
                <button className="icon-btn" onClick={toggleCompleted} title={paperStatus === "completed" ? "Mark as in progress" : "Mark done without grading"}
                  style={{ width: 34, height: 34, border: "1px solid var(--line-strong)", color: paperStatus === "completed" ? "var(--teal-deep)" : "var(--ink-faint)" }}>
                  <Icon name="check_circle" size={16} />
                </button>
              )}
              <button className="btn btn-primary btn-sm" onClick={gradePaper} disabled={grading || !hasAnyAnswer}
                title={!hasAnyAnswer ? (solveMode === "handwritten" ? "Upload your answers first" : "Answer at least one question first") : "Mark this paper with AI"}>
                {grading
                  ? <><Icon name="refresh" size={14} className="spin" /> Marking…</>
                  : <><Icon name="award" size={14} /> {report ? "Re-mark" : solveMode === "digital" && totalUnits > 0 ? `Submit for marking · ${answeredUnits}/${totalUnits}` : "Submit for marking"}</>}
              </button>
            </div>
          </div>
        )}

        {/* Sticky action bar for topic mode — stays visible while scrolling long lists */}
        {practiceMode === "topic" && ready && !loadingQuestions && displayQuestions.length > 0 && (
          <div className="card" style={{ position: "sticky", top: 8, zIndex: 25, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", padding: "8px 14px" }}>
            <div className="flex items-center gap-8">
              <span className="faint" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{answeredUnits}/{totalUnits} answered</span>
              <div style={{ width: 80 }}><Bar value={totalUnits ? Math.round((answeredUnits / totalUnits) * 100) : 0} tone="teal" height={6} /></div>
            </div>
            <div className="flex gap-8 wrap items-center">
              {questionType === "mcq" && (
                <button onClick={checkMcqs} disabled={gradable.length === 0} className="btn btn-primary btn-sm">
                  <Icon name="check_circle" size={14} /> Check {gradable.length > 0 ? `(${gradable.length})` : ""}
                </button>
              )}
              {hasScheme && schemesUnlockable && (
                <button onClick={() => setShowScheme((v) => !v)} className={"btn btn-sm " + (showScheme ? "btn-soft" : "btn-secondary")}>
                  <Icon name="shield" size={14} /> {showScheme ? "Hide answers" : questionType === "mcq" ? "Marking scheme" : "Answers"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Body — digital question paper, or the dedicated handwritten upload studio */}
        <div className="flex-col gap-16">
          {openingLink ? (
            <div className="card flex items-center justify-center gap-8" style={{ minHeight: 320, color: "var(--ink-faint)", display: "flex" }}>
              <Icon name="refresh" size={16} className="spin" /> Opening your paper…
            </div>
          ) : loadingQuestions ? (
            <>{[0, 1, 2].map((i) => <QuestionSkeleton key={i} />)}</>
          ) : !ready ? (
            <div className="card card-pad flex-col gap-16" style={{ display: "flex" }}>
              <EmptyState icon="file_text" title="Nothing selected yet"
                body={practiceMode === "topic" ? "Pick a subject, question type and topic to start drilling." : "Pick a subject, year and a paper to load the full paper."} />
              {quickPresets.length > 0 && (
                <div className="flex-col items-center gap-10" style={{ display: "flex" }}>
                  <span className="eyebrow">Quick start</span>
                  <div className="flex gap-8 wrap" style={{ justifyContent: "center" }}>
                    {quickPresets.map((p) => (
                      <button key={p.subject} className="chip" style={{ cursor: "pointer", padding: "8px 14px" }}
                        onClick={() => quickStart(p.subject, p.type, p.mode)}>
                        <Icon name="sparkles" size={13} style={{ color: "var(--crimson)" }} /> Try {p.subject} {p.type === "mcq" ? "MCQs" : "questions"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : practiceMode === "paper" && solveMode === "handwritten" ? (
            /* handwritten: a clean upload-only workspace — no digital questions shown */
            <HandwrittenStudio uploads={uploads} busy={uploadBusy}
              onFiles={(files) => void handleFiles(files)} onRemove={(path) => void handleRemoveUpload(path)} />
          ) : displayQuestions.length > 0 ? (
            <>
              {displayQuestions.map((question) => (
                <QuestionCard key={question.id} question={question} showYear={practiceMode === "topic"}
                  mcqAnswer={mcqAnswers[question.id]} partAnswers={partAnswers} checked={checked} showScheme={showScheme}
                  readOnly={practiceMode === "paper" && solveMode === "handwritten"}
                  onMcqAnswer={(value) => { interactedRef.current = true; setMcqAnswers((c) => ({ ...c, [question.id]: value })); }}
                  onPartAnswer={(partKey, value) => { interactedRef.current = true; setPartAnswers((c) => ({ ...c, [partKey]: value })); }}
                  onGradeOne={practiceMode === "topic" && question.type === "structured" ? () => gradeOne(question) : undefined}
                  onGradeImage={practiceMode === "topic" && question.type === "structured" ? (file) => gradeOneFromImage(question, file) : undefined}
                  topicMode={topicSolveMode === "handwritten" ? "upload" : "type"}
                  // scheme only unlocks once this question is marked (topic) or the paper is graded (paper)
                  schemeUnlocked={practiceMode === "topic" ? Boolean(oneResults[question.id]) : Boolean(report)}
                  gradeResult={practiceMode === "topic" ? oneResults[question.id] : resultById[question.id]}
                  gradingOne={Boolean(oneGrading[question.id])}
                  // D — paper mode: solved/marked questions open minimized with a dropdown
                  collapsed={practiceMode === "paper" ? !isQuestionOpen(question.id) : false}
                  onToggleCollapsed={practiceMode === "paper" ? () => toggleQuestionOpen(question.id) : undefined} />
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

      {/* AI marking report */}
      {portalMounted && reportOpen && report && selectedPaper && createPortal(
        <ReportModal
          report={report}
          meta={{ subject: selectedSubject, year: selectedPaper.year, session: selectedPaper.session, paper: selectedPaper.paper, variant: selectedPaper.variant }}
          partsById={Object.fromEntries(questions.map((q) => [q.id, q.parts]))}
          onClose={() => setReportOpen(false)}
        />,
        document.body,
      )}
    </div>
  );
}

/* ---- AI marking report modal ---- */
function ReportModal({ report, meta, partsById, onClose }: {
  report: PracticeReport;
  meta: { subject: string; year: string; session: string; paper: string; variant: string };
  partsById?: Record<string, PracticePart[]>;
  onClose: () => void;
}) {
  const ringColor = report.percent >= 70 ? "var(--teal-deep)" : report.percent >= 45 ? "var(--amber-deep)" : "var(--coral-bright)";
  return (
    <div className="pr" onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 9999, minHeight: 0, display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(20,16,12,.6)", backdropFilter: "blur(3px)" }} />
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"
        style={{ position: "relative", maxWidth: "min(96vw,860px)", width: "100%", maxHeight: "92vh", padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* header */}
        <div className="row-between" style={{ padding: "18px 22px", borderBottom: "1px solid var(--line)", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div className="eyebrow">Marking report</div>
            <h3 style={{ fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prettyPaperName(meta)}</h3>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close" style={{ border: "1px solid var(--line-strong)", flex: "none" }}><Icon name="x" /></button>
        </div>

        {/* scrollable body */}
        <div style={{ overflow: "auto", padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* headline score */}
          <div className="card card-pad" style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "grid", placeItems: "center", width: 108, height: 108, borderRadius: "50%", flex: "none",
              background: `conic-gradient(${ringColor} ${report.percent * 3.6}deg, var(--surface-2) 0deg)` }}>
              <div style={{ width: 84, height: 84, borderRadius: "50%", background: "var(--surface)", display: "grid", placeItems: "center" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: ringColor, lineHeight: 1 }}>{report.percent}%</div>
                  <div className="faint" style={{ fontSize: 10.5 }}>score</div>
                </div>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div className="flex items-center gap-10 wrap">
                <span className="big-num" style={{ fontSize: 26 }}>{report.earned} / {report.total}</span>
                <span className="badge crimson">{report.grade}</span>
                <span className="badge neutral">{report.solveMode === "handwritten" ? "Handwritten" : "Digital"}</span>
              </div>
              <p className="muted mt-6" style={{ fontSize: 14, lineHeight: 1.5 }}>{report.summary}</p>
            </div>
          </div>

          {/* focus areas */}
          {report.improvements.length > 0 && (
            <div className="card card-pad" style={{ borderColor: "var(--amber-soft)" }}>
              <div className="flex items-center gap-8" style={{ marginBottom: 8 }}>
                <Icon name="target" size={16} style={{ color: "var(--amber-deep)" }} />
                <span style={{ fontWeight: 600, fontSize: 14 }}>Focus next on</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                {report.improvements.map((item, index) => <li key={index} style={{ fontSize: 13.5, lineHeight: 1.5 }}>{item}</li>)}
              </ul>
            </div>
          )}

          {/* per-question breakdown */}
          <div className="flex-col gap-8">
            <div className="eyebrow" style={{ padding: "0 2px" }}>Question breakdown</div>
            {report.perQuestion.map((q) => <QuestionResultRow key={q.id} q={q} parts={partsById?.[q.id]} />)}
          </div>
        </div>

        {/* footer */}
        <div className="row-between" style={{ padding: "14px 22px", borderTop: "1px solid var(--line)", gap: 10 }}>
          <span className="faint" style={{ fontSize: 11.5 }}>Indicative marks · {report.model}</span>
          <div className="flex gap-8">
            <button className="btn btn-secondary btn-sm" onClick={() => downloadReport(report, meta)}>
              <Icon name="download" size={14} /> Download report
            </button>
            <button className="btn btn-primary btn-sm" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MarkBreakdown({ items }: { items: MarkCategory[] }) {
  return (
    <div className="flex gap-8 wrap" style={{ marginTop: 8 }}>
      {items.map((c) => {
        const pct = c.max ? Math.round((c.earned / c.max) * 100) : 0;
        const lost = c.max - c.earned;
        const fill = pct >= 80 ? "var(--teal-deep)" : pct >= 40 ? "var(--amber-deep)" : "var(--coral-bright)";
        return (
          <div key={c.category} style={{ flex: "1 1 118px", minWidth: 108, borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface-2)", padding: "8px 10px" }}>
            <div className="row-between" style={{ fontSize: 11.5 }}>
              <span style={{ fontWeight: 600 }}>{c.category}</span>
              <span className="tnum" style={{ fontWeight: 700 }}>{c.earned}/{c.max}</span>
            </div>
            <div className="bar" style={{ height: 5, marginTop: 5 }}><i style={{ width: pct + "%", background: fill }} /></div>
            {lost > 0 && <div className="faint" style={{ fontSize: 10.5, marginTop: 3 }}>−{lost} lost</div>}
          </div>
        );
      })}
    </div>
  );
}

/* ---- part-wise model answers: one top line, "see more" expands to every part ---- */
function ModelAnswerRow({ part }: { part: PracticePart }) {
  const [more, setMore] = useState(false);
  const text = (part.answer || "").trim();
  const long = text.length > 110;
  return (
    <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--amber-deep)" }}>
      <div className="flex items-baseline" style={{ justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontWeight: 700 }}>{part.label || "Answer"}</span>
        {part.marks != null && <span style={{ flex: "none", fontWeight: 700, opacity: 0.75 }}>[{part.marks}]</span>}
      </div>
      <p style={{ margin: "2px 0 0", whiteSpace: "pre-wrap",
        ...(more || !long ? {} : { display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }) }}>
        {text}
      </p>
      {long && (
        <button onClick={() => setMore((v) => !v)} className="btn btn-ghost btn-sm"
          style={{ padding: "1px 0", fontSize: 11, color: "var(--amber-deep)", textDecoration: "underline" }}>
          {more ? "less" : "more"}
        </button>
      )}
    </div>
  );
}

function ModelAnswers({ parts }: { parts: PracticePart[] }) {
  const [open, setOpen] = useState(false);
  const answered = useMemo(
    () => parts.filter((p) => p.answer && p.answer.trim() && !isHeaderPart(parts, p.label)),
    [parts],
  );
  if (answered.length === 0) return null;
  const shown = open ? answered : answered.slice(0, 1);
  return (
    <div style={{ marginTop: 8, borderRadius: 10, border: "1px solid var(--amber-soft)", background: "var(--amber-soft)", padding: "9px 11px" }}>
      <div className="row-between" style={{ gap: 8, alignItems: "center" }}>
        <span className="eyebrow" style={{ color: "var(--amber-deep)" }}>
          Model answer{answered.length > 1 ? `s · ${answered.length} parts` : ""}
        </span>
        {answered.length > 1 && (
          <button onClick={() => setOpen((v) => !v)} className="btn btn-ghost btn-sm"
            style={{ padding: "2px 8px", fontSize: 11.5, color: "var(--amber-deep)", whiteSpace: "nowrap" }}>
            <Icon name={open ? "chevron_down" : "chevron_right"} size={13} /> {open ? "Show less" : `See all ${answered.length} parts`}
          </button>
        )}
      </div>
      <div className="flex-col" style={{ display: "flex", gap: 8, marginTop: 8 }}>
        {shown.map((part, index) => <ModelAnswerRow key={index} part={part} />)}
      </div>
    </div>
  );
}

function QuestionResultRow({ q, parts }: { q: GradedQuestion; parts?: PracticePart[] }) {
  const tone = verdictColor(q.verdict);
  const missing = q.missingPoints ?? [];
  const expected = q.expectedPoints ?? [];
  const norm = (value: string) => value.trim().toLowerCase();
  const keyOf = (list: string[]) => list.map(norm).filter(Boolean).sort().join("|");
  // A ~0 answer makes the model return the same points as both "missing" and
  // "expected"; collapse them into one block instead of showing duplicates (B).
  const samePoints = missing.length > 0 && keyOf(missing) === keyOf(expected);
  return (
    <div className="card card-pad" style={{ padding: 14 }}>
      <div className="row-between" style={{ gap: 10, alignItems: "flex-start" }}>
        <div className="flex items-center gap-8 wrap" style={{ minWidth: 0 }}>
          <span className="chip-tag badge neutral" style={{ flex: "none" }}>Q{q.questionNumber}</span>
          <span style={{ padding: "2px 9px", borderRadius: 99, fontSize: 12, fontWeight: 600, color: tone.fg, background: tone.bg, whiteSpace: "nowrap" }}>{tone.label}</span>
          {q.gradingSource !== "deterministic" && (
            <span title={q.schemeUsed ? "Marked against this paper's official marking scheme" : "No scheme on file — marked by Grok as an examiner"}
              style={{ padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
                color: q.schemeUsed ? "var(--teal-deep)" : "var(--ink-soft)", background: q.schemeUsed ? "var(--teal-soft)" : "var(--surface-2)" }}>
              {q.schemeUsed ? "✓ Mark scheme" : "Examiner judgement"}
            </span>
          )}
          {q.commandWord && (
            <span title="Command word this question tests" style={{ padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", color: "var(--purple)", background: "var(--purple-soft)" }}>
              {q.commandWord}
            </span>
          )}
        </div>
        <span style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", color: tone.fg }}>{q.earned} / {q.max}</span>
      </div>
      <p style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 8 }}>{q.feedback}</p>
      {/* Phase 1 — marks breakdown by assessment objective */}
      {q.breakdown && q.breakdown.length > 0 && <MarkBreakdown items={q.breakdown} />}
      {samePoints ? (
        <p style={{ fontSize: 12.5, lineHeight: 1.45, marginTop: 6, color: "var(--coral-bright)" }}>
          <b>Key points you needed:</b> {expected.join("; ")}
        </p>
      ) : (
        <>
          {missing.length > 0 && (
            <p style={{ fontSize: 12.5, lineHeight: 1.45, marginTop: 6, color: "var(--coral-bright)" }}>
              <b>Improve:</b> {missing.join("; ")}
            </p>
          )}
          {expected.length > 0 && (
            <p className="faint" style={{ fontSize: 12.5, lineHeight: 1.45, marginTop: 4 }}>
              <b>Key points:</b> {expected.join("; ")}
            </p>
          )}
        </>
      )}
      {/* Part-wise model answers (C) — one line each, "see more" reveals every part */}
      {parts && parts.length > 0 && <ModelAnswers parts={parts} />}
      {/* Phase 3 — command-word coach */}
      {q.commandWordNote && (
        <div className="flex gap-8 items-start" style={{ marginTop: 8, padding: "8px 10px", borderRadius: 10, background: "var(--purple-soft)" }}>
          <Icon name="target" size={14} style={{ color: "var(--purple)", flex: "none", marginTop: 1 }} />
          <span style={{ fontSize: 12.5, lineHeight: 1.45, color: "var(--purple)" }}><b>Command word:</b> {q.commandWordNote}</span>
        </div>
      )}
      {/* Phase 3 — examiner-report insight */}
      {q.examinerNote && (
        <p className="faint" style={{ fontSize: 12, lineHeight: 1.45, marginTop: 6, fontStyle: "italic" }}>
          <Icon name="lightbulb" size={13} style={{ color: "var(--amber-deep)", marginRight: 4, verticalAlign: "middle" }} />
          {q.examinerNote}
        </p>
      )}
    </div>
  );
}

/* ---- handwritten workspace: upload-only, replaces the digital paper ---- */
function HandwrittenStudio({ uploads, busy, onFiles, onRemove }: {
  uploads: PracticeUpload[]; busy: boolean;
  onFiles: (files: FileList | null) => void; onRemove: (path: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex-col gap-14" style={{ display: "flex", alignItems: "center" }}>
      {/* medium dotted upload rectangle */}
      <div
        onDragOver={(e) => { e.preventDefault(); if (!busy) setDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (!busy) onFiles(e.dataTransfer.files); }}
        onClick={() => { if (!busy) inputRef.current?.click(); }}
        style={{ width: "100%", maxWidth: 460, cursor: busy ? "wait" : "pointer", padding: "30px 24px",
          display: "grid", placeItems: "center", textAlign: "center", borderRadius: 14,
          border: `2px dashed ${dragging ? "var(--crimson)" : "var(--line-strong)"}`,
          background: dragging ? "var(--crimson-soft)" : "var(--surface)", transition: "all .15s" }}
      >
        <input ref={inputRef} type="file" accept="image/*,application/pdf" multiple style={{ display: "none" }} disabled={busy}
          onChange={(e) => { onFiles(e.target.files); e.currentTarget.value = ""; }} />
        <div style={{ width: 48, height: 48, borderRadius: 14, background: "var(--crimson-soft)", color: "var(--crimson)", display: "grid", placeItems: "center", marginBottom: 12 }}>
          <Icon name={busy ? "refresh" : "upload"} size={22} className={busy ? "spin" : ""} />
        </div>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{busy ? "Uploading…" : "Upload handwritten answers"}</div>
        <div className="faint" style={{ fontSize: 12.5, marginTop: 4 }}>
          Drag &amp; drop or <span style={{ color: "var(--crimson)", fontWeight: 600 }}>browse</span>
        </div>
        <div className="faint" style={{ fontSize: 11.5, marginTop: 8 }}>JPG, PNG or PDF · maximum 15 MB per file</div>
      </div>

      {/* uploaded files — compact list */}
      {uploads.length > 0 && (
        <div className="flex-col" style={{ display: "flex", gap: 6, width: "100%", maxWidth: 460 }}>
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
              <button className="icon-btn" aria-label={`Remove ${file.name}`} onClick={() => onRemove(file.path)}
                style={{ width: 28, height: 28, flex: "none" }}>
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- shimmer skeleton shown while questions load (replaces the text spinner) ---- */
function QuestionSkeleton() {
  return (
    <div className="card card-pad flex-col gap-12" style={{ display: "flex" }}>
      <div className="flex gap-8">
        <div className="sk" style={{ width: 56, height: 22, borderRadius: 999 }} />
        <div className="sk" style={{ width: 96, height: 22, borderRadius: 999 }} />
      </div>
      <div className="sk" style={{ width: "82%", height: 18 }} />
      <div className="sk" style={{ width: "96%", height: 13 }} />
      <div className="sk" style={{ width: "68%", height: 13 }} />
      <div className="sk" style={{ height: 84, borderRadius: 12 }} />
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
