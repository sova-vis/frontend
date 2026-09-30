"use client";

/**
 * New assignment builder (spec §5.2) — rebuilt on the shared `.pr` design system
 * to match the student side. Three steps: Questions → Settings → Who.
 *
 * Wires to the existing, stable backend: createAssignment (POST /assignments) +
 * setReleaseConfig for the manual-release default. Question selection reuses the
 * bank/custom engine via <QuestionPicker>. The new-spec choices that the schema
 * doesn't yet have columns for (answer method, marking mode) are captured in
 * source_meta so the submission (§5.3) and marking (§5.4) slices can honour them;
 * release mode maps directly onto auto_release today.
 */
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/propel/Icon";
import { Segmented, useToast } from "@/components/propel/primitives";
import QuestionPicker from "@/components/teacher/assignment/QuestionPicker";
import { PickedQuestion, toBankLevel } from "@/lib/questionBank";
import {
  AssignmentRules, MarkSchemeVisibility, SourceMode, VISIBILITY_LABELS, createAssignment,
} from "@/lib/assignments";
import { setReleaseConfig } from "@/lib/feedbackRelease";
import { Enrollment, TeacherClass, listClasses, listEnrollments } from "@/lib/teacherClasses";
import { syllabusByCode, syllabusLabel } from "@/lib/syllabus";
import { resolveName } from "@/lib/displayName";

type AnswerMethod = "handwritten" | "typed" | "either";
type MarkingMode = "on_request" | "automatic";
type ReleaseMode = "manual" | "automatic";

const STEPS = ["Questions", "Settings", "Who"];

export default function NewAssignmentPage() {
  return (
    <Suspense fallback={<div className="sk" style={{ height: 360, borderRadius: 18 }} />}>
      <Builder />
    </Suspense>
  );
}

