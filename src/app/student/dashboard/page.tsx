"use client";

import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useClerkAuth } from "@/lib/useClerkAuth";
import { useStudentStats, timeAgo } from "@/lib/useStudentStats";
import { Icon } from "@/components/propel/Icon";
import { Bar, CountUp, Delta, Ring, SubjGlyph, EmptyState } from "@/components/propel/primitives";
import { subjectStyle } from "@/components/propel/subjects";
import type { TrackedPaper } from "@/lib/paperTracking";

/* next O-Level session target (no exam date is stored per student yet) */
const EXAM_DATE = new Date("2026-10-06T00:00:00");

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** subject label guessed from a tracked paper name, for glyphs */
function paperSubject(p: TrackedPaper): string {
  const known = ["physics", "chemistry", "biology", "mathematics", "add maths", "additional mathematics",
    "computer science", "business", "economics", "english", "islamiyat", "pakistan studies", "accounting"];
  const lower = (p.name || "").toLowerCase();
  for (const k of known) if (lower.includes(k)) return k;
  return (p.name || "Paper").split(/[\s/_-]/)[0] || "Paper";
}

export default function StudentDashboard() {
  const router = useRouter();
  const { user } = useUser();
  const { profile } = useClerkAuth();
  const stats = useStudentStats();
  const name = (profile?.full_name || user?.firstName || "there").split(" ")[0];

  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const daysToExam = Math.max(0, Math.ceil((EXAM_DATE.getTime() - Date.now()) / 86_400_000));

  // readiness = goal completion when goals exist (real), else completed-paper momentum
  const readiness = stats.goalsTotal > 0
    ? Math.round((stats.goalsDone / stats.goalsTotal) * 100)
    : Math.min(100, stats.completedCount * 8);
  const readinessLabel = readiness >= 75 ? "On track" : readiness >= 45 ? "Building up" : "Getting started";

  // completed-this-week (real momentum)
  const weekAgo = Date.now() - 7 * 86_400_000;
  const completedThisWeek = stats.papers.filter(
    (p) => p.statuses.includes("completed" as never) && new Date(p.savedAt).getTime() >= weekAgo
  ).length;

  // per-subject completed counts (real)
  const bySubject = new Map<string, number>();
  stats.papers.forEach((p) => {
    if (!p.statuses.includes("completed" as never)) return;
    const s = paperSubject(p);
    bySubject.set(s, (bySubject.get(s) || 0) + 1);
  });
  const subjectRows = Array.from(bySubject.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxSubject = Math.max(1, ...subjectRows.map(([, c]) => c));

  // weekly completed series for the trend (real)
  const weeks = 8;
  const series = Array.from({ length: weeks }, (_, i) => {
    const start = Date.now() - (weeks - i) * 7 * 86_400_000;
    const end = start + 7 * 86_400_000;
    const v = stats.papers.filter((p) => {
      if (!p.statuses.includes("completed" as never)) return false;
      const t = new Date(p.savedAt).getTime();
      return t >= start && t < end;
    }).length;
    return { wk: "W" + (i + 1), v };
  });
  const hasTrend = series.some((s) => s.v > 0);

  const go = (path: string) => router.push(path);

  const statCards = [
    { key: "done", label: "Papers solved", value: stats.completedCount, icon: "book", tone: "crimson" },
    { key: "prog", label: "In progress", value: stats.inProgressCount, icon: "clock", tone: "amber" },
    { key: "marks", label: "Bookmarked", value: stats.bookmarkedCount, icon: "bookmark", tone: "teal" },
    { key: "goals", label: "Goals set", value: stats.goalsTotal, icon: "target", tone: "purple" },
  ];

  return (
    <div className="pr">
      <div className="main stagger flex-col gap-24">
        {/* greeting + countdown */}
        <div className="row-between wrap" style={{ gap: 14 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>{today}</div>
            <h1 style={{ fontSize: "clamp(28px,4vw,40px)" }}>{greeting()}, {name} 👋</h1>
            <p className="muted mt-6" style={{ fontSize: 15.5 }}>
              You&apos;re <b style={{ color: "var(--ink)" }}>{daysToExam} days</b> from the next O-Level session. A focused paper today keeps your momentum.
            </p>
          </div>
          <div className="card card-pad" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, flex: "none" }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: "var(--crimson-soft)", color: "var(--crimson)", display: "grid", placeItems: "center" }}>
              <Icon name="calendar" size={22} />
            </div>
            <div>
              <div className="stat-num" style={{ fontSize: 30, color: "var(--crimson)" }}><CountUp value={daysToExam} /></div>
              <div className="faint" style={{ fontSize: 12 }}>days · Oct 2026 session</div>
            </div>
          </div>
        </div>

        {/* HERO ROW */}
        <div className="grid" style={{ gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr)", alignItems: "stretch" }}>
          {/* readiness */}
          <div className="card card-pad hero-crimson" style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
            <Ring value={readiness} size={168} label={readinessLabel} sub={stats.goalsTotal > 0 ? "of your goals" : "momentum"} />
            <div style={{ flex: 1, minWidth: 180, position: "relative", zIndex: 1 }}>
              <div className="eyebrow" style={{ color: "rgba(255,255,255,.75)" }}>North-star metric</div>
              <h2 style={{ color: "#fff", fontSize: 24, marginTop: 4 }}>Exam readiness</h2>
              <p style={{ color: "rgba(255,255,255,.86)", marginTop: 8, fontSize: 14.5, lineHeight: 1.5 }}>
                {stats.goalsTotal > 0
                  ? <>You&apos;ve completed <b>{stats.goalsDone} of {stats.goalsTotal}</b> goal papers. Finish the rest to reach the green zone.</>
                  : <>Set a few goal papers in <b>Papers</b> and complete them — your readiness builds from real progress.</>}
              </p>
              <div className="flex gap-8 wrap mt-16">
                <span className="badge" style={{ background: "rgba(255,255,255,.18)", color: "#fff" }}><Icon name="book" size={13} /> {stats.completedCount} solved</span>
                <span className="badge" style={{ background: "rgba(255,255,255,.18)", color: "#fff" }}><Icon name="target" size={13} /> target 100%</span>
              </div>
            </div>
          </div>

          {/* right column: this-week + library */}
          <div className="grid" style={{ gridTemplateRows: "1fr 1fr", gap: 18 }}>
            <div className="card card-pad hero-amber" style={{ display: "flex", flexDirection: "column", gap: 12, justifyContent: "center" }}>
              <div className="flex items-center gap-10">
                <Icon name="flame" size={30} fill="rgba(255,255,255,.25)" />
                <div>
                  <div className="big-num" style={{ fontSize: 30, color: "#fff" }}><CountUp value={completedThisWeek} /> this week</div>
                  <div style={{ color: "rgba(255,255,255,.82)", fontSize: 12.5 }}>papers completed</div>
                </div>
              </div>
              <button className="btn btn-sm" style={{ background: "#fff", color: "var(--amber-deep)", alignSelf: "flex-start" }} onClick={() => go("/student/paper-practice")}>
                Keep it going
              </button>
            </div>

            <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 12, justifyContent: "center" }}>
              <div className="flex items-center gap-10">
                <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--purple-soft)", color: "var(--purple)", display: "grid", placeItems: "center" }}>
                  <Icon name="layers" size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>Your library</div>
                  <div className="faint" style={{ fontSize: 12.5 }}>{stats.papers.length} papers tracked</div>
                </div>
              </div>
              <div className="flex gap-8 wrap">
                <span className="badge teal">{stats.completedCount} done</span>
                <span className="badge amber">{stats.inProgressCount} in progress</span>
                <span className="badge crimson">{stats.bookmarkedCount} saved</span>
              </div>
            </div>
          </div>
        </div>

        {/* STAT STRIP (real) */}
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
          {statCards.map((st) => (
            <div className="card card-pad card-hover" key={st.key} style={{ padding: 18 }}>
              <div className="row-between" style={{ marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface-2)", color: "var(--ink-soft)", display: "grid", placeItems: "center" }}>
                  <Icon name={st.icon} size={18} />
                </div>
                <span className={"badge " + st.tone} style={{ flex: "none" }}>{st.label.split(" ")[0]}</span>
              </div>
              <div className="stat-num"><CountUp value={st.value} /></div>
              <div className="faint" style={{ fontSize: 13, marginTop: 2 }}>{st.label}</div>
            </div>
          ))}
        </div>

        {/* two-column body */}
        <div className="grid dash-cols" style={{ gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)", alignItems: "start" }}>
          <div className="flex-col gap-18">
            {/* weak spots — needs attempt data we don't persist yet */}
            <div className="card card-pad">
              <div className="card-head">
                <div>
                  <div className="flex items-center gap-8">
                    <Icon name="target" size={19} style={{ color: "var(--coral)" }} />
                    <span className="card-title">Your weak spots</span>
                  </div>
                  <div className="card-sub mt-6">These surface once you start grading answers in Practice.</div>
                </div>
              </div>
              <EmptyState
                icon="target"
                title="No weak spots yet"
                body="Grade a few written answers in Practice and your toughest topics will rank here, worst-first."
                cta="Start practising"
                onCta={() => go("/student/paper-practice")}
              />
            </div>

            {/* completed trend (real) */}
            <div className="card card-pad">
              <div className="card-head">
                <div>
                  <span className="card-title">Papers completed</span>
                  <div className="card-sub mt-6">Last 8 weeks of your real progress</div>
                </div>
                <span className="badge teal"><Icon name="trend_up" size={13} /> {stats.completedCount} total</span>
              </div>
              {hasTrend ? <CompletedTrend series={series} /> : (
                <EmptyState icon="chart" title="Complete a paper to see your trend" body="Mark papers complete in Papers or Practice — your weekly pace appears here." />
              )}
            </div>
          </div>

          <div className="flex-col gap-18">
            {/* resume (real) */}
            <div className="card card-pad" style={{ background: "var(--ink)", color: "var(--canvas)", border: "none" }}>
              <div className="eyebrow" style={{ color: "var(--ink-faint)" }}>Resume where you left off</div>
              {stats.resume ? (
                <>
                  <div className="flex items-center gap-12 mt-12">
                    <SubjGlyph subj={subjectStyle(paperSubject(stats.resume))} size={44} radius={12} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stats.resume.name}</div>
                      <div style={{ fontSize: 12.5, opacity: 0.7 }}>{stats.resume.type} · in progress</div>
                    </div>
                  </div>
                  <button className="btn btn-block mt-16" style={{ background: "var(--crimson)", color: "#fff" }} onClick={() => go("/student/paper-practice")}>
                    <Icon name="play" size={15} fill="#fff" stroke={0} /> Continue paper
                  </button>
                </>
              ) : (
                <>
                  <p style={{ marginTop: 12, fontSize: 14, opacity: 0.85 }}>Nothing in progress. Pick a paper and start a session.</p>
                  <button className="btn btn-block mt-16" style={{ background: "var(--crimson)", color: "#fff" }} onClick={() => go("/student/past-papers")}>
                    <Icon name="book" size={15} /> Browse papers
                  </button>
                </>
              )}
            </div>

            {/* goals (real) */}
            <div className="card card-pad">
              <div className="card-head">
                <span className="card-title">Goals</span>
                <button className="btn btn-ghost btn-sm" onClick={() => go("/student/past-papers")}>Set goals <Icon name="chevron_right" size={15} /></button>
              </div>
              {stats.goalsTotal > 0 ? (
                <div className="flex-col gap-10">
                  {stats.papers.filter((p) => p.statuses.includes("goal" as never)).slice(0, 4).map((g) => {
                    const done = g.statuses.includes("completed" as never);
                    const subj = subjectStyle(paperSubject(g));
                    return (
                      <div key={g.id} className="flex items-center gap-12">
                        <div style={{ width: 30, height: 30, borderRadius: 9, flex: "none", display: "grid", placeItems: "center", background: done ? "var(--teal-soft)" : subj.color + "1e", color: done ? "var(--teal)" : subj.color }}>
                          <Icon name={done ? "check_circle" : subj.icon} size={16} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</div>
                          <div className="faint" style={{ fontSize: 11.5 }}>{done ? "Completed" : "In your goals"}</div>
                        </div>
                        {done && <span className="badge teal" style={{ flex: "none" }}>Done</span>}
                      </div>
                    );
                  })}
                  <div className="row-between mt-6" style={{ fontSize: 12.5 }}>
                    <span className="muted">{stats.goalsDone} of {stats.goalsTotal} done</span>
                    <Bar value={Math.round((stats.goalsDone / stats.goalsTotal) * 100)} tone="teal" height={6} />
                  </div>
                </div>
              ) : (
                <p className="faint" style={{ fontSize: 13.5 }}>No goals yet. Mark papers as a goal from the Papers tab to track them here.</p>
              )}
            </div>

            {/* subject activity (real) */}
            <div className="card card-pad">
              <div className="card-head"><span className="card-title">Papers by subject</span></div>
              {subjectRows.length > 0 ? (
                <div className="flex-col gap-16">
                  {subjectRows.map(([s, c]) => {
                    const subj = subjectStyle(s);
                    return (
                      <div key={s} className="flex items-center gap-12">
                        <SubjGlyph subj={subj} size={34} />
                        <div style={{ flex: 1 }}>
                          <div className="row-between" style={{ fontSize: 13.5, marginBottom: 5 }}>
                            <span style={{ fontWeight: 500, textTransform: "capitalize" }}>{s}</span>
                            <span className="tnum" style={{ fontWeight: 600, color: subj.color }}>{c}</span>
                          </div>
                          <div className="bar" style={{ height: 8 }}>
                            <i style={{ width: Math.round((c / maxSubject) * 100) + "%", background: subj.color }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="faint" style={{ fontSize: 13.5 }}>Complete papers to see your subject breakdown.</p>
              )}
            </div>
          </div>
        </div>

        {/* activity feed (real) */}
        <div className="card card-pad">
          <div className="card-head"><span className="card-title">Recent activity</span></div>
          {stats.activity.length > 0 ? (
            <div className="flex-col" style={{ gap: 2 }}>
              {stats.activity.map(({ paper, status, at }) => {
                const tone = status === "completed" ? "teal" : status === "in_progress" ? "amber" : status === "goal" ? "purple" : "crimson";
                const icon = status === "completed" ? "check_circle" : status === "in_progress" ? "clock" : status === "goal" ? "target" : "bookmark";
                const label = status === "completed" ? "Completed" : status === "in_progress" ? "Working on" : status === "goal" ? "Set as goal" : "Bookmarked";
                return (
                  <div key={paper.id + status} className="flex items-center gap-12" style={{ padding: "9px 0" }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, flex: "none", display: "grid", placeItems: "center", background: `var(--${tone}-soft)`, color: `var(--${tone === "crimson" ? "crimson" : tone})` }}>
                      <Icon name={icon} size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label} · {paper.name}</div>
                      <div className="faint" style={{ fontSize: 11.5 }}>{timeAgo(at)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="faint" style={{ fontSize: 13.5 }}>Your paper activity will show up here as you study.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- completed-papers weekly trend (real series) ---- */
function CompletedTrend({ series }: { series: { wk: string; v: number }[] }) {
  const w = 520, h = 190, pad = 28;
  const max = Math.max(2, ...series.map((d) => d.v));
  const x = (i: number) => pad + (i / (series.length - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const line = series.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.v)}`).join(" ");
  const area = `${line} L${x(series.length - 1)},${h - pad} L${x(0)},${h - pad} Z`;
  return (
    <div style={{ width: "100%", overflow: "hidden" }}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", display: "block" }}>
        <defs>
          <linearGradient id="tgrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--crimson)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--crimson)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#tgrad)" />
        <path d={line} fill="none" stroke="var(--crimson)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {series.map((d, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(d.v)} r={i === series.length - 1 ? 5 : 3} fill="var(--surface)" stroke="var(--crimson)" strokeWidth="2.5" />
            <text x={x(i)} y={h - 8} fontSize="10" fill="var(--ink-faint)" textAnchor="middle">{d.wk}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
