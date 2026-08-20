"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";
import { StudentProfileResponse, getStudent } from "@/lib/teacherClasses";
import { Predicted, Progress, getMastery, getPredicted, getProgress } from "@/lib/teacherInsights";
import { syllabusLabel } from "@/lib/syllabus";

// Individual student report (§13.2) — parent-facing: plain language, no
// confidence scores or AI references.
export default function StudentReportPage() {
  const params = useParams<{ classId: string; clerkId: string }>();
  const classId = (params?.classId ?? "") as string;
  const clerkId = (params?.clerkId ?? "") as string;

  const [profile, setProfile] = useState<StudentProfileResponse | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [predicted, setPredicted] = useState<Predicted | null>(null);
  const [mastery, setMastery] = useState<{ topic: string; mastery: number }[]>([]);

  useEffect(() => {
    void (async () => {
      const [pf, pg, pr, ms] = await Promise.all([
        getStudent(classId, clerkId),
        getProgress(classId, clerkId),
        getPredicted(classId, clerkId),
        getMastery(classId, clerkId),
      ]);
      setProfile(pf);
      setProgress(pg);
      setPredicted(pr);
      setMastery(ms.mastery);
    })();
  }, [classId, clerkId]);

  const name = profile?.profile.full_name || profile?.profile.username || "Student";

  return (
    <div className="px-4 md:px-8 py-8 print:p-0">
      <div className="max-w-3xl mx-auto space-y-6 print:max-w-none">
        <div className="flex items-center justify-between print:hidden">
          <h1 className="font-display text-xl font-semibold">Student report</h1>
          <button onClick={() => window.print()} className="ed-btn-primary px-4 py-2.5">
            <Printer size={15} /> Print / Save as PDF
          </button>
        </div>

        <div className="ed-card p-6 print:shadow-none print:border-0 space-y-6">
          <header className="border-b border-line pb-4">
            <h2 className="font-display text-2xl font-semibold">{name}</h2>
            <p className="text-ink-muted">
              {profile?.class.name}
              {profile ? ` · ${syllabusLabel(profile.class.syllabus_code)}` : ""}
            </p>
            <p className="text-xs text-ink-faint mt-1">Generated {new Date().toLocaleDateString()}</p>
          </header>

          <section className="grid grid-cols-2 gap-4">
            <div>
              <p className="ed-label">Predicted grade</p>
              {predicted?.enough_data && predicted.grade ? (
                <p className="font-display text-3xl font-semibold text-crimson">{predicted.grade}</p>
              ) : (
                <p className="font-display text-lg font-semibold">Not enough data yet</p>
              )}
              {predicted?.enough_data && predicted.marks_to_next_pct != null && (
                <p className="text-xs text-ink-muted mt-1">{predicted.marks_to_next_pct}% to the next grade</p>
              )}
            </div>
            <div>
              <p className="ed-label">Assignments completed</p>
              <p className="font-display text-3xl font-semibold">{progress?.points.length ?? 0}</p>
            </div>
          </section>

          <section>
            <h3 className="font-semibold mb-2">Topic strengths &amp; areas to work on</h3>
            {mastery.length === 0 ? (
              <p className="text-sm text-ink-faint">No marked work yet.</p>
            ) : (
              <div className="space-y-1.5">
                {mastery.map((t) => (
                  <div key={t.topic} className="flex items-center gap-3">
                    <span className="w-40 text-sm truncate">{t.topic}</span>
                    <div className="flex-1 h-4 rounded bg-surface-soft overflow-hidden">
                      <div
                        className={`h-full rounded ${t.mastery < 50 ? "bg-clay" : t.mastery < 75 ? "bg-gold" : "bg-mint"}`}
                        style={{ width: `${t.mastery}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs font-semibold">{t.mastery}%</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="font-semibold mb-2">Recent assignments</h3>
            {(progress?.points ?? []).length === 0 ? (
              <p className="text-sm text-ink-faint">No assignments completed yet.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {progress!.points.slice().reverse().map((p, i) => (
                    <tr key={i} className="border-b border-line/60">
                      <td className="py-1.5">{p.title}</td>
                      <td className="py-1.5 text-ink-faint">{new Date(p.date).toLocaleDateString()}</td>
                      <td className="py-1.5 text-right font-semibold">{p.pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
