"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Icon } from "@/components/propel/Icon";
import { EmptyState, SubjGlyph } from "@/components/propel/primitives";
import { subjectStyle } from "@/components/propel/subjects";
import Link from "next/link";
import { timeAgo } from "@/lib/useStudentStats";
import {
  Attempt, PatternResult, loadAttempts, loadAttemptsLocal, weakestTopics, mistakeList, dueRevisions, loadPatterns, topicReadiness,
} from "@/lib/insights";
import { TopicTrend, loadTopicTrends } from "@/lib/examTrends";
import { loadSelectedSubjects } from "@/lib/studentPersonalization";
import WeakPointsBySubject from "@/components/student/WeakPointsBySubject";

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
const normSubj = (s: string) => s.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/\d+/g, " ").replace(/[^a-z]+/g, " ").trim();

// Small section wrapper so the analytics read as tidy equal cards in the grid.
function Panel({ icon, iconColor, title, sub, action, children }: {
  icon: string; iconColor: string; title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="card card-pad" style={{ display: "flex", flexDirection: "column" }}>
      <div className="card-head">
        <div>
          <div className="flex items-center gap-8">
            <Icon name={icon} size={18} style={{ color: iconColor }} />
            <span className="card-title">{title}</span>
          </div>
          {sub && <div className="card-sub mt-6">{sub}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function NotebookPage() {
  const { getToken } = useAuth();
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [subject, setSubject] = useState("");
  const [patterns, setPatterns] = useState<PatternResult | null>(null);
  const [patternsBusy, setPatternsBusy] = useState(false);
  const [trends, setTrends] = useState<TopicTrend[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [topicsBySubject, setTopicsBySubject] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let active = true;
    const load = () => {
      loadAttempts(getToken).then((items) => { if (active) setAttempts(items); });
    };
    load();
    loadPatterns(getToken).then((p) => { if (active) setPatterns(p); });
    loadTopicTrends().then((t) => { if (active) setTrends(t); });
    const onChange = () => { setAttempts(loadAttemptsLocal()); load(); };
    window.addEventListener("propel:attempts-change", onChange);
    return () => {
      active = false;
      window.removeEventListener("propel:attempts-change", onChange);
    };
  }, [getToken]);

  // Every topic in each subject (from the question bank) — lets us list the ones
  // the student hasn't touched yet as "Unsolved".
  useEffect(() => {
    let active = true;
    const load = () => {
      const lvl = typeof window !== "undefined" && window.localStorage.getItem("propel_paper_level") === "alevel" ? "alevel" : "olevel";
      fetch(`/api/paper-practice?level=${lvl}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!active || !d?.subjects) return;
          const map: Record<string, string[]> = {};
          for (const s of d.subjects as { name: string; types?: { mcq?: { topics?: { name: string }[] }; structured?: { topics?: { name: string }[] } } }[]) {
            const set = new Set<string>();
            [...(s.types?.mcq?.topics ?? []), ...(s.types?.structured?.topics ?? [])].forEach((t) => {
              if (t?.name && !t.name.trim().toLowerCase().startsWith("uncategor")) set.add(t.name);
            });
            map[s.name] = Array.from(set);
          }
          setTopicsBySubject(map);
        })
        .catch(() => {});
    };
    load();
    window.addEventListener("propel:level-change", load);
    return () => { active = false; window.removeEventListener("propel:level-change", load); };
  }, []);

  const trendList = useMemo(() => trends.filter((t) => !subject || t.subject === subject).slice(0, 8), [trends, subject]);

  async function refreshPatterns() {
    setPatternsBusy(true);
    try { const p = await loadPatterns(getToken, true); if (p) setPatterns(p); }
    finally { setPatternsBusy(false); }
  }

  const revisions = useMemo(() => dueRevisions(attempts ?? []).filter((r) => !subject || r.subject === subject).slice(0, 8), [attempts, subject]);

  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  useEffect(() => {
    const read = () => setSelectedSubjects(loadSelectedSubjects().map((s) => s.name));
    read();
    window.addEventListener("propel:selected-subjects-change", read);
    return () => window.removeEventListener("propel:selected-subjects-change", read);
  }, []);
  const subjects = useMemo(() => {
    if (selectedSubjects.length) return selectedSubjects;
    return Array.from(new Set((attempts ?? []).map((a) => a.subject).filter(Boolean)));
  }, [attempts, selectedSubjects]);
  const filtered = useMemo(() => (attempts ?? []).filter((a) => !subject || a.subject === subject), [attempts, subject]);
  const weak = useMemo(() => weakestTopics(filtered, 1).slice(0, 12), [filtered]);
  const allWeak = useMemo(() => weakestTopics(attempts ?? [], 1), [attempts]);
  const mistakes = useMemo(() => mistakeList(filtered).slice(0, 60), [filtered]);
  const readiness = useMemo(() => topicReadiness(filtered), [filtered]);

  // Topics the student hasn't attempted yet, for the "Unsolved" readiness box.
  const unsolved = useMemo(() => {
    const subs = subject ? [subject] : subjects;
    const attempted = new Set((attempts ?? []).map((a) => `${normSubj(a.subject)}|${(a.topic || "").toLowerCase().trim()}`));
    const topicsFor = (name: string): string[] => {
      const n = normSubj(name);
      for (const [k, v] of Object.entries(topicsBySubject)) {
        const f = normSubj(k);
        if (f === n || f.startsWith(`${n} `) || n.startsWith(`${f} `)) return v;
      }
      return [];
    };
    const out: { key: string; topic: string; subject: string }[] = [];
    for (const s of subs) {
      for (const t of topicsFor(s)) {
        if (!attempted.has(`${normSubj(s)}|${t.toLowerCase().trim()}`)) out.push({ key: `${s}|${t}`, topic: t, subject: s });
      }
    }
    return out;
  }, [attempts, subjects, subject, topicsBySubject]);

  const totalGraded = filtered.length;
  const totalMistakes = filtered.filter((a) => a.verdict !== "correct").length;

  const readinessGroups = [
    { key: "mastered", label: "Mastered", tone: "teal", items: readiness.mastered.map((t) => ({ key: t.key, topic: t.topic, meta: `${t.accuracy}%`, href: `${t.subject}|${t.topic}` })) },
    { key: "needs-work", label: "Needs work", tone: "amber", items: readiness.needsWork.map((t) => ({ key: t.key, topic: t.topic, meta: `${t.accuracy}%`, href: `${t.subject}|${t.topic}` })) },
    { key: "weak", label: "Weak", tone: "coral", items: readiness.weak.map((t) => ({ key: t.key, topic: t.topic, meta: `${t.accuracy}%`, href: `${t.subject}|${t.topic}` })) },
    { key: "unsolved", label: "Unsolved", tone: "neutral", items: unsolved.map((u) => ({ key: u.key, topic: u.topic, meta: u.subject, href: `${u.subject}|${u.topic}` })) },
  ];
  const readinessHasData = readinessGroups.some((g) => g.items.length > 0);

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

        {/* Topic mastery across every chosen subject — full width, primary view. */}
        <Panel icon="layers" iconColor="var(--crimson)" title="Topic mastery by subject" sub="Every topic in your subjects — expand a subject to see where you stand.">
          <WeakPointsBySubject only={subject || undefined} weak={allWeak.map((w) => ({ subject: w.subject, topic: w.topic, accuracy: w.accuracy }))} />
        </Panel>

        {attempts === null ? (
          <div className="card flex items-center justify-center gap-8" style={{ minHeight: 200, color: "var(--ink-faint)", display: "flex" }}>
            <Icon name="refresh" size={16} className="spin" /> Loading your notebook…
          </div>
        ) : totalGraded === 0 && !readinessHasData ? (
          <div className="card">
            <EmptyState icon="target" title="Nothing logged yet"
              body="Check some MCQs or mark a written answer in Practice — every attempt is recorded here, worst topics first." />
          </div>
        ) : (
          <>
            {/* ── side-by-side analytics grid ── */}
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(330px,1fr))", gap: 16, alignItems: "start" }}>
              {/* weakness map */}
              <Panel icon="target" iconColor="var(--coral)" title="Weakness map"
                sub={`Accuracy by concept · ${totalMistakes} mistake${totalMistakes === 1 ? "" : "s"} across ${totalGraded} attempt${totalGraded === 1 ? "" : "s"}`}>
                {weak.length === 0 ? (
                  <p className="faint" style={{ fontSize: 13.5 }}>Not enough tagged-topic data yet — keep practising.</p>
                ) : (
                  <div className="flex-col gap-16">
                    {weak.slice(0, 8).map((w) => (
                      <div key={w.key} className="flex items-center gap-12">
                        <SubjGlyph subj={subjectStyle(w.subject)} size={32} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="row-between" style={{ fontSize: 13.5, marginBottom: 5, gap: 8 }}>
                            <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {w.topic} <span className="faint" style={{ fontSize: 11.5 }}>· {w.subject}</span>
                            </span>
                            <span className="tnum" style={{ fontWeight: 700, color: accColor(w.accuracy), flex: "none" }}>{w.accuracy}%</span>
                          </div>
                          <div className="bar" style={{ height: 8 }}><i style={{ width: Math.max(3, w.accuracy) + "%", background: accColor(w.accuracy) }} /></div>
                          <div className="faint" style={{ fontSize: 11, marginTop: 3 }}>{w.correct}/{w.attempts} correct</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              {/* topic readiness — now with an Unsolved box */}
              {readinessHasData && (
                <Panel icon="flag" iconColor="var(--teal-deep)" title="Topic readiness" sub="Where each topic stands — including ones you haven't started.">
                  <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
                    {readinessGroups.map((group) => (
                      <div key={group.key} style={{ borderRadius: 12, border: "1px solid var(--line)", padding: 12 }}>
                        <div className="flex items-center gap-8" style={{ marginBottom: 8 }}>
                          <span className={"badge " + group.tone}>{group.items.length}</span>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{group.label}</span>
                        </div>
                        {group.items.length === 0 ? (
                          <p className="faint" style={{ fontSize: 12 }}>None.</p>
                        ) : (
                          <div className="flex-col" style={{ gap: 4 }}>
                            {group.items.slice(0, 6).map((t) => (
                              <Link key={t.key} href={`/student/paper-practice?subject=${encodeURIComponent(t.href.split("|")[0])}&topic=${encodeURIComponent(t.href.split("|")[1])}`}
                                className="row-between" style={{ fontSize: 12.5, gap: 8, textDecoration: "none", color: "var(--ink)" }}>
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.topic}</span>
                                <span className="faint tnum" style={{ flex: "none" }}>{t.meta}</span>
                              </Link>
                            ))}
                            {group.items.length > 6 && <span className="faint" style={{ fontSize: 11 }}>+{group.items.length - 6} more</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Panel>
              )}

              {/* revisions due */}
              {revisions.length > 0 && (
                <Panel icon="rotate" iconColor="var(--crimson)" title="Revision due" sub="Topics you mastered before — revisit them before they fade.">
                  <div className="flex-col" style={{ gap: 8 }}>
                    {revisions.map((r) => {
                      const subj = subjectStyle(r.subject);
                      return (
                        <Link key={r.key} href={`/student/paper-practice?subject=${encodeURIComponent(r.subject)}&topic=${encodeURIComponent(r.topic)}`}
                          className="flex items-center gap-10" style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", textDecoration: "none", color: "var(--ink)" }}>
                          <div style={{ width: 28, height: 28, borderRadius: 9, flex: "none", display: "grid", placeItems: "center", background: subj.color + "1e", color: subj.color }}>
                            <Icon name={subj.icon} size={14} />
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
                </Panel>
              )}

              {/* most examined topics */}
              {trendList.length > 0 && (
                <Panel icon="trend_up" iconColor="var(--teal-deep)" title="Most examined topics" sub="How often each topic appears across past papers — historical frequency, not a prediction.">
                  <div className="flex-col gap-12">
                    {trendList.map((t) => {
                      const subj = subjectStyle(t.subject);
                      const maxCount = trendList[0].count || 1;
                      return (
                        <div key={`${t.subject}|${t.topic}`} className="flex items-center gap-12">
                          <SubjGlyph subj={subj} size={28} />
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
                </Panel>
              )}
            </div>

            {/* ── recent mistakes (full width, expandable to show answers) — ABOVE recurring patterns ── */}
            <Panel icon="target" iconColor="var(--coral)" title="Recent mistakes" sub="Tap a row to see what you wrote and the correct answer.">
              {mistakes.length === 0 ? (
                <p className="faint" style={{ fontSize: 13.5 }}>No mistakes logged — nice work.</p>
              ) : (
                <div className="flex-col" style={{ gap: 0 }}>
                  {mistakes.map((m) => {
                    const subj = subjectStyle(m.subject);
                    const tone = verdictTone[m.verdict];
                    const open = expanded === m.id;
                    const hasDetail = Boolean(m.yourAnswer || m.correctAnswer || m.questionText || m.reason);
                    return (
                      <div key={m.id} style={{ borderTop: "1px solid var(--line)" }}>
                        <button
                          onClick={() => hasDetail && setExpanded(open ? null : m.id)}
                          style={{ width: "100%", display: "flex", alignItems: "flex-start", gap: 12, padding: "11px 0", background: "transparent", border: "none", cursor: hasDetail ? "pointer" : "default", textAlign: "left" }}
                        >
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
                            {m.reason && !open && <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.45, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.reason}</div>}
                          </div>
                          <span className="faint" style={{ fontSize: 11, flex: "none", whiteSpace: "nowrap" }}>{timeAgo(m.at)}</span>
                          {hasDetail && <Icon name="chevron_down" size={15} style={{ color: "var(--ink-faint)", flex: "none", transform: open ? "rotate(180deg)" : "none", transition: "transform .18s" }} />}
                        </button>
                        {open && (
                          <div className="flex-col" style={{ gap: 10, padding: "2px 0 14px 46px" }}>
                            {m.questionText && (
                              <div>
                                <div className="eyebrow" style={{ color: "var(--ink-soft)", marginBottom: 4 }}>Question</div>
                                <p style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{m.questionText}</p>
                              </div>
                            )}
                            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
                              <div style={{ borderRadius: 10, border: "1px solid var(--coral-soft)", background: "var(--coral-soft)", padding: 10 }}>
                                <div className="eyebrow" style={{ color: "var(--coral)", marginBottom: 4 }}>Your answer</div>
                                <p style={{ fontSize: 12.5, lineHeight: 1.5, whiteSpace: "pre-wrap", color: "var(--ink)" }}>{m.yourAnswer || (m.verdict === "unanswered" ? "Not answered" : "—")}</p>
                              </div>
                              <div style={{ borderRadius: 10, border: "1px solid var(--teal-soft)", background: "var(--teal-soft)", padding: 10 }}>
                                <div className="eyebrow" style={{ color: "var(--teal-deep)", marginBottom: 4 }}>Correct answer</div>
                                <p style={{ fontSize: 12.5, lineHeight: 1.5, whiteSpace: "pre-wrap", color: "var(--ink)" }}>{m.correctAnswer || "—"}</p>
                              </div>
                            </div>
                            {m.reason && <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.45 }}>{m.reason}</div>}
                            {(!m.yourAnswer && !m.correctAnswer) && (
                              <p className="faint" style={{ fontSize: 11.5 }}>Answer details are saved for mistakes made from now on.</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>

            {/* ── recurring patterns (AI) — full width, below recent mistakes ── */}
            <Panel icon="lightbulb" iconColor="var(--amber-deep)" title="Recurring patterns" sub="Habits the AI spots across your mistakes — not just topics."
              action={
                <button className="btn btn-secondary btn-sm" onClick={refreshPatterns} disabled={patternsBusy || totalMistakes < 4}>
                  {patternsBusy ? <><Icon name="refresh" size={14} className="spin" /> Analyzing…</> : <><Icon name="sparkles" size={14} /> {patterns?.patterns.length ? "Re-analyze" : "Analyze"}</>}
                </button>
              }>
              {patterns && patterns.patterns.length > 0 ? (
                <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 10 }}>
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
            </Panel>
          </>
        )}
      </div>
    </div>
  );
}
