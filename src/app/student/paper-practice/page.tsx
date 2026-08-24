"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Icon } from "@/components/propel/Icon";
import { Segmented, EmptyState, Bar } from "@/components/propel/primitives";
import {
  PracticeProgress, PracticeUpload, PracticeReport, GradedQuestion, MarkCategory, SolveMode, PracticeStatus,
  ExtractionSummary,
  loadPracticeProgressList, loadPracticeProgressLocal, savePracticeProgress, deletePracticeProgress,
  uploadPracticeFile, removePracticeUpload, makePaperKey, prettyPaperName, reportAnswerStats,
} from "@/lib/practiceProgress";
import { cacheGet, cacheSet } from "@/lib/sessionCache";
import { loadSelectedSubjects } from "@/lib/studentPersonalization";
import { isExcludedSubject } from "@/lib/studentSubjects";
import { logAttempts, attemptsFromReport, attemptFromMcq, attemptFromGraded, mcqAnswerExtra, structuredAnswerExtra, type AnswerExtra } from "@/lib/insights";
import { gradePractice, gradeOneQuestion, gradeOneImage, downloadReport, verdictColor, GradeQuestionInput, slotAnswersFromGraded } from "@/lib/practiceGrading";
import { syncPracticePaperTracking } from "@/lib/paperTracking";
import { apiCall, getApiUrl } from "@/lib/api";
import { paperDurationSeconds, durationLabel, clockLabel } from "@/lib/paperDurations";
import { isClerkTokenFresh } from "@/lib/clerkToken";

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

// Active paper level — practice content is served per level so O and A never mix.
const paperLevelParam = () =>
  typeof window !== "undefined" && window.localStorage.getItem("propel_paper_level") === "alevel" ? "alevel" : "olevel";
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

/* ---- by-topic persistence: answers + marked results survive a reopen ----
   Topic drilling isn't a saved "paper", so it kept everything only in memory and
   lost it on reload. We mirror it to localStorage keyed by the globally-unique
   question id, so anything written (and any marked result) comes back — whether
   or not it was marked. */
const TOPIC_PRACTICE_KEY = "propel_topic_practice";
type TopicPracticeBlob = {
  mcq: Record<string, string>;
  parts: Record<string, string>;
  results: Record<string, GradedQuestion>;
};
function readTopicPractice(): TopicPracticeBlob {
  const empty: TopicPracticeBlob = { mcq: {}, parts: {}, results: {} };
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(TOPIC_PRACTICE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return empty;
    return { mcq: parsed.mcq ?? {}, parts: parsed.parts ?? {}, results: parsed.results ?? {} };
  } catch {
    return empty;
  }
}
function writeTopicPractice(blob: TopicPracticeBlob): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOPIC_PRACTICE_KEY, JSON.stringify(blob));
  } catch {
    // quota or serialization failure — non-fatal; in-memory state still works
  }
}

/* ---- handwritten upload limits (mirror the API's own checks) ---- */
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_UPLOAD_FILES = 24;
const ACCEPTED_UPLOAD_TYPES = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
const UPLOAD_ACCEPT_ATTR = ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf";

/** Reject unsupported or oversized files up front, with a reason to show. */
function validateUploadFile(file: File): string | null {
  const extension = (file.name.split(".").pop() || "").toLowerCase();
  const typeOk =
    ACCEPTED_UPLOAD_TYPES.includes(file.type.toLowerCase()) ||
    // some browsers report an empty type for files picked from cloud drives
    (!file.type && ["jpg", "jpeg", "png", "pdf"].includes(extension));
  if (!typeOk) return `${file.name} is not a JPG, PNG or PDF.`;
  if (file.size === 0) return `${file.name} is empty.`;
  if (file.size > MAX_UPLOAD_BYTES) {
    return `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 15 MB.`;
  }
  return null;
}

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
            // Islamiyat's Arabic verse strips are ~3680px wide; at the inline cap
            // the diacritics are unreadable, so these need enlarging as much as
            // the diagrams do.
            <SourceImage src={source.image.src} label={source.label} />
          )}
          {source.translation && <p style={{ marginTop: 8, whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.7 }}>{source.translation}</p>}
        </figure>
      ))}
    </div>
  );
}

// Full-screen viewer for a diagram. Exam figures are often taller than the inline
// cap (a Maths question can be 906x1387), so fitting them to the card shrinks the
// detail past reading size — the graph gridlines and axis labels are exactly what
// the student needs. Double-click cycles the zoom, the wheel zooms about the
// cursor, and dragging pans once magnified.
const ZOOM_STEPS = [1, 2, 3];

