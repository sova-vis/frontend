"use client";

import { useRef, useState } from "react";
import { CheckCircle2, RefreshCw, Upload } from "lucide-react";

/* ==========================================================================
   Shared question card — the SAME look as the student Practice page.
   Reuses the `.pr` reference design system (propel-scoped.css, imported
   globally) so a question renders identically wherever it appears:
     • Practice (self-study)
     • Teacher assignment builder (preview / select) — reveal + readOnly
     • Student classroom (solving an assignment) — answer inputs, no reveal
   The card wraps itself in `.pr` so it can drop into any page.
   ========================================================================== */

export interface SolveOption { label: string; text: string }
export interface SolvePart { label: string; body: string; marks: number | null; answer?: string | null }
export interface SolveImage { src: string; alt?: string; caption?: string; role?: string }

export interface SolveQuestion {
  id: string;
  type: "mcq" | "structured";
  questionNumber?: string;
  topic?: string;
  theme?: string;
  year?: string;
  session?: string;
  paper?: string;
  variant?: string;
  marks?: number | null;
  questionText: string;
  options: SolveOption[];
  correctOption?: string | null;
  markingScheme?: string;
  images: SolveImage[];
  parts: SolvePart[];
}

/* ---- adapters from the two existing question shapes ---- */
// Teacher assignment builder (lib/questionBank BankQuestion).
export function fromBankQuestion(q: {
  uid: string; type: "mcq" | "structured"; questionNumber: string; topic: string; theme: string;
  year: string; session: string; paper: string; variant: string; marks: number | null;
  questionText: string; options: SolveOption[]; correctOption: string | null; markingScheme: string;
  images: { src: string; alt: string }[]; parts: SolvePart[];
}): SolveQuestion {
  return {
    id: q.uid, type: q.type, questionNumber: q.questionNumber, topic: q.topic, theme: q.theme,
    year: q.year, session: q.session, paper: q.paper, variant: q.variant, marks: q.marks,
    questionText: q.questionText, options: q.options ?? [], correctOption: q.correctOption,
    markingScheme: q.markingScheme, images: q.images ?? [], parts: q.parts ?? [],
  };
}

// Student classroom (lib/submissions StudentQuestion). Answers/scheme are never
// sent to the student while solving, so those fields are intentionally absent.
export function fromStudentQuestion(q: {
  assignment_question_id: string; type: "mcq" | "theory"; question_text: string;
  options: SolveOption[]; marks: number;
  images?: { src: string; alt?: string | null; caption?: string | null }[];
  parts?: { label: string; body: string; marks: number | null }[];
}): SolveQuestion {
  return {
    id: q.assignment_question_id,
    type: q.type === "mcq" ? "mcq" : "structured",
    marks: q.marks,
    questionText: q.question_text || "",
    options: q.options ?? [],
    images: (q.images ?? []).map((im) => ({ src: im.src, alt: im.alt ?? undefined, caption: im.caption ?? undefined })),
    parts: (q.parts ?? []).map((p) => ({ label: p.label, body: p.body, marks: p.marks })),
  };
}

interface Props {
  question: SolveQuestion;
  index?: number;
  /** Show correct option + mark scheme + model answers (teacher preview only). */
  reveal?: boolean;
  /** No answer inputs (preview / review). */
  readOnly?: boolean;

  selectedOption?: string;
  onSelectOption?: (label: string) => void;
  answerText?: string;
  onAnswerText?: (text: string) => void;
  onAnswerBlur?: (text: string) => void;
  answerMode?: "type" | "upload";
  onAnswerMode?: (m: "type" | "upload") => void;
  upload?: { thumb?: string; confidence?: number; status?: string; busy?: boolean };
  onUpload?: (file: File) => void;
}

const SERIF: React.CSSProperties = { fontFamily: "var(--font-fraunces), serif" };

