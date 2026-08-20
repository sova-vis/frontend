"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { ChevronRight, Clock, Plus, School, Target } from "lucide-react";
import {
  AvailableAssignment,
  Classroom,
  WeakTopic,
  getAvailableAssignments,
  getMyClassrooms,
  getWeakSpots,
  joinClassByCode,
} from "@/lib/submissions";
import { useClerkAuth } from "@/lib/useClerkAuth";
import { resolveName } from "@/lib/displayName";
import NewspaperDatesheet from "@/components/student/NewspaperDatesheet";

export default function StudentClassroomPage() {
  const router = useRouter();
  const { user } = useUser();
  const { profile } = useClerkAuth();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [assignments, setAssignments] = useState<AvailableAssignment[]>([]);
  const [weak, setWeak] = useState<WeakTopic[]>([]);
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [c, a, w] = await Promise.all([getMyClassrooms(), getAvailableAssignments(), getWeakSpots().catch(() => ({ topics: [] }))]);
      setClassrooms(c);
      setAssignments(a);
      setWeak(w.topics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load classroom");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, []);

  const join = async () => {
    if (!code.trim()) return;
    setJoining(true); setMsg(""); setError("");
    try {
      const r = await joinClassByCode(code.trim());
      setCode("");
      setMsg(r.status === "pending" ? "Request sent — awaiting teacher approval." : `Joined ${r.class_name || "the class"}!`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join. Check the code.");
    } finally { setJoining(false); }
  };

  const firstName = resolveName({ full_name: profile?.full_name, firstName: user?.firstName, username: user?.username, email: user?.primaryEmailAddress?.emailAddress, fallback: "there" }).split(" ")[0];
  const isTodo = (a: AvailableAssignment) => !a.released && ["not_started", "in_progress", "returned"].includes(a.submission_status);
  const isSubmitted = (a: AvailableAssignment) => !a.released && ["submitted", "late"].includes(a.submission_status);
  const isReviewed = (a: AvailableAssignment) => a.released;
  const activeClasses = useMemo(() => classrooms.filter((c) => c.enrollment_status === "active"), [classrooms]);
  const pendingClasses = useMemo(() => classrooms.filter((c) => c.enrollment_status === "pending"), [classrooms]);

  return (
    <div className="min-h-screen bg-paper text-ink px-4 md:px-8 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">
            Hi, <span className="italic text-crimson">{firstName}</span>
          </h1>
          <p className="text-ink-muted mt-1">Your classroom — assignments from your teachers, all in one place.</p>
        </div>

        {loading ? (
          <div className="h-64 rounded-[1.25rem] bg-surface-soft animate-pulse" />
        ) : (
          <div className="grid lg:grid-cols-[1fr_320px] gap-6">
            {/* MAIN */}
            <div className="space-y-6">
              {classrooms.length === 0 ? (
                <div className="ed-card p-10 text-center">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-crimson-soft text-crimson-ink"><School size={26} /></div>
                  <h3 className="mt-4 font-display text-lg font-semibold">Join your first class</h3>
                  <p className="mt-1 text-ink-muted">Enter the code your teacher gave you (in the panel on the right).</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Each class is a clickable card that opens its own page. */}
                  {activeClasses.map((c) => {
                    const ct = assignments.filter((a) => a.class_id === c.class_id);
                    const cTodo = ct.filter(isTodo).length;
                    const cSub = ct.filter(isSubmitted).length;
                    const cRev = ct.filter(isReviewed).length;
                    return (
                      <button
                        key={c.class_id}
                        onClick={() => router.push(`/student/classroom/${c.class_id}`)}
                        className="ed-card p-5 text-left hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center gap-3">
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-crimson-soft text-crimson-ink"><School size={20} /></span>
                          <div className="min-w-0 flex-1">
                            <h2 className="font-display text-lg font-semibold truncate">{c.class_name}</h2>
                            <p className="text-xs text-ink-faint truncate">{c.teacher_name}{c.subject ? ` · ${c.subject}` : ""}</p>
                          </div>
                          <ChevronRight size={18} className="text-ink-faint shrink-0" />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {cTodo > 0 ? <span className="ed-pill-crimson text-[0.6rem]">{cTodo} to do</span> : <span className="ed-pill-mint text-[0.6rem]">All done</span>}
                          {cSub > 0 && <span className="ed-pill-gold text-[0.6rem]">{cSub} in review</span>}
                          {cRev > 0 && <span className="ed-pill-mint text-[0.6rem]">{cRev} reviewed</span>}
                        </div>
                      </button>
                    );
                  })}

                  {/* Classes still awaiting teacher approval. */}
                  {pendingClasses.map((c) => (
                    <div key={c.class_id} className="ed-card p-5 opacity-80">
                      <div className="flex items-center gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold-ink"><Clock size={20} /></span>
                        <div className="min-w-0">
                          <h2 className="font-display text-lg font-semibold truncate">{c.class_name}</h2>
                          <p className="text-xs text-ink-faint truncate">{c.teacher_name} · waiting for approval</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Weak spots */}
              <section className="ed-card p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Target size={17} className="text-clay-ink" />
                  <h2 className="font-display text-lg font-semibold">Weak spots</h2>
                </div>
                {weak.length === 0 ? (
                  <p className="text-sm text-ink-faint">Once your teachers mark your work, the topics you slip on show up here.</p>
                ) : (
                  <div className="space-y-3">
                    {weak.map((t) => (
                      <div key={t.topic} className="ed-card-soft p-3">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-ink">{t.topic}</p>
                          <span className="ed-pill-crimson text-[0.6rem]">{t.missed} mistake{t.missed === 1 ? "" : "s"} · {t.accuracy}%</span>
                        </div>
                        {t.mistakes.length > 0 && (
                          <ul className="mt-1.5 space-y-0.5">
                            {t.mistakes.map((m, i) => (
                              <li key={i} className="text-xs text-ink-muted flex gap-1.5"><span className="text-clay-ink">✗</span><span>{m}</span></li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* SIDEBAR */}
            <div className="space-y-4">
              <NewspaperDatesheet scope="classroom" />

              {/* Classrooms + join */}
              <div className="ed-card p-4">
                <p className="ed-label mb-2">Join a class</p>
                <div className="flex gap-2">
                  <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && void join()} placeholder="Code" className="ed-input px-3 py-2 text-sm font-mono tracking-widest flex-1 min-w-0" />
                  <button onClick={() => void join()} disabled={joining} className="ed-btn-primary px-3 py-2 text-sm shrink-0"><Plus size={14} /></button>
                </div>
                {msg && <p className="text-xs text-mint-ink mt-2">{msg}</p>}
                {error && <p className="text-xs text-crimson mt-2">{error}</p>}

                {classrooms.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="ed-label">Your teachers</p>
                    {classrooms.map((c) => (
                      <div key={c.class_id} className="flex items-center gap-2 text-sm">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-crimson-soft text-crimson-ink"><School size={15} /></span>
                        <div className="min-w-0">
                          <p className="font-medium text-ink truncate">{c.teacher_name}</p>
                          <p className="text-xs text-ink-faint truncate">{c.class_name}{c.enrollment_status === "pending" ? " · pending" : ""}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
