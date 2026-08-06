"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  Archive,
  ArchiveRestore,
  Check,
  Copy,
  Link2,
  RefreshCw,
  QrCode,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Reveal } from "@/components/ui/Motion";
import { subjectStyle } from "@/components/propel/subjects";
import { syllabusLabel } from "@/lib/syllabus";
import AddStudentsModal from "@/components/teacher/AddStudentsModal";
import {
  CoTeacher,
  Enrollment,
  TeacherClass,
  addCoTeacher,
  archiveClass,
  decideEnrollments,
  getClass,
  joinLink,
  listCoTeachers,
  listEnrollments,
  regenerateJoinCode,
  removeCoTeacher,
  setJoinEnabled,
} from "@/lib/teacherClasses";

type Tab = "roster" | "requests" | "share" | "coteach";

export default function ClassDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const classId = (params?.id ?? "") as string;

  const [klass, setKlass] = useState<TeacherClass | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [coTeachers, setCoTeachers] = useState<CoTeacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("roster");
  const [showAddStudents, setShowAddStudents] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [k, e, ct] = await Promise.all([
        getClass(classId),
        listEnrollments(classId),
        listCoTeachers(classId),
      ]);
      setKlass(k);
      setEnrollments(e);
      setCoTeachers(ct);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load class");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  const pending = enrollments.filter((e) => e.status === "pending");
  const active = enrollments.filter((e) => e.status === "active");

  const handleDecision = async (ids: string[], decision: "approve" | "reject") => {
    try {
      await decideEnrollments(classId, ids, decision);
      setEnrollments((prev) =>
        prev.map((e) =>
          ids.includes(e.student_clerk_id)
            ? { ...e, status: decision === "approve" ? "active" : "rejected" }
            : e
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update request");
    }
  };

  const handleArchive = async () => {
    if (!klass) return;
    const next = !klass.archived;
    if (next && !window.confirm("Archive this class? New submissions are disabled; all data is preserved and it can be restored.")) return;
    try {
      const updated = await archiveClass(classId, next);
      setKlass(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive class");
    }
  };

  if (loading) {
    return (
      <div className="px-4 md:px-8 py-8 max-w-5xl mx-auto space-y-4">
        <div className="h-28 rounded-[1.25rem] bg-surface-soft animate-pulse" />
        <div className="h-64 rounded-[1.25rem] bg-surface-soft animate-pulse" />
      </div>
    );
  }

  if (!klass) {
    return (
      <div className="px-4 md:px-8 py-16 text-center">
        <p className="text-ink-muted">{error || "Class not found."}</p>
        <button onClick={() => router.push("/teacher/classes")} className="ed-btn-ghost mt-4 px-4 py-2 mx-auto">
          Back to classes
        </button>
      </div>
    );
  }

  const style = subjectStyle(klass.subject);
  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "roster", label: "Roster", badge: active.length },
    { key: "requests", label: "Requests", badge: pending.length },
    { key: "share", label: "Share & join" },
    { key: "coteach", label: "Co-teachers", badge: coTeachers.length },
  ];

  return (
    <div className="px-4 md:px-8 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <button onClick={() => router.push("/teacher/classes")} className="text-sm text-ink-muted hover:text-ink">
          ← Classes
        </button>

        <Reveal>
          <section className="ed-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-paper" style={{ backgroundColor: style.color }}>
                  <Users size={22} />
                </span>
                <div className="min-w-0">
                  <h1 className="font-display text-2xl font-semibold tracking-tight truncate">{klass.name}</h1>
                  <p className="text-ink-muted text-sm">
                    {syllabusLabel(klass.syllabus_code)} · {klass.level} Level
                    {klass.year_group ? ` · ${klass.year_group}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {klass.archived && <span className="ed-pill-clay">Archived</span>}
                {klass.is_owner && (
                  <button onClick={() => void handleArchive()} className="ed-btn-ghost px-3 py-2 text-sm">
                    {klass.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                    {klass.archived ? "Restore" : "Archive"}
                  </button>
                )}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <Stat label="Students" value={active.length} />
              <Stat label="Pending" value={pending.length} />
              <Stat label="30-day avg" value="—" />
            </div>
          </section>
        </Reveal>

        {error && <p className="text-sm text-crimson">{error}</p>}

        {/* Pending banner (§4.1) — always visible above content when requests exist */}
        {pending.length > 0 && tab !== "requests" && (
          <div className="ed-card-soft p-4 flex flex-wrap items-center justify-between gap-3 border-l-4 border-crimson">
            <p className="text-sm text-ink">
              <span className="font-semibold">{pending.length}</span> student{pending.length === 1 ? "" : "s"} waiting to join.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setTab("requests")} className="ed-btn-ghost px-3 py-1.5 text-xs">
                Review
              </button>
              <button
                onClick={() => void handleDecision(pending.map((p) => p.student_clerk_id), "approve")}
                className="ed-btn-primary px-3 py-1.5 text-xs"
              >
                Approve all
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-line overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${
                tab === t.key ? "text-crimson" : "text-ink-muted hover:text-ink"
              }`}
            >
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className="ml-1.5 rounded-full bg-surface-soft px-1.5 py-0.5 text-[0.65rem] text-ink-muted">{t.badge}</span>
              )}
              {tab === t.key && <span className="absolute inset-x-3 -bottom-px h-0.5 bg-crimson rounded-full" />}
            </button>
          ))}
        </div>

        {tab === "roster" && (
          <RosterTab classId={classId} active={active} onAdd={() => setShowAddStudents(true)} />
        )}
        {tab === "requests" && <RequestsTab pending={pending} onDecide={handleDecision} />}
        {tab === "share" && <ShareTab klass={klass} onChange={setKlass} />}
        {tab === "coteach" && (
          <CoTeachTab
            klass={klass}
            coTeachers={coTeachers}
            onChange={setCoTeachers}
            onError={setError}
          />
        )}
      </div>

      {showAddStudents && (
        <AddStudentsModal
          classId={classId}
          className={klass.name}
          onClose={() => setShowAddStudents(false)}
          onChanged={() => void load()}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="ed-card-soft p-4">
      <p className="ed-label">{label}</p>
      <p className="font-display text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}

function RosterTab({ classId, active, onAdd }: { classId: string; active: Enrollment[]; onAdd: () => void }) {
  const [search, setSearch] = useState("");
  const rows = active.filter((e) =>
    (e.full_name || e.email || "").toLowerCase().includes(search.toLowerCase())
  );

  if (active.length === 0) {
    return (
      <div className="ed-card p-8 text-center">
        <p className="text-ink-muted">
          No students yet. Share the join code from the <span className="font-semibold">Share &amp; join</span> tab, or add
          them directly.
        </p>
        <button onClick={onAdd} className="ed-btn-primary mt-4 px-4 py-2.5 mx-auto">
          <UserPlus size={15} /> Add students
        </button>
      </div>
    );
  }

  return (
    <div className="ed-card p-0 overflow-hidden">
      <div className="p-4 border-b border-line flex items-center justify-between gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search students…"
          className="ed-input px-3 py-2 text-sm max-w-xs"
        />
        <button onClick={onAdd} className="ed-btn-ghost px-3 py-2 text-sm shrink-0">
          <UserPlus size={15} /> Add
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-faint border-b border-line">
              <th className="px-4 py-3 font-semibold">Student</th>
              <th className="px-4 py-3 font-semibold">Last active</th>
              <th className="px-4 py-3 font-semibold">Completed</th>
              <th className="px-4 py-3 font-semibold">Average</th>
              <th className="px-4 py-3 font-semibold">Flag</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr
                key={e.id}
                onClick={() => (window.location.href = `/teacher/classes/${classId}/students/${e.student_clerk_id}`)}
                className="border-b border-line/60 hover:bg-surface-soft/50 cursor-pointer"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-paper text-[0.6rem] font-bold">
                      {(e.full_name || e.email || "S").slice(0, 2).toUpperCase()}
                    </span>
                    <span className="font-medium text-ink">{e.full_name || e.email || "Student"}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-ink-faint">—</td>
                <td className="px-4 py-3 text-ink-faint">—</td>
                <td className="px-4 py-3 text-ink-faint">—</td>
                <td className="px-4 py-3 text-ink-faint">—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RequestsTab({
  pending,
  onDecide,
}: {
  pending: Enrollment[];
  onDecide: (ids: string[], decision: "approve" | "reject") => Promise<void>;
}) {
  if (pending.length === 0) {
    return (
      <div className="ed-card p-8 text-center">
        <p className="text-ink-muted">No pending enrolment requests.</p>
      </div>
    );
  }
  return (
    <div className="ed-card p-4 space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => void onDecide(pending.map((p) => p.student_clerk_id), "approve")}
          className="ed-btn-primary px-3 py-1.5 text-xs"
        >
          Approve all
        </button>
      </div>
      {pending.map((e) => (
        <div key={e.id} className="ed-card-soft p-3 flex items-center justify-between gap-3">
          <div>
            <p className="font-medium text-ink">{e.full_name || e.email || "Student"}</p>
            <p className="text-xs text-ink-faint">Requested {new Date(e.requested_at).toLocaleDateString()}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void onDecide([e.student_clerk_id], "approve")}
              className="inline-flex items-center gap-1.5 rounded-full border border-mint/30 bg-mint-soft px-3 py-1.5 text-xs font-bold text-mint-ink"
            >
              <Check size={13} /> Approve
            </button>
            <button
              onClick={() => void onDecide([e.student_clerk_id], "reject")}
              className="inline-flex items-center gap-1.5 rounded-full border border-crimson/30 bg-crimson-soft px-3 py-1.5 text-xs font-bold text-crimson-ink"
            >
              <X size={13} /> Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ShareTab({ klass, onChange }: { klass: TeacherClass; onChange: (k: TeacherClass) => void }) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [busy, setBusy] = useState(false);
  const link = klass.join_code ? joinLink(klass.join_code) : "";

  const copy = async (value: string, which: "code" | "link") => {
    await navigator.clipboard.writeText(value);
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  };

  const regen = async () => {
    if (!window.confirm("Generate a new code? The current code stops working immediately. Enrolled students are unaffected.")) return;
    setBusy(true);
    try {
      onChange(await regenerateJoinCode(klass.id));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async () => {
    setBusy(true);
    try {
      onChange(await setJoinEnabled(klass.id, !klass.join_enabled));
    } finally {
      setBusy(false);
    }
  };

  const downloadQr = () => {
    const svg = document.getElementById("join-qr");
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${klass.name.replace(/\s+/g, "-")}-join-qr.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="ed-card p-6 space-y-5">
        <div>
          <p className="ed-label mb-2">Join code</p>
          <div className="flex items-center gap-2">
            <span className="font-display text-3xl font-bold tracking-[0.3em] text-ink">
              {klass.join_enabled ? klass.join_code : "——————"}
            </span>
            {klass.join_enabled && klass.join_code && (
              <button onClick={() => void copy(klass.join_code!, "code")} className="ed-btn-ghost p-2">
                {copied === "code" ? <Check size={15} /> : <Copy size={15} />}
              </button>
            )}
          </div>
          <p className="text-xs text-ink-faint mt-1">Students enter this at join — it is not case-sensitive.</p>
        </div>

        <div>
          <p className="ed-label mb-2">Join link</p>
          <div className="flex items-center gap-2">
            <input readOnly value={klass.join_enabled ? link : "Disabled"} className="ed-input px-3 py-2 text-sm flex-1" />
            {klass.join_enabled && (
              <button onClick={() => void copy(link, "link")} className="ed-btn-ghost p-2.5">
                {copied === "link" ? <Check size={15} /> : <Link2 size={15} />}
              </button>
            )}
          </div>
        </div>

        {klass.is_owner && (
          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={() => void regen()} disabled={busy} className="ed-btn-ghost px-3 py-2 text-sm">
              <RefreshCw size={14} /> Regenerate
            </button>
            <button onClick={() => void toggle()} disabled={busy} className="ed-btn-ghost px-3 py-2 text-sm">
              {klass.join_enabled ? "Disable joining" : "Enable joining"}
            </button>
          </div>
        )}
      </div>

      <div className="ed-card p-6 flex flex-col items-center justify-center gap-4">
        {klass.join_enabled && link ? (
          <>
            <div className="rounded-2xl bg-white p-4">
              <QRCodeSVG id="join-qr" value={link} size={168} level="M" />
            </div>
            <button onClick={downloadQr} className="ed-btn-ghost px-3 py-2 text-sm">
              <QrCode size={14} /> Download QR
            </button>
          </>
        ) : (
          <p className="text-ink-faint text-sm text-center">Enable joining to show a QR code.</p>
        )}
      </div>
    </div>
  );
}

function CoTeachTab({
  klass,
  coTeachers,
  onChange,
  onError,
}: {
  klass: TeacherClass;
  coTeachers: CoTeacher[];
  onChange: (rows: CoTeacher[]) => void;
  onError: (msg: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [canGrade, setCanGrade] = useState(true);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!email.trim()) return;
    setBusy(true);
    try {
      const created = await addCoTeacher(klass.id, email.trim(), canGrade);
      onChange([...coTeachers.filter((c) => c.teacher_clerk_id !== created.teacher_clerk_id), created]);
      setEmail("");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to add co-teacher");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (teacherClerkId: string) => {
    try {
      await removeCoTeacher(klass.id, teacherClerkId);
      onChange(coTeachers.filter((c) => c.teacher_clerk_id !== teacherClerkId));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to remove co-teacher");
    }
  };

  return (
    <div className="ed-card p-6 space-y-5">
      {klass.is_owner && (
        <div>
          <p className="ed-label mb-2">Invite a co-teacher by email</p>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teacher@school.edu"
              className="ed-input px-3 py-2 text-sm flex-1 min-w-[200px]"
            />
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <input type="checkbox" checked={canGrade} onChange={(e) => setCanGrade(e.target.checked)} className="accent-crimson" />
              Can grade
            </label>
            <button onClick={() => void add()} disabled={busy} className="ed-btn-primary px-3 py-2 text-sm">
              <UserPlus size={14} /> Add
            </button>
          </div>
          <p className="text-xs text-ink-faint mt-1">They must already have a teacher account.</p>
        </div>
      )}

      {coTeachers.length === 0 ? (
        <p className="text-ink-faint text-sm">No co-teachers on this class.</p>
      ) : (
        <div className="space-y-2">
          {coTeachers.map((c) => (
            <div key={c.id} className="ed-card-soft p-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-ink">{c.full_name || c.email}</p>
                <p className="text-xs text-ink-faint">{c.can_grade ? "Can grade" : "Observer"}</p>
              </div>
              {klass.is_owner && (
                <button onClick={() => void remove(c.teacher_clerk_id)} className="ed-btn-ghost p-2">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
