"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Icon } from "@/components/propel/Icon";
import { Bar, EmptyState, SubjGlyph } from "@/components/propel/primitives";
import { subjectStyle } from "@/components/propel/subjects";
import Link from "next/link";
import { timeAgo } from "@/lib/useStudentStats";
import {
  Attempt, PatternResult, loadAttempts, weakestTopics, mistakeList, dueRevisions, loadPatterns, topicReadiness,
} from "@/lib/insights";
import { TopicTrend, loadTopicTrends } from "@/lib/examTrends";

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
  const [patterns, setPatterns] = useState<PatternResult | null>(null);
  const [patternsBusy, setPatternsBusy] = useState(false);

  const [trends, setTrends] = useState<TopicTrend[]>([]);

  useEffect(() => {
    let active = true;
    loadAttempts(() => getToken()).then((items) => { if (active) setAttempts(items); });
    loadPatterns(() => getToken()).then((p) => { if (active) setPatterns(p); });
    loadTopicTrends().then((t) => { if (active) setTrends(t); });
    return () => { active = false; };
  }, [getToken]);

  const trendList = useMemo(
    () => trends.filter((t) => !subject || t.subject === subject).slice(0, 8),
    [trends, subject],
  );

  async function refreshPatterns() {
    setPatternsBusy(true);
    try { const p = await loadPatterns(() => getToken(), true); if (p) setPatterns(p); }
    finally { setPatternsBusy(false); }
  }

  const revisions = useMemo(() => dueRevisions(attempts ?? []).filter((r) => !subject || r.subject === subject).slice(0, 8), [attempts, subject]);

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
  const readiness = useMemo(() => topicReadiness(filtered), [filtered]);

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

            {/* topic readiness — per-topic status instead of one blended % */}
            {(readiness.mastered.length + readiness.needsWork.length + readiness.weak.length) > 0 && (
              <div className="card card-pad">
                <div className="card-head"><span className="card-title">Topic readiness</span></div>
                <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
                  {([
                    { key: "mastered", label: "Mastered", tone: "teal", items: readiness.mastered },
                    { key: "needs-work", label: "Needs work", tone: "amber", items: readiness.needsWork },
                    { key: "weak", label: "Weak", tone: "coral", items: readiness.weak },
                  ] as const).map((group) => (
                    <div key={group.key} style={{ borderRadius: 12, border: "1px solid var(--line)", padding: 12 }}>
                      <div className="flex items-center gap-8" style={{ marginBottom: 8 }}>
                        <span className={"badge " + group.tone}>{group.items.length}</span>
                        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{group.label}</span>
                      </div>
                      {group.items.length === 0 ? (
                        <p className="faint" style={{ fontSize: 12 }}>None yet.</p>
                      ) : (
                        <div className="flex-col" style={{ gap: 4 }}>
                          {group.items.slice(0, 6).map((t) => (
                            <div key={t.key} className="row-between" style={{ fontSize: 12.5, gap: 8 }}>
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.topic}</span>
                              <span className="faint tnum" style={{ flex: "none" }}>{t.accuracy}%</span>
                            </div>
                          ))}
                          {group.items.length > 6 && <span className="faint" style={{ fontSize: 11 }}>+{group.items.length - 6} more</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* spaced-repetition revisions due */}
            {revisions.length > 0 && (
              <div className="card card-pad">
                <div className="card-head">
                  <div>
                    <div className="flex items-center gap-8">
                      <Icon name="rotate" size={18} style={{ color: "var(--purple)" }} />
                      <span className="card-title">Revision due</span>
                    </div>
                    <div className="card-sub mt-6">Topics you mastered before — revisit them before they fade.</div>
                  </div>
                </div>
                <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10 }}>
                  {revisions.map((r) => {
                    const subj = subjectStyle(r.subject);
                    return (
                      <Link key={r.key} href={`/student/paper-practice?subject=${encodeURIComponent(r.subject)}&topic=${encodeURIComponent(r.topic)}`}
                        className="flex items-center gap-10" style={{ padding: "11px 13px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)" }}>
                        <div style={{ width: 30, height: 30, borderRadius: 9, flex: "none", display: "grid", placeItems: "center", background: subj.color + "1e", color: subj.color }}>
                          <Icon name={subj.icon} size={15} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.topic}</div>
                          <div className="faint" style={{ fontSize: 11.5 }}>{r.subject} · level {r.box}/5</div>
                        </div>
                        <Icon name="chevron_right" size={15} style={{ color: "var(--ink-faint)", flex: "none" }} />
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* AI pattern detection */}
            <div className="card card-pad">
              <div className="card-head">
                <div>
                  <div className="flex items-center gap-8">
                    <Icon name="lightbulb" size={18} style={{ color: "var(--amber-deep)" }} />
                    <span className="card-title">Recurring patterns</span>
                  </div>
                  <div className="card-sub mt-6">Habits the AI spots across your mistakes — not just topics.</div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={refreshPatterns} disabled={patternsBusy || totalMistakes < 4}>
                  {patternsBusy ? <><Icon name="refresh" size={14} className="spin" /> Analyzing…</> : <><Icon name="sparkles" size={14} /> {patterns?.patterns.length ? "Re-analyze" : "Analyze"}</>}
                </button>
              </div>
              {patterns && patterns.patterns.length > 0 ? (
                <div className="flex-col gap-10">
                  {patterns.patterns.map((p, i) => (
                    <div key={i} className="flex gap-10 items-start" style={{ padding: "11px 13px", borderRadius: 11, background: "var(--surface-2)" }}>
                      <Icon name="alert" size={16} style={{ color: "var(--amber-deep)", flex: "none", marginTop: 1 }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.title}</div>
                        <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.45, marginTop: 2 }}>{p.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="faint" style={{ fontSize: 13 }}>
                  {totalMistakes < 4 ? "Log a few more mistakes and the AI will spot your recurring habits here." : "Tap Analyze to spot the habits behind your mistakes."}
                </p>
              )}
            </div>

            {/* trend analyzer — most examined topics from the bank */}
            {trendList.length > 0 && (
              <div className="card card-pad">
                <div className="card-head">
                  <div>
                    <div className="flex items-center gap-8">
                      <Icon name="trend_up" size={18} style={{ color: "var(--teal-deep)" }} />
                      <span className="card-title">Most examined topics</span>
                    </div>
                    <div className="card-sub mt-6">How often each topic appears across past papers — historical frequency, not a prediction.</div>
                  </div>
                </div>
                <div className="flex-col gap-12">
                  {trendList.map((t) => {
                    const subj = subjectStyle(t.subject);
                    const maxCount = trendList[0].count || 1;
                    return (
                      <div key={`${t.subject}|${t.topic}`} className="flex items-center gap-12">
                        <SubjGlyph subj={subj} size={30} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="row-between" style={{ fontSize: 13, marginBottom: 4, gap: 8 }}>
                            <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {t.topic} <span className="faint" style={{ fontSize: 11.5 }}>· {t.subject}</span>
                            </span>
                            <span className="faint tnum" style={{ flex: "none" }}>{t.count} Qs · {t.share}%</span>
                          </div>
                          <div className="bar" style={{ height: 7 }}><i style={{ width: Math.round((t.count / maxCount) * 100) + "%", background: subj.color }} /></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
