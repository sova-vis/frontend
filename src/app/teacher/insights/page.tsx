"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { Reveal } from "@/components/ui/Motion";
import { TeacherClass, Enrollment, listClasses, listEnrollments } from "@/lib/teacherClasses";
import {
  Difficulty,
  Heatmap,
  Predicted,
  Progress,
  downloadCsv,
  getDifficulty,
  getHeatmap,
  getPredicted,
  getProgress,
} from "@/lib/teacherInsights";
import { syllabusLabel } from "@/lib/syllabus";

export default function InsightsPage() {
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [classId, setClassId] = useState("");
  const [heatmap, setHeatmap] = useState<Heatmap | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [students, setStudents] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    void (async () => {
      const c = await listClasses();
      setClasses(c);
      if (c.length > 0) setClassId(c[0].id);
    })();
  }, []);

  useEffect(() => {
    if (!classId) return;
    void (async () => {
      setLoading(true);
      try {
        const [h, d, e] = await Promise.all([getHeatmap(classId), getDifficulty(classId), listEnrollments(classId, "active")]);
        setHeatmap(h);
        setDifficulty(d);
        setStudents(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [classId]);

  const selectedClass = classes.find((c) => c.id === classId);

  return (
    <div className="px-4 md:px-8 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">
                <span className="italic text-crimson">Insights</span>
              </h1>
              {selectedClass && <p className="text-ink-muted mt-1">{syllabusLabel(selectedClass.syllabus_code)}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={classId} onChange={(e) => setClassId(e.target.value)} className="ed-input px-3 py-2 text-sm w-auto">
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="ed-input px-2 py-2 text-sm w-auto" title="From" />
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="ed-input px-2 py-2 text-sm w-auto" title="To" />
              <button onClick={() => void downloadCsv(classId, from || undefined, to || undefined)} className="ed-btn-ghost px-3 py-2 text-sm">
                <Download size={14} /> CSV
              </button>
              {classId && (
                <Link href={`/teacher/reports/class/${classId}`} className="ed-btn-ghost px-3 py-2 text-sm">
                  <FileText size={14} /> Report
                </Link>
              )}
            </div>
          </div>
        </Reveal>

        {loading ? (
          <div className="h-64 rounded-[1.25rem] bg-surface-soft animate-pulse" />
        ) : (
          <>
            <HeatmapPanel heatmap={heatmap} />
            <DifficultyPanel difficulty={difficulty} />
            <StudentPanel classId={classId} students={students} />
          </>
        )}
      </div>
    </div>
  );
}

function shade(pct: number | null): string {
  if (pct === null) return "transparent";
  // Single-hue sequential (crimson), opacity by mastery.
  const alpha = 0.12 + (pct / 100) * 0.78;
  return `rgba(168, 18, 60, ${alpha.toFixed(2)})`;
}

function HeatmapPanel({ heatmap }: { heatmap: Heatmap | null }) {
  if (!heatmap || heatmap.rows.length === 0) {
    return <section className="ed-card p-6 text-ink-muted text-sm">No marked data yet for the topic heatmap.</section>;
  }
  return (
    <section className="ed-card p-6">
      <h2 className="font-display text-lg font-semibold mb-1">Topic heatmap</h2>
      <p className="text-xs text-ink-faint mb-4">A pale column = the class didn&apos;t learn a topic; a pale row = one student struggling.</p>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 bg-paper px-2 py-1 text-left text-ink-faint font-semibold">Student</th>
              {heatmap.topics.map((t) => (
                <th key={t} className="px-1 py-1 text-ink-faint font-normal align-bottom">
                  <div className="w-8 truncate" title={t}>{t}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmap.rows.map((r) => (
              <tr key={r.student}>
                <td className="sticky left-0 bg-paper px-2 py-1 text-ink whitespace-nowrap">{r.student}</td>
                {r.cells.map((c, i) => (
                  <td key={i} className="text-center text-[0.65rem] text-ink" style={{ backgroundColor: shade(c) }} title={`${heatmap.topics[i]}: ${c ?? "—"}%`}>
                    {c ?? ""}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t-2 border-line font-semibold">
              <td className="sticky left-0 bg-paper px-2 py-1 text-ink">Class avg</td>
              {heatmap.class_average.map((c, i) => (
                <td key={i} className="text-center text-[0.65rem] text-ink" style={{ backgroundColor: shade(c) }}>{c ?? ""}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DifficultyPanel({ difficulty }: { difficulty: Difficulty | null }) {
  if (!difficulty || difficulty.questions.length === 0) {
    return <section className="ed-card p-6 text-ink-muted text-sm">No marked questions yet for difficulty analysis.</section>;
  }
  return (
    <section className="ed-card p-6">
      <h2 className="font-display text-lg font-semibold mb-4">Question difficulty <span className="text-ink-faint text-sm font-normal">(worst first)</span></h2>
      <div className="space-y-2">
        {difficulty.questions.slice(0, 20).map((q, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-xs text-ink-muted truncate" title={q.topic}>
              {q.number ? `Q${q.number} ` : ""}{q.topic}
            </span>
            <div className="flex-1 h-5 rounded bg-surface-soft overflow-hidden">
              <div className="h-full rounded" style={{ width: `${q.pct}%`, backgroundColor: q.pct < 50 ? "#A8123C" : q.pct < 75 ? "#D9852A" : "#16876B" }} />
            </div>
            <span className="w-10 text-right text-xs font-semibold text-ink">{q.pct}%</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function StudentPanel({ classId, students }: { classId: string; students: Enrollment[] }) {
  const [clerkId, setClerkId] = useState("");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [predicted, setPredicted] = useState<Predicted | null>(null);

  useEffect(() => {
    if (!clerkId) {
      setProgress(null);
      setPredicted(null);
      return;
    }
    void (async () => {
      const [p, pr] = await Promise.all([getProgress(classId, clerkId), getPredicted(classId, clerkId)]);
      setProgress(p);
      setPredicted(pr);
    })();
  }, [classId, clerkId]);

  const pts = progress?.points ?? [];
  const spark = useMemo(() => {
    if (pts.length < 2) return "";
    const w = 280;
    const h = 60;
    return pts
      .map((p, i) => `${(i / (pts.length - 1)) * w},${h - (p.pct / 100) * h}`)
      .join(" ");
  }, [pts]);

  return (
    <section className="ed-card p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-display text-lg font-semibold">Individual progress</h2>
        <select value={clerkId} onChange={(e) => setClerkId(e.target.value)} className="ed-input px-3 py-2 text-sm w-auto">
          <option value="">Select a student…</option>
          {students.map((s) => (
            <option key={s.id} value={s.student_clerk_id}>{s.full_name || s.email || "Student"}</option>
          ))}
        </select>
      </div>

      {!clerkId ? (
        <p className="text-sm text-ink-faint">Pick a student to see their progress and predicted grade.</p>
      ) : (
        <div className="grid md:grid-cols-[1fr_240px] gap-5">
          <div>
            {pts.length === 0 ? (
              <p className="text-sm text-ink-faint">No attempts yet.</p>
            ) : (
              <>
                <svg viewBox="0 0 280 60" className="w-full h-16">
                  <polyline points={spark} fill="none" stroke="#A8123C" strokeWidth="2" />
                </svg>
                <div className="mt-2 space-y-1">
                  {pts.slice(-5).reverse().map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-ink-muted truncate">
                        {p.title} {p.is_full_paper ? <span className="ed-pill-mint text-[0.55rem]">Paper</span> : <span className="ed-pill-gold text-[0.55rem]">Topical</span>}
                      </span>
                      <span className="font-semibold text-ink">{p.pct}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="ed-card-soft p-4">
            <p className="ed-label">Predicted grade</p>
            {!predicted ? (
              <p className="text-sm text-ink-faint mt-1">…</p>
            ) : !predicted.enough_data ? (
              <>
                <p className="font-display text-xl font-semibold mt-1">Not enough data yet</p>
                <p className="text-xs text-ink-faint mt-1">
                  {predicted.completed ?? 0} assignments · {predicted.topics ?? 0} topics (need 4 across 3+ topics).
                </p>
              </>
            ) : predicted.grade === null ? (
              <>
                <p className="font-display text-2xl font-semibold mt-1">{predicted.rolling_pct}%</p>
                <p className="text-xs text-ink-faint mt-1">{predicted.reason}</p>
              </>
            ) : (
              <>
                <p className="font-display text-3xl font-semibold mt-1 text-crimson">{predicted.grade}</p>
                <p className="text-xs text-ink-muted mt-1">Rolling average {predicted.rolling_pct}%</p>
                {predicted.marks_to_next_pct != null && (
                  <p className="text-xs text-ink-faint mt-1">{predicted.marks_to_next_pct}% to the next grade</p>
                )}
                <p className="text-[0.65rem] text-ink-faint mt-2">Boundaries: {predicted.session_used}</p>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
