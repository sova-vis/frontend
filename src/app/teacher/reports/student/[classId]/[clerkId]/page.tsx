"use client";

/**
 * Individual student report (spec §5.8) — parent-facing, print/PDF-ready, on the
 * shared `.pr` design. Plain language: no confidence scores or AI references.
 * Reuses the stable /teacher-insights data (getMastery/getProgress/getPredicted).
 * Print CSS hides the portal chrome so "Save as PDF" yields a clean one-pager.
 */
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Icon } from "@/components/propel/Icon";
import { Bar, accTone } from "@/components/propel/primitives";
import { StudentProfileResponse, getStudent } from "@/lib/teacherClasses";
import { Predicted, Progress, getMastery, getPredicted, getProgress } from "@/lib/teacherInsights";
import { syllabusLabel } from "@/lib/syllabus";

function band(v: number): string { return v >= 75 ? "Strong" : v >= 55 ? "Developing" : "Needs work"; }
function accCol(v: number): string { return v >= 75 ? "var(--teal)" : v >= 55 ? "var(--amber)" : "var(--coral)"; }

export default function StudentReportPage() {
  const params = useParams<{ classId: string; clerkId: string }>();
  const classId = params?.classId ?? "";
  const clerkId = params?.clerkId ?? "";

  const [profile, setProfile] = useState<StudentProfileResponse | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [predicted, setPredicted] = useState<Predicted | null>(null);
  const [mastery, setMastery] = useState<{ topic: string; mastery: number }[]>([]);

  useEffect(() => {
    if (!classId || !clerkId) return;
    void (async () => {
      const [pf, pg, pr, ms] = await Promise.all([
        getStudent(classId, clerkId),
        getProgress(classId, clerkId),
        getPredicted(classId, clerkId),
        getMastery(classId, clerkId),
      ]);
      setProfile(pf); setProgress(pg); setPredicted(pr); setMastery(ms.mastery);
    })();
  }, [classId, clerkId]);

  const name = profile?.profile.full_name || profile?.profile.username || "Student";
  const completed = progress?.points.length ?? 0;
  const avg = progress && progress.points.length ? Math.round(progress.points.reduce((s, p) => s + p.pct, 0) / progress.points.length) : null;
  const sorted = [...mastery].sort((a, b) => b.mastery - a.mastery);

  return (
    <>
      <style>{`@media print {
        nav, .rp-noprint, .toast-wrap { display: none !important; }
        .rp-card { box-shadow: none !important; border: 1px solid #eee !important; }
      }`}</style>

      <div className="row-between rp-noprint" style={{ marginBottom: 18 }}>
        <h1 className="big-num" style={{ fontSize: 22 }}>Student report</h1>
        <button className="btn btn-primary" onClick={() => window.print()}><Icon name="download" size={16} /> Print / Save as PDF</button>
      </div>

      <div className="card card-pad rp-card" style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* Header */}
        <div className="row-between wrap gap-12" style={{ borderBottom: "1px solid var(--line)", paddingBottom: 16, marginBottom: 18 }}>
          <div>
            <h2 style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 24, fontWeight: 600 }}>{name}</h2>
            <p className="muted" style={{ fontSize: 14, marginTop: 2 }}>{profile?.class.name}{profile ? ` · ${syllabusLabel(profile.class.syllabus_code)}` : ""}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "var(--font-fraunces), serif", fontWeight: 600, fontSize: 16, color: "var(--crimson)" }}>Propel</div>
            <p className="faint" style={{ fontSize: 11.5 }}>Generated {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</p>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
          <div style={{ background: "var(--surface-2)", borderRadius: 12, padding: "14px 16px" }}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Predicted grade</div>
            <div className="big-num" style={{ fontSize: 30, color: "var(--crimson)" }}>{predicted?.enough_data && predicted.grade ? predicted.grade : "—"}</div>
            {predicted?.enough_data && predicted.marks_to_next_pct != null && <p className="faint" style={{ fontSize: 11.5, marginTop: 2 }}>{predicted.marks_to_next_pct}% to the next grade</p>}
          </div>
          <div style={{ background: "var(--surface-2)", borderRadius: 12, padding: "14px 16px" }}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Average score</div>
            <div className="big-num" style={{ fontSize: 30, color: avg != null ? accCol(avg) : "var(--ink)" }}>{avg != null ? `${avg}%` : "—"}</div>
          </div>
          <div style={{ background: "var(--surface-2)", borderRadius: 12, padding: "14px 16px" }}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Assignments completed</div>
            <div className="big-num" style={{ fontSize: 30 }}>{completed}</div>
          </div>
        </div>

        {/* Topic strengths */}
        <section style={{ marginBottom: 20 }}>
          <h3 style={{ fontWeight: 600, fontSize: 15, marginBottom: 10 }}>Topic strengths &amp; areas to work on</h3>
          {sorted.length === 0 ? (
            <p className="faint" style={{ fontSize: 13.5 }}>No marked work yet.</p>
          ) : (
            <div className="grid" style={{ gap: 9 }}>
              {sorted.map((t) => (
                <div key={t.topic} className="flex items-center gap-12">
                  <span style={{ flex: "0 0 38%", minWidth: 0, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.topic}</span>
                  <div style={{ flex: 1 }}><Bar value={t.mastery} tone={accTone(t.mastery)} /></div>
                  <span style={{ flex: "none", width: 92, textAlign: "right", fontSize: 12, fontWeight: 600, color: accCol(t.mastery) }}>{band(t.mastery)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent assignments */}
        <section>
          <h3 style={{ fontWeight: 600, fontSize: 15, marginBottom: 10 }}>Recent assignments</h3>
          {completed === 0 ? (
            <p className="faint" style={{ fontSize: 13.5 }}>No assignments completed yet.</p>
          ) : (
            <div className="grid" style={{ gap: 6 }}>
              {progress!.points.slice().reverse().map((p, i) => (
                <div key={i} className="row-between" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)", fontSize: 13.5 }}>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{p.title}</span>
                  <span className="faint" style={{ flex: "none", margin: "0 12px" }}>{new Date(p.date).toLocaleDateString()}</span>
                  <span style={{ flex: "none", fontWeight: 600, color: accCol(p.pct) }}>{p.pct}%</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