function ImageLightbox({ src, alt, caption, onClose }: {
  src: string; alt?: string | null; caption?: string | null; onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(6, z * 1.4));
      if (e.key === "-") setZoom((z) => Math.max(1, z / 1.4));
      if (e.key === "0") { setZoom(1); setOffset({ x: 0, y: 0 }); }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";      // don't scroll the page behind
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  // step through the zoom levels, resetting the pan when we land back at fit
  const cycleZoom = () => setZoom((z) => {
    const next = ZOOM_STEPS.find((s) => s > z + 0.01) ?? ZOOM_STEPS[0];
    if (next === 1) setOffset({ x: 0, y: 0 });
    return next;
  });

  const onWheel = (e: ReactWheelEvent) => {
    setZoom((z) => {
      const next = Math.min(6, Math.max(1, z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
      if (next === 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (zoom <= 1) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    setDragging(true);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    setOffset({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) });
  };
  const endDrag = () => { drag.current = null; setDragging(false); };

  if (!mounted) return null;

  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={caption || alt || "Figure"}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 2000, background: "rgba(8,10,14,.92)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        className="flex items-center gap-8"
        onClick={(e) => e.stopPropagation()}
        style={{ position: "absolute", top: 12, right: 12, zIndex: 1 }}
      >
        <button type="button" onClick={() => setZoom((z) => Math.max(1, z / 1.4))} aria-label="Zoom out"
          style={lightboxBtn}>&minus;</button>
        <span style={{ minWidth: 52, textAlign: "center", color: "#fff", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
          {Math.round(zoom * 100)}%
        </span>
        <button type="button" onClick={() => setZoom((z) => Math.min(6, z * 1.4))} aria-label="Zoom in"
          style={lightboxBtn}>+</button>
        <button type="button" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }} aria-label="Reset zoom"
          style={lightboxBtn}>Reset</button>
        <button type="button" onClick={onClose} aria-label="Close" style={lightboxBtn}>&times;</button>
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={cycleZoom}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          maxWidth: "96vw", maxHeight: "88vh", overflow: "hidden",
          cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in",
          touchAction: zoom > 1 ? "none" : "auto",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt || caption || "figure"}
          draggable={false}
          style={{
            display: "block", maxWidth: "96vw", maxHeight: "88vh", objectFit: "contain",
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            transition: dragging ? "none" : "transform .15s ease-out",
            background: "#fff", borderRadius: 6,
          }}
        />
      </div>

      <p style={{ marginTop: 10, color: "rgba(255,255,255,.72)", fontSize: 12, textAlign: "center", padding: "0 16px" }}>
        {caption ? `${caption} — ` : ""}double-click or scroll to zoom, drag to pan, Esc to close
      </p>
    </div>
  );

  // portal to the body: a fixed overlay nested inside a transformed or
  // overflow-hidden ancestor gets clipped to that ancestor instead of the viewport
  return createPortal(overlay, document.body);
}

const lightboxBtn: CSSProperties = {
  minWidth: 34, height: 34, padding: "0 10px", borderRadius: 8, cursor: "pointer",
  border: "1px solid rgba(255,255,255,.28)", background: "rgba(255,255,255,.10)",
  color: "#fff", fontSize: 15, fontWeight: 600, lineHeight: 1,
};

function SourceImage({ src, label }: { src: string; label?: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        onDoubleClick={() => setOpen(true)}
        title="Click to enlarge"
        aria-label={`Enlarge ${label || "passage"}`}
        style={{ display: "block", width: "100%", padding: 0, border: 0, background: "none", cursor: "zoom-in" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={label || "passage"} style={{ margin: "8px auto 0", maxHeight: 300, width: "100%", maxWidth: 640, objectFit: "contain" }} loading="lazy" />
      </button>
      {open && <ImageLightbox src={src} alt={label} caption={label} onClose={() => setOpen(false)} />}
    </>
  );
}

function QuestionImage({ image }: { image: PracticeImage }) {
  const [open, setOpen] = useState(false);
  if (!image.src) return null;
  return (
    <figure style={{ borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface-2)", padding: 12 }}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        onDoubleClick={() => setOpen(true)}
        title="Click to enlarge"
        aria-label={`Enlarge figure${image.caption ? `: ${image.caption}` : ""}`}
        style={{ display: "block", width: "100%", padding: 0, border: 0, background: "none", cursor: "zoom-in" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.src} alt={image.alt} style={{ margin: "0 auto", maxHeight: 520, width: "100%", maxWidth: 760, objectFit: "contain" }} loading="lazy" />
      </button>
      {image.caption && <figcaption style={{ marginTop: 8, textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--ink-faint)" }}>{image.caption}</figcaption>}
      {open && <ImageLightbox src={image.src} alt={image.alt} caption={image.caption} onClose={() => setOpen(false)} />}
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
      <p style={{ whiteSpace: "pre-wrap", fontSize: 18, lineHeight: 1.5, fontFamily: "var(--font-fraunces), serif" }}>{question.questionText}</p>
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
      {question.questionText && <p style={{ whiteSpace: "pre-wrap", fontSize: 18, lineHeight: 1.5, fontFamily: "var(--font-fraunces), serif" }}>{question.questionText}</p>}
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
                {!readOnly ? (
                  <textarea value={answers[partKey] ?? ""} onChange={(e) => onAnswer(partKey, e.target.value)} placeholder="Write your answer…"
                    className="textarea" style={{ marginTop: 8, minHeight: 90 }} />
                ) : (answers[partKey] ?? "").trim() ? (
                  <p style={{ marginTop: 8, whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.55, padding: "8px 10px", borderRadius: 8,
                    background: "var(--surface)", border: "1px solid var(--line)" }}>{answers[partKey]}</p>
                ) : null}
                {revealScheme && part.answer && (
                  <div style={{ marginTop: 8 }}><SchemeList text={part.answer} /></div>
                )}
              </div>
            );
          })}
        </div>
      ) : !readOnly ? (
        <textarea value={answers[`${question.id}::0`] ?? ""} onChange={(e) => onAnswer(`${question.id}::0`, e.target.value)} placeholder="Write your answer…" className="textarea" />
      ) : (answers[`${question.id}::0`] ?? "").trim() ? (
        <p style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.55, padding: "8px 10px", borderRadius: 8,
          background: "var(--surface)", border: "1px solid var(--line)" }}>{answers[`${question.id}::0`]}</p>
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

// Side panel that shows the question's ORIGINAL past-paper PDF, jumped to the page
// the question is on, so a student can compare it against the extracted crop
// without leaving the practice list. Resolved server-side from the question's
// identity (subject/year/session/paper/variant, which the paper's filename
// encodes) — the backend also locates the page by matching the question text.
// A small, draggable floating window showing the original paper (jumped to the
// question's page). No scrim — the page behind stays fully usable so the window
// can be dragged aside to compare. Move it by its title bar; resize from the
// bottom-right corner.
function PaperModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const DEF_W = 420, DEF_H = 460;
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState({ w: DEF_W, h: DEF_H });
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const resize = useRef<{ px: number; py: number; w: number; h: number } | null>(null);

  useEffect(() => {
    setMounted(true);
    // open small, docked to the right, clamped to the viewport
    const w = Math.min(DEF_W, window.innerWidth - 24);
    const h = Math.min(DEF_H, window.innerHeight - 24);
    setSize({ w, h });
    setPos({ x: Math.max(12, window.innerWidth - w - 16), y: Math.max(12, (window.innerHeight - h) / 2) });
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted || !pos) return null;

  const startDrag = (e: ReactPointerEvent) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ox: pos.x, oy: pos.y };
  };
  const startResize = (e: ReactPointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    resize.current = { px: e.clientX, py: e.clientY, w: size.w, h: size.h };
  };
  const onMove = (e: ReactPointerEvent) => {
    if (drag.current) {
      const nx = drag.current.ox + (e.clientX - drag.current.px);
      const ny = drag.current.oy + (e.clientY - drag.current.py);
      // keep the title bar reachable on screen
      setPos({
        x: Math.min(Math.max(-size.w + 80, nx), window.innerWidth - 80),
        y: Math.min(Math.max(0, ny), window.innerHeight - 40),
      });
    } else if (resize.current) {
      setSize({
        w: Math.max(320, Math.min(resize.current.w + (e.clientX - resize.current.px), window.innerWidth - pos.x - 8)),
        h: Math.max(260, Math.min(resize.current.h + (e.clientY - resize.current.py), window.innerHeight - pos.y - 8)),
      });
    }
  };
  const endMove = () => { drag.current = null; resize.current = null; };

  // Portal INTO the app's .pr root so the theme vars resolve; portaling to body
  // and adding className="pr" would repaint .pr's full-viewport background over
  // the page. .pr has no transform, so fixed positioning still tracks the viewport.
  const target = (typeof document !== "undefined" && document.querySelector(".pr")) || (typeof document !== "undefined" ? document.body : null);
  if (!target) return null;

  return createPortal(
    <div
      role="dialog"
      aria-label={title}
      onPointerMove={onMove}
      onPointerUp={endMove}
      onPointerCancel={endMove}
      style={{
        position: "fixed", left: pos.x, top: pos.y, width: size.w, height: size.h,
        zIndex: 3000, background: "var(--surface)", color: "var(--ink)",
        border: "1px solid var(--line-strong, var(--line))", borderRadius: 12,
        boxShadow: "0 24px 60px -12px rgba(0,0,0,.45)", overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}
    >
      <div
        onPointerDown={startDrag}
        className="row-between"
        style={{
          gap: 10, padding: "9px 10px 9px 12px", background: "var(--surface)",
          borderBottom: "1px solid var(--line)", cursor: "grab", userSelect: "none",
          touchAction: "none",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 12.5, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {title}
        </span>
        <div className="flex gap-8 items-center" style={{ flex: "none" }} onPointerDown={(e) => e.stopPropagation()}>
          <a className="icon-btn" href={url} target="_blank" rel="noopener noreferrer"
            title="Open in a new tab" aria-label="Open in a new tab"
            style={{ width: 26, height: 26, border: "1px solid var(--line)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="file_text" size={14} />
          </a>
          <button className="icon-btn" onClick={onClose} title="Close" aria-label="Close"
            style={{ width: 26, height: 26, border: "1px solid var(--line)" }}>
            <Icon name="x" size={14} />
          </button>
        </div>
      </div>
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        <iframe src={url} title={title} style={{ width: "100%", height: "100%", border: 0, background: "#525659", display: "block" }} />
        {/* resize grip (bottom-right) */}
        <div
          onPointerDown={startResize}
          title="Drag to resize"
          style={{
            position: "absolute", right: 0, bottom: 0, width: 18, height: 18,
            cursor: "nwse-resize", touchAction: "none",
            background: "linear-gradient(135deg, transparent 50%, var(--line-strong, #999) 50%)",
          }}
        />
      </div>
    </div>,
    target,
  );
}

function OpenPaperButton({ question }: { question: PracticeQuestion }) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [panel, setPanel] = useState<{ url: string; title: string } | null>(null);

  const refName = (() => {
    const p = question.reference && (question.reference as Record<string, unknown>).past_paper_pdf;
    return typeof p === "string" ? p : "";
  })();

  const canResolve = Boolean(refName || (question.subject && question.year && question.session && question.paper));
  if (!canResolve) return null;

  const openPaper = async () => {
    if (state === "loading") return;
    setState("loading");
    try {
      const qs = new URLSearchParams();
      if (refName) qs.set("name", refName);
      else {
        qs.set("subject", question.subject);
        qs.set("year", question.year);
        qs.set("session", question.session);
        qs.set("paper", question.paper);
        if (question.variant) qs.set("variant", question.variant);
      }
      // send the question text so the backend can find which page it is on
      if (question.questionText) qs.set("text", question.questionText.slice(0, 400));
      const res = await apiCall(`/papers/find-qp?${qs.toString()}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { viewUrl?: string; page?: number | null; name?: string };
      if (!data.viewUrl) throw new Error("no url");
      const url = `${getApiUrl()}${data.viewUrl}${data.page ? `#page=${data.page}` : ""}`;
      const title = `${data.name || "Past paper"}${data.page ? ` — p.${data.page}` : ""}`;
      setPanel({ url, title });
      setState("idle");
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2500);
    }
  };

  const label = state === "loading" ? "Opening…" : state === "error" ? "Not found" : "View in paper";
  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); openPaper(); }}
        disabled={state === "loading"}
        title="See this question in the original past paper"
        aria-label="See this question in the original past paper"
        style={{
          display: "inline-flex", alignItems: "center", gap: 5, flex: "none",
          height: 26, padding: "0 9px", borderRadius: 999, cursor: "pointer",
          fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap",
          background: "var(--surface-2)",
          border: "1px solid " + (state === "error" ? "var(--coral, #e11d48)" : "var(--line)"),
          color: state === "error" ? "var(--coral, #e11d48)" : "var(--ink-soft, var(--ink))",
        }}
      >
        <Icon name={state === "loading" ? "refresh" : "eye"} size={13}
          className={state === "loading" ? "spin" : undefined} />
        {label}
      </button>
      {panel && <PaperModal url={panel.url} title={panel.title} onClose={() => setPanel(null)} />}
    </>
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
          <OpenPaperButton question={question} />
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
      <input ref={inputRef} type="file" accept={UPLOAD_ACCEPT_ATTR} style={{ display: "none" }} disabled={busy}
        onChange={(e) => { pick(e.target.files); e.currentTarget.value = ""; }} />
      <div className="flex items-center gap-8" style={{ color: "var(--ink-soft)", fontSize: 13, fontWeight: 500 }}>
        <Icon name={busy ? "refresh" : graded ? "check_circle" : "upload"} size={16} className={busy ? "spin" : ""} style={{ color: "var(--crimson)" }} />
        {busy ? "Marking your answer…" : graded ? "Upload another photo to re-mark" : "Upload a photo of your answer"}
      </div>
      <div className="faint" style={{ fontSize: 11, marginTop: 5 }}>JPG, PNG or PDF · maximum 15 MB</div>
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

  // A deep link from Past Papers carries ?level=olevel|alevel; adopt it before any
  // data load so the whole page (subjects, this paper, and "view in paper") uses the
  // right level even on a fresh visit where localStorage isn't set yet.
  const levelSyncedRef = useRef(false);
  if (!levelSyncedRef.current && typeof window !== "undefined") {
    levelSyncedRef.current = true;
    const lvl = searchParams?.get("level");
    if (lvl === "alevel" || lvl === "olevel") {
      try { window.localStorage.setItem("propel_paper_level", lvl); } catch { /* ignore */ }
    }
  }

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
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; name: string } | null>(null);
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
  const [revealResults, setRevealResults] = useState(false);
  const [portalMounted, setPortalMounted] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const justGradedRef = useRef(false);
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
  // per-question grading (topic drills): id -> result, and in-flight ids
  const [oneResults, setOneResults] = useState<Record<string, GradedQuestion>>({});
  const [oneGrading, setOneGrading] = useState<Record<string, boolean>>({});

  const [topicTotal, setTopicTotal] = useState(0);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState(false);
  const checkedLoggedRef = useRef(false); // ensures MCQ attempts log once per check
  const [showScheme, setShowScheme] = useState(false);

  const [subjTick, setSubjTick] = useState(0); // bumped when the student edits their subjects
  const [selectedCount, setSelectedCount] = useState(0);
  useEffect(() => {
    const onChange = () => { setSubjTick((t) => t + 1); setSelectedCount(loadSelectedSubjects().length); };
    onChange();
    window.addEventListener("propel:selected-subjects-change", onChange);
    return () => window.removeEventListener("propel:selected-subjects-change", onChange);
  }, []);

  // ---- subjects metadata (cached for instant paint, then revalidated) ----
  useEffect(() => {
    let mounted = true;
    const normName = (s: string) => s.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/\d+/g, " ").replace(/[^a-z]+/g, " ").trim();
    // Show only the subjects the student picked (whole-word match so "Mathematics"
    // never pulls in "Additional Mathematics"). Fall back to the full catalog if
    // they've chosen none, or none of theirs exist in the bank.
    const filterToSelected = (raw: SubjectMeta[]) => {
      const list = raw.filter((s) => !isExcludedSubject(s.name)); // hide e.g. Additional Mathematics
      const selected = loadSelectedSubjects().map((s) => s.name).filter((s) => !isExcludedSubject(s)).map(normName).filter(Boolean);
      if (!selected.length) return []; // nothing selected → prompt to pick subjects
      // Only the student's selected subjects that actually exist in the practice
      // bank. NEVER fall back to the full list — that leaked O-level subjects into
      // an A-level session (which has no practice content yet).
      return list.filter((s) => {
        const f = normName(s.name);
        return selected.some((n) => f === n || f.startsWith(`${n} `) || n.startsWith(`${f} `));
      });
    };
    const prepare = (list: SubjectMeta[]) => filterToSelected([...list].sort((a, b) => {
      const ai = preferredSubjects.indexOf(a.name);
      const bi = preferredSubjects.indexOf(b.name);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      return a.name.localeCompare(b.name);
    }));
    const lvl = paperLevelParam();
    const cacheKey = `pp:practice:subjects:${lvl}`;
    const cached = cacheGet<SubjectMeta[]>(cacheKey, 30 * 60 * 1000);
    if (cached && cached.length) { setSubjects(prepare(cached)); setLoadingMeta(false); }
    (async () => {
      if (!cached) { setLoadingMeta(true); setError(""); }
      try {
        const response = await fetch(`/api/paper-practice?level=${lvl}`);
        if (!response.ok) throw new Error("Could not load practice metadata.");
        const data = (await response.json()) as { subjects: SubjectMeta[] };
        if (!mounted) return;
        cacheSet(cacheKey, data.subjects ?? []);
        setSubjects(prepare(data.subjects ?? []));
      } catch (loadError) {
        if (mounted && !cached) setError(loadError instanceof Error ? loadError.message : "Could not load practice metadata.");
      } finally {
        if (mounted) setLoadingMeta(false);
      }
    })();
    return () => { mounted = false; };
  }, [subjTick]);

  useEffect(() => setPortalMounted(true), []);

  // ---- saved practice sessions (local seed → remote revalidate) ----
  useEffect(() => {
    let mounted = true;
    // Instant paint from the local mirror so the grid isn't stuck on "loading".
    const seed = loadPracticeProgressLocal();
    if (seed.length) setProgressMap(new Map(seed.map((item) => [item.paperKey, item])));
    loadPracticeProgressList(getToken).then((items) => {
      if (mounted) setProgressMap(new Map(items.map((item) => [item.paperKey, item])));
    });
    const refreshToken = () => {
      void getToken({ skipCache: true }).then((token) => { if (token) tokenRef.current = token; }).catch(() => {});
    };
    refreshToken();
    const tokenTimer = window.setInterval(refreshToken, 25_000);
    return () => { mounted = false; window.clearInterval(tokenTimer); };
  }, [getToken]);

  const currentSubject = useMemo(() => subjects.find((s) => s.name === selectedSubject) ?? null, [selectedSubject, subjects]);
  const currentTypeMeta = currentSubject?.types[questionType] ?? null;
  const availableYears = currentTypeMeta?.years ?? [];
  // Hide the catch-all "Uncategorised" bucket — it isn't a real revision topic.
  // (Data uses the British spelling, so match the "uncategor" prefix.)
  const availableTopics = (currentTypeMeta?.topics ?? []).filter((t) => !t.name.trim().toLowerCase().startsWith("uncategor"));

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
    setRevealResults(false);
    setOneResults({});
    setOneGrading({});
    setOpenMap({});
    touchedIdsRef.current = new Set();
    restoredKeyRef.current = null;
    interactedRef.current = false;
  }

  // Re-hydrate topic answers + marked results for the loaded questions (localStorage).
  function restoreTopicPractice(loaded: PracticeQuestion[]) {
    const blob = readTopicPractice();
    const ids = new Set(loaded.map((q) => q.id));
    const mcq: Record<string, string> = {};
    const parts: Record<string, string> = {};
    const results: Record<string, GradedQuestion> = {};
    for (const [key, value] of Object.entries(blob.mcq)) if (ids.has(key)) mcq[key] = value;
    for (const [key, value] of Object.entries(blob.parts)) if (ids.has(key.split("::")[0])) parts[key] = value;
    for (const [key, value] of Object.entries(blob.results)) if (ids.has(key)) results[key] = value;
    if (Object.keys(mcq).length) setMcqAnswers((prev) => ({ ...prev, ...mcq }));
    if (Object.keys(parts).length) setPartAnswers((prev) => ({ ...prev, ...parts }));
    if (Object.keys(results).length) setOneResults((prev) => ({ ...prev, ...results }));
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
        const params = new URLSearchParams({ subject: selectedSubject, type: questionType, topic: selectedTopic, mode: "topic", limit: String(TOPIC_PAGE), offset: "0", level: paperLevelParam() });
        const response = await fetch(`/api/paper-practice?${params.toString()}`);
        if (!response.ok) throw new Error("Could not load topic questions.");
        const data = (await response.json()) as { questions: PracticeQuestion[]; total: number };
        if (mounted) { setQuestions(data.questions ?? []); setTopicTotal(data.total ?? 0); restoreTopicPractice(data.questions ?? []); }
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
      const params = new URLSearchParams({ subject: selectedSubject, type: questionType, topic: selectedTopic, mode: "topic", limit: String(TOPIC_PAGE), offset: String(questions.length), level: paperLevelParam() });
      const response = await fetch(`/api/paper-practice?${params.toString()}`);
      if (!response.ok) throw new Error("Could not load more questions.");
      const data = (await response.json()) as { questions: PracticeQuestion[]; total: number };
      setQuestions((prev) => [...prev, ...(data.questions ?? [])]);
      setTopicTotal((prev) => data.total ?? prev);
      restoreTopicPractice(data.questions ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load more questions.");
    } finally {
      setLoadingMore(false);
    }
  }

  // Persist topic answers + marked results (debounced), merged by question id so
  // switching topics never drops another topic's saved work.
  useEffect(() => {
    if (practiceMode !== "topic") return;
    const id = setTimeout(() => {
      const blob = readTopicPractice();
      writeTopicPractice({
        mcq: { ...blob.mcq, ...pruneAnswers(mcqAnswers) },
        parts: { ...blob.parts, ...pruneAnswers(partAnswers) },
        results: { ...blob.results, ...oneResults },
      });
    }, 600);
    return () => clearTimeout(id);
  }, [practiceMode, mcqAnswers, partAnswers, oneResults]);

  // ---- PAPER mode: available papers ----
  useEffect(() => {
    if (practiceMode !== "paper" || !selectedSubject || !selectedYear) { setPapers([]); return; }
    let mounted = true;
    (async () => {
      try {
        const params = new URLSearchParams({ subject: selectedSubject, type: questionType, year: selectedYear, papers: "1", level: paperLevelParam() });
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
        const params = new URLSearchParams({ subject: selectedSubject, year: paper.year, session: paper.session, paper: paper.paper, variant: paper.variant, level: paperLevelParam() });
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
  const reportStats = reportAnswerStats(report);
  const headerAnswered = reportStats ? reportStats.answered : solveMode === "handwritten" ? "—" : answeredCount;
  const headerScore = reportStats
    ? `${reportStats.earned}/${reportStats.max}`
    : questionType === "mcq" && checked ? `${score}/${gradable.length}` : "—";

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
      answeredCount: reportStats?.answered ?? answeredUnits,
      totalCount: reportStats?.total ?? totalUnits,
      timerDurationSeconds: timerDuration,
      timerElapsedSeconds: timerElapsedRef.current,
      startedAt: startedAtRef.current ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [currentPaperKey, selectedPaper, selectedSubject, solveMode, paperStatus, mcqAnswers, partAnswers, uploads, answeredUnits, totalUnits, timerDuration, reportStats]);

  const doSave = useCallback(async (overrides?: Partial<Pick<PracticeProgress, "status" | "solveMode">>) => {
    const doc = buildDoc(overrides);
    if (!doc) return;
    const firstSave = !hasRowRef.current;
    setSavingState("saving");
    getToken().then((token) => { if (token) tokenRef.current = token; }).catch(() => {});
    try {
      const saved = await savePracticeProgress(doc, getToken);
      startedAtRef.current = saved.startedAt;
      hasRowRef.current = true;
      setUploads(saved.uploads ?? []);
      setProgressMap((prev) => { const next = new Map(prev ?? []); next.set(saved.paperKey, saved); return next; });
      setSavingState("saved"); setLastSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      if (firstSave && selectedPaper && selectedSubject && currentPaperKey) {
        void syncPracticePaperTracking({
          paperKey: currentPaperKey, subject: selectedSubject, year: selectedPaper.year,
          session: selectedPaper.session, paper: selectedPaper.paper, variant: selectedPaper.variant,
        }, "in_progress", getToken);
      }
    } catch {
      setSavingState("error");
    }
  }, [buildDoc, getToken, selectedPaper, selectedSubject, currentPaperKey]);

  // restore a saved session (or start a fresh one) once the paper's questions arrive
  useEffect(() => {
    if (practiceMode !== "paper" || !currentPaperKey || loadingQuestions || questions.length === 0) return;
    if (progressMap === null) return; // wait for the saved-session list
    if (restoredKeyRef.current === currentPaperKey) return;
    restoredKeyRef.current = currentPaperKey;
    interactedRef.current = false;

    const saved = progressMap.get(currentPaperKey);
    const fallbackDuration = paperDurationSeconds(selectedSubject, selectedPaper?.paper ?? "", selectedPaper?.isMcq ?? false);
    setRevealResults(false);
    if (saved) {
      let mcq = saved.answers?.mcq ?? {};
      let parts = saved.answers?.parts ?? {};
      // Older handwritten reports stored the transcription only on the graded
      // questions. Fill the same Solve-here slots so the paper looks identical.
      if (
        saved.solveMode === "handwritten" && saved.report?.perQuestion?.length
        && Object.keys(mcq).length === 0 && Object.keys(parts).length === 0
      ) {
        const hydratedMcq: Record<string, string> = {};
        const hydratedParts: Record<string, string> = {};
        for (const q of questions) {
          const graded = saved.report.perQuestion.find((item) => item.id === q.id);
          if (!graded) continue;
          const slotted = slotAnswersFromGraded(q, graded);
          if (slotted.mcq) hydratedMcq[q.id] = slotted.mcq;
          Object.assign(hydratedParts, slotted.parts);
        }
        mcq = hydratedMcq;
        parts = hydratedParts;
      }
      setMcqAnswers(mcq);
      setPartAnswers(parts);
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
      // reopening a paper starts with no manual expand/collapse overrides and
      // nothing "touched" — so the derived collapse minimises already-answered
      // questions on open.
      setOpenMap({});
      touchedIdsRef.current = new Set();
    } else {
      setTimerDuration(fallbackDuration);
      timerElapsedRef.current = 0;
      setTimerStartElapsed(0);
      setTimerStarted(false); // fresh paper — the exam clock waits for Start
      setTimerRunning(false);
      startedAtRef.current = null;
      hasRowRef.current = false;
      setSavingState("idle");
      setOpenMap({});
      touchedIdsRef.current = new Set();
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

  // flush on tab hide / close so nothing typed is ever lost. Do not listen to
  // window blur — DevTools and clicking away would 401-spam with a stale JWT.
  useEffect(() => {
    const flush = () => {
      if (!currentPaperKey || restoredKeyRef.current !== currentPaperKey) return;
      if (!interactedRef.current && !hasRowRef.current) return;
      if (!isClerkTokenFresh(tokenRef.current, 0)) return;
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
    void doSave({ solveMode: mode });
  }

  function toggleCompleted() {
    interactedRef.current = true;
    const next: PracticeStatus = paperStatus === "completed" ? "in_progress" : "completed";
    setPaperStatus(next);
    if (next === "completed") {
      setTimerRunning(false);
      if (currentPaperKey && selectedPaper && selectedSubject) {
        void syncPracticePaperTracking({
          paperKey: currentPaperKey, subject: selectedSubject, year: selectedPaper.year,
          session: selectedPaper.session, paper: selectedPaper.paper, variant: selectedPaper.variant,
        }, "completed", getToken);
      }
    }
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

  /**
   * Upload the picked files one at a time, reporting per-file progress. A file
   * that fails is named and skipped rather than aborting the whole batch, so one
   * bad photo doesn't discard the pages that were fine.
   */
  async function handleFiles(list: FileList | null) {
    if (!list || !currentPaperKey) return;
    const picked = Array.from(list);
    setError("");

    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const file of picked) {
      const problem = validateUploadFile(file);
      if (problem) rejected.push(problem);
      else accepted.push(file);
    }
    const room = MAX_UPLOAD_FILES - uploads.length;
    if (accepted.length > room) {
      rejected.push(
        room <= 0
          ? `You already have ${MAX_UPLOAD_FILES} files attached — remove one before adding more.`
          : `Only ${room} more file${room === 1 ? "" : "s"} can be attached (limit ${MAX_UPLOAD_FILES}).`,
      );
      accepted.length = Math.max(0, room);
    }
    if (accepted.length === 0) {
      setError(rejected.join(" ") || "Nothing to upload.");
      return;
    }

    setUploadBusy(true);
    const failures = [...rejected];
    try {
      for (let index = 0; index < accepted.length; index++) {
        const file = accepted[index];
        setUploadProgress({ current: index + 1, total: accepted.length, name: file.name });
        try {
          const item = await uploadPracticeFile(currentPaperKey, file, getToken);
          if (item) {
            setUploads(item.uploads ?? []);
            setProgressMap((prev) => { const next = new Map(prev ?? []); next.set(item.paperKey, item); return next; });
            hasRowRef.current = true;
            startedAtRef.current = item.startedAt;
            setSavingState("saved"); setLastSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
            if (index === 0 && selectedPaper && selectedSubject && currentPaperKey) {
              void syncPracticePaperTracking({
                paperKey: currentPaperKey, subject: selectedSubject, year: selectedPaper.year,
                session: selectedPaper.session, paper: selectedPaper.paper, variant: selectedPaper.variant,
              }, "in_progress", getToken);
            }
          }
        } catch (uploadError) {
          failures.push(`${file.name}: ${uploadError instanceof Error ? uploadError.message : "upload failed"}.`);
        }
      }
    } finally {
      setUploadBusy(false);
      setUploadProgress(null);
      if (failures.length > 0) setError(failures.join(" "));
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
      .map((q) => attemptFromMcq(q, mcqAnswers[q.id], q.correctOption, mcqAnswerExtra(q, mcqAnswers[q.id], q.correctOption)));
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
      setRevealResults(false);
      setOpenMap({});
      touchedIdsRef.current = new Set();
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

  const buildGradeQuestions = (): GradeQuestionInput[] => {
    const mapped = questions.map(toGradeInput);
    if (solveMode !== "handwritten") return mapped;
    // Uploaded papers are marked from the transcription only — never mix in a
    // leftover typed draft from an earlier Solve-here attempt on the same paper.
    return mapped.map((q) => ({ ...q, studentOption: null, studentParts: {}, studentAnswer: null }));
  };

  // D — collapse solved/marked questions when a paper is reopened. Derived from
  // the CURRENT answers every render (no snapshot/effect timing to get out of
  // sync): a paper question is collapsed by default once it's fully answered or
  // already marked, UNLESS the student has touched it this session (actively
  // working on it) or manually toggled it. On a reopen nothing is touched yet,
  // so every already-answered question opens minimized.
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const touchedIdsRef = useRef<Set<string>>(new Set());
  const markTouched = (id: string) => { touchedIdsRef.current.add(id); };

  // paper-mode per-question results, keyed by question id (from the saved report)
  const resultById = useMemo(() => {
    const map: Record<string, GradedQuestion> = {};
    for (const r of report?.perQuestion ?? []) map[r.id] = r;
    return map;
  }, [report]);

  const isQuestionFullyAnswered = (q: PracticeQuestion): boolean => {
    if (q.type === "mcq") return Boolean(mcqAnswers[q.id]?.trim());
    if (q.parts.length) return q.parts.every((part, i) => isHeaderPart(q.parts, part.label) || Boolean(partAnswers[`${q.id}::${i}`]?.trim()));
    return Boolean(partAnswers[`${q.id}::0`]?.trim());
  };
  // Collapse (minimise) a question once it's marked or fully answered — in BOTH
  // paper and by-topic mode — unless it's been touched this session. resultById
  // holds paper-mode marks; oneResults holds by-topic marks.
  const collapsedByDefault = (q: PracticeQuestion): boolean => {
    if (revealResults && (resultById[q.id] || oneResults[q.id])) return false;
    return !touchedIdsRef.current.has(q.id) && (Boolean(resultById[q.id]) || Boolean(oneResults[q.id]) || isQuestionFullyAnswered(q));
  };
  const isQuestionOpen = (q: PracticeQuestion): boolean => openMap[q.id] ?? !collapsedByDefault(q);
  const toggleQuestionOpen = (q: PracticeQuestion) =>
    setOpenMap((prev) => ({ ...prev, [q.id]: !(prev[q.id] ?? !collapsedByDefault(q)) }));
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
      markTouched(q.id); // keep it open right after marking; it collapses on reopen
      setOneResults((prev) => ({ ...prev, [q.id]: result }));
      void logAttempts([attemptFromGraded(q, result, structuredAnswerExtra(q, partAnswers, q.id))], getToken);
    } catch (gradeError) {
      setError(gradeError instanceof Error ? gradeError.message : "Grading failed. Please try again.");
    } finally {
      setOneGrading((prev) => ({ ...prev, [q.id]: false }));
    }
  }

  async function gradeOneFromImage(q: PracticeQuestion, file: File) {
    if (!selectedSubject || oneGrading[q.id]) return;
    const problem = validateUploadFile(file);
    if (problem) { setError(problem); return; }
    setOneGrading((prev) => ({ ...prev, [q.id]: true }));
    setError("");
    try {
      const result = await gradeOneImage(selectedSubject, toGradeInput(q), file, getToken);
      markTouched(q.id); // keep it open right after marking; it collapses on reopen
      setOneResults((prev) => ({ ...prev, [q.id]: result }));
      const slotted = slotAnswersFromGraded(q, result);
      if (slotted.mcq) setMcqAnswers((prev) => ({ ...prev, [q.id]: slotted.mcq as string }));
      if (Object.keys(slotted.parts).length) setPartAnswers((prev) => ({ ...prev, ...slotted.parts }));
      // Handwritten: the read text is what the student "wrote" — use the slotted answers.
      const mergedParts = { ...partAnswers, ...slotted.parts };
      const imgExtra = q.type === "mcq"
        ? mcqAnswerExtra(q, slotted.mcq || mcqAnswers[q.id], q.correctOption)
        : structuredAnswerExtra(q, mergedParts, q.id);
      void logAttempts([attemptFromGraded(q, result, imgExtra)], getToken);
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
      justGradedRef.current = true;
      setRevealResults(true);
      setOpenMap(Object.fromEntries(graded.perQuestion.map((q) => [q.id, true])));
      for (const q of graded.perQuestion) markTouched(q.id);
      setPaperStatus("completed");
      setTimerRunning(false);
      if (solveMode === "handwritten") {
        const serverMcq = item.answers?.mcq ?? {};
        const serverParts = item.answers?.parts ?? {};
        if (Object.keys(serverMcq).length || Object.keys(serverParts).length) {
          setMcqAnswers(serverMcq);
          setPartAnswers(serverParts);
        } else {
          const mcq: Record<string, string> = {};
          const parts: Record<string, string> = {};
          for (const q of questions) {
            const result = graded.perQuestion.find((item) => item.id === q.id);
            if (!result) continue;
            const slotted = slotAnswersFromGraded(q, result);
            if (slotted.mcq) mcq[q.id] = slotted.mcq;
            Object.assign(parts, slotted.parts);
          }
          setMcqAnswers(mcq);
          setPartAnswers(parts);
        }
      }
      // Phase 1 — log every graded question to the attempts backbone (mastery, predicted grade, notebook)
      const finalMcq: Record<string, string> = solveMode === "handwritten" ? (item.answers?.mcq ?? {}) : mcqAnswers;
      const finalParts: Record<string, string> = solveMode === "handwritten" ? (item.answers?.parts ?? {}) : partAnswers;
      const paperExtras: Record<string, AnswerExtra> = {};
      for (const q of questions) {
        paperExtras[q.id] = q.type === "mcq"
          ? mcqAnswerExtra(q, finalMcq[q.id], q.correctOption)
          : structuredAnswerExtra(q, finalParts, q.id);
      }
      void logAttempts(attemptsFromReport(graded.perQuestion, questions, paperExtras), getToken);
      if (selectedPaper) {
        void syncPracticePaperTracking({
          paperKey: currentPaperKey, subject: selectedSubject, year: selectedPaper.year,
          session: selectedPaper.session, paper: selectedPaper.paper, variant: selectedPaper.variant,
        }, "completed", getToken);
      }
      setUploads(item.uploads ?? []);
      hasRowRef.current = true;
      setProgressMap((prev) => { const next = new Map(prev ?? []); next.set(item.paperKey, item); return next; });
    } catch (gradeError) {
      setError(gradeError instanceof Error ? gradeError.message : "Grading failed. Please try again.");
    } finally {
      setGrading(false);
    }
  }

  useEffect(() => {
    if (!justGradedRef.current || !report) return;
    justGradedRef.current = false;
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [report]);

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
                  { label: "Answered", value: headerAnswered },
                  { label: "Score", value: headerScore },
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
          ) : subjects.length === 0 ? (
            selectedCount === 0 ? (
              <EmptyState
                icon="book"
                title="Select your subjects first"
                body="Pick your subjects in Settings → Manage subjects to practise them here."
                cta="Manage subjects"
                onCta={() => window.dispatchEvent(new CustomEvent("propel:open-settings", { detail: "profile" }))}
              />
            ) : (
              <EmptyState
                icon="book"
                title="No practice for these subjects yet"
                body="We don't have practice questions for your selected subjects at this level yet — try your Past Papers, or switch level in Settings."
              />
            )
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
                    {reportStats
                      ? <span className="badge teal" style={{ fontSize: 11.5 }}>{reportStats.answered}/{reportStats.total} answered</span>
                      : solveMode !== "handwritten" && totalUnits > 0 && <span className="badge neutral" style={{ fontSize: 11.5 }}>{answeredUnits}/{totalUnits} answered</span>}
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
              {reportStats ? (
                <div className="flex items-center gap-8">
                  <span className="faint" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{reportStats.answered}/{reportStats.total} answered</span>
                  <div style={{ width: 72 }}><Bar value={reportStats.total ? Math.round((reportStats.answered / reportStats.total) * 100) : 0} tone="teal" height={6} /></div>
                </div>
              ) : solveMode === "digital" ? (
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
              <button className="btn btn-primary btn-sm" onClick={gradePaper} disabled={grading || uploadBusy || !hasAnyAnswer}
                title={!hasAnyAnswer ? (solveMode === "handwritten" ? "Upload your answers first" : "Answer at least one question first") : uploadBusy ? "Wait for the upload to finish" : "Mark this paper with AI"}>
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
          ) : displayQuestions.length > 0 ? (
            <div ref={resultsRef} className="flex-col gap-16" style={{ display: "flex" }}>
              {practiceMode === "paper" && solveMode === "handwritten" && (
                <HandwrittenStudio uploads={uploads} busy={uploadBusy} progress={uploadProgress}
                  questionCount={displayQuestions.length}
                  onFiles={(files) => void handleFiles(files)} onRemove={(path) => void handleRemoveUpload(path)} />
              )}
              {practiceMode === "paper" && solveMode === "handwritten" && report?.extraction && (
                <ExtractionPanel extraction={report.extraction} />
              )}
              {displayQuestions.map((question) => (
                <QuestionCard key={question.id} question={question} showYear={practiceMode === "topic"}
                  mcqAnswer={mcqAnswers[question.id]} partAnswers={partAnswers} checked={checked} showScheme={showScheme}
                  readOnly={practiceMode === "paper" && solveMode === "handwritten"}
                  onMcqAnswer={(value) => { interactedRef.current = true; markTouched(question.id); setMcqAnswers((c) => ({ ...c, [question.id]: value })); }}
                  onPartAnswer={(partKey, value) => { interactedRef.current = true; markTouched(question.id); setPartAnswers((c) => ({ ...c, [partKey]: value })); }}
                  onGradeOne={practiceMode === "topic" && question.type === "structured" ? () => gradeOne(question) : undefined}
                  onGradeImage={practiceMode === "topic" && question.type === "structured" ? (file) => gradeOneFromImage(question, file) : undefined}
                  topicMode={topicSolveMode === "handwritten" ? "upload" : "type"}
                  // scheme only unlocks once this question is marked (topic) or the paper is graded (paper)
                  schemeUnlocked={practiceMode === "topic" ? Boolean(oneResults[question.id]) : Boolean(report)}
                  gradeResult={practiceMode === "topic" ? oneResults[question.id] : resultById[question.id]}
                  gradingOne={Boolean(oneGrading[question.id])}
                  // D — solved/marked questions open minimized with a dropdown (paper + topic)
                  collapsed={!isQuestionOpen(question)}
                  onToggleCollapsed={() => toggleQuestionOpen(question)} />
              ))}

              {practiceMode === "topic" && questions.length < topicTotal && !query.trim() && (
                <button onClick={loadMoreTopic} disabled={loadingMore} className="btn btn-secondary btn-block" style={{ height: 48 }}>
                  {loadingMore ? <><Icon name="refresh" size={16} className="spin" /> Loading…</> : `Load more (${questions.length} of ${topicTotal})`}
                </button>
              )}
            </div>
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

          {/* how the upload was read — only on handwritten attempts */}
          {report.extraction && <ExtractionPanel extraction={report.extraction} />}

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

/* ---- handwritten attempts: what we read, and what we couldn't ---- */
function ExtractionPanel({ extraction }: { extraction: ExtractionSummary }) {
  const problems = extraction.unreadableCount + extraction.notFoundCount;
  const tone = extraction.paperMismatch || problems > 0
    ? { border: "var(--coral-soft)", fg: "var(--coral-bright)", icon: "alert" as const }
    : extraction.lowConfidenceCount > 0
      ? { border: "var(--amber-soft)", fg: "var(--amber-deep)", icon: "alert" as const }
      : { border: "var(--teal-soft)", fg: "var(--teal-deep)", icon: "check" as const };

  const counts = [
    { label: "Read clearly", value: extraction.readCount, fg: "var(--teal-deep)" },
    { label: "Low confidence", value: extraction.lowConfidenceCount, fg: "var(--amber-deep)" },
    { label: "Couldn't read", value: extraction.unreadableCount, fg: "var(--coral-bright)" },
    { label: "Left blank", value: extraction.blankCount, fg: "var(--ink-faint)" },
    { label: "Not on pages", value: extraction.notFoundCount, fg: "var(--ink-faint)" },
  ].filter((entry) => entry.value > 0);

  return (
    <div className="card card-pad" style={{ borderColor: tone.border }}>
      <div className="flex items-center gap-8" style={{ marginBottom: 8 }}>
        <Icon name={tone.icon} size={16} style={{ color: tone.fg }} />
        <span style={{ fontWeight: 600, fontSize: 14 }}>
          Read from your upload · {extraction.pageCount} page{extraction.pageCount === 1 ? "" : "s"}
        </span>
      </div>

      {counts.length > 0 && (
        <div className="flex gap-8 wrap">
          {counts.map((entry) => (
            <span key={entry.label} style={{ padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600,
              color: entry.fg, background: "var(--surface-2)", whiteSpace: "nowrap" }}>
              {entry.value} {entry.label}
            </span>
          ))}
        </div>
      )}

      {extraction.withheldMarks > 0 && (
        <p style={{ fontSize: 13, lineHeight: 1.5, marginTop: 10, color: "var(--coral-bright)" }}>
          <b>{extraction.withheldMarks} marks were not assessed</b> because those answers could not be read.
          They are excluded from your score rather than counted as wrong — re-upload those pages more clearly to have them marked.
        </p>
      )}

      {extraction.warnings.length > 0 && (
        <ul style={{ margin: "10px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
          {extraction.warnings.map((warning, index) => (
            <li key={index} style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--ink-soft)" }}>{warning}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Per-question read-back so the student can check the marks against their script. */
function ExtractionDetail({ q }: { q: GradedQuestion }) {
  const flag = q.extractionFlag;
  if (!flag || flag === "not_found") return null;

  if (flag === "unreadable") {
    return (
      <div className="flex gap-8 items-start" style={{ marginTop: 8, padding: "8px 10px", borderRadius: 10, background: "var(--coral-soft)" }}>
        <Icon name="alert" size={14} style={{ color: "var(--coral-bright)", flex: "none", marginTop: 1 }} />
        <span style={{ fontSize: 12.5, lineHeight: 1.45, color: "var(--coral-bright)" }}>
          <b>Not marked —</b> we could not read this answer{q.extractionNote ? ` (${q.extractionNote})` : ""}. Its marks are excluded from your score.
        </span>
      </div>
    );
  }
  if (flag === "blank") return null;
  if (!q.extractedAnswer) return null;

  const low = flag === "low_confidence";
  const pct = q.extractionConfidence != null ? Math.round(q.extractionConfidence * 100) : null;
  return (
    <details style={{ marginTop: 8, borderRadius: 10, border: `1px solid ${low ? "var(--amber-soft)" : "var(--line)"}`,
      background: low ? "var(--amber-soft)" : "var(--surface-2)", padding: "8px 11px" }}>
      <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 600, color: low ? "var(--amber-deep)" : "var(--ink-soft)" }}>
        {low ? "Check what we read — unclear handwriting" : "What we read from your page"}
        {pct != null && <span style={{ fontWeight: 500 }}> · {pct}% confidence</span>}
        {q.extractionPages?.length ? <span style={{ fontWeight: 500 }}> · page {q.extractionPages.join(", ")}</span> : null}
      </summary>
      <p style={{ margin: "8px 0 0", fontSize: 12.5, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{q.extractedAnswer}</p>
      {low && (
        <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.45, color: "var(--amber-deep)" }}>
          This was marked on the reading above. If it does not match what you wrote, re-upload a clearer photo of this page.
        </p>
      )}
    </details>
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

/* ---- answers dropdown: full model answer per part + the marks you were awarded ---- */
type PartScore = { label: string; earned: number; max: number };
const normPartLabel = (value: string) => (value || "").trim().toLowerCase().replace(/\s+/g, "");

function AnswerRow({ part, score, hideLabel }: { part: PracticePart; score?: PartScore; hideLabel?: boolean }) {
  const text = (part.answer || "").trim();
  const label = hideLabel ? "" : (part.label || "Answer");
  return (
    <div style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--amber-deep)" }}>
      {(label || score) && (
        <div className="flex items-baseline" style={{ justifyContent: "space-between", gap: 8 }}>
          {label ? <span style={{ fontWeight: 700 }}>{label}</span> : <span />}
          {score && <span style={{ flex: "none", fontWeight: 700 }}>{score.earned} / {score.max}</span>}
        </div>
      )}
      {text && <p style={{ margin: label || score ? "2px 0 0" : 0, whiteSpace: "pre-wrap" }}>{text}</p>}
    </div>
  );
}

function ModelAnswers({ parts = [], partScores, fallbackPoints, fallbackScore }: {
  parts?: PracticePart[];
  partScores?: PartScore[];
  /** examiner-generated model answer, used when the bank has no part answers */
  fallbackPoints?: string[];
  fallbackScore?: PartScore;
}) {
  const [open, setOpen] = useState(true);
  const scoreByLabel = useMemo(() => {
    const map = new Map<string, PartScore>();
    for (const s of partScores ?? []) map.set(normPartLabel(s.label), s);
    return map;
  }, [partScores]);
  const fromBank = useMemo(
    () => parts.filter((p) => {
      if (isHeaderPart(parts, p.label)) return false;
      return Boolean((p.answer || "").trim()) || scoreByLabel.has(normPartLabel(p.label));
    }),
    [parts, scoreByLabel],
  );
  const rows: PracticePart[] = fromBank.length
    ? fromBank
    : (fallbackPoints?.length
      ? [{ label: "", body: "", marks: fallbackScore?.max ?? null, answer: fallbackPoints.join("\n") }]
      : []);
  if (rows.length === 0) return null;
  const toggleLabel = open
    ? "Hide"
    : rows.length === 1
      ? "Show answer"
      : `Show answers · ${rows.length} parts`;
  return (
    <div style={{ marginTop: 8, borderRadius: 10, border: "1px solid var(--amber-soft)", background: "var(--amber-soft)", padding: "9px 11px" }}>
      <div className="row-between" style={{ gap: 8, alignItems: "center", cursor: "pointer" }}
        onClick={() => setOpen((v) => !v)}>
        <span className="eyebrow" style={{ color: "var(--amber-deep)" }}>Answers</span>
        <button type="button" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }} className="btn btn-ghost btn-sm"
          aria-expanded={open} style={{ padding: "2px 8px", fontSize: 11.5, color: "var(--amber-deep)", whiteSpace: "nowrap" }}>
          <Icon name={open ? "chevron_down" : "chevron_right"} size={13} /> {toggleLabel}
        </button>
      </div>
      {open && (
        <div className="flex-col" style={{ display: "flex", gap: 10, marginTop: 8 }}>
          {rows.map((part, index) => (
            <AnswerRow
              key={index}
              part={part}
              hideLabel={!part.label}
              score={scoreByLabel.get(normPartLabel(part.label)) || (fromBank.length === 0 ? fallbackScore : undefined)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionResultRow({ q, parts }: { q: GradedQuestion; parts?: PracticePart[] }) {
  const tone = verdictColor(q.verdict);
  // A withheld question was never assessed, so showing "0 / 6" would read as a
  // zero the student earned. Show the marks as unassessed instead.
  const withheld = q.marksWithheld === true;
  return (
    <div className="card card-pad" style={{ padding: 14, ...(withheld ? { borderColor: "var(--coral-soft)" } : {}) }}>
      <div className="row-between" style={{ gap: 10, alignItems: "flex-start" }}>
        <div className="flex items-center gap-8 wrap" style={{ minWidth: 0 }}>
          <span className="chip-tag badge neutral" style={{ flex: "none" }}>Q{q.questionNumber}</span>
          <span style={{ padding: "2px 9px", borderRadius: 99, fontSize: 12, fontWeight: 600,
            color: withheld ? "var(--coral-bright)" : tone.fg, background: withheld ? "var(--coral-soft)" : tone.bg, whiteSpace: "nowrap" }}>
            {withheld ? (
              q.extractionFlag === "not_found" ? "Not found"
              : q.extractionFlag === "unreadable" ? "Couldn't read"
              : "Marking failed"
            ) : tone.label}
          </span>
          {q.extractionFlag === "low_confidence" && (
            <span title="Read from unclear handwriting — check the transcription below"
              style={{ padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", color: "var(--amber-deep)", background: "var(--amber-soft)" }}>
              Unclear handwriting
            </span>
          )}
          {!withheld && q.gradingSource !== "deterministic" && (
            <span title={q.schemeUsed ? "Marked against this paper's official marking scheme" : "No scheme on file — marked by AI as an examiner"}
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
        <span style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", color: withheld ? "var(--coral-bright)" : tone.fg }}>
          {withheld ? `— / ${q.max}` : `${q.earned} / ${q.max}`}
        </span>
      </div>
      <p style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 8 }}>{q.feedback}</p>
      {/* handwritten attempts: the transcription this mark was based on */}
      <ExtractionDetail q={q} />
      {/* Phase 1 — marks breakdown by assessment objective */}
      {q.breakdown && q.breakdown.length > 0 && <MarkBreakdown items={q.breakdown} />}
      {/* Answers — official scheme when on file, otherwise the examiner's model answer */}
      <ModelAnswers
        parts={parts}
        partScores={q.partScores}
        fallbackPoints={q.expectedPoints}
        fallbackScore={{ label: "Answer", earned: q.earned, max: q.max }}
      />
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
function HandwrittenStudio({ uploads, busy, progress, questionCount, onFiles, onRemove }: {
  uploads: PracticeUpload[]; busy: boolean;
  progress: { current: number; total: number; name: string } | null;
  questionCount?: number;
  onFiles: (files: FileList | null) => void; onRemove: (path: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pct = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
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
        <input ref={inputRef} type="file" accept={UPLOAD_ACCEPT_ATTR} multiple style={{ display: "none" }} disabled={busy}
          onChange={(e) => { onFiles(e.target.files); e.currentTarget.value = ""; }} />
        <div style={{ width: 48, height: 48, borderRadius: 14, background: "var(--crimson-soft)", color: "var(--crimson)", display: "grid", placeItems: "center", marginBottom: 12 }}>
          <Icon name={busy ? "refresh" : "upload"} size={22} className={busy ? "spin" : ""} />
        </div>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{busy ? "Uploading…" : "Upload handwritten answers"}</div>
        {busy && progress ? (
          <div style={{ width: "100%", maxWidth: 300, marginTop: 8 }}>
            <div className="faint" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {progress.name} · {progress.current} of {progress.total}
            </div>
            <div className="bar" style={{ height: 5, marginTop: 6 }}><i style={{ width: `${pct}%`, background: "var(--crimson)" }} /></div>
          </div>
        ) : (
          <>
            <div className="faint" style={{ fontSize: 12.5, marginTop: 4 }}>
              Drag &amp; drop or <span style={{ color: "var(--crimson)", fontWeight: 600 }}>browse</span>
            </div>
            <div className="faint" style={{ fontSize: 11.5, marginTop: 8 }}>JPG, PNG or multi-page PDF · maximum 15 MB per file</div>
          </>
        )}
      </div>

      {/* reading these answers depends entirely on scan quality — say so up front */}
      <p className="faint" style={{ fontSize: 12, lineHeight: 1.5, maxWidth: 460, textAlign: "center", margin: 0 }}>
        {questionCount ? `This paper has ${questionCount} question${questionCount === 1 ? "" : "s"}. ` : ""}
        Write the question number next to each answer, and upload pages in order.
        Flat, well-lit, in-focus pages read most accurately — anything we cannot
        read is flagged rather than guessed at.
      </p>

      {/* uploaded files — compact list */}
      {uploads.length > 0 && (
        <div className="flex-col" style={{ display: "flex", gap: 6, width: "100%", maxWidth: 460 }}>
          {uploads.map((file) => (
            <div key={file.path} className="flex items-center gap-10" style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface-2)" }}>
              <Icon name={file.type === "application/pdf" ? "file_text" : "camera"} size={16} style={{ color: "var(--crimson)", flex: "none" }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
              <span className="faint" style={{ fontSize: 11.5, flex: "none" }}>{Math.max(1, Math.round(file.size / 1024))} KB</span>
              {file.url && (
                <a href={file.url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ flex: "none", padding: "4px 8px" }}>
                  <Icon name="eye" size={14} /> View
                </a>
              )}
              <button className="icon-btn" aria-label={`Remove ${file.name}`} onClick={() => onRemove(file.path)} disabled={busy}
                style={{ width: 28, height: 28, flex: "none" }}>
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
          <div className="faint" style={{ fontSize: 11.5, textAlign: "right" }}>
            {uploads.length} of {MAX_UPLOAD_FILES} files
          </div>
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
