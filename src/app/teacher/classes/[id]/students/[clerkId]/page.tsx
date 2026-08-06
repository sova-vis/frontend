"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRightLeft, FileText, MoreVertical, UserMinus } from "lucide-react";
import { Reveal } from "@/components/ui/Motion";
import { subjectStyle } from "@/components/propel/subjects";
import { syllabusLabel } from "@/lib/syllabus";
import {
  StudentProfileResponse,
  TeacherClass,
  getStudent,
  listClasses,
  removeStudent,
  transferStudent,
} from "@/lib/teacherClasses";

export default function StudentProfilePage() {
  const params = useParams<{ id: string; clerkId: string }>();
  const router = useRouter();
  const classId = (params?.id ?? "") as string;
  const clerkId = (params?.clerkId ?? "") as string;

  const [data, setData] = useState<StudentProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        setData(await getStudent(classId, clerkId));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load student");
      } finally {
        setLoading(false);
      }
    })();
  }, [classId, clerkId]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleRemove = async () => {
    if (!window.confirm("Remove this student from the class? Their attempts are preserved and stay accessible via assignment history.")) return;
    try {
      await removeStudent(classId, clerkId);
      router.push(`/teacher/classes/${classId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove student");
    }
  };

  if (loading) {
    return (
      <div className="px-4 md:px-8 py-8 max-w-4xl mx-auto space-y-4">
        <div className="h-28 rounded-[1.25rem] bg-surface-soft animate-pulse" />
        <div className="h-40 rounded-[1.25rem] bg-surface-soft animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-4 md:px-8 py-16 text-center">
        <p className="text-ink-muted">{error || "Student not found."}</p>
        <button onClick={() => router.push(`/teacher/classes/${classId}`)} className="ed-btn-ghost mt-4 px-4 py-2 mx-auto">
          Back to class
        </button>
      </div>
    );
  }

  const name = data.profile.full_name || data.profile.username || data.profile.email || "Student";
  const style = subjectStyle(data.class.subject);
  const joinDate = data.enrollment.approved_at || data.enrollment.requested_at;

  return (
    <div className="px-4 md:px-8 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <button onClick={() => router.push(`/teacher/classes/${classId}`)} className="text-sm text-ink-muted hover:text-ink">
          ← {data.class.name}
        </button>

        <Reveal>
          <section className="ed-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="grid h-14 w-14 place-items-center rounded-2xl text-paper text-lg font-bold" style={{ backgroundColor: style.color }}>
                  {name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <h1 className="font-display text-2xl font-semibold tracking-tight">{name}</h1>
                  <p className="text-ink-muted text-sm">
                    {data.class.name} · {syllabusLabel(data.class.syllabus_code)}
                  </p>
                  <p className="text-ink-faint text-xs mt-0.5">
                    {data.profile.is_provisioned && data.profile.username && (
                      <span className="font-mono">{data.profile.username} · </span>
                    )}
                    Joined {joinDate ? new Date(joinDate).toLocaleDateString() : "—"}
                  </p>
                </div>
              </div>

              <div className="relative" ref={menuRef}>
                <button onClick={() => setMenuOpen((v) => !v)} className="ed-btn-ghost p-2.5">
                  <MoreVertical size={16} />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-1 w-52 ed-card p-1 z-10">
                    <Link
                      href={`/teacher/reports/student/${classId}/${clerkId}`}
                      className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface-soft text-left"
                    >
                      <FileText size={15} /> Report for parents
                    </Link>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setTransferOpen(true);
                      }}
                      className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface-soft text-left"
                    >
                      <ArrowRightLeft size={15} /> Transfer to another class
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        void handleRemove();
                      }}
                      className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-crimson hover:bg-crimson-soft text-left"
                    >
                      <UserMinus size={15} /> Remove from class
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Subject switcher (§4.2) — metrics never averaged across subjects. */}
            {data.sibling_classes.length > 1 && (
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="ed-label self-center">Subject:</span>
                {data.sibling_classes.map((c) => (
                  <Link
                    key={c.id}
                    href={`/teacher/classes/${c.id}/students/${clerkId}`}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold border ${
                      c.id === data.class.id ? "border-crimson bg-crimson-soft text-crimson-ink" : "border-line text-ink-muted hover:bg-surface-soft"
                    }`}
                  >
                    {c.subject}
                  </Link>
                ))}
              </div>
            )}
          </section>
        </Reveal>

        {error && <p className="text-sm text-crimson">{error}</p>}

        {/* Metric cards — honest empty state until Phase 4 produces marks. */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label="Average" value="—" />
          <MetricCard label="Predicted grade" value="—" />
          <MetricCard label="Completed" value="0" />
          <MetricCard label="Syllabus coverage" value="—" />
        </div>

        <section className="ed-card p-6">
          <h2 className="font-display text-lg font-semibold mb-1">Topic mastery</h2>
          <p className="text-sm text-ink-faint">
            Per-topic mastery appears here once this student has attempted marked assignments.
          </p>
        </section>

        <section className="ed-card p-6">
          <h2 className="font-display text-lg font-semibold mb-1">Attempt history</h2>
          <p className="text-sm text-ink-faint">No attempts yet.</p>
        </section>
      </div>

      {transferOpen && (
        <TransferModal
          classId={classId}
          clerkId={clerkId}
          currentClassId={data.class.id}
          onClose={() => setTransferOpen(false)}
          onDone={(targetId) => router.push(`/teacher/classes/${targetId}/students/${clerkId}`)}
        />
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="ed-card p-4">
      <p className="ed-label">{label}</p>
      <p className="font-display text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}

function TransferModal({
  classId,
  clerkId,
  currentClassId,
  onClose,
  onDone,
}: {
  classId: string;
  clerkId: string;
  currentClassId: string;
  onClose: () => void;
  onDone: (targetId: string) => void;
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
    setBusy(true);
    setError("");
    try {
      await transferStudent(classId, clerkId, target);
      onDone(target);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to transfer");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4">
      <div className="ed-card w-full max-w-md p-6">
        <h2 className="font-display text-xl font-semibold mb-1">Transfer student</h2>
        <p className="text-sm text-ink-muted mb-4">Moves the student and their attempt history into another class you own.</p>
        {classes.length === 0 ? (
          <p className="text-sm text-ink-faint">You have no other classes to transfer into.</p>
        ) : (
          <select value={target} onChange={(e) => setTarget(e.target.value)} className="ed-input px-3 py-2.5 text-sm">
            <option value="">Select a class…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.syllabus_code})
              </option>
            ))}
          </select>
        )}
        {error && <p className="text-sm text-crimson mt-2">{error}</p>}
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="ed-btn-ghost flex-1 justify-center py-2.5">
            Cancel
          </button>
          <button onClick={() => void submit()} disabled={busy || !target} className="ed-btn-primary flex-1 justify-center py-2.5">
            {busy ? "Transferring…" : "Transfer"}
          </button>
        </div>
      </div>
    </div>
  );
}
