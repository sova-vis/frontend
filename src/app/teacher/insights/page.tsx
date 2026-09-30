"use client";

/**
 * Class-wide insights (spec §5.7) — rebuilt on the shared `.pr` design.
 * For a chosen class: the weakness heatmap (topics x students, doubling as the
 * topic->student pivot — read a column to see who's weak in that topic), the
 * class's weakest topics headline, and question difficulty (worst-first). Plus a
 * CSV export (§4.3). Per-student depth lives on the student profile page (§5.6).
 * Reuses the stable /teacher-insights endpoints untouched.
 */
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/propel/Icon";
import { Bar, accTone, EmptyState, useToast } from "@/components/propel/primitives";
import { Difficulty, Heatmap, downloadCsv, getDifficulty, getHeatmap } from "@/lib/teacherInsights";
import { TeacherClass, listClasses } from "@/lib/teacherClasses";

function cellStyle(v: number | null): React.CSSProperties {
  if (v == null) return { background: "var(--surface-2)", color: "var(--ink-faint)" };
  if (v >= 75) return { background: "var(--teal-soft)", color: "var(--teal-deep)" };
  if (v >= 55) return { background: "var(--amber-soft)", color: "var(--amber-deep)" };
  return { background: "var(--coral-soft)", color: "var(--coral)" };
}

