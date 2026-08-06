"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CheckCircle2, Clock, GraduationCap, Plus, School, Users } from "lucide-react";
import {
  AvailableAssignment,
  Classroom,
  getAvailableAssignments,
  getMyClassrooms,
  joinClassByCode,
} from "@/lib/submissions";

export default function StudentClassroomPage() {
  const router = useRouter();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [assignments, setAssignments] = useState<AvailableAssignment[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [c, a] = await Promise.all([getMyClassrooms(), getAvailableAssignments()]);
      setClassrooms(c);
      setAssignments(a);
      if (!selected && c.length > 0) setSelected(c[0].class_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load classrooms");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const join = async () => {
    if (!code.trim()) return;
    setJoining(true);
    setMsg("");
    setError("");
    try {
      const r = await joinClassByCode(code.trim());
      setCode("");
      if (r.status === "pending") setMsg("Request sent — your teacher needs to approve you.");
      else setMsg(`Joined ${r.class_name || "the class"}!`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join. Check the code.");
    } finally {
      setJoining(false);
    }
  };

  const current = classrooms.find((c) => c.class_id === selected) || null;
  const classAssignments = useMemo(() => assignments.filter((a) => a.class_id === selected), [assignments, selected]);
  const todo = classAssignments.filter((a) => !a.released && ["not_started", "in_progress", "returned"].includes(a.submission_status));
  const submitted = classAssignments.filter((a) => !a.released && ["submitted", "late"].includes(a.submission_status));
  const reviewed = classAssignments.filter((a) => a.released);

  return (
    <div className="min-h-screen bg-paper text-ink px-4 md:px-8 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">
            Your <span className="italic text-crimson">Classroom</span>
          </h1>
          <p className="text-ink-muted mt-1">Join your teachers&apos; classes and do their assignments here.</p>
        </div>

        {/* Join by code */}
        <div className="ed-card p-5">
          <p className="ed-label mb-2">Join a class</p>
          <div className="flex flex-wrap gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Enter class code"
              className="ed-input px-3 py-2.5 text-sm font-mono tracking-widest max-w-[200px]"
              onKeyDown={(e) => e.key === "Enter" && void join()}
            />
            <button onClick={() => void join()} disabled={joining} className="ed-btn-primary px-4 py-2.5">
              <Plus size={15} /> {joining ? "Joining…" : "Join"}
            </button>
          </div>
          {msg && <p className="text-sm text-mint-ink mt-2">{msg}</p>}
          {error && <p className="text-sm text-crimson mt-2">{error}</p>}
        </div>

        {loading ? (
          <div className="h-40 rounded-[1.25rem] bg-surface-soft animate-pulse" />
        ) : classrooms.length === 0 ? (
          <div className="ed-card p-10 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-crimson-soft text-crimson-ink"><School size={26} /></div>
            <p className="mt-4 text-ink-muted">You haven&apos;t joined any classes yet. Enter a code from your teacher above.</p>
          </div>
        ) : (
          <>
            {/* Teacher / classroom cards */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {classrooms.map((c) => (
                <button
                  key={c.class_id}
                  onClick={() => setSelected(c.class_id)}
                  className={`ed-card p-4 text-left transition-shadow ${selected === c.class_id ? "ring-2 ring-crimson" : "hover:shadow-md"}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-crimson-soft text-crimson-ink"><Users size={18} /></span>
                    <div className="min-w-0">
                      <p className="font-semibold text-ink truncate">{c.class_name}</p>
                      <p className="text-xs text-ink-faint truncate">{c.teacher_name}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="ed-pill-mint text-[0.6rem]">{c.subject}</span>
                    {c.enrollment_status === "pending" && <span className="ed-pill-gold text-[0.6rem]">Pending approval</span>}
                  </div>
                </button>
              ))}
            </div>

            {/* Selected classroom assignments */}
            {current && (
              <div className="space-y-5">
                <h2 className="font-display text-lg font-semibold">{current.class_name} · <span className="text-ink-faint font-normal">{current.teacher_name}</span></h2>
                {current.enrollment_status === "pending" ? (
                  <div className="ed-card p-6 text-center text-ink-muted">Waiting for your teacher to approve you. Assignments appear once you&apos;re in.</div>
                ) : (
                  <>
                    <Section title="To do" icon={BookOpen} items={todo} empty="Nothing to do right now." onOpen={(id) => router.push(`/student/assignments/${id}`)} cta="Start" />
                    <Section title="Submitted · awaiting review" icon={Clock} items={submitted} empty="No submissions awaiting review." onOpen={(id) => router.push(`/student/assignments/${id}`)} cta="View" muted />
                    <Section title="Reviewed" icon={CheckCircle2} items={reviewed} empty="No reviewed results yet." onOpen={(id) => router.push(`/student/assignments/${id}`)} cta="See feedback" mint />
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Section({
  title, icon: Icon, items, empty, onOpen, cta, muted, mint,
}: {
  title: string; icon: typeof BookOpen; items: AvailableAssignment[]; empty: string; onOpen: (id: string) => void; cta: string; muted?: boolean; mint?: boolean;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className={mint ? "text-mint-ink" : muted ? "text-ink-faint" : "text-crimson"} />
        <h3 className="font-semibold text-ink text-sm">{title}</h3>
        <span className="text-xs text-ink-faint">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-ink-faint">{empty}</p>
      ) : (
        <div className="space-y-2">
          {items.map((a) => (
            <div key={a.id} className="ed-card-soft p-3 flex items-center gap-3">
              <GraduationCap size={16} className="text-ink-faint shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink truncate">{a.title}</p>
                {a.deadline_at && <p className="text-xs text-ink-faint">Due {new Date(a.deadline_at).toLocaleDateString()}</p>}
              </div>
              <button onClick={() => onOpen(a.id)} className={`px-3 py-1.5 text-xs font-semibold rounded-full ${mint ? "bg-mint-soft text-mint-ink" : "ed-btn-primary"}`}>{cta}</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
