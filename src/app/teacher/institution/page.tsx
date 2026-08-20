"use client";

import { useEffect, useState } from "react";
import { Reveal } from "@/components/ui/Motion";
import {
  Institution,
  ScopeGrant,
  TeacherRow,
  addScopeGrant,
  getActivityLog,
  getInstitution,
  getSchoolPerformance,
  getScopeGrants,
  getTeachers,
  removeScopeGrant,
  setTeacherActive,
} from "@/lib/portalAdmin";

type Tab = "overview" | "teachers" | "performance" | "oversight" | "activity";

export default function InstitutionPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [inst, setInst] = useState<Institution | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getInstitution()
      .then(setInst)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="px-4 md:px-8 py-8 max-w-4xl mx-auto"><div className="h-64 rounded-[1.25rem] bg-surface-soft animate-pulse" /></div>;

  if (error || !inst) {
    return (
      <div className="px-4 md:px-8 py-16 text-center">
        <p className="text-ink-muted">{error || "You don't have institution admin access."}</p>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "teachers", label: "Teachers" },
    { key: "performance", label: "Performance" },
    { key: "oversight", label: "Oversight" },
    { key: "activity", label: "Activity log" },
  ];

  return (
    <div className="px-4 md:px-8 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Reveal>
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">{inst.name}</h1>
            <p className="text-ink-muted mt-1 capitalize">{inst.status} institution</p>
          </div>
        </Reveal>

        <div className="flex gap-1 border-b border-line overflow-x-auto">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`relative px-4 py-2.5 text-sm font-semibold whitespace-nowrap ${tab === t.key ? "text-crimson" : "text-ink-muted"}`}>
              {t.label}
              {tab === t.key && <span className="absolute inset-x-3 -bottom-px h-0.5 bg-crimson rounded-full" />}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Stat label="Teachers" value={`${inst.seat_usage.teachers}${inst.seat_usage.seat_limit_teachers ? ` / ${inst.seat_usage.seat_limit_teachers}` : ""}`} />
            <Stat label="Students" value={`${inst.seat_usage.students}${inst.seat_usage.seat_limit_students ? ` / ${inst.seat_usage.seat_limit_students}` : ""}`} />
            <Stat label="Academic year" value={inst.academic_year_start ? `${inst.academic_year_start} → ${inst.academic_year_end ?? "?"}` : "Not set"} />
            <Stat label="OCR image retention" value={`${inst.retention_policy?.ocr_images_days ?? "—"} days`} />
          </div>
        )}
        {tab === "teachers" && <TeachersTab />}
        {tab === "performance" && <PerformanceTab />}
        {tab === "oversight" && <OversightTab />}
        {tab === "activity" && <ActivityTab />}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="ed-card p-4">
      <p className="ed-label">{label}</p>
      <p className="font-display text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}

function TeachersTab() {
  const [rows, setRows] = useState<TeacherRow[]>([]);
  useEffect(() => { void getTeachers().then(setRows).catch(() => {}); }, []);
  return (
    <div className="ed-card p-0 overflow-hidden">
      <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead><tr className="text-left text-ink-faint border-b border-line">
          <th className="px-4 py-3">Teacher</th><th className="px-4 py-3">Classes</th><th className="px-4 py-3">Assignments</th><th className="px-4 py-3"></th>
        </tr></thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.clerk_id} className="border-b border-line/60">
              <td className="px-4 py-3">
                <span className="text-ink">{t.full_name || t.email}</span>
                {t.deactivated && <span className="ed-pill-clay text-[0.6rem] ml-2">Deactivated</span>}
              </td>
              <td className="px-4 py-3 text-ink-muted">{t.classes}</td>
              <td className="px-4 py-3 text-ink-muted">{t.assignments}</td>
              <td className="px-4 py-3 text-right">
                <button onClick={async () => { await setTeacherActive(t.clerk_id, t.deactivated); setRows((prev) => prev.map((r) => r.clerk_id === t.clerk_id ? { ...r, deactivated: !r.deactivated } : r)); }} className="ed-btn-ghost px-2 py-1 text-xs">
                  {t.deactivated ? "Reactivate" : "Deactivate"}
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-ink-faint">No teachers yet.</td></tr>}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function PerformanceTab() {
  const [rows, setRows] = useState<{ id: string; name: string; subject: string; level: string; students: number; avg: number | null }[]>([]);
  useEffect(() => { void getSchoolPerformance().then(setRows).catch(() => {}); }, []);
  return (
    <div className="ed-card p-6">
      <p className="text-xs text-ink-faint mb-3">Aggregate only — admins never see individual scripts.</p>
      <div className="space-y-2">
        {rows.map((c) => (
          <div key={c.id} className="ed-card-soft p-3 flex items-center justify-between">
            <div><p className="font-semibold text-ink">{c.name}</p><p className="text-xs text-ink-faint">{c.subject} · {c.level} Level · {c.students} students</p></div>
            <span className="text-sm font-semibold">{c.avg != null ? `${c.avg}%` : "—"}</span>
          </div>
        ))}
        {rows.length === 0 && <p className="text-ink-faint text-sm">No classes yet.</p>}
      </div>
    </div>
  );
}

