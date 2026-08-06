"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";
import { TeacherClass, getClass } from "@/lib/teacherClasses";
import { Heatmap, getHeatmap } from "@/lib/teacherInsights";
import { syllabusLabel } from "@/lib/syllabus";

// Class performance report (§13.1) — print-friendly (Save as PDF).
export default function ClassReportPage() {
  const params = useParams<{ classId: string }>();
  const classId = (params?.classId ?? "") as string;
  const [klass, setKlass] = useState<TeacherClass | null>(null);
  const [heatmap, setHeatmap] = useState<Heatmap | null>(null);

  useEffect(() => {
    void (async () => {
      const [k, h] = await Promise.all([getClass(classId), getHeatmap(classId)]);
      setKlass(k);
      setHeatmap(h);
    })();
  }, [classId]);

  const studentAverages = (heatmap?.rows ?? []).map((r) => {
    const vals = r.cells.filter((c): c is number => c !== null);
    return { student: r.student, avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null };
  });
  const weakest = (heatmap?.topics ?? [])
    .map((t, i) => ({ topic: t, avg: heatmap?.class_average[i] ?? null }))
    .filter((t) => t.avg !== null)
    .sort((a, b) => (a.avg as number) - (b.avg as number))
    .slice(0, 5);

  return (
    <div className="px-4 md:px-8 py-8 print:p-0">
      <div className="max-w-3xl mx-auto space-y-6 print:max-w-none">
        <div className="flex items-center justify-between print:hidden">
          <h1 className="font-display text-xl font-semibold">Class report</h1>
          <button onClick={() => window.print()} className="ed-btn-primary px-4 py-2.5">
            <Printer size={15} /> Print / Save as PDF
          </button>
        </div>

        <div className="ed-card p-6 print:shadow-none print:border-0 space-y-6">
          <header className="border-b border-line pb-4">
            <h2 className="font-display text-2xl font-semibold">{klass?.name || "Class"}</h2>
            <p className="text-ink-muted">{klass ? `${syllabusLabel(klass.syllabus_code)} · ${klass.level} Level` : ""}</p>
            <p className="text-xs text-ink-faint mt-1">Generated {new Date().toLocaleDateString()}</p>
          </header>

          <section>
            <h3 className="font-semibold mb-2">Weakest topics</h3>
            {weakest.length === 0 ? (
              <p className="text-sm text-ink-faint">No marked data yet.</p>
            ) : (
              <ul className="text-sm space-y-1">
                {weakest.map((t) => (
                  <li key={t.topic} className="flex justify-between">
                    <span>{t.topic}</span>
                    <span className="font-semibold">{t.avg}%</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="font-semibold mb-2">Student summary</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-faint border-b border-line">
                  <th className="py-1.5">Student</th>
                  <th className="py-1.5 text-right">Average</th>
                </tr>
              </thead>
              <tbody>
                {studentAverages.map((s) => (
                  <tr key={s.student} className="border-b border-line/60">
                    <td className="py-1.5">{s.student}</td>
                    <td className="py-1.5 text-right font-semibold">{s.avg != null ? `${s.avg}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </div>
  );
}
