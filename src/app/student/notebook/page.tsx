"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Icon } from "@/components/propel/Icon";
import { Bar, EmptyState, SubjGlyph } from "@/components/propel/primitives";
import { subjectStyle } from "@/components/propel/subjects";
import { timeAgo } from "@/lib/useStudentStats";
import { Attempt, loadAttempts, weakestTopics, mistakeList } from "@/lib/insights";

const verdictTone: Record<Attempt["verdict"], { label: string; bg: string; fg: string }> = {
  correct: { label: "Correct", bg: "var(--teal-soft)", fg: "var(--teal-deep)" },
  partial: { label: "Partial", bg: "var(--amber-soft)", fg: "var(--amber-deep)" },
  weak: { label: "Weak", bg: "var(--coral-soft)", fg: "var(--coral-bright)" },
  incorrect: { label: "Incorrect", bg: "var(--coral-soft)", fg: "var(--coral-bright)" },
  unanswered: { label: "Not answered", bg: "var(--surface-2)", fg: "var(--ink-faint)" },
};

function accColor(pct: number): string {
  return pct >= 75 ? "var(--teal-deep)" : pct >= 50 ? "var(--amber-deep)" : "var(--coral-bright)";
}

export default function NotebookPage() {
  const { getToken } = useAuth();
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [subject, setSubject] = useState("");

  useEffect(() => {
    let active = true;
    loadAttempts(() => getToken()).then((items) => { if (active) setAttempts(items); });
    return () => { active = false; };
  }, [getToken]);

  const subjects = useMemo(
    () => Array.from(new Set((attempts ?? []).map((a) => a.subject).filter(Boolean))).sort(),
    [attempts],
  );
  const filtered = useMemo(
    () => (attempts ?? []).filter((a) => !subject || a.subject === subject),
    [attempts, subject],
  );
  const weak = useMemo(() => weakestTopics(filtered, 1).slice(0, 12), [filtered]);
  const mistakes = useMemo(() => mistakeList(filtered).slice(0, 60), [filtered]);

  const totalGraded = filtered.length;
  const totalMistakes = filtered.filter((a) => a.verdict !== "correct").length;

  return (
    <div className="pr">
      <div className="main flex-col gap-24">
        {/* header */}
        <div className="row-between wrap" style={{ gap: 14, alignItems: "flex-end" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Insights</div>
            <h1 style={{ fontSize: "clamp(26px,3.5vw,36px)" }}>Mistake Notebook</h1>
            <p className="muted mt-6" style={{ maxWidth: 560 }}>
              Every wrong answer is logged automatically with its topic and reason — so your weak spots surface by concept, not just by subject.
            </p>
          </div>
          {subjects.length > 0 && (
            <label className="chip" style={{ padding: "0 6px 0 13px", gap: 4, cursor: "pointer" }}>
              <span className="faint" style={{ fontSize: 12 }}>Subject</span>
              <select value={subject} onChange={(e) => setSubject(e.target.value)}
                style={{ border: "none", background: "transparent", padding: "8px 4px", fontWeight: 500, cursor: "pointer", outline: "none", color: "var(--ink)" }}>
                <option value="">All subjects</option>
                {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          )}
        </div>

        {attempts === null ? (
          <div className="card flex items-center justify-center gap-8" style={{ minHeight: 240, color: "var(--ink-faint)", display: "flex" }}>
            <Icon name="refresh" size={16} className="spin" /> Loading your notebook…
          </div>
        ) : totalGraded === 0 ? (
          <div className="card">
            <EmptyState icon="target" title="Nothing logged yet"
              body="Check some MCQs or mark a written answer in Practice — every attempt is recorded here, worst topics first." />
          </div>
        ) : (
          <>
            {/* weakness map */}
            <div className="card card-pad">
              <div className="card-head">
                <div>
                  <div className="flex items-center gap-8">
                    <Icon name="target" size={19} style={{ color: "var(--coral)" }} />
                    <span className="card-title">Weakness map</span>
                  </div>
                  <div className="card-sub mt-6">Accuracy by concept · {totalMistakes} mistake{totalMistakes === 1 ? "" : "s"} across {totalGraded} attempt{totalGraded === 1 ? "" : "s"}</div>
                </div>
              </div>
              {weak.length === 0 ? (
                <p className="faint" style={{ fontSize: 13.5 }}>Not enough tagged-topic data yet — keep practising.</p>
              ) : (
                <div className="flex-col gap-16">
                  {weak.map((w) => {
                    const subj = subjectStyle(w.subject);
                    return (
                      <div key={w.key} className="flex items-center gap-12">
                        <SubjGlyph subj={subj} size={34} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="row-between" style={{ fontSize: 13.5, marginBottom: 5, gap: 8 }}>
                            <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {w.topic} <span className="faint" style={{ fontSize: 11.5 }}>· {w.subject}</span>
                            </span>
                            <span className="tnum" style={{ fontWeight: 700, color: accColor(w.accuracy), flex: "none" }}>{w.accuracy}%</span>
                          </div>
                          <div className="bar" style={{ height: 8 }}>
                            <i style={{ width: Math.max(3, w.accuracy) + "%", background: accColor(w.accuracy) }} />
                          </div>
                          <div className="faint" style={{ fontSize: 11, marginTop: 3 }}>{w.correct}/{w.attempts} correct</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* mistake list */}
            <div className="card card-pad">
              <div className="card-head"><span className="card-title">Recent mistakes</span></div>
              {mistakes.length === 0 ? (
                <p className="faint" style={{ fontSize: 13.5 }}>No mistakes logged — nice work.</p>
              ) : (
                <div className="flex-col" style={{ gap: 2 }}>
                  {mistakes.map((m) => {
                    const subj = subjectStyle(m.subject);
                    const tone = verdictTone[m.verdict];
                    return (
                      <div key={m.id} className="flex items-start gap-12" style={{ padding: "11px 0", borderTop: "1px solid var(--line)" }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, flex: "none", display: "grid", placeItems: "center", background: subj.color + "1e", color: subj.color }}>
                          <Icon name={subj.icon} size={16} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="flex items-center gap-8 wrap" style={{ marginBottom: 2 }}>
                            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{m.topic}</span>
                            <span className="faint" style={{ fontSize: 11.5 }}>{m.subject}</span>
                            <span style={{ padding: "1px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600, color: tone.fg, background: tone.bg }}>{tone.label}</span>
                            {m.max > 0 && <span className="faint" style={{ fontSize: 11 }}>{m.earned}/{m.max}</span>}
                          </div>
                          {m.reason && <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.45 }}>{m.reason}</div>}
                        </div>
                        <span className="faint" style={{ fontSize: 11, flex: "none", whiteSpace: "nowrap" }}>{timeAgo(m.at)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