export default function QuestionSolveCard(props: Props) {
  const { question: q, reveal, readOnly } = props;
  const isMcq = q.type === "mcq";
  const figures = q.images.filter((im) => im.src && im.role !== "answer");
  const answerFigures = q.images.filter((im) => im.src && im.role === "answer");

  const answered = isMcq ? Boolean(props.selectedOption) : Boolean(props.answerText?.trim());

  return (
    <div className="pr">
      <article className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* header */}
        <div className="row-between" style={{ flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span className="chip-tag badge neutral">Q{q.questionNumber ?? props.index ?? ""}</span>
            {!readOnly && (
              <span className={"badge " + (answered ? "amber" : "neutral")} style={{ fontSize: 11 }}>
                {answered ? "Answered" : "Unanswered"}
              </span>
            )}
            {q.topic && (
              <span className="chip-tag" style={{ background: "var(--crimson-soft)", color: "var(--crimson)" }}>#{q.topic}</span>
            )}
            {q.theme && <span className="chip-tag badge teal">{q.theme}</span>}
          </div>
          <div className="faint" style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5 }}>
            {q.year && <span style={{ fontWeight: 700, color: "var(--crimson)" }}>{q.year}</span>}
            {q.marks != null && <span>{q.marks} mark{q.marks === 1 ? "" : "s"}</span>}
            {q.session && <span>{q.session.replace(/_/g, " ")}</span>}
            {q.paper && <span>{q.paper.replace(/_/g, " ")}</span>}
          </div>
        </div>

        {/* body */}
        {isMcq ? (
          <McqBody q={q} reveal={reveal} readOnly={readOnly} selected={props.selectedOption} onSelect={props.onSelectOption} figures={figures} />
        ) : (
          <StructuredBody q={q} reveal={reveal} readOnly={readOnly} figures={figures} answerFigures={answerFigures}
            answerText={props.answerText} onAnswerText={props.onAnswerText} onAnswerBlur={props.onAnswerBlur}
            answerMode={props.answerMode} onAnswerMode={props.onAnswerMode} upload={props.upload} onUpload={props.onUpload} />
        )}
      </article>
    </div>
  );
}

function QImage({ image }: { image: SolveImage }) {
  return (
    <figure style={{ margin: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.src} alt={image.alt || "Question figure"}
        style={{ maxHeight: 300, maxWidth: "100%", borderRadius: 12, border: "1px solid var(--line)", background: "#fff", objectFit: "contain" }} />
      {image.caption && <figcaption className="faint" style={{ fontSize: 11.5, marginTop: 4 }}>{image.caption}</figcaption>}
    </figure>
  );
}

// Mark scheme / model answer rendered as tidy points.
function SchemeList({ text, label = "Mark scheme" }: { text: string; label?: string }) {
  const points = text.split(/\r?\n|;\s+/).map((s) => s.trim()).filter(Boolean);
  return (
    <div style={{ borderRadius: 12, border: "1px solid var(--teal-soft)", background: "var(--teal-soft)", padding: 12 }}>
      <p className="eyebrow" style={{ color: "var(--teal-deep)", marginBottom: 6 }}>{label}</p>
      {points.length > 1 ? (
        <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
          {points.map((p, i) => <li key={i} style={{ fontSize: 13, lineHeight: 1.5 }}>{p}</li>)}
        </ul>
      ) : (
        <p style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{text}</p>
      )}
    </div>
  );
}

function McqBody({ q, reveal, readOnly, selected, onSelect, figures }: {
  q: SolveQuestion; reveal?: boolean; readOnly?: boolean; selected?: string; onSelect?: (l: string) => void; figures: SolveImage[];
}) {
  const correct = q.correctOption;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "4px 2px" }}>
      {q.questionText && <p style={{ whiteSpace: "pre-wrap", fontSize: 18, lineHeight: 1.5, ...SERIF }}>{q.questionText}</p>}
      {figures.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{figures.map((im, i) => <QImage key={i} image={im} />)}</div>}

      {q.options.length >= 2 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {q.options.map((o) => {
            const sel = selected === o.label;
            const ok = reveal && correct === o.label;
            const bad = reveal && sel && correct !== o.label;
            const border = ok ? "var(--teal)" : bad ? "var(--coral-bright)" : sel ? "var(--crimson)" : "var(--line-strong)";
            const bg = ok ? "var(--teal-soft)" : bad ? "var(--coral-soft)" : sel ? "var(--crimson-soft)" : "var(--surface)";
            return (
              <label key={o.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", borderRadius: 13,
                cursor: readOnly ? "default" : "pointer", border: `1.5px solid ${border}`, background: bg, transition: "all .14s" }}>
                <input type="radio" name={q.id} checked={sel} disabled={readOnly} onChange={() => !readOnly && onSelect?.(o.label)} style={{ display: "none" }} />
                <span style={{ width: 26, height: 26, borderRadius: 8, display: "grid", placeItems: "center", flex: "none", fontWeight: 600, fontSize: 13,
                  border: `1.5px solid ${sel || ok ? border : "var(--line-strong)"}`, color: sel || ok ? border : "var(--ink-faint)" }}>{o.label}</span>
                <span style={{ fontSize: 14.5, flex: 1 }}>{o.text}</span>
                {ok && <CheckCircle2 size={18} style={{ color: "var(--teal-deep)", flex: "none" }} />}
                {sel && !reveal && <span className="badge crimson" style={{ fontSize: 10.5, flex: "none" }}>Your pick</span>}
              </label>
            );
          })}
        </div>
      ) : (
        <p style={{ borderRadius: 12, border: "1px dashed var(--line-strong)", background: "var(--surface-2)", padding: 12, fontSize: 12.5, fontWeight: 600, color: "var(--ink-faint)" }}>
          The answer options for this question are shown in the figure above.
        </p>
      )}

      {reveal && correct && (
        <div className="badge teal" style={{ fontSize: 13.5, padding: "8px 12px" }}>
          <CheckCircle2 size={16} /> Correct answer: {correct}
        </div>
      )}
      {reveal && q.markingScheme && <SchemeList text={q.markingScheme} />}
    </div>
  );
}

