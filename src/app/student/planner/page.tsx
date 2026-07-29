"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Icon } from "@/components/propel/Icon";
import { EmptyState } from "@/components/propel/primitives";
import { daysUntilExam, EXAM_DATE, EXAM_SESSION_LABEL } from "@/lib/examCountdown";
import { Attempt, loadAttempts, weakestTopics, buildRevisionSchedule } from "@/lib/insights";
import { buildStudyPlan, weekdayName, DEFAULT_WEEKDAYS } from "@/lib/studyPlanner";

const SESSION_LENGTHS = [30, 45, 60];

export default function PlannerPage() {
  const { getToken } = useAuth();
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [weekdays, setWeekdays] = useState<number[]>(DEFAULT_WEEKDAYS);
  const [minutes, setMinutes] = useState(45);

  useEffect(() => {
    let active = true;
    loadAttempts(() => getToken()).then((items) => { if (active) setAttempts(items); });
    return () => { active = false; };
  }, [getToken]);

  const plan = useMemo(() => {
    if (!attempts) return [];
    const weak = weakestTopics(attempts, 1).map((w) => ({ topic: w.topic, subject: w.subject }));
    const revisions = buildRevisionSchedule(attempts).map((r) => ({ topic: r.topic, subject: r.subject }));
    return buildStudyPlan({ weekdays, minutesPerSession: minutes, examDate: EXAM_DATE, weakTopics: weak, revisions });
  }, [attempts, weekdays, minutes]);

  const weeks = useMemo(() => {
    const map = new Map<number, typeof plan>();
    for (const s of plan) { const list = map.get(s.weekIndex) ?? []; list.push(s); map.set(s.weekIndex, list); }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [plan]);

  const totalMin = plan.reduce((s, x) => s + x.minutes, 0);
  const toggleDay = (d: number) => setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  return (
    <div className="pr">
      <div className="main flex-col gap-24">
        <div className="row-between wrap" style={{ gap: 14, alignItems: "flex-end" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Plan</div>
            <h1 style={{ fontSize: "clamp(26px,3.5vw,36px)" }}>Study planner</h1>
            <p className="muted mt-6" style={{ maxWidth: 560 }}>
              A timetable to the {EXAM_SESSION_LABEL} that spreads your weakest topics and due revisions across the days you study — {daysUntilExam()} days to go.
            </p>
          </div>
          <Link href="/student/notebook" className="btn btn-secondary btn-sm"><Icon name="target" size={14} /> Notebook</Link>
        </div>

        {/* controls */}
        <div className="card card-pad flex-col gap-16">
          <div>
            <span className="eyebrow" style={{ marginBottom: 8, display: "block" }}>Study days</span>
            <div className="flex gap-6 wrap">
              {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                const on = weekdays.includes(d);
                return (
                  <button key={d} onClick={() => toggleDay(d)} className="chip" style={{ cursor: "pointer", padding: "8px 12px", minWidth: 48, justifyContent: "center",
                    border: on ? "1.5px solid var(--crimson)" : "1px solid var(--line-strong)", background: on ? "var(--crimson-soft)" : "var(--surface)", color: on ? "var(--crimson)" : "var(--ink-soft)", fontWeight: on ? 600 : 500 }}>
                    {weekdayName(d)}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <span className="eyebrow" style={{ marginBottom: 8, display: "block" }}>Session length</span>
            <div className="flex gap-8 wrap">
              {SESSION_LENGTHS.map((t) => (
                <button key={t} onClick={() => setMinutes(t)} className="chip" style={{ cursor: "pointer", padding: "8px 16px",
                  border: minutes === t ? "1.5px solid var(--crimson)" : "1px solid var(--line-strong)", background: minutes === t ? "var(--crimson-soft)" : "var(--surface)", color: minutes === t ? "var(--crimson)" : "var(--ink-soft)", fontWeight: minutes === t ? 600 : 500 }}>
                  {t} min
                </button>
              ))}
            </div>
          </div>
          {plan.length > 0 && (
            <div className="faint" style={{ fontSize: 12.5 }}>{plan.length} sessions · ~{Math.round(totalMin / 60)}h of focused study planned</div>
          )}
        </div>

        {attempts === null ? (
          <div className="card flex items-center justify-center gap-8" style={{ minHeight: 200, color: "var(--ink-faint)", display: "flex" }}>
            <Icon name="refresh" size={16} className="spin" /> Building your plan…
          </div>
        ) : plan.length === 0 ? (
          <div className="card">
            <EmptyState icon="calendar" title={weekdays.length === 0 ? "Pick your study days" : "Practise a little first"}
              body={weekdays.length === 0 ? "Choose which weekdays you can study and a plan will appear." : "Once you've graded a few answers, the planner targets your weakest topics."}
              cta="Start practising" onCta={() => { window.location.href = "/student/paper-practice"; }} />
          </div>
        ) : (
          <div className="flex-col gap-18">
            {weeks.map(([wk, list]) => (
              <div key={wk} className="card card-pad">
                <div className="card-head"><span className="card-title">{wk === 0 ? "This week" : wk === 1 ? "Next week" : `In ${wk} weeks`}</span><span className="faint" style={{ fontSize: 12 }}>{list.length} sessions</span></div>
                <div className="flex-col" style={{ gap: 2 }}>
                  {list.map((s, i) => (
                    <Link key={i} href={s.href} className="flex items-center gap-12" style={{ padding: "10px 0", borderTop: i ? "1px solid var(--line)" : "none" }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, flex: "none", display: "grid", placeItems: "center", background: `var(--${s.tone}-soft)`, color: `var(--${s.tone === "crimson" ? "crimson" : s.tone})` }}>
                        <Icon name={s.icon} size={16} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.focus}</div>
                        <div className="faint" style={{ fontSize: 11.5 }}>{s.label} · {s.detail} · {s.minutes} min</div>
                      </div>
                      <Icon name="chevron_right" size={15} style={{ color: "var(--ink-faint)", flex: "none" }} />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
