"use client";

import { useEffect, useState } from "react";
import { CalendarDays, CalendarPlus, Clock } from "lucide-react";
import { apiCall } from "@/lib/api";

interface Paper {
  subject: string;
  component: string;
  syllabus_code: string | null;
  date: string | null;
  date_start: string | null;
  date_end: string | null;
  session_slot: string | null;
  duration: string | null;
  status: "confirmed" | "predicted";
  days_remaining?: number | null;
}

interface Datesheet {
  status: "confirmed" | "predicted" | "unavailable" | "no_subjects";
  session: string | null;
  next_exam: Paper | null;
  papers: Paper[];
}

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}
function daysTo(d: string | null | undefined): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

// Exam datesheet card (spec §3.3). Confirmed rows are maroon; predicted rows are
// amber and explicitly labelled — never a confident single date.
export default function DatesheetCard() {
  const [data, setData] = useState<Datesheet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiCall("/datesheet");
        if (res.ok) setData(await res.json());
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  const downloadIcs = () => {
    if (!data?.papers?.length) return;
    const pad = (n: number) => String(n).padStart(2, "0");
    const toIcs = (d: string) => { const dt = new Date(d); return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}`; };
    const events = data.papers
      .filter((p) => p.date)
      .map((p) => `BEGIN:VEVENT\nUID:${p.syllabus_code}-${p.component}@propel\nDTSTART;VALUE=DATE:${toIcs(p.date!)}\nSUMMARY:${p.subject} ${p.component}${p.session_slot ? ` (${p.session_slot})` : ""}\nDESCRIPTION:${p.duration || ""} · ${p.status}\nEND:VEVENT`)
      .join("\n");
    const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Propel//Datesheet//EN\n${events}\nEND:VCALENDAR`;
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url; a.download = "propel-exam-dates.ics"; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="ed-card p-5 animate-pulse h-40" />;
  if (!data) return null;

  if (data.status === "no_subjects" || data.status === "unavailable") {
    return (
      <div className="ed-card p-5">
        <div className="flex items-center gap-2 mb-1"><CalendarDays size={18} className="text-crimson" /><h3 className="font-display text-lg font-semibold">Exam datesheet</h3></div>
        <p className="text-sm text-ink-muted mt-1">
          {data.status === "no_subjects"
            ? "Pick your subjects to see your exam dates here."
            : "We'll pin your datesheet here as soon as the timetable for your session is out."}
        </p>
      </div>
    );
  }

  const next = data.next_exam;
  const isPredicted = data.status === "predicted";
  const nextDays = next ? (next.days_remaining ?? daysTo(next.date || next.date_start)) : null;

  return (
    <div className="ed-card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className="text-crimson" />
          <h3 className="font-display text-lg font-semibold">Exam datesheet</h3>
          <span className={`text-[0.6rem] ${isPredicted ? "ed-pill-gold" : "ed-pill-mint"}`}>{isPredicted ? "Predicted" : "Confirmed"}</span>
        </div>
        <button onClick={downloadIcs} className="ed-btn-ghost px-3 py-1.5 text-xs"><CalendarPlus size={13} /> Add to calendar</button>
      </div>

      {isPredicted && (
        <p className="text-xs text-gold-ink bg-gold-soft rounded-lg px-3 py-2 mb-3">
          Official timetable not yet published. These are estimates based on previous sessions — confirm with your school.
        </p>
      )}

      {/* Next exam — primary countdown */}
      {next && (
        <div className="ed-card-soft p-4 mb-3">
          <p className="ed-label">Next exam · {data.session}</p>
          <div className="flex items-end justify-between gap-3 mt-1">
            <div>
              <p className="font-display text-xl font-semibold">{next.subject} <span className="text-ink-faint text-base font-normal">{next.component}</span></p>
              <p className="text-sm text-ink-muted mt-0.5 inline-flex items-center gap-1.5">
                {fmt(next.date || next.date_start)}{next.session_slot ? ` · ${next.session_slot}` : ""}{next.duration ? ` · ${next.duration}` : ""}
              </p>
            </div>
            {nextDays != null && (
              <div className="text-right">
                <p className="font-display text-3xl font-bold text-crimson leading-none">{Math.max(0, nextDays)}</p>
                <p className="text-xs text-ink-faint">days away</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full list */}
      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
        {data.papers.map((p, i) => {
          const dr = p.days_remaining ?? daysTo(p.date || p.date_start);
          return (
            <div key={i} className={`flex items-center gap-3 text-sm rounded-lg px-2.5 py-1.5 ${p.status === "predicted" ? "bg-gold-soft/50" : ""}`}>
              <span className="w-16 shrink-0 text-xs text-ink-faint">{fmt(p.date || p.date_start)}</span>
              <span className="flex-1 truncate text-ink">{p.subject} <span className="text-ink-faint">{p.component}</span></span>
              {p.session_slot && <span className="text-[0.6rem] text-ink-faint">{p.session_slot === "Morning" ? "AM" : "PM"}</span>}
              {dr != null && dr >= 0 && <span className="text-xs text-ink-muted shrink-0">{dr}d</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
