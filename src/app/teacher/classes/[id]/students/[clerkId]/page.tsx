"use client";

/**
 * Student profile inside a class (spec §5.6) — rebuilt on the shared `.pr`
 * design with REAL analytics (previously a stub). Shows predicted grade,
 * assignments completed, syllabus coverage, a per-topic mastery breakdown in
 * FOUR states (strong / developing / weak / never attempted), and a score
 * trend over time. Reuses the stable /teacher-insights endpoints:
 *   getMastery (per-topic %), getProgress (trend), getPredicted (grade),
 *   getHeatmap (only for the class's topic universe → the "never attempted"
 *   state + coverage). Management actions (report, transfer, remove, subject
 *   switch) are preserved. Marks-weighted %, consistent with the backend.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/propel/Icon";
import { Bar, accTone, Modal, useToast } from "@/components/propel/primitives";
import { subjectStyle } from "@/components/propel/subjects";
import { syllabusLabel } from "@/lib/syllabus";
import {
  StudentProfileResponse, TeacherClass, getStudent, listClasses, removeStudent, transferStudent,
} from "@/lib/teacherClasses";
import { Predicted, getHeatmap, getMastery, getPredicted, getProgress } from "@/lib/teacherInsights";

interface TopicMastery { topic: string; mastery: number }
interface ProgressPoint { date: string; title: string; pct: number; is_full_paper: boolean }

function stateOf(v: number): "strong" | "developing" | "weak" { return v >= 75 ? "strong" : v >= 55 ? "developing" : "weak"; }
const STATE_META = {
  strong: { label: "Strong", color: "var(--teal)" },
  developing: { label: "Developing", color: "var(--amber)" },
  weak: { label: "Needs work", color: "var(--coral)" },
  never: { label: "Not attempted", color: "var(--ink-faint)" },
} as const;

export default function StudentProfilePage() {
  const params = useParams<{ id: string; clerkId: string }>();
  const router = useRouter();
  const classId = params?.id ?? "";
  const clerkId = params?.clerkId ?? "";
  const toast = useToast();

  const [data, setData] = useState<StudentProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // analytics (best-effort — one failing source never blocks the rest)
  const [mastery, setMastery] = useState<TopicMastery[] | null>(null);
  const [progress, setProgress] = useState<ProgressPoint[] | null>(null);
  const [predicted, setPredicted] = useState<Predicted | null>(null);
  const [universe, setUniverse] = useState<string[]>([]);

  useEffect(() => {
    void (async () => {
      try { setLoading(true); setData(await getStudent(classId, clerkId)); }
      catch (err) { setError(err instanceof Error ? err.message : "Failed to load student"); }
      finally { setLoading(false); }
    })();
  }, [classId, clerkId]);

  useEffect(() => {
    if (!classId || !clerkId) return;
    getMastery(classId, clerkId).then((r) => setMastery(r.mastery)).catch(() => setMastery([]));
    getProgress(classId, clerkId).then((r) => setProgress(r.points)).catch(() => setProgress([]));
    getPredicted(classId, clerkId).then(setPredicted).catch(() => setPredicted(null));
    getHeatmap(classId).then((r) => setUniverse(r.topics)).catch(() => setUniverse([]));
  }, [classId, clerkId]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const attempted = useMemo(() => new Set((mastery ?? []).map((m) => m.topic)), [mastery]);
  const neverAttempted = useMemo(
    () => universe.filter((t) => t && t !== "General" && !attempted.has(t)),
    [universe, attempted],
  );
  const sortedMastery = useMemo(() => [...(mastery ?? [])].sort((a, b) => a.mastery - b.mastery), [mastery]);

  const average = useMemo(() => {
    if (predicted?.rolling_pct != null) return Math.round(predicted.rolling_pct);
    const pts = progress ?? [];
    if (pts.length) return Math.round(pts.reduce((s, p) => s + p.pct, 0) / pts.length);
    return null;
  }, [predicted, progress]);
  const coverage = useMemo(() => {
    const total = universe.filter((t) => t && t !== "General").length;
    if (!total) return null;
    return Math.round((attempted.size / total) * 100);
  }, [universe, attempted]);

  const handleRemove = async () => {
    try { await removeStudent(classId, clerkId); router.push(`/teacher/classes/${classId}`); }
    catch (err) { toast(err instanceof Error ? err.message : "Failed to remove", "alert"); setConfirmRemove(false); }
  };

  if (loading) return <div className="grid" style={{ gap: 16 }}><div className="sk" style={{ height: 110, borderRadius: 18 }} /><div className="sk" style={{ height: 220, borderRadius: 18 }} /></div>;
  if (!data) return (
    <div style={{ textAlign: "center", padding: "64px 0" }}>
      <p className="muted">{error || "Student not found."}</p>
      <Link href={`/teacher/classes/${classId}`} className="btn btn-secondary" style={{ marginTop: 16 }}>Back to class</Link>
    </div>
  );

  const name = data.profile.full_name || data.profile.username || data.profile.email || "Student";
  const style = subjectStyle(data.class.subject);
  const joinDate = data.enrollment.approved_at || data.enrollment.requested_at;
  const gradeVal = predicted?.enough_data ? (predicted.grade ?? "—") : "—";

  return (
    <>
      <Link href={`/teacher/classes/${classId}`} className="chip" style={{ marginBottom: 18 }}><Icon name="chevron_left" size={15} /> {data.class.name}</Link>

      {/* Header */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="row-between wrap gap-16">
          <div className="flex items-center gap-16" style={{ minWidth: 0 }}>
            <span style={{ width: 56, height: 56, borderRadius: 15, flex: "none", display: "grid", placeItems: "center", background: style.color, color: "#fff", fontFamily: "var(--font-fraunces), serif", fontWeight: 600, fontSize: 22 }}>{name.slice(0, 2).toUpperCase()}</span>
            <div style={{ minWidth: 0 }}>
              <h1 className="big-num" style={{ fontSize: 24 }}>{name}</h1>
              <p className="faint" style={{ fontSize: 13, marginTop: 2 }}>{data.class.name} · {syllabusLabel(data.class.syllabus_code)}</p>
              <p className="faint" style={{ fontSize: 12, marginTop: 2 }}>
                {data.profile.is_provisioned && data.profile.username && <span className="mono">{data.profile.username} · </span>}
                Joined {joinDate ? new Date(joinDate).toLocaleDateString() : "—"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-8" style={{ flex: "none" }}>
            <Link href={`/teacher/reports/student/${classId}/${clerkId}`} className="btn btn-secondary btn-sm"><Icon name="file_text" size={15} /> Report</Link>
            <div className="relative" ref={menuRef} style={{ position: "relative" }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setMenuOpen((v) => !v)} aria-label="More actions"><Icon name="settings" size={16} /></button>
              {menuOpen && (
                <div className="card" style={{ position: "absolute", right: 0, marginTop: 6, width: 210, padding: 6, zIndex: 20 }}>
                  <button className="menu-item" onClick={() => { setMenuOpen(false); setTransferOpen(true); }}><Icon name="arrow_right" size={15} /> Transfer to another class</button>
                  <button className="menu-item" onClick={() => { setMenuOpen(false); setConfirmRemove(true); }} style={{ color: "var(--coral)" }}><Icon name="trash" size={15} /> Remove from class</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {data.sibling_classes.length > 1 && (
          <div className="flex items-center gap-8 wrap" style={{ marginTop: 18 }}>
            <span className="eyebrow" style={{ alignSelf: "center" }}>Subject</span>
            {data.sibling_classes.map((c) => (
              <Link key={c.id} href={`/teacher/classes/${c.id}/students/${clerkId}`}
                className="chip-tag" style={c.id === data.class.id ? { background: "var(--crimson-soft)", color: "var(--crimson)" } : { background: "var(--surface-2)", color: "var(--ink-soft)", border: "1px solid var(--line)" }}>
                {c.subject}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Metrics */}
      <div className="grid gap-12" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", marginBottom: 16 }}>
        <Metric label="Average" value={average != null ? `${average}%` : "—"} tone={average != null ? accCol(average) : undefined} />
        <Metric label="Predicted grade" value={String(gradeVal)} tone="var(--crimson)" />
        <Metric label="Completed" value={progress ? String(progress.length) : "—"} />
        <Metric label="Coverage" value={coverage != null ? `${coverage}%` : "—"} />
      </div>

      {/* Topic mastery */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <h2 style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Topic mastery</h2>
        {mastery === null ? (
          <div className="sk" style={{ height: 140, borderRadius: 14, marginTop: 12 }} />
        ) : sortedMastery.length === 0 && neverAttempted.length === 0 ? (
          <p className="faint" style={{ fontSize: 13.5, marginTop: 6 }}>Per-topic mastery appears here once this student has attempted marked assignments.</p>
        ) : (
          <>
            <div className="flex items-center gap-12 wrap" style={{ margin: "10px 0 16px" }}>
              {(["strong", "developing", "weak"] as const).map((k) => {
                const n = sortedMastery.filter((m) => stateOf(m.mastery) === k).length;
                return <Legend key={k} color={STATE_META[k].color} label={STATE_META[k].label} n={n} />;
              })}
              {neverAttempted.length > 0 && <Legend color={STATE_META.never.color} label={STATE_META.never.label} n={neverAttempted.length} />}
            </div>
            <div className="grid" style={{ gap: 10 }}>
              {sortedMastery.map((m) => (
                <div key={m.topic} className="flex items-center gap-12">
                  <span style={{ fontSize: 13, minWidth: 0, flex: "0 0 40%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.topic}</span>
                  <div style={{ flex: 1 }}><Bar value={m.mastery} tone={accTone(m.mastery)} /></div>
                  <span className="mono" style={{ fontSize: 12.5, fontWeight: 600, flex: "none", width: 40, textAlign: "right", color: accCol(m.mastery) }}>{m.mastery}%</span>
                </div>
              ))}
            </div>
            {neverAttempted.length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                <p className="eyebrow" style={{ marginBottom: 8 }}>Not yet attempted</p>
                <div className="flex wrap gap-6">
                  {neverAttempted.map((t) => <span key={t} className="chip-tag" style={{ background: "var(--surface-2)", color: "var(--ink-faint)", border: "1px solid var(--line)" }}>{t}</span>)}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Score trend */}
      <div className="card card-pad">
        <h2 style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Score over time</h2>
        {progress === null ? (
          <div className="sk" style={{ height: 140, borderRadius: 14 }} />
        ) : progress.length === 0 ? (
          <p className="faint" style={{ fontSize: 13.5 }}>No submitted assignments yet.</p>
        ) : (
          <>
            <Trend points={progress} />
            <div className="grid" style={{ gap: 8, marginTop: 14 }}>
              {[...progress].reverse().slice(0, 5).map((p, i) => (
                <div key={i} className="flex items-center gap-12" style={{ padding: "8px 12px", borderRadius: 10, background: "var(--surface-2)" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</div>
                    <div className="faint" style={{ fontSize: 11.5 }}>{new Date(p.date).toLocaleDateString()}{p.is_full_paper ? " · full paper" : ""}</div>
                  </div>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: accCol(p.pct) }}>{p.pct}%</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {transferOpen && (
        <TransferModal classId={classId} clerkId={clerkId} currentClassId={data.class.id}
          onClose={() => setTransferOpen(false)} onDone={(t) => router.push(`/teacher/classes/${t}/students/${clerkId}`)} />
      )}

      <Modal open={confirmRemove} onClose={() => setConfirmRemove(false)}>
        <h3 style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Remove {name.split(" ")[0]}?</h3>
        <p className="muted" style={{ fontSize: 14, marginBottom: 20 }}>They leave this class. Their attempts are preserved and stay accessible via assignment history.</p>
        <div className="flex gap-8" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={() => setConfirmRemove(false)}>Cancel</button>
          <button className="btn" style={{ background: "var(--coral)", color: "#fff" }} onClick={() => void handleRemove()}>Remove</button>
        </div>
      </Modal>

      <style>{`.menu-item{display:flex;align-items:center;gap:8px;width:100%;text-align:left;padding:9px 10px;border-radius:9px;font-size:13.5px;color:var(--ink)}.menu-item:hover{background:var(--surface-2)}`}</style>
    </>
  );
}

function accCol(v: number): string { return v >= 75 ? "var(--teal)" : v >= 55 ? "var(--amber)" : "var(--coral)"; }

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>{label}</div>
      <div className="big-num" style={{ fontSize: 26, color: tone }}>{value}</div>
    </div>
  );
}

function Legend({ color, label, n }: { color: string; label: string; n: number }) {
  return (
    <span className="flex items-center gap-6" style={{ fontSize: 12.5 }}>
      <span style={{ width: 9, height: 9, borderRadius: 3, background: color, flex: "none" }} />
      <span className="faint">{label}</span>
      <b style={{ color: "var(--ink)" }}>{n}</b>
    </span>
  );
}

function Trend({ points }: { points: ProgressPoint[] }) {
  const w = 640, h = 150, pad = 14;
  if (points.length === 1) {
    return <div style={{ textAlign: "center", padding: "20px 0" }}><span className="big-num" style={{ fontSize: 34, color: accCol(points[0].pct) }}>{points[0].pct}%</span><p className="faint" style={{ fontSize: 12.5 }}>{points[0].title}</p></div>;
  }
  const n = points.length;
  const xs = points.map((_, i) => pad + (i / (n - 1)) * (w - 2 * pad));
  const ys = points.map((p) => h - pad - (p.pct / 100) * (h - 2 * pad));
  const line = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const area = `${line} L${xs[n - 1].toFixed(1)},${h - pad} L${xs[0].toFixed(1)},${h - pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ display: "block", overflow: "visible" }} preserveAspectRatio="none">
      {[0, 50, 100].map((g) => { const y = h - pad - (g / 100) * (h - 2 * pad); return <line key={g} x1={pad} y1={y} x2={w - pad} y2={y} stroke="var(--line)" strokeWidth={1} strokeDasharray="3 4" />; })}
      <path d={area} fill="var(--crimson-soft)" opacity={0.7} />
      <path d={line} fill="none" stroke="var(--crimson)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {xs.map((x, i) => <circle key={i} cx={x} cy={ys[i]} r={3.5} fill="var(--crimson)" />)}
    </svg>
  );
}

function TransferModal({ classId, clerkId, currentClassId, onClose, onDone }: {
  classId: string; clerkId: string; currentClassId: string; onClose: () => void; onDone: (targetId: string) => void;
}) {
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const all = await listClasses();
      setClasses(all.filter((c) => c.is_owner && c.id !== currentClassId && !c.archived));
    })();
  }, [currentClassId]);

  const submit = async () => {
    if (!target) return;
    setBusy(true); setError("");
    try { await transferStudent(classId, clerkId, target); onDone(target); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to transfer"); setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}>
      <h3 style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Transfer student</h3>
      <p className="muted" style={{ fontSize: 13.5, marginBottom: 16 }}>Moves the student and their attempt history into another class you own.</p>
      {classes.length === 0 ? (
        <p className="faint" style={{ fontSize: 13 }}>You have no other classes to transfer into.</p>
      ) : (
        <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">Select a class…</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.syllabus_code})</option>)}
        </select>
      )}
      {error && <p style={{ color: "var(--coral)", fontSize: 13, marginTop: 8 }}>{error}</p>}
      <div className="flex gap-8" style={{ marginTop: 20, justifyContent: "flex-end" }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={busy || !target} onClick={() => void submit()}>{busy ? "Transferring…" : "Transfer"}</button>
      </div>
    </Modal>
  );
}
