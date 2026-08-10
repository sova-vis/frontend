"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Camera, Check, GraduationCap, School } from "lucide-react";
import { apiCall } from "@/lib/api";
import { useClerkAuth } from "@/lib/useClerkAuth";
import { SUBJECT_OPTIONS as SUBJECTS, subjectSlug } from "@/lib/studentSubjects";
import { saveSelectedSubjects } from "@/lib/studentPersonalization";
const SESSIONS = ["Oct/Nov 2026", "May/June 2027", "Oct/Nov 2027", "Not sure yet"];
const GRADES = ["A*", "A", "B", "C", "Just want to pass"];
const STUDY = [
  { key: "2-3", label: "2–3 days" },
  { key: "4-5", label: "4–5 days" },
  { key: "every", label: "Every day" },
];

interface Data {
  firstName: string;
  lastName: string;
  level: string;
  session: string;
  subjects: string[];
  target: string;
  studyDays: string;
  confidence: Record<string, string>;
  experience: string;
  school: string;
  schoolType: string;
  teachesAtSchool: boolean | null;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { profile, loading } = useClerkAuth();

  const [role, setRole] = useState<"student" | "teacher" | null>(null);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [data, setData] = useState<Data>({
    firstName: "", lastName: "", level: "", session: "", subjects: [], target: "", studyDays: "",
    confidence: {}, experience: "", school: "", schoolType: "", teachesAtSchool: null,
  });

  // Prefill name from Clerk if present.
  useEffect(() => {
    if (user) setData((d) => ({ ...d, firstName: d.firstName || user.firstName || "", lastName: d.lastName || user.lastName || "" }));
  }, [user]);

  // Already onboarded → straight to the right place.
  useEffect(() => {
    if (!isLoaded) return;
    if (!user) { router.replace("/sign-in"); return; }
    if (!loading && profile?.onboarding_complete) {
      router.replace(profile.role === "teacher" ? "/teacher/dashboard" : profile.role === "admin" ? "/admin/dashboard" : "/student/dashboard");
    }
  }, [isLoaded, user, loading, profile, router]);

  const set = (patch: Partial<Data>) => setData((d) => ({ ...d, ...patch }));
  const go = (n: number) => { setDir(n > step ? 1 : -1); setStep(n); };
  const next = () => go(step + 1);
  const back = () => (step === 0 ? setRole(null) : go(step - 1));

  const onPhoto = (f: File | null) => {
    setPhotoFile(f);
    if (f) setPhotoPreview(URL.createObjectURL(f));
    else setPhotoPreview("");
  };

  // Step definitions per role (blocking vs skippable handled in the CTA).
  const studentSteps = ["name", "level", "session", "subjects", "target", "study", "confidence"];
  const teacherSteps = ["name", "experience", "school"];
  const steps = role === "teacher" ? teacherSteps : studentSteps;
  const blockingCount = role === "teacher" ? 3 : 4; // first N are required
  const currentKey = steps[step];
  const isLast = step === steps.length - 1;

  const canProceed = useMemo(() => {
    switch (currentKey) {
      case "name": return data.firstName.trim().length > 0;
      case "level": return !!data.level;
      case "session": return !!data.session;
      case "subjects": return data.subjects.length > 0;
      case "experience": return data.experience !== "";
      case "school": return data.teachesAtSchool === false || (data.teachesAtSchool === true && !!data.schoolType);
      default: return true; // skippable
    }
  }, [currentKey, data]);