export default function InsightsPage() {
  const toast = useToast();
  const [classes, setClasses] = useState<TeacherClass[] | null>(null);
  const [classId, setClassId] = useState("");
  const [heatmap, setHeatmap] = useState<Heatmap | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const cs = (await listClasses()).filter((c) => !c.archived && (c.can_grade ?? c.is_owner ?? true));
        setClasses(cs);
        if (cs.length) setClassId(cs[0].id);
      } catch { setClasses([]); }
    })();
  }, []);

  useEffect(() => {
    if (!classId) { setHeatmap(null); setDifficulty(null); return; }
    setLoading(true);
    Promise.allSettled([getHeatmap(classId), getDifficulty(classId)]).then(([h, d]) => {
      setHeatmap(h.status === "fulfilled" ? h.value : { topics: [], rows: [], class_average: [] });
      setDifficulty(d.status === "fulfilled" ? d.value : { questions: [] });
      setLoading(false);
    });
  }, [classId]);

  const weakest = useMemo(() => {
    if (!heatmap) return [];
    return heatmap.topics
      .map((t, i) => ({ topic: t, avg: heatmap.class_average[i] }))
      .filter((x): x is { topic: string; avg: number } => x.avg != null && x.topic !== "General")
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 4);
  }, [heatmap]);

  const exportCsv = async () => {
    if (!classId) return;
    setExporting(true);
    try { await downloadCsv(classId); toast("Export ready", "download"); }
    catch { toast("Export failed", "alert"); }
    finally { setExporting(false); }
  };

  const hasHeat = heatmap && heatmap.rows.length > 0 && heatmap.topics.length > 0;

  return (
    <>
      <div className="row-between wrap gap-16" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="big-num" style={{ fontSize: 28 }}>Insights</h1>
          <p className="faint" style={{ fontSize: 13.5, marginTop: 4 }}>Where a class is strong, where it needs work.</p>
        </div>
        <div className="flex gap-8 wrap">
          {classes && classes.length > 0 && (
            <select className="input" style={{ width: "auto", minWidth: 180 }} value={classId} onChange={(e) => setClassId(e.target.value)}>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <button className="btn btn-secondary" disabled={!classId || exporting} onClick={() => void exportCsv()}><Icon name="download" size={16} /> Export CSV</button>
        </div>
      </div>

      {classes === null ? (
        <div className="grid" style={{ gap: 12 }}>{[0, 1].map((i) => <div key={i} className="sk" style={{ height: 160, borderRadius: 18 }} />)}</div>
      ) : classes.length === 0 ? (
        <EmptyState icon="users" title="No classes yet" body="Create a class and set assignments — once work is marked, its analytics land here." />
      ) : loading ? (
        <div className="grid" style={{ gap: 16 }}><div className="sk" style={{ height: 90, borderRadius: 18 }} /><div className="sk" style={{ height: 240, borderRadius: 18 }} /></div>
      ) : !hasHeat ? (
        <EmptyState icon="chart" title="No marked work yet" body="Once this class has submitted and marked assignments, the weakness heatmap and question analytics appear here." />
      ) : (
        <div className="grid" style={{ gap: 16 }}>
          {/* Weakest topics headline */}
          {weakest.length > 0 && (
            <div className="card card-pad">
              <p className="eyebrow" style={{ marginBottom: 10 }}>Class needs work on</p>
              <div className="flex wrap gap-8">
                {weakest.map((w) => (
                  <span key={w.topic} className="flex items-center gap-8" style={{ padding: "8px 12px", borderRadius: 12, ...cellStyle(w.avg) }}>
                    <b style={{ fontSize: 13.5 }}>{w.topic}</b>
                    <span className="mono" style={{ fontSize: 12.5 }}>{w.avg}%</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Heatmap */}
          <div className="card card-pad">
            <div className="row-between wrap gap-8" style={{ marginBottom: 12 }}>
              <h2 style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 18, fontWeight: 600 }}>Weakness heatmap</h2>
              <span className="faint" style={{ fontSize: 12 }}>Read a column to see who is weak in a topic</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "separate", borderSpacing: 4, minWidth: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ position: "sticky", left: 0, background: "var(--canvas)", zIndex: 1, textAlign: "left", padding: "4px 8px", minWidth: 120 }}><span className="eyebrow">Student</span></th>
                    {heatmap!.topics.map((t) => (
                      <th key={t} title={t} style={{ padding: "4px 6px", minWidth: 62, maxWidth: 84 }}>
                        <span className="faint" style={{ fontSize: 10.5, fontWeight: 600, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 80 }}>{t}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmap!.rows.map((r, ri) => (
                    <tr key={ri}>
                      <td style={{ position: "sticky", left: 0, background: "var(--canvas)", zIndex: 1, padding: "4px 8px", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>{r.student}</td>
                      {r.cells.map((c, ci) => (
                        <td key={ci} style={{ padding: 0 }}>
                          <div className="mono" style={{ height: 34, borderRadius: 8, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 600, ...cellStyle(c) }}>{c == null ? "·" : c}</div>
                        </td>
                      ))}
                    </tr>
                  ))}
                  {/* Class average */}
                  <tr>
                    <td style={{ position: "sticky", left: 0, background: "var(--canvas)", zIndex: 1, padding: "8px 8px 4px", fontSize: 12 }}><span className="eyebrow">Class avg</span></td>
                    {heatmap!.class_average.map((c, ci) => (
                      <td key={ci} style={{ padding: "6px 0 0" }}>
                        <div style={{ height: 30, borderRadius: 8, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, border: "1px solid var(--line)", color: c == null ? "var(--ink-faint)" : "var(--ink)" }}>{c == null ? "·" : c}</div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Question difficulty */}
          {difficulty && difficulty.questions.length > 0 && (
            <div className="card card-pad">
              <h2 style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Hardest questions</h2>
              <p className="faint" style={{ fontSize: 12.5, marginBottom: 14 }}>Lowest class score first — good candidates to reteach.</p>
              <div className="grid" style={{ gap: 10 }}>
                {difficulty.questions.slice(0, 20).map((q, i) => (
                  <div key={i} className="flex items-center gap-12">
                    <span style={{ flex: "0 0 42%", minWidth: 0, fontSize: 13 }}>
                      <span className="mono faint" style={{ fontSize: 11.5 }}>Q{q.number || "?"}</span>{" "}
                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.topic}</span>
                    </span>
                    <div style={{ flex: 1 }}><Bar value={q.pct} tone={accTone(q.pct)} /></div>
                    <span className="mono" style={{ fontSize: 12.5, fontWeight: 600, flex: "none", width: 40, textAlign: "right" }}>{q.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
