"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Icon } from "@/components/propel/Icon";
import { Segmented, EmptyState } from "@/components/propel/primitives";
import { subjectStyle } from "@/components/propel/subjects";
import {
  PaperType, PAPER_TYPE_LABEL, UploadCheckResult, UploadGradedQuestion,
  runUploadCheck, loadUploadCheckHistory, downloadUploadReport, verdictTone,
} from "@/lib/uploadCheck";

const PAPER_TYPES: PaperType[] = ["questions", "topical", "mcqs", "mixed"];
const MAX_FILES = 12;
const MAX_BYTES = 20 * 1024 * 1024;

const selectStyle: React.CSSProperties = {
  height: 42, width: "100%", borderRadius: 12, border: "1px solid var(--line-strong)", background: "var(--surface)",
  padding: "0 12px", fontSize: 13.5, fontWeight: 500, color: "var(--ink)", outline: "none",
};

const LOADING_STEPS = ["Reading your pages…", "Marking against the scheme…", "Writing examiner notes…", "Annotating your PDF…"];

export default function UploadCheckPage() {
  const { getToken } = useAuth();

  const [subjects, setSubjects] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [paperType, setPaperType] = useState<PaperType>("questions");
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<UploadCheckResult | null>(null);
  const [history, setHistory] = useState<UploadCheckResult[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/paper-practice");
        const data = res.ok ? ((await res.json()) as { subjects?: { name: string }[] }) : { subjects: [] };
        setSubjects((data.subjects ?? []).map((s) => s.name));
      } catch { setSubjects([]); }
    })();
    loadUploadCheckHistory(() => getToken()).then(setHistory);
  }, [getToken]);

  // cycle the loading captions while marking
  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setLoadingStep((s) => (s + 1) % LOADING_STEPS.length), 2200);
    return () => clearInterval(id);
  }, [loading]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setError("");
    const incoming = Array.from(list).filter((f) => /^image\//.test(f.type) || f.type === "application/pdf");
    const tooBig = incoming.find((f) => f.size > MAX_BYTES);
    if (tooBig) { setError(`${tooBig.name} is larger than 20 MB`); return; }
    setFiles((prev) => [...prev, ...incoming].slice(0, MAX_FILES));
  }

  const canSubmit = subject && files.length > 0 && !loading;

  async function submit() {
    if (!canSubmit) return;
    setLoading(true); setError(""); setResult(null); setLoadingStep(0);
    try {
      const res = await runUploadCheck(subject, paperType, files, getToken);
      setResult(res);
      setHistory((prev) => [res, ...prev].slice(0, 20));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Marking failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function reset() { setResult(null); setFiles([]); setError(""); }

  const curSubj = subjectStyle(subject);

  return (
    <div className="pr">
      <div className="main flex-col gap-24">
        {/* header */}
        <div className="row-between wrap" style={{ gap: 14, alignItems: "flex-end" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Mark my work</div>
            <h1 style={{ fontSize: "clamp(26px,3.5vw,36px)" }}>Upload &amp; get marked</h1>
            <p className="muted mt-6" style={{ maxWidth: 560 }}>
              Upload photos or a PDF of any solved paper. Grok reads your answers, marks them, writes notes on your
              pages, and gives you a full report — no need to match a specific past paper.
            </p>
          </div>
          <Link href="/student/paper-practice" className="btn btn-secondary btn-sm">
            <Icon name="arrow_right" size={14} style={{ transform: "rotate(180deg)" }} /> Question bank
          </Link>
        </div>

        {error && (
          <div className="badge coral" style={{ fontSize: 13.5, padding: "10px 14px", alignSelf: "flex-start" }}>
            <Icon name="alert" size={16} /> {error}
          </div>
        )}

        {result ? (
          <ResultView result={result} onReset={reset} />
        ) : (
          <div className="card card-pad flex-col gap-16">
            <div className="flex gap-12 wrap items-end">
              <label style={{ flex: "1 1 220px", minWidth: 180 }}>
                <span className="eyebrow" style={{ marginBottom: 6 }}>Subject</span>
                <select value={subject} onChange={(e) => setSubject(e.target.value)} style={selectStyle}>
                  <option value="">Select subject</option>
                  {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <div>
                <span className="eyebrow" style={{ marginBottom: 6, display: "block" }}>Paper type</span>
                <Segmented value={paperType} onChange={(v) => setPaperType(v)}
                  options={PAPER_TYPES.map((t) => ({ value: t, label: PAPER_TYPE_LABEL[t] }))} />
              </div>
            </div>

            {/* upload zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); if (!loading) setDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
              onDrop={(e) => { e.preventDefault(); setDragging(false); if (!loading) addFiles(e.dataTransfer.files); }}
              onClick={() => { if (!loading) inputRef.current?.click(); }}
              style={{ cursor: loading ? "wait" : "pointer", padding: "30px 24px", display: "grid", placeItems: "center",
                textAlign: "center", borderRadius: 14, border: `2px dashed ${dragging ? "var(--crimson)" : "var(--line-strong)"}`,
                background: dragging ? "var(--crimson-soft)" : "var(--surface)", transition: "all .15s" }}
            >
              <input ref={inputRef} type="file" accept="image/*,application/pdf" multiple style={{ display: "none" }}
                onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ""; }} />
              <div style={{ width: 52, height: 52, borderRadius: 15, background: "var(--crimson-soft)", color: "var(--crimson)", display: "grid", placeItems: "center", marginBottom: 12 }}>
                <Icon name="upload" size={24} />
              </div>
              <div style={{ fontWeight: 600, fontSize: 15.5 }}>Drop your solved pages here</div>
              <div className="faint" style={{ fontSize: 12.5, marginTop: 4 }}>
                Photos (JPG / PNG) or a PDF · drag in or <span style={{ color: "var(--crimson)", fontWeight: 600 }}>browse</span>
              </div>
              <div className="faint" style={{ fontSize: 11.5, marginTop: 8 }}>up to {MAX_FILES} pages · maximum 20 MB per file</div>
            </div>

            {files.length > 0 && (
              <div className="flex-col" style={{ display: "flex", gap: 6 }}>
                {files.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center gap-10" style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface-2)" }}>
                    <Icon name={file.type === "application/pdf" ? "file_text" : "camera"} size={16} style={{ color: "var(--crimson)", flex: "none" }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
                    <span className="faint" style={{ fontSize: 11.5, flex: "none" }}>{Math.max(1, Math.round(file.size / 1024))} KB</span>
                    <button className="icon-btn" aria-label={`Remove ${file.name}`} onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                      style={{ width: 28, height: 28, flex: "none" }}>
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="row-between wrap" style={{ gap: 12, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
              <p className="flex items-center gap-8 muted" style={{ fontSize: 13 }}>
                <Icon name="lightbulb" size={15} style={{ color: "var(--amber-deep)" }} />
                {subject ? `${subject} · ${PAPER_TYPE_LABEL[paperType]}` : "Pick a subject and upload your work"}
              </p>
              <button className="btn btn-primary" onClick={submit} disabled={!canSubmit}
                title={!subject ? "Pick a subject" : files.length === 0 ? "Upload at least one page" : "Mark my work"}>
                {loading ? <><Icon name="refresh" size={16} className="spin" /> {LOADING_STEPS[loadingStep]}</> : <><Icon name="award" size={16} /> Mark my work</>}
              </button>
            </div>

            {loading && (
              <p className="faint" style={{ fontSize: 12, textAlign: "center" }}>
                This can take up to a minute for a full paper — hang tight, we&apos;re reading every page.
              </p>
            )}
          </div>
        )}

        {/* history */}
        {!result && history.length > 0 && (
          <div className="card card-pad">
            <div className="card-head"><span className="card-title">Recent marks</span></div>
            <div className="flex-col" style={{ gap: 2 }}>
              {history.slice(0, 6).map((h) => {
                const subj = subjectStyle(h.report.subject);
                return (
                  <div key={h.checkId} className="flex items-center gap-12" style={{ padding: "9px 0" }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, flex: "none", display: "grid", placeItems: "center", background: subj.color + "1e", color: subj.color }}>
                      <Icon name={subj.icon} size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {h.report.subject} · {PAPER_TYPE_LABEL[h.report.paperType]}
                      </div>
                      <div className="faint" style={{ fontSize: 11.5 }}>{h.report.earned}/{h.report.total} · {h.report.percent}%</div>
                    </div>
                    {h.annotatedUrl && (
                      <a href={h.annotatedUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ flex: "none" }}>
                        <Icon name="file_text" size={14} /> PDF
                      </a>
                    )}
                    <button className="btn btn-secondary btn-sm" style={{ flex: "none" }} onClick={() => setResult(h)}>Open</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- result view ---------------- */
function ResultView({ result, onReset }: { result: UploadCheckResult; onReset: () => void }) {
  const { report, annotatedUrl } = result;
  const ringColor = report.percent >= 70 ? "var(--teal-deep)" : report.percent >= 45 ? "var(--amber-deep)" : "var(--coral-bright)";
  return (
    <div className="flex-col gap-16">
      {/* score header */}
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
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="flex items-center gap-10 wrap">
            <span className="big-num" style={{ fontSize: 26 }}>{report.earned} / {report.total}</span>
            <span className="badge crimson">{report.grade}</span>
            <span className="badge neutral">{report.subject} · {PAPER_TYPE_LABEL[report.paperType]}</span>
            <span className="badge neutral">{report.pageCount} page{report.pageCount === 1 ? "" : "s"}</span>
          </div>
          <p className="muted mt-6" style={{ fontSize: 14, lineHeight: 1.5 }}>{report.summary}</p>
        </div>
        <div className="flex gap-8 wrap" style={{ flex: "none" }}>
          <button className="btn btn-secondary btn-sm" onClick={onReset}><Icon name="upload" size={14} /> Mark another</button>
        </div>
      </div>

      {/* shortcomings + suggestions */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
        {report.shortcomings.length > 0 && (
          <div className="card card-pad" style={{ borderColor: "var(--coral-soft)" }}>
            <div className="flex items-center gap-8" style={{ marginBottom: 8 }}>
              <Icon name="alert" size={16} style={{ color: "var(--coral-bright)" }} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Where you lost marks</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
              {report.shortcomings.map((s, i) => <li key={i} style={{ fontSize: 13.5, lineHeight: 1.5 }}>{s}</li>)}
            </ul>
          </div>
        )}
        {report.suggestions.length > 0 && (
          <div className="card card-pad" style={{ borderColor: "var(--teal-soft)" }}>
            <div className="flex items-center gap-8" style={{ marginBottom: 8 }}>
              <Icon name="lightbulb" size={16} style={{ color: "var(--teal-deep)" }} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>How to improve</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
              {report.suggestions.map((s, i) => <li key={i} style={{ fontSize: 13.5, lineHeight: 1.5 }}>{s}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* annotated PDF */}
      {annotatedUrl && (
        <div className="card card-pad">
          <div className="row-between wrap" style={{ marginBottom: 12, gap: 8 }}>
            <span className="card-title">Your annotated paper</span>
            <div className="flex gap-8">
              <a href={annotatedUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm"><Icon name="download" size={14} /> Annotated PDF</a>
              <button className="btn btn-secondary btn-sm" onClick={() => downloadUploadReport(report)}><Icon name="file_text" size={14} /> Report</button>
            </div>
          </div>
          <iframe src={annotatedUrl} title="Annotated paper" style={{ width: "100%", height: "72vh", border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-2)" }} />
        </div>
      )}

      {/* per-question breakdown */}
      <div className="flex-col gap-8">
        <div className="eyebrow" style={{ padding: "0 2px" }}>Question breakdown</div>
        {report.questions.length > 0 ? report.questions.map((q, i) => <QuestionRow key={i} q={q} />) : (
          <div className="card"><EmptyState icon="search" title="No questions detected" body="Try clearer photos, or make sure question numbers are visible." /></div>
        )}
      </div>
    </div>
  );
}

function QuestionRow({ q }: { q: UploadGradedQuestion }) {
  const tone = verdictTone(q.verdict);
  return (
    <div className="card card-pad" style={{ padding: 14 }}>
      <div className="row-between" style={{ gap: 10, alignItems: "flex-start" }}>
        <div className="flex items-center gap-8 wrap" style={{ minWidth: 0 }}>
          <span className="chip-tag badge neutral" style={{ flex: "none" }}>Q{q.questionNumber}</span>
          <span className="faint" style={{ fontSize: 11.5 }}>page {q.page}</span>
          <span style={{ padding: "2px 9px", borderRadius: 99, fontSize: 12, fontWeight: 600, color: tone.fg, background: tone.bg, whiteSpace: "nowrap" }}>{tone.label}</span>
        </div>
        <span style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", color: tone.fg }}>{q.earned} / {q.max}</span>
      </div>
      {q.question && <p style={{ fontSize: 13.5, fontWeight: 600, marginTop: 8 }}>{q.question}</p>}
      {q.correctAnswer && <p style={{ fontSize: 12.5, lineHeight: 1.45, marginTop: 4, color: "var(--teal-deep)" }}><b>Expected:</b> {q.correctAnswer}</p>}
      {q.corrections.length > 0 && <p style={{ fontSize: 12.5, lineHeight: 1.45, marginTop: 4, color: "var(--coral-bright)" }}><b>Corrections:</b> {q.corrections.join("; ")}</p>}
      {q.suggestions.length > 0 && <p className="faint" style={{ fontSize: 12.5, lineHeight: 1.45, marginTop: 4 }}><b>Suggestions:</b> {q.suggestions.join("; ")}</p>}
    </div>
  );
}
