"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Icon } from "@/components/propel/Icon";
import { loadSelectedSubjects } from "@/lib/studentPersonalization";
import { Attempt, loadAttempts, loadAttemptsLocal, weakestTopics } from "@/lib/insights";
import { cacheGet, cacheSet } from "@/lib/sessionCache";
import { apiCall } from "@/lib/api";
import { weekdayName } from "@/lib/studyPlanner";
import { buildIntelligentPlan, PlanSession } from "@/lib/intelligentPlanner";

const MINUTE_OPTS = [30, 45, 60, 90, 120];
const CONFIG_KEY = "propel_planner_config";

interface TopicMeta { name: string; count: number }
interface SubjMeta { name: string; types: { mcq?: { topics?: TopicMeta[] }; structured?: { topics?: TopicMeta[] } } }
interface Config { weekdays: number[]; minutes: number; weakSubjects: string[] }

const normSubj = (s: string) => s.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/\d+/g, " ").replace(/[^a-z]+/g, " ").trim();
const matches = (a: string, b: string) => { const x = normSubj(a), y = normSubj(b); return x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `); };
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }); }

export default function PlannerPage() {
  const { getToken } = useAuth();
  const [subjects, setSubjects] = useState<string[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [examBySubjectRaw, setExamBySubjectRaw] = useState<Record<string, string>>({});
  const [topicsRaw, setTopicsRaw] = useState<Record<string, string[]>>({});

  const [config, setConfig] = useState<Config | null>(null);
  const [editing, setEditing] = useState(false);

  // Setup form state
  const [weekdays, setWeekdays] = useState<number[]>([1, 3, 5]);
  const [minutes, setMinutes] = useState(45);
  const [weakSubjects, setWeakSubjects] = useState<string[]>([]);

  // Selected subjects + attempts
  useEffect(() => {
    const readSubjects = () => setSubjects(loadSelectedSubjects().map((s) => s.name));
    readSubjects();
    setAttempts(loadAttemptsLocal());
    loadAttempts(() => getToken()).then(setAttempts).catch(() => {});
    window.addEventListener("propel:selected-subjects-change", readSubjects);
    return () => window.removeEventListener("propel:selected-subjects-change", readSubjects);
  }, [getToken]);

  // Saved config
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CONFIG_KEY);
      if (raw) { const c = JSON.parse(raw) as Config; setConfig(c); setWeekdays(c.weekdays); setMinutes(c.minutes); setWeakSubjects(c.weakSubjects || []); }
    } catch { /* ignore */ }
  }, []);

  // Exam dates from the datesheet (earliest paper per subject)
  useEffect(() => {
    apiCall("/datesheet?scope=personal").then((r) => (r.ok ? r.json() : null)).then((d: { papers?: { subject: string; date: string | null; date_start: string | null }[] } | null) => {
      if (!d?.papers) return;
      const map: Record<string, string> = {};
      for (const p of d.papers) { const date = p.date || p.date_start; if (!date) continue; if (!map[p.subject] || date < map[p.subject]) map[p.subject] = date; }
      setExamBySubjectRaw(map);
    }).catch(() => {});
  }, []);

  // Topics per subject from the practice library
  useEffect(() => {
    const use = (list: SubjMeta[]) => {
      const map: Record<string, string[]> = {};
      for (const m of list) {
        const set = new Set<string>();
        [...(m.types?.mcq?.topics ?? []), ...(m.types?.structured?.topics ?? [])].forEach((t) => { if (t.name && !t.name.trim().toLowerCase().startsWith("uncategor")) set.add(t.name); });
        map[m.name] = Array.from(set);
      }
      setTopicsRaw(map);
    };
    const cached = cacheGet<SubjMeta[]>("pp:practice:subjects", 30 * 60 * 1000);
    if (cached && cached.length) use(cached);
    fetch("/api/paper-practice").then((r) => (r.ok ? r.json() : null)).then((d: { subjects?: SubjMeta[] } | null) => { if (d?.subjects) { cacheSet("pp:practice:subjects", d.subjects); use(d.subjects); } }).catch(() => {});
  }, []);

  // Map raw datesheet/library keys onto the student's selected subject names
  const examDateBySubject = useMemo(() => {
    const out: Record<string, string | null> = {};
    for (const s of subjects) {
      let found: string | null = null;
      for (const [k, v] of Object.entries(examBySubjectRaw)) if (matches(k, s) && (!found || v < found)) found = v;
      out[s] = found;
    }
    return out;
  }, [subjects, examBySubjectRaw]);

  const topicsBySubject = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const s of subjects) { const key = Object.keys(topicsRaw).find((k) => matches(k, s)); out[s] = key ? topicsRaw[key] : []; }
    return out;
  }, [subjects, topicsRaw]);

  const weakTopicsBySubject = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const w of weakestTopics(attempts, 1)) {
      const subj = subjects.find((s) => matches(s, w.subject || "")) || null;
      if (subj) (out[subj] = out[subj] || []).push(w.topic);
    }
    return out;
  }, [attempts, subjects]);

  const plan = useMemo(() => {
    if (!config) return [] as PlanSession[];
    return buildIntelligentPlan({
      weekdays: config.weekdays, minutes: config.minutes, weakSubjects: config.weakSubjects,
      subjects, examDateBySubject, topicsBySubject, weakTopicsBySubject,
    });
  }, [config, subjects, examDateBySubject, topicsBySubject, weakTopicsBySubject]);

  const weeks = useMemo(() => {
    const m = new Map<number, PlanSession[]>();
    for (const s of plan) { const l = m.get(s.weekIndex) ?? []; l.push(s); m.set(s.weekIndex, l); }
    return Array.from(m.entries()).sort((a, b) => a[0] - b[0]);
  }, [plan]);

  const totalHours = Math.round(plan.reduce((s, x) => s + x.minutes, 0) / 60);
  const toggleDay = (d: number) => setWeekdays((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d].sort()));
  const toggleWeak = (s: string) => setWeakSubjects((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  const savePlan = () => {
    const c: Config = { weekdays, minutes, weakSubjects: weakSubjects.filter((w) => subjects.includes(w)) };
    try { window.localStorage.setItem(CONFIG_KEY, JSON.stringify(c)); } catch { /* ignore */ }
    setConfig(c); setEditing(false);
  };

  const showSetup = !config || editing;

  return (
    <div className="pr">
      <div className="main flex-col gap-24">
        <div className="row-between wrap" style={{ gap: 14, alignItems: "flex-end" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Plan</div>
            <h1 style={{ fontSize: "clamp(26px,3.5vw,36px)" }}>Study planner</h1>
            <p className="muted mt-6" style={{ maxWidth: 560 }}>
              Tell the planner how you study and where you feel weak — it builds a timetable around your exam dates, front-loading your weaker subjects.
            </p>
          </div>
          {!showSetup && <button onClick={() => setEditing(true)} className="btn btn-secondary btn-sm"><Icon name="settings" size={14} /> Edit preferences</button>}
        </div>

        {subjects.length === 0 ? (
          <div className="card card-pad">
            <p className="muted">Add your subjects in Settings first — the planner builds around them.</p>
          </div>
        ) : showSetup ? (
          <div className="card card-pad flex-col gap-24">
            {/* Q1 — minutes per day */}
            <div>
              <span className="card-title" style={{ display: "block", marginBottom: 3 }}>How long can you study each day?</span>
              <div className="faint" style={{ fontSize: 12.5, marginBottom: 10 }}>One focused session per study day.</div>
              <div className="flex gap-8 wrap">
                {MINUTE_OPTS.map((t) => (
                  <button key={t} onClick={() => setMinutes(t)} className="chip" style={{ cursor: "pointer", padding: "8px 16px",
                    border: minutes === t ? "1.5px solid var(--crimson)" : "1px solid var(--line-strong)", background: minutes === t ? "var(--crimson-soft)" : "var(--surface)", color: minutes === t ? "var(--crimson)" : "var(--ink-soft)", fontWeight: minutes === t ? 600 : 500 }}>
                    {t >= 60 ? `${t / 60}h${t % 60 ? ` ${t % 60}m` : ""}` : `${t} min`}
                  </button>
                ))}
              </div>
            </div>

            {/* Q2 — which days of the week */}
            <div>
              <span className="card-title" style={{ display: "block", marginBottom: 3 }}>Which days of the week can you study?</span>
              <div className="faint" style={{ fontSize: 12.5, marginBottom: 10 }}>{weekdays.length} day{weekdays.length === 1 ? "" : "s"} a week selected.</div>
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

            {/* Q3 — weaker subjects */}
            <div>
              <span className="card-title" style={{ display: "block", marginBottom: 3 }}>Which subjects feel weakest right now?</span>
              <div className="faint" style={{ fontSize: 12.5, marginBottom: 10 }}>These get more sessions. Pick any (or none).</div>
              <div className="flex gap-8 wrap">
                {subjects.map((s) => {
                  const on = weakSubjects.includes(s);
                  return (
                    <button key={s} onClick={() => toggleWeak(s)} className="chip" style={{ cursor: "pointer", padding: "8px 14px",
                      border: on ? "1.5px solid var(--coral-bright)" : "1px solid var(--line-strong)", background: on ? "var(--coral-soft)" : "var(--surface)", color: on ? "var(--coral-bright)" : "var(--ink-soft)", fontWeight: on ? 600 : 500 }}>
                      {on && <Icon name="check_circle" size={13} />} {s}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-12 wrap">
              <button onClick={savePlan} disabled={weekdays.length === 0} className="btn btn-primary" style={{ opacity: weekdays.length === 0 ? 0.5 : 1 }}>
                <Icon name="sparkles" size={15} /> Build my plan
              </button>
              {weekdays.length === 0 && <span className="faint" style={{ fontSize: 12.5 }}>Pick at least one study day.</span>}
              {config && <button onClick={() => setEditing(false)} className="btn btn-ghost btn-sm">Cancel</button>}
            </div>
          </div>
        ) : (
          <>
            {/* summary */}
            <div className="card card-pad row-between wrap" style={{ gap: 12 }}>
              <div className="flex gap-8 wrap" style={{ fontSize: 13 }}>
                <span className="chip" style={{ padding: "6px 12px" }}><Icon name="clock" size={13} /> {config!.minutes} min/day</span>
                <span className="chip" style={{ padding: "6px 12px" }}><Icon name="calendar" size={13} /> {config!.weekdays.length} days/week</span>
                {config!.weakSubjects.length > 0 && <span className="chip" style={{ padding: "6px 12px", color: "var(--coral-bright)" }}><Icon name="target" size={13} /> focus: {config!.weakSubjects.join(", ")}</span>}
              </div>
              <span className="faint" style={{ fontSize: 12.5 }}>{plan.length} sessions · ~{totalHours}h planned</span>
            </div>

            {plan.length === 0 ? (
              <div className="card card-pad"><p className="muted">No sessions to schedule yet — check your study days, or add subjects with upcoming exams.</p></div>
            ) : (
              <div className="flex-col gap-18">
                {weeks.map(([wk, list]) => (
                  <div key={wk} className="card card-pad">
                    <div className="card-head">
                      <span className="card-title">{wk === 0 ? "This week" : wk === 1 ? "Next week" : `In ${wk} weeks`}</span>
                      <span className="faint" style={{ fontSize: 12 }}>{list.length} session{list.length === 1 ? "" : "s"}</span>
                    </div>
                    <div className="flex-col" style={{ gap: 2 }}>
                      {list.map((s, i) => (
                        <Link key={i} href="/student/paper-practice" className="flex items-center gap-12" style={{ padding: "10px 0", borderTop: i ? "1px solid var(--line)" : "none" }}>
                          <div style={{ width: 44, flex: "none", textAlign: "center" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-faint)", textTransform: "uppercase" }}>{fmtDate(s.date).split(" ")[0]}</div>
                            <div style={{ fontSize: 15, fontWeight: 700 }}>{fmtDate(s.date).split(" ")[1]}</div>
                          </div>
                          <div style={{ width: 34, height: 34, borderRadius: 10, flex: "none", display: "grid", placeItems: "center", background: s.weak ? "var(--coral-soft)" : "var(--crimson-soft)", color: s.weak ? "var(--coral-bright)" : "var(--crimson)" }}>
                            <Icon name={s.weak ? "target" : "book"} size={16} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {s.subject}{s.weak && <span className="badge coral" style={{ fontSize: 10, marginLeft: 6 }}>weak</span>}
                            </div>
                            <div className="faint" style={{ fontSize: 11.5 }}>
                              {s.topic ? s.topic : "Practice"} · {s.minutes} min{s.daysToExam != null ? ` · exam in ${s.daysToExam}d` : ""}
                            </div>
                          </div>
                          <Icon name="chevron_right" size={15} style={{ color: "var(--ink-faint)", flex: "none" }} />
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
