"use client";

/**
 * Class performance report (spec §5.8) — print/PDF-ready, on the shared `.pr`
 * design. Weakest topics + a per-student average summary, derived from the class
 * heatmap. Print CSS hides the portal chrome for a clean one-pager.
 */
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Icon } from "@/components/propel/Icon";
import { TeacherClass, getClass } from "@/lib/teacherClasses";
import { Heatmap, getHeatmap } from "@/lib/teacherInsights";
import { syllabusLabel } from "@/lib/syllabus";

function accCol(v: number): string { return v >= 75 ? "var(--teal)" : v >= 55 ? "var(--amber)" : "var(--coral)"; }

export default function ClassReportPage() {
  const params = useParams<{ classId: string }>();
  const classId = params?.classId ?? "";
  const [klass, setKlass] = useState<TeacherClass | null>(null);
  const [heatmap, setHeatmap] = useState<Heatmap | null>(null);

  useEffect(() => {
    if (!classId) return;
    void (async () => {
      const [k, h] = await Promise.all([getClass(classId), getHeatmap(classId)]);
      setKlass(k); setHeatmap(h);
    })();
  }, [classId]);

  const studentAverages = useMemo(() => (heatmap?.rows ?? []).map((r) => {
    const vals = r.cells.filter((c): c is number => c !== null);
    return { student: r.student, avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null };
  }).sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1)), [heatmap]);

  const weakest = useMemo(() => (heatmap?.topics ?? [])
    .map((t, i) => ({ topic: t, avg: heatmap?.class_average[i] ?? null }))
    .filter((t): t is { topic: string; avg: number } => t.avg !== null && t.topic !== "General")
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 6), [heatmap]);

  const classAvg = studentAverages.length
    ? Math.round(studentAverages.filter((s) => s.avg != null).reduce((sum, s) => sum + (s.avg ?? 0), 0) / Math.max(1, studentAverages.filter((s) => s.avg != null).length))
    : null;

  return (
    <>
      <style>{`@media print {
        nav, .rp-noprint, .toast-wrap { display: none !important; }
        .rp-card { box-shadow: none !important; border: 1px solid #eee !important; }
      }`}</style>

      <div className="row-between rp-noprint" style={{ marginBottom: 18 }}>
        <h1 className="big-num" style={{ fontSize: 22 }}>Class report</h1>
        <button className="btn btn-primary" onClick={() => window.print()}><Icon name="download" size={16} /> Print / Save as PDF</button>
      </div>

      <div className="card card-pad rp-card" style={{ maxWidth: 760, margin: "0 auto" }}>
        <div className="row-between wrap gap-12" style={{ borderBottom: "1px solid var(--line)", paddingBottom: 16, marginBottom: 18 }}>
          <div>
            <h2 style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 24, fontWeight: 600 }}>{klass?.name || "Class"}</h2>
            <p className="muted" style={{ fontSize: 14, marginTop: 2 }}>{klass ? `${syllabusLabel(klass.syllabus_code)} · ${klass.level === "A" ? "A" : "O"} Level` : ""}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "var(--font-fraunces), serif", fontWeight: 600, fontSize: 16, color: "var(--crimson)" }}>Propel</div>
            <p className="faint" style={{ fontSize: 11.5 }}>Generated {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</p>
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
          <div style={{ background: "var(--surface-2)", borderRadius: 12, padding: "14px 16px" }}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Class average</div>
            <div className="big-num" style={{ fontSize: 30, color: classAvg != null ? accCol(classAvg) : "var(--ink)" }}>{classAvg != null ? `${classAvg}%` : "—"}</div>
          </div>
          <div style={{ background: "var(--surface-2)", borderRadius: 12, padding: "14px 16px" }}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Students</div>
            <div className="big-num" style={{ fontSize: 30 }}>{studentAverages.length}</div>
          </div>
        </div>

        <section style={{ marginBottom: 20 }}>
          <h3 style={{ fontWeight: 600, fontSize: 15, marginBottom: 10 }}>Weakest topics</h3>
          {weakest.length === 0 ? (
            <p className="faint" style={{ fontSize: 13.5 }}>No marked data yet.</p>
          ) : (
            <div className="grid" style={{ gap: 7 }}>
              {weakest.map((t) => (
                <div key={t.topic} className="row-between" style={{ fontSize: 13.5 }}>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.topic}</span>
                  <span style={{ fontWeight: 600, color: accCol(t.avg), flex: "none", marginLeft: 12 }}>{t.avg}%</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 style={{ fontWeight: 600, fontSize: 15, marginBottom: 10 }}>Student summary</h3>
          {studentAverages.length === 0 ? (
            <p className="faint" style={{ fontSize: 13.5 }}>No students yet.</p>
          ) : (
            <div className="grid" style={{ gap: 4 }}>
              {studentAverages.map((s) => (
                <div key={s.student} className="row-between" style={{ padding: "7px 0", borderBottom: "1px solid var(--line)", fontSize: 13.5 }}>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.student}</span>
                  <span style={{ fontWeight: 600, flex: "none", marginLeft: 12, color: s.avg != null ? accCol(s.avg) : "var(--ink-faint)" }}>{s.avg != null ? `${s.avg}%` : "—"}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
