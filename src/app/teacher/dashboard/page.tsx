"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileStack,
  School,
  Layers,
  ScanLine,
  UserPlus,
} from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/Motion";
import { useClerkAuth } from "@/lib/useClerkAuth";
import { subjectStyle } from "@/components/propel/subjects";
import { TeacherClass, listClasses } from "@/lib/teacherClasses";
import { DashboardData, getDashboard } from "@/lib/teacherInsights";
import { resolveName } from "@/lib/displayName";

export default function TeacherHome() {
  const { profile, user } = useClerkAuth();
  const router = useRouter();
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const [c, d] = await Promise.all([listClasses(), getDashboard().catch(() => null)]);
        setClasses(c);
        setDash(d);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const firstName = resolveName({
    full_name: profile?.full_name,
    firstName: user?.firstName,
    email: user?.primaryEmailAddress?.emailAddress,
    fallback: "there",
  }).split(" ")[0];
  const hasClasses = classes.length > 0;
  const totalStudents = classes.reduce((sum, c) => sum + (c.student_count ?? 0), 0);
  const aq = dash?.action_queue;

  return (
    <div className="px-4 md:px-8 py-8">
      <div className="max-w-6xl mx-auto space-y-7">
        <Reveal>
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">
              Welcome back, <span className="italic text-crimson">{firstName}</span>
            </h1>
            <p className="text-ink-muted mt-1">
              {hasClasses ? `${classes.length} class${classes.length === 1 ? "" : "es"} · ${totalStudents} students` : "Let's get your first class set up."}
            </p>
          </div>
        </Reveal>

        {loading ? (
          <div className="h-40 rounded-[1.25rem] bg-surface-soft animate-pulse" />
        ) : !hasClasses ? (
          <SetupChecklist hasStudents={totalStudents > 0} />
        ) : (
          <>
            {/* §2.1 Action queue */}
            <Reveal>
              <section>
                <h2 className="ed-label mb-2">What needs you now</h2>
                <div className="grid grid-cols-3 gap-3">
                  <QueueCard label="Needs review" value={aq?.low_confidence ?? 0} tone="crimson" icon={AlertTriangle} onClick={() => router.push("/teacher/assignments")} />
                  <QueueCard label="Ready to approve" value={aq?.ready_bulk ?? 0} tone="mint" icon={Layers} onClick={() => router.push("/teacher/assignments")} />
                  <QueueCard label="OCR failed" value={aq?.ocr_failed ?? 0} tone="gold" icon={ScanLine} onClick={() => router.push("/teacher/assignments")} />
                </div>
                {(aq?.reviewed_unreleased ?? 0) > 0 && (
                  <p className="text-sm text-ink-muted mt-2">
                    {aq!.reviewed_unreleased} assignment{aq!.reviewed_unreleased === 1 ? "" : "s"} fully reviewed but not released.
                  </p>
                )}
              </section>
            </Reveal>

            <Reveal delay={0.05}><QuickActions /></Reveal>

            {/* §2.2 Active assignments */}
            {dash && dash.active_assignments.length > 0 && (
              <Reveal delay={0.08}>
                <section className="ed-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display text-lg font-semibold">Active assignments</h2>
                    <Link href="/teacher/assignments" className="text-sm text-crimson hover:text-crimson-deep inline-flex items-center gap-1">
                      View all <ArrowRight size={14} />
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {dash.active_assignments.map((a) => {
                      const overdue = a.deadline_at && new Date(a.deadline_at) < new Date();
                      return (
                        <Link key={a.id} href={`/teacher/assignments/${a.id}`} className="ed-card-soft p-3 flex items-center gap-3 hover:shadow-sm transition-shadow">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-ink truncate">{a.title}</p>
                            <p className="text-xs text-ink-faint">{a.class_name}</p>
                          </div>
                          <span className="text-sm text-ink-muted">{a.submitted}/{a.total}{a.late > 0 ? ` · ${a.late} late` : ""}</span>
                          {a.deadline_at && (
                            <span className={`text-xs shrink-0 ${overdue ? "text-crimson font-semibold" : "text-ink-faint"}`}>
                              {new Date(a.deadline_at).toLocaleDateString()}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </section>
              </Reveal>
            )}

            <div className="grid lg:grid-cols-2 gap-6">
              {/* §2.3 Class pulse */}
              {dash && dash.class_pulse.length > 0 && (
                <Reveal delay={0.1}>
                  <section className="ed-card p-6">
                    <h2 className="font-display text-lg font-semibold mb-4">Class pulse</h2>
                    <Stagger className="space-y-3">
                      {dash.class_pulse.map((p) => {
                        const style = subjectStyle(p.subject);
                        return (
                          <StaggerItem key={p.class_id}>
                            <div className="ed-card-soft p-3">
                              <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: style.color }} />
                                <span className="font-semibold text-ink flex-1 truncate">{p.class_name}</span>
                                <span className="text-sm text-ink-muted">{p.avg != null ? `${p.avg}% avg` : "—"}</span>
                              </div>
                              {p.weakest_topics.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {p.weakest_topics.map((t) => (
                                    <Link
                                      key={t.topic}
                                      href={`/teacher/assignments/new?class_id=${p.class_id}`}
                                      className="ed-pill-crimson text-[0.6rem] hover:opacity-80"
                                      title="Assign practice on this topic"
                                    >
                                      {t.topic} {t.mastery}%
                                    </Link>
                                  ))}
                                </div>
                              )}
                            </div>
                          </StaggerItem>
                        );
                      })}
                    </Stagger>
                  </section>
                </Reveal>
              )}

              {/* §2.4 Students needing attention */}
              {dash && dash.needs_attention.length > 0 && (
                <Reveal delay={0.12}>
                  <section className="ed-card p-6">
                    <h2 className="font-display text-lg font-semibold mb-4">Needs attention</h2>
                    <div className="space-y-2">
                      {dash.needs_attention.map((s) => (
                        <Link
                          key={s.clerk_id}
                          href={`/teacher/classes/${s.class_id}/students/${s.clerk_id}`}
                          className="ed-card-soft p-3 flex items-center gap-3 hover:shadow-sm transition-shadow"
                        >
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-paper text-[0.6rem] font-bold">
                            {s.name.slice(0, 2).toUpperCase()}
                          </span>
                          <span className="font-medium text-ink flex-1 truncate">{s.name}</span>
                          <span className="ed-pill-gold text-[0.6rem]">{s.reason}</span>
                        </Link>
                      ))}
                    </div>
                  </section>
                </Reveal>
              )}
            </div>

            <Reveal delay={0.14}>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">Your classes</h2>
                <Link href="/teacher/classes" className="text-sm text-crimson hover:text-crimson-deep inline-flex items-center gap-1">
                  View all <ArrowRight size={14} />
                </Link>
              </div>
            </Reveal>
            <Stagger className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {classes.slice(0, 6).map((c) => {
                const style = subjectStyle(c.subject);
                return (
                  <StaggerItem key={c.id}>
                    <Link href={`/teacher/classes/${c.id}`} className="ed-card-soft p-4 flex items-center gap-3 hover:shadow-sm transition-shadow">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-paper" style={{ backgroundColor: style.color }}>
                        <School size={18} />
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-ink truncate">{c.name}</p>
                        <p className="text-xs text-ink-faint truncate">{c.student_count ?? 0} students</p>
                      </div>
                    </Link>
                  </StaggerItem>
                );
              })}
            </Stagger>
          </>
        )}
      </div>
    </div>
  );
}

function QueueCard({ label, value, tone, icon: Icon, onClick }: { label: string; value: number; tone: "crimson" | "mint" | "gold"; icon: typeof AlertTriangle; onClick: () => void }) {
  const toneCls = tone === "crimson" ? "bg-crimson-soft text-crimson-ink" : tone === "mint" ? "bg-mint-soft text-mint-ink" : "bg-gold-soft text-gold-ink";
  return (
    <button onClick={onClick} className="ed-card p-4 text-left hover:shadow-md transition-shadow">
      <span className={`grid h-8 w-8 place-items-center rounded-lg ${toneCls}`}>
        <Icon size={16} />
      </span>
      <p className="font-display text-2xl font-semibold mt-2">{value}</p>
      <p className="text-xs text-ink-muted">{label}</p>
    </button>
  );
}

function QuickActions() {
  const actions = [
    { href: "/teacher/assignments/new?mode=topical", label: "Assign topical set", icon: BookOpen },
    { href: "/teacher/assignments/new?mode=paper", label: "Assign full paper", icon: FileStack },
    { href: "/teacher/classes", label: "Create class", icon: School },
    { href: "/teacher/classes", label: "Invite students", icon: UserPlus },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {actions.map(({ href, label, icon: Icon }) => (
        <Link key={label} href={href} className="ed-card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-crimson-soft text-crimson-ink">
            <Icon size={18} />
          </span>
          <span className="text-sm font-semibold text-ink">{label}</span>
        </Link>
      ))}
    </div>
  );
}

function SetupChecklist({ hasStudents }: { hasStudents: boolean }) {
  const steps = [
    { done: false, label: "Create your first class", href: "/teacher/classes", cta: "Create class" },
    { done: hasStudents, label: "Invite your students", href: "/teacher/classes", cta: "Invite" },
    { done: false, label: "Set your first assignment", href: "/teacher/classes", cta: "Assign" },
  ];
  return (
    <Reveal>
      <section className="ed-card p-8 max-w-2xl">
        <h2 className="font-display text-xl font-semibold">Get started in three steps</h2>
        <p className="text-ink-muted mt-1">Propel is built around the assign → mark → review → release loop. Here&apos;s how to begin.</p>
        <div className="mt-6 space-y-3">
          {steps.map((s, i) => (
            <div key={i} className="ed-card-soft p-4 flex items-center gap-3">
              {s.done
                ? <CheckCircle2 className="text-mint-ink shrink-0" size={22} />
                : <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-crimson text-white text-xs font-bold">{i + 1}</span>}
              <span className={`flex-1 font-medium ${s.done ? "text-ink-faint line-through" : "text-ink"}`}>{s.label}</span>
              {!s.done && <Link href={s.href} className="ed-btn-primary px-3 py-1.5 text-xs">{s.cta}</Link>}
            </div>
          ))}
        </div>
      </section>
    </Reveal>
  );
}
