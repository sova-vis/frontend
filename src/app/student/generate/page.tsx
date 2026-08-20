"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Icon } from "@/components/propel/Icon";
import { EmptyState } from "@/components/propel/primitives";
import { subjectStyle } from "@/components/propel/subjects";
import { clockLabel } from "@/lib/paperDurations";
import { gradeOneQuestion, verdictColor, GradeQuestionInput } from "@/lib/practiceGrading";
import { GradedQuestion } from "@/lib/practiceProgress";
import { GenQuestion, GeneratedPaper, generatePaper } from "@/lib/paperGenerator";
import { Attempt, loadAttempts, loadAttemptsLocal, weakestTopics, attemptFromMcq, attemptFromGraded, logAttempts } from "@/lib/insights";

const TIME_OPTIONS = [30, 45, 60, 90];

export default function GeneratePage() {
  const { getToken } = useAuth();
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [minutes, setMinutes] = useState(45);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [paper, setPaper] = useState<GeneratedPaper | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const [mcq, setMcq] = useState<Record<string, string>>({});
  const [parts, setParts] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, GradedQuestion>>({});
  const [grading, setGrading] = useState(false);
  const [graded, setGraded] = useState(false);

  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/paper-practice").then((r) => (r.ok ? r.json() : { subjects: [] }))
      .then((d) => setSubjects((d.subjects ?? []).map((s: { name: string }) => s.name))).catch(() => {});
    const load = () => { loadAttempts(getToken).then(setAttempts); };
    load();
    const onChange = () => { setAttempts(loadAttemptsLocal()); load(); };
    window.addEventListener("propel:attempts-change", onChange);
    return () => window.removeEventListener("propel:attempts-change", onChange);
  }, [getToken]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const weakTopics = useMemo(() => weakestTopics(attempts, 1).map((w) => w.topic), [attempts]);

  function toggleSubject(s: string) {
    setSelected((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function generate() {
    if (!selected.length || generating) return;
    setGenerating(true); setError(""); setPaper(null); setResults({}); setGraded(false); setMcq({}); setParts({}); setElapsed(0);
    try {
      const p = await generatePaper({ subjects: selected, minutes, weakTopics, getToken });
      if (p.questions.length === 0) { setError("Couldn't assemble a paper for those subjects — try others."); return; }
      setPaper(p);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch { setError("Generation failed. Please try again."); }
    finally { setGenerating(false); }
  }

  const answeredCount = useMemo(() => {
    if (!paper) return 0;
    return paper.questions.filter((q) => q.type === "mcq"
      ? Boolean(mcq[q.id])
      : (q.parts.length ? q.parts.some((_, i) => parts[`${q.id}::${i}`]?.trim()) : parts[`${q.id}::0`]?.trim())).length;
  }, [paper, mcq, parts]);

  async function submit() {
    if (!paper || grading) return;
    setGrading(true);
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      const res: Record<string, GradedQuestion> = {};
      const toLog: Attempt[] = [];
      for (const q of paper.questions) {
        if (q.type === "mcq") {
          const chosen = mcq[q.id];
          const right = Boolean(chosen && q.correctOption && chosen === q.correctOption);
          res[q.id] = {
            id: q.id, questionNumber: "", earned: right ? 1 : 0, max: 1,
            verdict: right ? "correct" : chosen ? "weak" : "unanswered",
            feedback: right ? "Correct." : q.correctOption ? `Correct answer: ${q.correctOption}` : "",
            expectedPoints: [], missingPoints: [], gradingSource: "deterministic",
          };
          toLog.push(attemptFromMcq(q, chosen, q.correctOption));
        } else {
          const studentParts: Record<string, string> = {};
          if (q.parts.length) q.parts.forEach((p, i) => { const v = parts[`${q.id}::${i}`]; if (v?.trim()) studentParts[p.label || `Part ${i + 1}`] = v.trim(); });
          else { const v = parts[`${q.id}::0`]; if (v?.trim()) studentParts["Answer"] = v.trim(); }
          const input: GradeQuestionInput = {
            id: q.id, questionNumber: "", type: "structured", questionText: q.questionText,
            maxMarks: q.marks || q.parts.reduce((m, p) => m + (p.marks || 0), 0) || 4,
            markingScheme: q.markingScheme || null, parts: q.parts, studentParts,
          };
          try { const g = await gradeOneQuestion(q.subject, input, getToken); res[q.id] = g; toLog.push(attemptFromGraded(q, g)); } catch {}
        }
      }
      setResults(res); setGraded(true);
      void logAttempts(toLog, getToken);
    } finally { setGrading(false); }
  }

  const score = useMemo(() => {
    const list = Object.values(results);
    const earned = list.reduce((s, r) => s + r.earned, 0);
    const total = list.reduce((s, r) => s + r.max, 0);
    return { earned, total, percent: total ? Math.round((earned / total) * 100) : 0 };
  }, [results]);

  return (
    <div className="pr">
      <div className="main flex-col gap-24">
        <div className="row-between wrap" style={{ gap: 14, alignItems: "flex-end" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Generate</div>
            <h1 style={{ fontSize: "clamp(26px,3.5vw,36px)" }}>AI paper generator</h1>
            <p className="muted mt-6" style={{ maxWidth: 560 }}>
              Pick your subjects and how long you have — we build a mixed paper from real past-paper questions (weighted to your weak topics) and polish it into a clean set.
            </p>
          </div>
          <Link href="/student/paper-practice" className="btn btn-secondary btn-sm">
            <Icon name="arrow_right" size={14} style={{ transform: "rotate(180deg)" }} /> Question bank
          </Link>
        </div>

        {error && <div className="badge coral" style={{ fontSize: 13.5, padding: "10px 14px", alignSelf: "flex-start" }}><Icon name="alert" size={16} /> {error}</div>}

        {!paper ? (
          <div className="card card-pad flex-col gap-16">
            <div>
              <span className="eyebrow" style={{ marginBottom: 8, display: "block" }}>Subjects</span>
              {subjects.length === 0 ? (
                <p className="faint" style={{ fontSize: 13 }}>Loading subjects…</p>
              ) : (
                <div className="flex gap-8 wrap">
                  {subjects.map((s) => {
                    const on = selected.includes(s);
                    const st = subjectStyle(s);
                    return (
                      <button key={s} onClick={() => toggleSubject(s)} className="chip" style={{ cursor: "pointer", padding: "8px 13px",
                        border: on ? `1.5px solid ${st.color}` : "1px solid var(--line-strong)", background: on ? st.color + "18" : "var(--surface)", color: on ? st.color : "var(--ink-soft)", fontWeight: on ? 600 : 500 }}>
                        <Icon name={st.icon} size={14} /> {s}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <span className="eyebrow" style={{ marginBottom: 8, display: "block" }}>Time budget</span>
              <div className="flex gap-8 wrap">
                {TIME_OPTIONS.map((t) => (
                  <button key={t} onClick={() => setMinutes(t)} className="chip" style={{ cursor: "pointer", padding: "8px 16px",
                    border: minutes === t ? "1.5px solid var(--crimson)" : "1px solid var(--line-strong)", background: minutes === t ? "var(--crimson-soft)" : "var(--surface)", color: minutes === t ? "var(--crimson)" : "var(--ink-soft)", fontWeight: minutes === t ? 600 : 500 }}>
                    {t} min
                  </button>
                ))}
              </div>
            </div>
            <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={generate} disabled={!selected.length || generating}>
              {generating ? <><Icon name="refresh" size={16} className="spin" /> Building your paper…</> : <><Icon name="bolt" size={16} /> Generate paper</>}
            </button>
            {generating && <p className="faint" style={{ fontSize: 12 }}>Sampling real questions and polishing them — this takes a few seconds.</p>}
          </div>
        ) : (
          <>
            {/* session bar */}
            <div className="card" style={{ position: "sticky", top: 8, zIndex: 25, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", padding: "10px 16px" }}>
              <div className="flex items-center gap-12 wrap">
                <span className="badge crimson">{paper.questions.length} questions · {paper.totalMarks} marks</span>
                {!graded && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 14, fontVariantNumeric: "tabular-nums" }}><Icon name="clock" size={15} style={{ color: "var(--crimson)" }} /> {clockLabel(elapsed)}</span>}
              </div>
              <div className="flex items-center gap-10 wrap">
                {graded ? (
                  <span className="badge teal"><Icon name="award" size={13} /> {score.earned}/{score.total} · {score.percent}%</span>
                ) : (
                  <>
                    <span className="faint" style={{ fontSize: 12.5 }}>{answeredCount}/{paper.questions.length} answered</span>
                    <button className="btn btn-primary btn-sm" onClick={submit} disabled={grading || answeredCount === 0}>
                      {grading ? <><Icon name="refresh" size={14} className="spin" /> Marking…</> : <><Icon name="award" size={14} /> Submit for marking</>}
                    </button>
                  </>
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => { setPaper(null); if (timerRef.current) clearInterval(timerRef.current); }}>New paper</button>
              </div>
            </div>

            {/* questions */}
            <div className="flex-col gap-16">
              {paper.questions.map((q, i) => (
                <GenCard key={q.id} q={q} index={i} mcqAnswer={mcq[q.id]} parts={parts} graded={graded} result={results[q.id]}
                  onMcq={(v) => setMcq((c) => ({ ...c, [q.id]: v }))}
                  onPart={(k, v) => setParts((c) => ({ ...c, [k]: v }))} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function GenCard({ q, index, mcqAnswer, parts, graded, result, onMcq, onPart }: {
  q: GenQuestion; index: number; mcqAnswer?: string; parts: Record<string, string>; graded: boolean; result?: GradedQuestion;
  onMcq: (v: string) => void; onPart: (key: string, v: string) => void;
}) {
  const subj = subjectStyle(q.subject);
  const tone = result ? verdictColor(result.verdict) : null;
  return (
    <article className="card card-pad flex-col gap-14">
      <div className="row-between wrap" style={{ gap: 8 }}>
        <div className="flex items-center gap-8 wrap">
          <span className="chip-tag badge neutral">Q{index + 1}</span>
          <span className="chip-tag" style={{ background: subj.color + "1c", color: subj.color }}><Icon name={subj.icon} size={12} /> {q.subject}</span>
          {q.topic && <span className="faint" style={{ fontSize: 11.5 }}>{q.topic}</span>}
        </div>
        <span className="faint" style={{ fontSize: 12 }}>{q.type === "mcq" ? "1 mark" : `${q.marks || q.parts.reduce((m, p) => m + (p.marks || 0), 0) || 4} marks`}</span>
      </div>
      <p style={{ whiteSpace: "pre-wrap", fontSize: 16, lineHeight: 1.5, fontFamily: "var(--font-fraunces), serif" }}>{q.questionText}</p>

      {q.type === "mcq" ? (
        <div className="flex-col gap-8">
          {q.options.map((o) => {
            const selected = mcqAnswer === o.label;
            const showCorrect = graded && q.correctOption === o.label;
            const showWrong = graded && selected && q.correctOption !== o.label;
            const border = showCorrect ? "var(--teal)" : showWrong ? "var(--coral-bright)" : selected ? "var(--crimson)" : "var(--line-strong)";
            const bg = showCorrect ? "var(--teal-soft)" : showWrong ? "var(--coral-soft)" : selected ? "var(--crimson-soft)" : "var(--surface)";
            return (
              <label key={o.label} className="flex items-center gap-12" style={{ padding: "11px 14px", borderRadius: 12, cursor: graded ? "default" : "pointer", border: `1.5px solid ${border}`, background: bg }}>
                <input type="radio" name={q.id} checked={selected} disabled={graded} onChange={() => onMcq(o.label)} style={{ display: "none" }} />
                <span style={{ width: 24, height: 24, borderRadius: 7, display: "grid", placeItems: "center", flex: "none", fontWeight: 600, fontSize: 12.5, border: `1.5px solid ${selected || showCorrect ? border : "var(--line-strong)"}`, color: selected || showCorrect ? border : "var(--ink-faint)" }}>{o.label}</span>
                <span style={{ fontSize: 14, flex: 1 }}>{o.text}</span>
              </label>
            );
          })}
        </div>
      ) : q.parts.length > 0 ? (
        <div className="flex-col gap-14">
          {q.parts.map((p, i) => {
            const key = `${q.id}::${i}`;
            return (
              <div key={key} style={{ borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface-2)", padding: 12 }}>
                <div className="row-between" style={{ alignItems: "baseline" }}>
                  <p style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.5 }}>{p.label && <span style={{ marginRight: 4, color: "var(--crimson)" }}>{p.label}</span>}{p.body}</p>
                  {p.marks !== null && <span className="faint" style={{ flex: "none", fontSize: 12, fontWeight: 700 }}>[{p.marks}]</span>}
                </div>
                {!graded && <textarea value={parts[key] ?? ""} onChange={(e) => onPart(key, e.target.value)} placeholder="Write your answer…" className="textarea" style={{ marginTop: 8, minHeight: 80 }} />}
              </div>
            );
          })}
        </div>
      ) : (
        !graded && <textarea value={parts[`${q.id}::0`] ?? ""} onChange={(e) => onPart(`${q.id}::0`, e.target.value)} placeholder="Write your answer…" className="textarea" />
      )}

      {graded && result && (
        <div style={{ borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface-2)", padding: 12 }}>
          <div className="row-between">
            <span style={{ padding: "2px 9px", borderRadius: 99, fontSize: 12, fontWeight: 600, color: tone!.fg, background: tone!.bg }}>{tone!.label}</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: tone!.fg }}>{result.earned} / {result.max}</span>
          </div>
          {result.feedback && <p style={{ fontSize: 13, lineHeight: 1.5, marginTop: 8 }}>{result.feedback}</p>}
          {result.missingPoints.length > 0 && <p style={{ fontSize: 12.5, marginTop: 6, color: "var(--coral-bright)" }}><b>Improve:</b> {result.missingPoints.join("; ")}</p>}
        </div>
      )}
    </article>
  );
}