function OversightTab() {
  const [grants, setGrants] = useState<ScopeGrant[]>([]);
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");
  const [subjects, setSubjects] = useState("");
  const [levels, setLevels] = useState<string[]>([]);
  const [caps, setCaps] = useState<string[]>(["view"]);
  const [error, setError] = useState("");

  useEffect(() => { void getScopeGrants().then(setGrants).catch(() => {}); }, []);

  const add = async () => {
    if (!email.trim()) return;
    try {
      const g = await addScopeGrant({
        email: email.trim(),
        label: label.trim(),
        filter_subjects: subjects.split(",").map((s) => s.trim()).filter(Boolean),
        filter_levels: levels,
        capabilities: caps,
      });
      setGrants((prev) => [...prev, g]);
      setEmail(""); setLabel(""); setSubjects("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };
  const toggle = (arr: string[], v: string, set: (a: string[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div className="space-y-4">
      <div className="ed-card p-5 space-y-3">
        <p className="ed-label">Grant oversight</p>
        <div className="grid sm:grid-cols-2 gap-2">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@school.edu" className="ed-input px-3 py-2 text-sm" />
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (e.g. Head of Chemistry)" className="ed-input px-3 py-2 text-sm" />
        </div>
        <input value={subjects} onChange={(e) => setSubjects(e.target.value)} placeholder="Subjects (comma-separated, blank = all)" className="ed-input px-3 py-2 text-sm" />
        <div className="flex flex-wrap gap-3 items-center text-sm">
          <span className="text-ink-muted">Levels:</span>
          {["O", "A"].map((l) => <label key={l} className="flex items-center gap-1"><input type="checkbox" checked={levels.includes(l)} onChange={() => toggle(levels, l, setLevels)} className="accent-crimson" /> {l}</label>)}
          <span className="text-ink-muted ml-3">Can:</span>
          {["view", "moderate", "assign"].map((c) => <label key={c} className="flex items-center gap-1"><input type="checkbox" checked={caps.includes(c)} onChange={() => toggle(caps, c, setCaps)} className="accent-crimson" /> {c}</label>)}
        </div>
        {error && <p className="text-sm text-crimson">{error}</p>}
        <button onClick={() => void add()} className="ed-btn-primary px-4 py-2 text-sm">Grant</button>
      </div>

      <div className="space-y-2">
        {grants.map((g) => (
          <div key={g.id} className="ed-card-soft p-3 flex items-center justify-between">
            <div>
              <p className="font-semibold text-ink">{g.label || "Oversight grant"}</p>
              <p className="text-xs text-ink-faint">{g.filter_subjects.length ? g.filter_subjects.join(", ") : "all subjects"} · {g.filter_levels.length ? g.filter_levels.join("/") + " Level" : "all levels"} · {g.capabilities.join(", ")}</p>
            </div>
            <button onClick={async () => { await removeScopeGrant(g.id); setGrants((prev) => prev.filter((x) => x.id !== g.id)); }} className="ed-btn-ghost px-2 py-1 text-xs text-crimson">Revoke</button>
          </div>
        ))}
        {grants.length === 0 && <p className="text-ink-faint text-sm">No oversight grants.</p>}
      </div>
    </div>
  );
}

function ActivityTab() {
  const [rows, setRows] = useState<{ id: string; event_type: string; actor_clerk_id: string; created_at: string }[]>([]);
  useEffect(() => { void getActivityLog().then(setRows).catch(() => {}); }, []);
  return (
    <div className="ed-card p-6">
      <p className="text-xs text-ink-faint mb-3">Immutable audit — overrides, releases, grant changes, deletions.</p>
      <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 text-xs border-b border-line/50 py-1.5">
            <span className="ed-pill-mint text-[0.6rem]">{r.event_type.replace(/_/g, " ")}</span>
            <span className="text-ink-faint flex-1">{new Date(r.created_at).toLocaleString()}</span>
          </div>
        ))}
        {rows.length === 0 && <p className="text-ink-faint text-sm">No activity logged yet.</p>}
      </div>
    </div>
  );
}