  const finish = async () => {
    setSubmitting(true);
    setError("");
    try {
      // Name + optional photo → Clerk (best-effort).
      let photoUrl = "";
      try {
        if (user) {
          await user.update({ firstName: data.firstName.trim(), lastName: data.lastName.trim() || undefined });
          if (photoFile) { await user.setProfileImage({ file: photoFile }); photoUrl = user.imageUrl || ""; }
        }
      } catch { /* non-fatal */ }

      const payload: Record<string, unknown> = {
        role,
        full_name: `${data.firstName.trim()} ${data.lastName.trim()}`.trim(),
        photo_url: photoUrl || undefined,
      };
      if (role === "student") {
        Object.assign(payload, {
          level: data.level,
          exam_session: data.session,
          selected_subjects: data.subjects,
          target_grade: data.target || undefined,
          study_days: data.studyDays || undefined,
          subject_confidence: data.confidence,
        });
      } else {
        Object.assign(payload, {
          experience_years: data.experience ? Number(data.experience) : undefined,
          school_name: data.teachesAtSchool ? data.school : "",
          school_type: data.teachesAtSchool ? data.schoolType : "none",
        });
      }

      const res = await apiCall("/auth/complete-onboarding", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Could not finish onboarding");
      }
      if (typeof window !== "undefined" && user?.id) window.localStorage.removeItem(`propel_profile_${user.id}`);
      // Seed the local subject store so Practice/Papers are populated immediately.
      if (role === "student") saveSelectedSubjects(data.subjects.map((n) => ({ id: subjectSlug(n), name: n })));
      window.location.href = role === "teacher" ? "/teacher/dashboard" : "/student/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  };

  // ---- Role picker (step -1) ----
  if (!role) {
    return (
      <Shell>
        <p className="ed-eyebrow">Welcome{user?.firstName ? `, ${user.firstName}` : ""}</p>
        <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mt-2">
          How will you use <span className="italic text-crimson">Propel</span>?
        </h1>
        <p className="text-ink-muted mt-2">Choose your role to get set up.</p>
        <div className="grid sm:grid-cols-2 gap-4 mt-8">
          <RoleCard icon={GraduationCap} tone="mint" title="I'm a Student" desc="Practise past papers, take assignments, track progress." onClick={() => { setRole("student"); setStep(0); }} />
          <RoleCard icon={School} tone="crimson" title="I'm a Teacher" desc="Create classes, set assignments, mark with AI, release results." onClick={() => { setRole("teacher"); setStep(0); }} />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Progress */}
      <div className="flex items-center gap-1.5 mb-8">
        {steps.map((_, i) => (
          <span key={i} className={`h-1.5 rounded-full transition-all ${i <= step ? "bg-crimson" : "bg-surface-soft"} ${i === step ? "w-8" : "w-4"}`} />
        ))}
      </div>

      <div className="min-h-[280px]">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={currentKey}
            custom={dir}
            initial={{ x: dir > 0 ? 40 : -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: dir > 0 ? -40 : 40, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {currentKey === "name" && (
              <Step title="What should we call you?">
                <div className="flex items-center gap-4 mb-5">
                  <button onClick={() => fileRef.current?.click()} className="relative grid h-20 w-20 place-items-center rounded-full bg-surface-soft border border-line overflow-hidden group">
                    {photoPreview ? <img src={photoPreview} alt="" className="h-full w-full object-cover" /> : <Camera size={22} className="text-ink-faint" />}
                    <span className="absolute inset-0 bg-ink/40 opacity-0 group-hover:opacity-100 grid place-items-center text-paper text-[0.6rem] transition-opacity">Change</span>
                  </button>
                  <div className="text-sm text-ink-muted">Add a profile photo <span className="text-ink-faint">(optional)</span></div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0] || null)} />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div><label className="ed-label">First name</label><input value={data.firstName} onChange={(e) => set({ firstName: e.target.value })} className="ed-input mt-1 px-3 py-2.5 text-sm" autoFocus /></div>
                  <div><label className="ed-label">Last name <span className="text-ink-faint">(optional)</span></label><input value={data.lastName} onChange={(e) => set({ lastName: e.target.value })} className="ed-input mt-1 px-3 py-2.5 text-sm" /></div>
                </div>
              </Step>
            )}

            {currentKey === "level" && (
              <Step title="What are you studying for?">
                <Choices options={role === "teacher" ? ["O Level", "A Level", "Both"] : ["O Level", "A Level", "Both"]} value={data.level} onChange={(v) => { set({ level: v }); }} />
              </Step>
            )}

            {currentKey === "session" && (
              <Step title="When's your next exam session?" subtitle="Drives your countdown and datesheet.">
                <Choices options={SESSIONS} value={data.session} onChange={(v) => set({ session: v })} />
              </Step>
            )}

            {currentKey === "subjects" && (
              <Step title="Which subjects are you taking?" subtitle="Pick all that apply — you can change these later.">
                <div className="flex flex-wrap gap-2">
                  {SUBJECTS.map((s) => {
                    const on = data.subjects.includes(s);
                    return (
                      <button key={s} onClick={() => set({ subjects: on ? data.subjects.filter((x) => x !== s) : [...data.subjects, s] })}
                        className={`rounded-full px-3.5 py-2 text-sm font-medium border transition-colors ${on ? "border-crimson bg-crimson-soft text-crimson-ink" : "border-line text-ink-muted hover:bg-surface-soft"}`}>
                        {on && <Check size={13} className="inline mr-1 -mt-0.5" />}{s}
                      </button>
                    );
                  })}
                </div>
              </Step>
            )}

            {currentKey === "target" && (
              <Step title="What grade are you aiming for?" subtitle="Optional — sets your readiness target.">
                <Choices options={GRADES} value={data.target} onChange={(v) => set({ target: v })} />
              </Step>
            )}

            {currentKey === "study" && (
              <Step title="How many days a week can you study?" subtitle="Optional — sets your planner baseline.">
                <Choices options={STUDY.map((s) => s.label)} value={STUDY.find((s) => s.key === data.studyDays)?.label || ""} onChange={(label) => set({ studyDays: STUDY.find((s) => s.label === label)?.key || "" })} />
              </Step>
            )}

            {currentKey === "confidence" && (
              <Step title="How do you feel about each subject?" subtitle="Optional — sets your starting point; it updates as you solve.">
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {data.subjects.map((s) => (
                    <div key={s} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-ink">{s}</span>
                      <div className="flex gap-1.5">
                        {["Strong", "Okay", "Weak"].map((c) => (
                          <button key={c} onClick={() => set({ confidence: { ...data.confidence, [s]: c.toLowerCase() } })}
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold border ${data.confidence[s] === c.toLowerCase() ? "border-crimson bg-crimson-soft text-crimson-ink" : "border-line text-ink-muted"}`}>{c}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Step>
            )}

            {currentKey === "experience" && (
              <Step title="How many years have you been teaching?">
                <input type="number" min={0} max={60} value={data.experience} onChange={(e) => set({ experience: e.target.value })} placeholder="e.g. 8" className="ed-input px-3 py-2.5 text-sm w-40" autoFocus />
              </Step>
            )}

            {currentKey === "school" && (
              <Step title="Where do you teach?">
                <p className="text-sm text-ink-muted mb-3">Do you teach at a school?</p>
                <div className="flex gap-2 mb-4">
                  <button onClick={() => set({ teachesAtSchool: true })} className={`rounded-xl border px-5 py-2.5 text-sm font-semibold ${data.teachesAtSchool === true ? "border-crimson bg-crimson-soft text-crimson-ink" : "border-line text-ink-muted"}`}>Yes</button>
                  <button onClick={() => set({ teachesAtSchool: false, school: "", schoolType: "none" })} className={`rounded-xl border px-5 py-2.5 text-sm font-semibold ${data.teachesAtSchool === false ? "border-crimson bg-crimson-soft text-crimson-ink" : "border-line text-ink-muted"}`}>No, I teach independently</button>
                </div>
                {data.teachesAtSchool && (
                  <div className="space-y-3">
                    <div><label className="ed-label">School name</label><input value={data.school} onChange={(e) => set({ school: e.target.value })} placeholder="e.g. City Grammar School" className="ed-input mt-1 px-3 py-2.5 text-sm" /></div>
                    <div>
                      <label className="ed-label">Type</label>
                      <div className="flex gap-2 mt-1">
                        {["private", "public"].map((t) => (
                          <button key={t} onClick={() => set({ schoolType: t })} className={`rounded-xl border px-5 py-2 text-sm font-semibold capitalize ${data.schoolType === t ? "border-crimson bg-crimson-soft text-crimson-ink" : "border-line text-ink-muted"}`}>{t}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </Step>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {error && <p className="text-sm text-crimson mt-3">{error}</p>}

      {/* Nav */}
      <div className="flex items-center justify-between mt-8">
        <button onClick={back} className="ed-btn-ghost px-4 py-2.5 text-sm"><ArrowLeft size={15} /> Back</button>
        <div className="flex items-center gap-2">
          {step >= blockingCount && !isLast && (
            <button onClick={next} className="text-sm text-ink-muted hover:text-ink px-3 py-2.5">Skip</button>
          )}
          {isLast ? (
            <button onClick={() => void finish()} disabled={submitting || !canProceed} className="ed-btn-primary px-6 py-2.5">
              {submitting ? "Setting up…" : "Finish"}
            </button>
          ) : (
            <button onClick={next} disabled={!canProceed} className="ed-btn-primary px-6 py-2.5">Continue <ArrowRight size={15} /></button>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper text-ink grid place-items-center px-4 py-10">
      <div className="w-full max-w-xl">{children}</div>
    </div>
  );
}

function Step({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-2xl font-semibold tracking-tight">{title}</h2>
      {subtitle && <p className="text-ink-muted text-sm mt-1">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

function Choices({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid sm:grid-cols-2 gap-2.5">
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)} className={`rounded-xl border px-4 py-3 text-sm font-semibold text-left transition-colors ${value === o ? "border-crimson bg-crimson-soft text-crimson-ink" : "border-line text-ink-muted hover:bg-surface-soft"}`}>
          {value === o && <Check size={14} className="inline mr-1.5 -mt-0.5" />}{o}
        </button>
      ))}
    </div>
  );
}

function RoleCard({ icon: Icon, tone, title, desc, onClick }: { icon: typeof School; tone: "mint" | "crimson"; title: string; desc: string; onClick: () => void }) {
  const toneCls = tone === "mint" ? "bg-mint-soft text-mint-ink" : "bg-crimson-soft text-crimson-ink";
  return (
    <button onClick={onClick} className="ed-card p-8 text-left hover:shadow-lg transition-shadow group">
      <span className={`grid h-14 w-14 place-items-center rounded-2xl ${toneCls} group-hover:scale-105 transition-transform`}><Icon size={28} /></span>
      <h2 className="font-display text-xl font-semibold mt-4">{title}</h2>
      <p className="text-ink-muted text-sm mt-1">{desc}</p>
      <span className="inline-block mt-4 text-sm font-semibold text-crimson">Continue →</span>
    </button>
  );
}