function StructuredBody(props: {
  q: SolveQuestion; reveal?: boolean; readOnly?: boolean; figures: SolveImage[]; answerFigures: SolveImage[];
  answerText?: string; onAnswerText?: (t: string) => void; onAnswerBlur?: (t: string) => void;
  answerMode?: "type" | "upload"; onAnswerMode?: (m: "type" | "upload") => void;
  upload?: { thumb?: string; confidence?: number; status?: string; busy?: boolean }; onUpload?: (f: File) => void;
}) {
  const { q, reveal, readOnly, figures, answerFigures } = props;
  const mode = props.answerMode ?? "type";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "4px 2px" }}>
      {q.questionText && <p style={{ whiteSpace: "pre-wrap", fontSize: 18, lineHeight: 1.5, ...SERIF }}>{q.questionText}</p>}
      {figures.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{figures.map((im, i) => <QImage key={i} image={im} />)}</div>}

      {/* Sub-parts (a, b, c…) so the whole question is visible, with their marks. */}
      {q.parts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {q.parts.map((part, i) => (
            <div key={i} style={{ borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface-2)", padding: 13 }}>
              <div className="row-between" style={{ alignItems: "baseline" }}>
                <p style={{ whiteSpace: "pre-wrap", fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>
                  {part.label && <span style={{ marginRight: 4, color: "var(--crimson)" }}>{part.label}</span>}
                  {part.body}
                </p>
                {part.marks != null && <span className="faint" style={{ flex: "none", fontSize: 12, fontWeight: 700 }}>[{part.marks}]</span>}
              </div>
              {reveal && part.answer && <div style={{ marginTop: 8 }}><SchemeList text={part.answer} label="Model answer" /></div>}
            </div>
          ))}
        </div>
      )}

      {/* Answer area (solving only). */}
      {!readOnly && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <p className="eyebrow" style={{ color: "var(--ink-soft)" }}>Your answer</p>
            <div style={{ display: "inline-flex", borderRadius: 10, border: "1px solid var(--line-strong)", overflow: "hidden" }}>
              <button type="button" onClick={() => props.onAnswerMode?.("type")}
                className="btn btn-sm" style={{ borderRadius: 0, background: mode === "type" ? "var(--crimson-soft)" : "transparent", color: mode === "type" ? "var(--crimson)" : "var(--ink-soft)", boxShadow: "none" }}>
                ✏️ Type
              </button>
              <button type="button" onClick={() => props.onAnswerMode?.("upload")}
                className="btn btn-sm" style={{ borderRadius: 0, background: mode === "upload" ? "var(--crimson-soft)" : "transparent", color: mode === "upload" ? "var(--crimson)" : "var(--ink-soft)", boxShadow: "none" }}>
                📷 Upload
              </button>
            </div>
          </div>

          {mode === "upload" ? (
            <UploadBox upload={props.upload} onFile={(f) => props.onUpload?.(f)} />
          ) : null}

          <textarea
            className="textarea"
            value={props.answerText ?? ""}
            onChange={(e) => props.onAnswerText?.(e.target.value)}
            onBlur={(e) => props.onAnswerBlur?.(e.target.value)}
            placeholder={mode === "upload" ? "Extracted text appears here — edit if needed…" : "Write your answer…"}
            style={{ minHeight: 110 }}
          />
        </div>
      )}

      {/* Read-only answer echo (teacher preview never has an answer; kept for review reuse). */}
      {readOnly && (props.answerText ?? "").trim() && (
        <p style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.55, padding: "8px 10px", borderRadius: 8, background: "var(--surface)", border: "1px solid var(--line)" }}>{props.answerText}</p>
      )}

      {reveal && q.markingScheme && <SchemeList text={q.markingScheme} label="Mark scheme" />}
      {reveal && answerFigures.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, borderRadius: 12, border: "1px solid var(--amber-soft)", background: "var(--amber-soft)", padding: 12 }}>
          <p className="eyebrow" style={{ color: "var(--amber-deep)" }}>Mark scheme</p>
          {answerFigures.map((im, i) => <QImage key={i} image={im} />)}
        </div>
      )}
    </div>
  );
}

