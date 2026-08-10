"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronLeft, Clock, X } from "lucide-react";
import { Reveal } from "@/components/ui/Motion";
import QuestionBrowser from "@/components/teacher/assignment/QuestionBrowser";
import { PickedQuestion } from "@/lib/questionBank";
import {
  AssignmentRules,
  MarkSchemeVisibility,
  SourceMode,
  VISIBILITY_LABELS,
  createAssignment,
} from "@/lib/assignments";
import { Enrollment, TeacherClass, listClasses, listEnrollments } from "@/lib/teacherClasses";
import { syllabusByCode, syllabusLabel } from "@/lib/syllabus";

export default function NewAssignmentPage() {
  return (
    <Suspense fallback={<div className="p-8 text-ink-muted">Loading…</div>}>
      <Builder />
    </Suspense>
  );
}

function Builder() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetClassId = searchParams?.get("class_id") || "";

  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [classId, setClassId] = useState(presetClassId);
  const [title, setTitle] = useState("");
  const [step, setStep] = useState(1);

  const [cart, setCart] = useState<Map<string, PickedQuestion>>(new Map());
  const [sourceMode, setSourceMode] = useState<SourceMode>("selected");
  const [sourceMeta, setSourceMeta] = useState<Record<string, unknown>>({});

  const [rules, setRules] = useState<AssignmentRules>({
    deadline_at: "",
    timed: false,
    duration_minutes: 60,
    attempt_limit: 1,
    mark_scheme_visibility: "after_release",
  });

  const [targetAll, setTargetAll] = useState(true);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [recipientIds, setRecipientIds] = useState<Set<string>>(new Set());

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const all = await listClasses();
      setClasses(all.filter((c) => !c.archived && (c.can_grade ?? c.is_owner ?? true)));
    })();
  }, []);

  const selectedClass = classes.find((c) => c.id === classId) || null;

  useEffect(() => {
    if (!classId) return;
    void (async () => {
      try {
        setEnrollments(await listEnrollments(classId, "active"));
      } catch {
        setEnrollments([]);
      }
    })();
  }, [classId]);

  const cartArray = useMemo(() => Array.from(cart.values()), [cart]);
  const cartKeys = useMemo(() => new Set(cart.keys()), [cart]);
  const totalMarks = cartArray.reduce((s, i) => s + i.marks, 0);
  const estMinutes = Math.round(totalMarks * 1.5);

  const addQuestion = (q: PickedQuestion) =>
    setCart((prev) => {
      const next = new Map(prev);
      if (!next.has(q.key)) next.set(q.key, q);
      return next;
    });
  const addMany = (qs: PickedQuestion[]) =>
    setCart((prev) => {
      const next = new Map(prev);
      for (const q of qs) if (!next.has(q.key)) next.set(q.key, q);
      return next;
    });
  const removeQuestion = (key: string) =>
    setCart((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });

  const canProceedStep1 = classId && title.trim() && cart.size > 0;

  const submit = async (status: "draft" | "published" | "scheduled") => {
    setSaving(true);
    setError("");
    try {
      const questions = cartArray.map((item, i) => ({
        source: item.source,
        question_uid: item.question_uid,
        custom_question_id: item.custom_question_id,
        question_ref: item.question_ref,
        marks: item.marks,
        order_index: i,
        snapshot: item.snapshot,
      }));
      const created = await createAssignment({
        class_id: classId,
        title: title.trim(),
        source_mode: sourceMode,
        source_meta: sourceMeta,
        questions,
        rules: {
          ...rules,
          deadline_at: rules.deadline_at ? new Date(rules.deadline_at).toISOString() : null,
        },
        target_all: targetAll,
        recipient_ids: targetAll ? [] : Array.from(recipientIds),
        status,
        scheduled_publish_at:
          status === "scheduled" && rules.deadline_at ? new Date(rules.deadline_at).toISOString() : null,
      });
      router.push(`/teacher/assignments/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create assignment");
      setSaving(false);
    }
  };

  return (
    <div className="px-4 md:px-8 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <button onClick={() => router.push("/teacher/assignments")} className="text-sm text-ink-muted hover:text-ink inline-flex items-center gap-1">
          <ChevronLeft size={15} /> Assignments
        </button>

        <Reveal>
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">
              New <span className="italic text-crimson">assignment</span>
            </h1>
            <StepBar step={step} />
          </div>
        </Reveal>

        {error && <p className="text-sm text-crimson">{error}</p>}

        {step === 1 && (
          <div className="grid lg:grid-cols-[1fr_320px] gap-6">
            <div className="space-y-5">
              <div className="ed-card p-5 space-y-4">
                <div>
                  <label className="ed-label">Class</label>
                  <select
                    value={classId}
                    onChange={(e) => {
                      setClassId(e.target.value);
                      setCart(new Map());
                    }}
                    className="ed-input mt-1 px-3 py-2.5 text-sm"
                  >
                    <option value="">Select a class…</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {syllabusLabel(c.syllabus_code)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="ed-label">Assignment title</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Organic Chemistry — June 2023 P4"
                    className="ed-input mt-1 px-3 py-2.5 text-sm"
                  />
                </div>
              </div>

              {selectedClass ? (
                <div className="ed-card p-5">
                  <h2 className="font-display text-lg font-semibold mb-3">Choose questions</h2>
                  <QuestionBrowser
                    subject={syllabusByCode(selectedClass.syllabus_code)?.subject || selectedClass.subject}
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
                <div className="ed-card p-6 text-center text-ink-muted">Select a class to browse its question bank.</div>
              )}
            </div>

            <CartPanel
              items={cartArray}
              totalMarks={totalMarks}
              estMinutes={estMinutes}
              onRemove={removeQuestion}
            />
          </div>
        )}

        {step === 2 && (
          <RulesStep rules={rules} setRules={setRules} totalMarks={totalMarks} />
        )}

        {step === 3 && (
          <RecipientsStep
            targetAll={targetAll}
            setTargetAll={setTargetAll}
            enrollments={enrollments}
            recipientIds={recipientIds}
            setRecipientIds={setRecipientIds}
          />
        )}

        {/* Footer nav */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <div>
            {step > 1 && (
              <button onClick={() => setStep(step - 1)} className="ed-btn-ghost px-4 py-2.5">
                Back
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && !canProceedStep1}
                className="ed-btn-primary px-5 py-2.5"
              >
                Continue
              </button>
            ) : (
              <>
                <button onClick={() => void submit("draft")} disabled={saving} className="ed-btn-ghost px-4 py-2.5">
                  Save draft
                </button>
                {rules.deadline_at && new Date(rules.deadline_at) > new Date() && (
                  <button onClick={() => void submit("scheduled")} disabled={saving} className="ed-btn-ghost px-4 py-2.5">
                    Schedule
                  </button>
                )}
                <button onClick={() => void submit("published")} disabled={saving} className="ed-btn-primary px-5 py-2.5">
                  {saving ? "Publishing…" : "Publish now"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepBar({ step }: { step: number }) {
  const labels = ["Questions", "Rules", "Recipients"];
  return (
    <div className="flex items-center gap-2 mt-3">
      {labels.map((l, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <div key={l} className="flex items-center gap-2">
            <span
              className={`grid h-6 w-6 place-items-center rounded-full text-[0.7rem] font-bold ${
                active ? "bg-crimson text-paper" : done ? "bg-mint text-paper" : "bg-surface-soft text-ink-faint"
              }`}
            >
              {done ? <Check size={12} /> : n}
            </span>
            <span className={`text-sm ${active ? "text-ink font-semibold" : "text-ink-faint"}`}>{l}</span>
            {n < 3 && <span className="w-6 h-px bg-line" />}
          </div>
        );
      })}
    </div>
  );
}

function CartPanel({
  items,
  totalMarks,
  estMinutes,
  onRemove,
}: {
  items: PickedQuestion[];
  totalMarks: number;
  estMinutes: number;
  onRemove: (key: string) => void;
}) {
  return (
    <div className="ed-card p-4 h-fit lg:sticky lg:top-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-ink">Selected</h3>
        <span className="ed-pill-crimson text-[0.65rem]">{items.length}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="ed-card-soft p-2 text-center">
          <p className="ed-label">Marks</p>
          <p className="font-display text-lg font-semibold">{totalMarks}</p>
        </div>
        <div className="ed-card-soft p-2 text-center">
          <p className="ed-label">~ Duration</p>
          <p className="font-display text-lg font-semibold">{estMinutes}m</p>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-ink-faint">No questions selected yet.</p>
      ) : (
        <div className="space-y-1.5 max-h-[340px] overflow-y-auto">
          {items.map((it) => (
            <div key={it.key} className="flex items-center gap-2 text-sm">
              <span className="font-mono text-xs text-ink-faint shrink-0">{it.questionNumber}</span>
              <span className="truncate flex-1 text-ink">{it.topic || it.text.slice(0, 30)}</span>
              <span className="text-xs text-ink-faint">{it.marks}</span>
              <button onClick={() => onRemove(it.key)} className="text-ink-faint hover:text-crimson">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RulesStep({
  rules,
  setRules,
  totalMarks,
}: {
  rules: AssignmentRules;
  setRules: (r: AssignmentRules) => void;
  totalMarks: number;
}) {
  return (
    <div className="ed-card p-6 max-w-2xl space-y-5">
      <div>
        <label className="ed-label">Deadline</label>
        <input
          type="datetime-local"
          value={rules.deadline_at || ""}
          onChange={(e) => setRules({ ...rules, deadline_at: e.target.value })}
          className="ed-input mt-1 px-3 py-2.5 text-sm"
        />
        <p className="text-xs text-ink-faint mt-1">Shown to students in their own timezone.</p>
      </div>

      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={rules.timed}
            onChange={(e) => setRules({ ...rules, timed: e.target.checked })}
            className="accent-crimson"
          />
          <span className="font-medium text-ink">Timed assignment</span>
        </label>
        {rules.timed && (
          <div className="mt-2 flex items-center gap-2">
            <Clock size={15} className="text-ink-faint" />
            <input
              type="number"
              min={1}
              value={rules.duration_minutes ?? 60}
              onChange={(e) => setRules({ ...rules, duration_minutes: Number(e.target.value) })}
              className="ed-input px-3 py-2 text-sm w-28"
            />
            <span className="text-sm text-ink-muted">minutes</span>
          </div>
        )}
      </div>

      <div>
        <label className="ed-label">Attempts allowed</label>
        <select
          value={rules.attempt_limit === null ? "unlimited" : String(rules.attempt_limit ?? 1)}
          onChange={(e) =>
            setRules({ ...rules, attempt_limit: e.target.value === "unlimited" ? null : Number(e.target.value) })
          }
          className="ed-input mt-1 px-3 py-2.5 text-sm w-40"
        >
          {["1", "2", "3", "unlimited"].map((v) => (
            <option key={v} value={v}>
              {v === "unlimited" ? "Unlimited" : v}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="ed-label">Mark scheme visibility</label>
        <select
          value={rules.mark_scheme_visibility}
          onChange={(e) => setRules({ ...rules, mark_scheme_visibility: e.target.value as MarkSchemeVisibility })}
          className="ed-input mt-1 px-3 py-2.5 text-sm"
        >
          {(Object.keys(VISIBILITY_LABELS) as MarkSchemeVisibility[]).map((v) => (
            <option key={v} value={v}>
              {VISIBILITY_LABELS[v]}
            </option>
          ))}
        </select>
        <p className="text-xs text-ink-faint mt-1">
          Default is after results released — showing the scheme earlier invalidates AI marking.
        </p>
      </div>

      <div className="ed-card-soft p-3 text-sm text-ink-muted">
        Total marks: <span className="font-semibold text-ink">{totalMarks}</span>
      </div>
    </div>
  );
}

function RecipientsStep({
  targetAll,
  setTargetAll,
  enrollments,
  recipientIds,
  setRecipientIds,
}: {
  targetAll: boolean;
  setTargetAll: (v: boolean) => void;
  enrollments: Enrollment[];
  recipientIds: Set<string>;
  setRecipientIds: (s: Set<string>) => void;
}) {
  const toggle = (id: string) => {
    const next = new Set(recipientIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setRecipientIds(next);
  };

  return (
    <div className="ed-card p-6 max-w-2xl space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setTargetAll(true)}
          className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
            targetAll ? "border-crimson bg-crimson-soft text-crimson-ink" : "border-line text-ink-muted"
          }`}
        >
          Whole class ({enrollments.length})
        </button>
        <button
          onClick={() => setTargetAll(false)}
          className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
            !targetAll ? "border-crimson bg-crimson-soft text-crimson-ink" : "border-line text-ink-muted"
          }`}
        >
          Selected students
        </button>
      </div>

      {!targetAll && (
        <div className="space-y-1.5 max-h-[360px] overflow-y-auto">
          {enrollments.length === 0 ? (
            <p className="text-sm text-ink-faint">No active students in this class.</p>
          ) : (
            enrollments.map((e) => {
              const checked = recipientIds.has(e.student_clerk_id);
              return (
                <button
                  key={e.id}
                  onClick={() => toggle(e.student_clerk_id)}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left border ${
                    checked ? "border-crimson bg-crimson-soft" : "border-line"
                  }`}
                >
                  <span className={`grid h-5 w-5 place-items-center rounded ${checked ? "bg-crimson text-paper" : "border border-line"}`}>
                    {checked && <Check size={12} />}
                  </span>
                  <span className="text-sm text-ink">{e.full_name || e.email || "Student"}</span>
                </button>
              );
            })
          )}
        </div>
      )}

      {!targetAll && (
        <p className="text-sm text-ink-muted">
          {recipientIds.size} student{recipientIds.size === 1 ? "" : "s"} selected.
        </p>
      )}
    </div>
  );
}