function Builder() {
  const router = useRouter();
  const toast = useToast();
  const search = useSearchParams();
  const presetClassId = search?.get("class_id") || "";

  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [classId, setClassId] = useState(presetClassId);
  const [title, setTitle] = useState("");
  const [step, setStep] = useState(1);

  const [cart, setCart] = useState<Map<string, PickedQuestion>>(new Map());
  const [sourceMode, setSourceMode] = useState<SourceMode>("selected");
  const [sourceMeta, setSourceMeta] = useState<Record<string, unknown>>({});

  const [rules, setRules] = useState<AssignmentRules>({
    deadline_at: "", timed: false, duration_minutes: 60, attempt_limit: 1,
    mark_scheme_visibility: "after_release",
  });
  const [answerMethod, setAnswerMethod] = useState<AnswerMethod>("handwritten");
  const [markingMode, setMarkingMode] = useState<MarkingMode>("on_request");
  const [releaseMode, setReleaseMode] = useState<ReleaseMode>("manual");

  const [targetAll, setTargetAll] = useState(true);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [recipientIds, setRecipientIds] = useState<Set<string>>(new Set());

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const all = await listClasses();
        setClasses(all.filter((c) => !c.archived && (c.can_grade ?? c.is_owner ?? true)));
      } catch (e) { setError((e as Error).message); }
    })();
  }, []);

  const selectedClass = classes.find((c) => c.id === classId) || null;

  useEffect(() => {
    if (!classId) { setEnrollments([]); return; }
    void (async () => {
      try { setEnrollments(await listEnrollments(classId, "active")); }
      catch { setEnrollments([]); }
    })();
  }, [classId]);

  const cartArray = useMemo(() => Array.from(cart.values()), [cart]);
  const cartKeys = useMemo(() => new Set(cart.keys()), [cart]);
  const totalMarks = cartArray.reduce((s, i) => s + i.marks, 0);
  const estMinutes = Math.max(5, Math.round(totalMarks * 1.5));

  const addQuestion = (q: PickedQuestion) => setCart((prev) => { const n = new Map(prev); if (!n.has(q.key)) n.set(q.key, q); return n; });
  const addMany = (qs: PickedQuestion[]) => setCart((prev) => { const n = new Map(prev); for (const q of qs) if (!n.has(q.key)) n.set(q.key, q); return n; });
  const removeQuestion = (key: string) => setCart((prev) => { const n = new Map(prev); n.delete(key); return n; });

  const canStep1 = !!classId && !!title.trim() && cart.size > 0;

  const submit = async (status: "draft" | "published" | "scheduled") => {
    setSaving(true); setError("");
    try {
      const questions = cartArray.map((item, i) => ({
        source: item.source, question_uid: item.question_uid, custom_question_id: item.custom_question_id,
        question_ref: item.question_ref, marks: item.marks, order_index: i, snapshot: item.snapshot,
      }));
      const deadlineIso = rules.deadline_at ? new Date(rules.deadline_at).toISOString() : null;
      const created = await createAssignment({
        class_id: classId,
        title: title.trim(),
        source_mode: sourceMode,
        source_meta: { ...sourceMeta, answer_method: answerMethod, marking_mode: markingMode },
        questions,
        rules: { ...rules, deadline_at: deadlineIso },
        target_all: targetAll,
        recipient_ids: targetAll ? [] : Array.from(recipientIds),
        status,
        scheduled_publish_at: status === "scheduled" ? deadlineIso : null,
      });
      // Manual release is the default (§5.2); auto_release defaults TRUE in the DB
      // so we set it explicitly. Non-fatal — the assignment already exists.
      try { await setReleaseConfig(created.id, { auto_release: releaseMode === "automatic" }); } catch { /* ignore */ }
      toast(status === "draft" ? "Draft saved" : status === "scheduled" ? "Scheduled" : "Assignment published", "check_circle");
      router.push(`/teacher/assignments/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create assignment");
      setSaving(false);
    }
  };

  const deadlineFuture = !!rules.deadline_at && new Date(rules.deadline_at) > new Date();

  return (
    <>
      <style>{`
        .asn-grid { display:grid; grid-template-columns: minmax(0,1fr); gap:20px; align-items:start; }
        @media (min-width: 980px){ .asn-grid { grid-template-columns: minmax(0,1fr) 320px; } .asn-cart { position: sticky; top: 88px; } }
      `}</style>

      <Link href="/teacher/assignments" className="chip" style={{ marginBottom: 18 }}><Icon name="chevron_left" size={15} /> Assignments</Link>

      <div style={{ marginBottom: 22 }}>
        <h1 className="big-num" style={{ fontSize: 28 }}>New assignment</h1>
        <StepBar step={step} />
      </div>

      {error && (
        <div className="card" style={{ padding: "12px 16px", marginBottom: 16, background: "var(--coral-soft, var(--crimson-soft))", border: "1px solid var(--coral)", color: "var(--coral)", fontSize: 13.5 }}>{error}</div>
      )}

      {step === 1 && (
        <div className="asn-grid">
          <div className="grid" style={{ gap: 16 }}>
            <div className="card card-pad grid" style={{ gap: 14 }}>
              <div>
                <label className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Class</label>
                <select className="input" value={classId} onChange={(e) => { setClassId(e.target.value); setCart(new Map()); }}>
                  <option value="">Select a class…</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.subject || syllabusLabel(c.syllabus_code)}</option>)}
                </select>
              </div>
              <div>
                <label className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Assignment title</label>
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Organic Chemistry — June 2023 P4" />
              </div>
            </div>

            {selectedClass ? (
              <div className="card card-pad">
                <h2 style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 18, fontWeight: 600, marginBottom: 14 }}>Choose questions</h2>
                <QuestionPicker
                  subject={selectedClass.subject || syllabusByCode(selectedClass.syllabus_code)?.subject || ""}
                  level={toBankLevel(selectedClass.level)}
                  cartKeys={cartKeys}
                  onAdd={addQuestion}
                  onAddMany={addMany}
                  onRemove={removeQuestion}
                  onModeChange={(m, meta) => {
                    setSourceMode(m === "paper" ? "full_paper" : m === "topic" ? "topic" : "selected");
                    setSourceMeta(meta);
                  }}
                />
              </div>
            ) : (
              <div className="card card-pad" style={{ textAlign: "center" }}>
                <p className="muted" style={{ fontSize: 14 }}>Select a class to browse its question bank.</p>
              </div>
            )}
          </div>

          <div className="asn-cart">
            <Cart items={cartArray} totalMarks={totalMarks} estMinutes={estMinutes} onRemove={removeQuestion} />
          </div>
        </div>
      )}

      {step === 2 && (
        <SettingsStep
          rules={rules} setRules={setRules} totalMarks={totalMarks}
          answerMethod={answerMethod} setAnswerMethod={setAnswerMethod}
          markingMode={markingMode} setMarkingMode={setMarkingMode}
          releaseMode={releaseMode} setReleaseMode={setReleaseMode}
        />
      )}

      {step === 3 && (
        <RecipientsStep
          targetAll={targetAll} setTargetAll={setTargetAll}
          enrollments={enrollments} recipientIds={recipientIds} setRecipientIds={setRecipientIds}
        />
      )}

      {/* Footer nav */}
      <div className="row-between" style={{ marginTop: 22, gap: 12 }}>
        <div>
          {step > 1 && <button className="btn btn-ghost" onClick={() => setStep(step - 1)}><Icon name="chevron_left" size={16} /> Back</button>}
        </div>
        <div className="flex gap-8">
          {step < 3 ? (
            <button className="btn btn-primary" disabled={step === 1 && !canStep1} onClick={() => setStep(step + 1)}>
              Continue <Icon name="chevron_right" size={16} />
            </button>
          ) : (
            <>
              <button className="btn btn-ghost" disabled={saving} onClick={() => void submit("draft")}>Save draft</button>
              {deadlineFuture && <button className="btn btn-secondary" disabled={saving} onClick={() => void submit("scheduled")}><Icon name="calendar" size={15} /> Schedule</button>}
              <button className="btn btn-primary" disabled={saving} onClick={() => void submit("published")}>
                {saving ? "Publishing…" : <><Icon name="send" size={15} /> Publish now</>}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function StepBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-8 wrap" style={{ marginTop: 12 }}>
      {STEPS.map((l, i) => {
        const n = i + 1, active = n === step, done = n < step;
        return (
          <div key={l} className="flex items-center gap-8">
            <span style={{
              width: 24, height: 24, borderRadius: 99, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700,
              background: active ? "var(--crimson)" : done ? "var(--teal)" : "var(--surface-2)",
              color: active || done ? "#fff" : "var(--ink-faint)",
            }}>{done ? <Icon name="check_circle" size={14} /> : n}</span>
            <span style={{ fontSize: 13.5, fontWeight: active ? 600 : 500, color: active ? "var(--ink)" : "var(--ink-faint)" }}>{l}</span>
            {n < STEPS.length && <span style={{ width: 22, height: 1, background: "var(--line)" }} />}
          </div>
        );
      })}
    </div>
  );
}

function Cart({ items, totalMarks, estMinutes, onRemove }: { items: PickedQuestion[]; totalMarks: number; estMinutes: number; onRemove: (key: string) => void }) {
  return (
    <div className="card card-pad">
      <div className="row-between" style={{ marginBottom: 12 }}>
        <span className="eyebrow">Selected</span>
        <span className="chip-tag" style={{ background: "var(--crimson-soft)", color: "var(--crimson)" }}>{items.length}</span>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <div style={{ background: "var(--surface-2)", borderRadius: 12, padding: "10px 12px", textAlign: "center" }}>
          <div className="eyebrow">Marks</div>
          <div className="big-num" style={{ fontSize: 22 }}>{totalMarks}</div>
        </div>
        <div style={{ background: "var(--surface-2)", borderRadius: 12, padding: "10px 12px", textAlign: "center" }}>
          <div className="eyebrow">~ Time</div>
          <div className="big-num" style={{ fontSize: 22 }}>{estMinutes}m</div>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="faint" style={{ fontSize: 13 }}>No questions selected yet. Add some from the bank.</p>
      ) : (
        <div className="grid" style={{ gap: 6, maxHeight: 360, overflowY: "auto" }}>
          {items.map((it) => (
            <div key={it.key} className="flex items-center gap-8" style={{ fontSize: 13 }}>
              <span className="mono faint" style={{ fontSize: 11.5, flex: "none" }}>{it.questionNumber || "—"}</span>
              <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.topic || it.text.slice(0, 34) || "Question"}</span>
              <span className="faint" style={{ fontSize: 12, flex: "none" }}>{it.marks}</span>
              <button onClick={() => onRemove(it.key)} style={{ flex: "none", color: "var(--ink-faint)" }} aria-label="Remove"><Icon name="x" size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="eyebrow" style={{ display: "block", marginBottom: 8 }}>{label}</label>
      {children}
      {hint && <p className="faint" style={{ fontSize: 12, marginTop: 6 }}>{hint}</p>}
    </div>
  );
}

function SettingsStep({
  rules, setRules, totalMarks, answerMethod, setAnswerMethod, markingMode, setMarkingMode, releaseMode, setReleaseMode,
}: {
  rules: AssignmentRules; setRules: (r: AssignmentRules) => void; totalMarks: number;
  answerMethod: AnswerMethod; setAnswerMethod: (v: AnswerMethod) => void;
  markingMode: MarkingMode; setMarkingMode: (v: MarkingMode) => void;
  releaseMode: ReleaseMode; setReleaseMode: (v: ReleaseMode) => void;
}) {
  return (
    <div className="card card-pad grid" style={{ gap: 22, maxWidth: 720 }}>
      <Field label="Deadline" hint="Shown to each student in their own timezone. Leave empty for no fixed due date.">
        <input type="datetime-local" className="input" style={{ width: "auto", minWidth: 240 }}
          value={rules.deadline_at || ""} onChange={(e) => setRules({ ...rules, deadline_at: e.target.value })} />
      </Field>

      <Field label="Timed">
        <div className="flex items-center gap-12 wrap">
          <Switch on={!!rules.timed} onToggle={() => setRules({ ...rules, timed: !rules.timed })} label={rules.timed ? "On" : "Off"} />
          {rules.timed && (
            <div className="flex items-center gap-8">
              <Icon name="clock" size={16} style={{ color: "var(--ink-faint)" }} />
              <input type="number" min={1} className="input" style={{ width: 96 }}
                value={rules.duration_minutes ?? 60} onChange={(e) => setRules({ ...rules, duration_minutes: Number(e.target.value) })} />
              <span className="faint" style={{ fontSize: 13 }}>minutes</span>
            </div>
          )}
        </div>
      </Field>

      <Field label="How students answer" hint="Handwritten is the default — students photograph their working and it's read automatically.">
        <Segmented<AnswerMethod>
          options={[{ value: "handwritten", label: "Handwritten" }, { value: "typed", label: "Typed" }, { value: "either", label: "Either" }]}
          value={answerMethod} onChange={setAnswerMethod}
        />
      </Field>

      <Field label="Attempts allowed">
        <Segmented<string>
          options={[{ value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" }, { value: "unlimited", label: "Unlimited" }]}
          value={rules.attempt_limit === null ? "unlimited" : String(rules.attempt_limit ?? 1)}
          onChange={(v) => setRules({ ...rules, attempt_limit: v === "unlimited" ? null : Number(v) })}
        />
      </Field>

      <div className="hr" />

      <Field label="Marking" hint="On request means you press Mark when you're ready — nothing is marked until you do.">
        <Segmented<MarkingMode>
          options={[{ value: "on_request", label: "On request" }, { value: "automatic", label: "Automatic on submit" }]}
          value={markingMode} onChange={setMarkingMode}
        />
      </Field>

      <Field label="Releasing results" hint="Manual means students see nothing until you review and release. This is the recommended default.">
        <Segmented<ReleaseMode>
          options={[{ value: "manual", label: "Manual" }, { value: "automatic", label: "Auto after review" }]}
          value={releaseMode} onChange={setReleaseMode}
        />
      </Field>

      <Field label="Mark scheme visibility" hint="Showing the scheme before results are released would invalidate AI marking.">
        <select className="input" style={{ maxWidth: 320 }}
          value={rules.mark_scheme_visibility}
          onChange={(e) => setRules({ ...rules, mark_scheme_visibility: e.target.value as MarkSchemeVisibility })}>
          {(Object.keys(VISIBILITY_LABELS) as MarkSchemeVisibility[]).map((v) => <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>)}
        </select>
      </Field>

      <div style={{ background: "var(--surface-2)", borderRadius: 12, padding: "12px 16px" }} className="row-between">
        <span className="muted" style={{ fontSize: 13.5 }}>Total marks</span>
        <span className="big-num" style={{ fontSize: 20 }}>{totalMarks}</span>
      </div>
    </div>
  );
}

function RecipientsStep({
  targetAll, setTargetAll, enrollments, recipientIds, setRecipientIds,
}: {
  targetAll: boolean; setTargetAll: (v: boolean) => void; enrollments: Enrollment[];
  recipientIds: Set<string>; setRecipientIds: (s: Set<string>) => void;
}) {
  const toggle = (id: string) => { const n = new Set(recipientIds); if (n.has(id)) n.delete(id); else n.add(id); setRecipientIds(n); };
  return (
    <div className="card card-pad grid" style={{ gap: 16, maxWidth: 620 }}>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <ChoiceTile on={targetAll} onClick={() => setTargetAll(true)} icon="users" title="Whole class" sub={`${enrollments.length} student${enrollments.length === 1 ? "" : "s"}`} />
        <ChoiceTile on={!targetAll} onClick={() => setTargetAll(false)} icon="filter" title="Selected students" sub={targetAll ? "Pick individuals" : `${recipientIds.size} selected`} />
      </div>

      {!targetAll && (
        enrollments.length === 0 ? (
          <p className="faint" style={{ fontSize: 13 }}>No active students in this class yet.</p>
        ) : (
          <div className="grid" style={{ gap: 8, maxHeight: 380, overflowY: "auto" }}>
            {enrollments.map((e) => {
              const checked = recipientIds.has(e.student_clerk_id);
              const name = resolveName({ full_name: e.full_name, email: e.email });
              return (
                <button key={e.id} onClick={() => toggle(e.student_clerk_id)} className="flex items-center gap-12"
                  style={{ textAlign: "left", padding: "10px 12px", borderRadius: 12, background: checked ? "var(--crimson-soft)" : "var(--surface-2)", border: `1px solid ${checked ? "var(--crimson)" : "transparent"}` }}>
                  <span style={{ width: 22, height: 22, borderRadius: 7, flex: "none", display: "grid", placeItems: "center", background: checked ? "var(--crimson)" : "var(--surface)", color: "#fff", border: checked ? "none" : "1px solid var(--line-strong)" }}>
                    {checked && <Icon name="check_circle" size={14} />}
                  </span>
                  <span style={{ fontSize: 14, color: "var(--ink)" }}>{name}</span>
                </button>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

function ChoiceTile({ on, onClick, icon, title, sub }: { on: boolean; onClick: () => void; icon: string; title: string; sub: string }) {
  return (
    <button onClick={onClick} className="grid" style={{
      gap: 6, padding: "16px 14px", borderRadius: 14, textAlign: "left",
      background: on ? "var(--crimson-soft)" : "var(--surface-2)", border: `1px solid ${on ? "var(--crimson)" : "transparent"}`,
    }}>
      <Icon name={icon} size={18} style={{ color: on ? "var(--crimson)" : "var(--ink-soft)" }} />
      <div style={{ fontWeight: 600, fontSize: 14.5, color: on ? "var(--crimson)" : "var(--ink)" }}>{title}</div>
      <div className="faint" style={{ fontSize: 12 }}>{sub}</div>
    </button>
  );
}

function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" onClick={onToggle} className="flex items-center gap-8" aria-pressed={on}>
      <span style={{ display: "inline-block", width: 44, height: 26, borderRadius: 99, background: on ? "var(--teal)" : "var(--line-strong)", position: "relative", transition: "background .2s", flex: "none" }}>
        <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "var(--shadow-sm)" }} />
      </span>
      <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink-soft)" }}>{label}</span>
    </button>
  );
}