function UploadBox({ upload, onFile }: { upload?: { thumb?: string; confidence?: number; status?: string; busy?: boolean }; onFile: (f: File) => void }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const busy = Boolean(upload?.busy);
  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); if (!busy) setDrag(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDrag(false); }}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f && !busy) onFile(f); }}
        onClick={() => { if (!busy) ref.current?.click(); }}
        style={{ cursor: busy ? "wait" : "pointer", padding: "16px 18px", display: "grid", placeItems: "center", textAlign: "center", borderRadius: 12,
          border: `2px dashed ${drag ? "var(--crimson)" : "var(--line-strong)"}`, background: drag ? "var(--crimson-soft)" : "var(--surface)", transition: "all .15s" }}
      >
        <input ref={ref} type="file" accept="image/*" capture="environment" style={{ display: "none" }} disabled={busy}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = ""; }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ink-soft)", fontSize: 13, fontWeight: 500 }}>
          {busy ? <RefreshCw size={16} className="spin" style={{ color: "var(--crimson)" }} /> : <Upload size={16} style={{ color: "var(--crimson)" }} />}
          {busy ? "Reading your handwriting…" : "Upload a photo of your written answer"}
        </div>
      </div>
      {upload?.thumb && (
        <div style={{ marginTop: 8, display: "flex", alignItems: "flex-start", gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={upload.thumb} alt="your answer" style={{ height: 80, width: 80, objectFit: "cover", borderRadius: 10, border: "1px solid var(--line)" }} />
          <p style={{ fontSize: 12, flex: 1, color: upload.status === "failed" ? "var(--coral)" : "var(--teal-deep)" }}>
            {upload.status === "failed"
              ? "Couldn't read that clearly — try a sharper photo, or type it below."
              : `Read your answer${upload.confidence != null ? ` (${Math.round(upload.confidence * 100)}% legible)` : ""}. Check and edit below.`}
          </p>
        </div>
      )}
    </div>
  );
}
