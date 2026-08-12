"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarPlus, Newspaper, Pencil, RotateCcw, X } from "lucide-react";
import { apiCall } from "@/lib/api";

interface Paper {
  subject: string;
  component: string;
  syllabus_code: string | null;
  date: string | null;
  date_start: string | null;
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

const OVERRIDES_KEY = "propel_datesheet_overrides";

function paperKey(p: Paper): string {
  return `${p.syllabus_code || p.subject}|${p.component}`;
}
function toInputDate(d: string | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
}
function fmt(d: string | null | undefined, long = false) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, long ? { weekday: "long", day: "numeric", month: "long" } : { day: "numeric", month: "short" });
}
function daysTo(d: string | null | undefined): number | null {
  if (!d) return null;
  return Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 86400000));
}

// Newspaper-styled exam datesheet: a compact "front page" that opens the full
// timetable in a modal. `scope="personal"` uses the student's own subjects;
// `scope="classroom"` uses the subjects of the classes they've joined.
// Students can correct any wrong date themselves — overrides are saved locally.
export default function NewspaperDatesheet({ scope = "personal" }: { scope?: "personal" | "classroom" }) {
  const [data, setData] = useState<Datesheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(OVERRIDES_KEY);
      if (raw) setOverrides(JSON.parse(raw) || {});
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await apiCall(`/datesheet?scope=${scope}`);
        if (res.ok && active) setData(await res.json());
      } catch { /* ignore */ } finally { if (active) setLoading(false); }
    };
    void load();
    const onChange = () => { if (scope === "personal") void load(); };
    window.addEventListener("propel:selected-subjects-change", onChange);
    return () => { active = false; window.removeEventListener("propel:selected-subjects-change", onChange); };
  }, [scope]);

  const setOverride = (key: string, iso: string) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (iso) next[key] = iso; else delete next[key];
      try { window.localStorage.setItem(OVERRIDES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // Apply the student's date corrections, then re-sort and recompute the next exam.
  const view = useMemo(() => {
    if (!data) return null;
    const papers = data.papers
      .map((p): Paper & { edited: boolean } => {
        const ov = overrides[paperKey(p)];
        return ov ? { ...p, date: ov, date_start: ov, edited: true } : { ...p, edited: false };
      })
      .sort((a, b) => String(a.date || a.date_start || "").localeCompare(String(b.date || b.date_start || "")));
    const today = new Date(new Date().toDateString());
    const upcoming = papers.filter((p) => { const d = p.date || p.date_start; return d ? new Date(String(d)) >= today : false; });
    return { papers, next: upcoming[0] || papers[0] || null };
  }, [data, overrides]);

  if (loading) return <div className="ed-card p-4 h-56 animate-pulse" />;
  if (!data || !view) return null;

  const empty = data.status === "no_subjects" || data.status === "unavailable" || !view.next;
  const next = view.next;
  const nextDays = next ? daysTo(next.date || next.date_start) : null;

  return (
    <>
      <button
        onClick={() => !empty && setOpen(true)}
        className="w-full text-left rounded-[0.75rem] border-2 border-ink bg-paper p-4 font-serif hover:shadow-md transition-shadow"
        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
      >
        {/* Masthead */}
        <div className="border-b-2 border-ink pb-1.5 mb-2 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <Newspaper size={13} />
            <span className="text-[0.7rem] font-black uppercase tracking-[0.2em]">The Exam Times</span>
          </div>
          <div className="text-[0.55rem] uppercase tracking-widest text-ink-muted mt-0.5">
            {data.session || "Your session"} · {data.status === "predicted" ? "Predicted" : "Official"}
          </div>
        </div>

        {empty ? (
          <p className="text-xs text-ink-muted text-center py-4">
            {data.status === "no_subjects" ? "Add your subjects to see your exam dates." : "Datesheet will appear when the timetable is out."}
          </p>
        ) : (
          <>
            {/* Headline */}
            <div className="text-center border-b border-line pb-2 mb-2">
              <p className="text-[0.55rem] uppercase tracking-widest text-crimson font-bold">Next exam</p>
              <p className="font-black text-lg leading-tight mt-0.5">{next!.subject}</p>
              <p className="text-xs text-ink-muted">{next!.component} · {fmt(next!.date || next!.date_start, true)}</p>
              <p className="text-2xl font-black text-crimson mt-1">{nextDays} <span className="text-xs font-normal text-ink-faint">days away</span></p>
            </div>
            {/* Column of upcoming */}
            <div className="space-y-1">
              {view.papers.slice(0, 4).map((p, i) => (
                <div key={i} className="flex items-baseline justify-between text-xs border-b border-dotted border-line pb-0.5">
                  <span className="truncate">{p.subject} <span className="text-ink-faint">{p.component}</span></span>
                  <span className="text-ink-muted shrink-0 ml-2">{fmt(p.date || p.date_start)}</span>
                </div>
              ))}
            </div>
            <p className="text-[0.6rem] text-center text-crimson font-bold mt-2 uppercase tracking-wide">Read full datesheet →</p>
          </>
        )}
      </button>

      {open && next && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-ink/60 backdrop-blur-md p-4" onClick={() => { setOpen(false); setEditing(false); }}>
          <div className="max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 rounded-[0.75rem] border-2 border-ink bg-paper shadow-2xl" style={{ fontFamily: "Georgia, serif" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b-2 border-ink pb-2 mb-3">
              <div>
                <p className="text-lg font-black uppercase tracking-[0.15em]">The Exam Times</p>
                <p className="text-[0.6rem] uppercase tracking-widest text-ink-muted">{data.session} · {data.status === "predicted" ? "Predicted — confirm with your school" : "Official timetable"}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setEditing((e) => !e)}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-sans font-semibold ${editing ? "bg-crimson text-paper" : "border border-ink text-ink"}`}
                >
                  <Pencil size={12} /> {editing ? "Done" : "Edit dates"}
                </button>
                <button onClick={() => { setOpen(false); setEditing(false); }} className="ed-btn-ghost p-1.5"><X size={15} /></button>
              </div>
            </div>

            {editing ? (
              <p className="text-xs bg-crimson-soft text-crimson-ink rounded px-2 py-1.5 mb-3 font-sans">Correct any wrong date — your changes are saved just for you on this device.</p>
            ) : data.status === "predicted" && (
              <p className="text-xs bg-gold-soft text-gold-ink rounded px-2 py-1.5 mb-3">Estimated from previous sessions — always confirm with your school.</p>
            )}

            <table className="w-full text-sm">
              <tbody>
                {view.papers.map((p, i) => {
                  const dr = p.days_remaining ?? daysTo(p.date || p.date_start);
                  const key = paperKey(p);
                  return (
                    <tr key={i} className="border-b border-dotted border-line">
                      <td className="py-1.5 pr-2">
                        {p.subject} <span className="text-ink-faint text-xs">{p.component}</span>
                        {p.edited && <span className="ml-1.5 text-[0.6rem] font-sans text-crimson">· edited</span>}
                      </td>
                      {editing ? (
                        <td className="py-1.5 text-right" colSpan={2}>
                          <div className="inline-flex items-center gap-1.5 font-sans">
                            <input
                              type="date"
                              value={toInputDate(p.date || p.date_start)}
                              onChange={(e) => setOverride(key, e.target.value)}
                              className="ed-input px-2 py-1 text-xs"
                            />
                            {p.edited && (
                              <button onClick={() => setOverride(key, "")} title="Reset to official date" className="text-ink-faint hover:text-crimson">
                                <RotateCcw size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      ) : (
                        <>
                          <td className="py-1.5 text-ink-muted whitespace-nowrap">{fmt(p.date || p.date_start, true)}</td>
                          <td className="py-1.5 text-right text-xs text-ink-faint whitespace-nowrap">{p.session_slot === "Morning" ? "AM" : p.session_slot === "Afternoon" ? "PM" : ""}{dr != null ? ` · ${dr}d` : ""}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <button
              onClick={() => {
                const pad = (n: number) => String(n).padStart(2, "0");
                const toIcs = (d: string) => { const dt = new Date(d); return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}`; };
                const events = view.papers.filter((p) => p.date || p.date_start).map((p) => `BEGIN:VEVENT\nUID:${p.syllabus_code}-${p.component}@propel\nDTSTART;VALUE=DATE:${toIcs((p.date || p.date_start)!)}\nSUMMARY:${p.subject} ${p.component}\nEND:VEVENT`).join("\n");
                const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Propel//EN\n${events}\nEND:VCALENDAR`;
                const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
                const a = document.createElement("a"); a.href = url; a.download = "propel-exam-dates.ics"; a.click(); URL.revokeObjectURL(url);
              }}
              className="ed-btn-ghost px-3 py-2 text-sm mt-4 font-sans"
            >
              <CalendarPlus size={14} /> Add to calendar
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
