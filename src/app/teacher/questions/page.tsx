"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ImagePlus, Plus, Share2, Trash2, X } from "lucide-react";
import { Reveal } from "@/components/ui/Motion";
import {
  Criterion,
  CustomImage,
  CustomPart,
  CustomQuestion,
  CustomQuestionType,
  createCustomQuestion,
  deleteCustomQuestion,
  listCustomQuestions,
  updateCustomQuestion,
} from "@/lib/customQuestions";
import { TeacherClass, listClasses } from "@/lib/teacherClasses";

// Figures are stored inline as data URLs. Downscale on the client so a phone photo
// doesn't bloat the request/DB — long edge capped, re-encoded as JPEG.
async function fileToDownscaledDataUrl(file: File, maxDim = 1400, quality = 0.82): Promise<string> {
  const readAsDataUrl = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error("read failed"));
      fr.readAsDataURL(f);
    });
  const original = await readAsDataUrl(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("decode failed"));
      i.src = original;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    if (scale >= 1 && original.length < 400_000) return original;
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return original;
  }
}

export default function CustomQuestionsPage() {
  const [questions, setQuestions] = useState<CustomQuestion[]>([]);
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const [q, c] = await Promise.all([listCustomQuestions(), listClasses()]);
      setQuestions(q);
      setClasses(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const subjects = useMemo(() => Array.from(new Set(classes.map((c) => c.subject))).sort(), [classes]);

  const toggleShare = async (q: CustomQuestion) => {
    try {
      const updated = await updateCustomQuestion(q.id, { shared_to_institution: !q.shared_to_institution });
      setQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, shared_to_institution: updated.shared_to_institution } : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this custom question?")) return;
    try {
      await deleteCustomQuestion(id);
      setQuestions((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <div className="px-4 md:px-8 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Reveal>
          <Link href="/teacher/assignments" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink mb-3">
            <ArrowLeft size={15} /> Back to assignments
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">
                Custom <span className="italic text-crimson">Questions</span>
              </h1>
              <p className="text-ink-muted mt-1">Your own questions with discrete mark-scheme criteria — assignable and AI-marked like bank questions.</p>
            </div>
            <button onClick={() => setShowForm(true)} className="ed-btn-primary px-4 py-2.5">
              <Plus size={16} /> New question
            </button>
          </div>
        </Reveal>

        {error && <p className="text-sm text-crimson">{error}</p>}

        {loading ? (
          <div className="h-40 rounded-[1.25rem] bg-surface-soft animate-pulse" />
        ) : questions.length === 0 ? (
          <div className="ed-card p-10 text-center">
            <p className="text-ink-muted">No custom questions yet.</p>
            <button onClick={() => setShowForm(true)} className="ed-btn-primary mt-4 px-4 py-2.5 mx-auto">
              <Plus size={16} /> New question
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q) => (
              <div key={q.id} className="ed-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-xs text-ink-faint">
                      <span className="ed-pill-mint text-[0.6rem]">{q.subject}</span>
                      {q.topic && <span className="ed-pill-gold text-[0.6rem]">{q.topic}</span>}
                      <span>
                        {q.marks} marks · {q.criteria.length} criteria
                        {q.parts?.length ? ` · ${q.parts.length} part${q.parts.length > 1 ? "s" : ""}` : ""}
                        {(() => { const n = (q.images?.length ?? 0) + (q.parts?.reduce((s, p) => s + (p.images?.length ?? 0), 0) ?? 0); return n ? ` · ${n} figure${n > 1 ? "s" : ""}` : ""; })()}
                      </span>
                      {!q.is_owner && <span className="ed-pill-neutral text-[0.6rem]">Shared</span>}
                    </div>
                    <p className="text-sm text-ink mt-1.5">{q.question_text}</p>
                  </div>
                  {q.is_owner && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => void toggleShare(q)}
                        title={q.shared_to_institution ? "Shared to institution" : "Share to institution"}
                        className={`p-2 rounded-lg ${q.shared_to_institution ? "bg-mint-soft text-mint-ink" : "ed-btn-ghost"}`}
                      >
                        <Share2 size={14} />
                      </button>
                      <button onClick={() => void remove(q.id)} className="ed-btn-ghost p-2 text-crimson">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="mt-3 border-t border-line pt-2 space-y-1">
                  {q.criteria.map((c, i) => (
                    <div key={c.id ?? i} className="flex items-center gap-2 text-xs text-ink-muted">
                      <span className="font-mono text-ink-faint">{i + 1}.</span>
                      <span className="flex-1">{c.criterion_text}</span>
                      <span className="font-semibold">{c.marks}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <QuestionForm
          subjects={subjects}
          onClose={() => setShowForm(false)}
          onCreated={(q) => {
            setQuestions((prev) => [q, ...prev]);
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
}

function QuestionForm({
  subjects,
  onClose,
  onCreated,
}: {
  subjects: string[];
  onClose: () => void;
  onCreated: (q: CustomQuestion) => void;
}) {
  const [subject, setSubject] = useState(subjects[0] || "");
  const [topic, setTopic] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [type, setType] = useState<CustomQuestionType>("structured");
  const [criteria, setCriteria] = useState<Criterion[]>([{ criterion_text: "", marks: 1 }]);
  const [images, setImages] = useState<CustomImage[]>([]);
  const [parts, setParts] = useState<{ label: string; body: string; marks: number | ""; images: CustomImage[] }[]>([]);
  const [imgBusy, setImgBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const total = criteria.reduce((s, c) => s + (Number.isFinite(c.marks) ? c.marks : 0), 0);

  const setCriterion = (i: number, patch: Partial<Criterion>) =>
    setCriteria((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const addCriterion = () => setCriteria((prev) => [...prev, { criterion_text: "", marks: 1 }]);
  const removeCriterion = (i: number) => setCriteria((prev) => prev.filter((_, idx) => idx !== i));

  type DraftPart = { label: string; body: string; marks: number | ""; images: CustomImage[] };
  const addPart = () => setParts((prev) => [...prev, { label: `(${String.fromCharCode(97 + prev.length)})`, body: "", marks: "", images: [] }]);
  const setPart = (i: number, patch: Partial<DraftPart>) =>
    setParts((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const removePart = (i: number) => setParts((prev) => prev.filter((_, idx) => idx !== i));

  const uploadImages = async (files: FileList | null, target: "question" | number) => {
    if (!files || files.length === 0) return;
    setImgBusy(true);
    try {
      const imgs: CustomImage[] = [];
      for (const f of Array.from(files)) {
        if (!f.type.startsWith("image/")) continue;
        imgs.push({ data_url: await fileToDownscaledDataUrl(f), alt: f.name.replace(/\.[^.]+$/, "") });
      }
      if (imgs.length === 0) return;
      if (target === "question") setImages((prev) => [...prev, ...imgs]);
      else setParts((prev) => prev.map((p, idx) => (idx === target ? { ...p, images: [...p.images, ...imgs] } : p)));
    } finally {
      setImgBusy(false);
    }
  };
  const removeImage = (target: "question" | number, imgIdx: number) => {
    if (target === "question") setImages((prev) => prev.filter((_, i) => i !== imgIdx));
    else setParts((prev) => prev.map((p, idx) => (idx === target ? { ...p, images: p.images.filter((_, i) => i !== imgIdx) } : p)));
  };

  const submit = async () => {
    const cleaned = criteria.filter((c) => c.criterion_text.trim());
    if (!subject.trim() || !questionText.trim() || cleaned.length === 0) {
      setError("Subject, question text and at least one criterion are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const created = await createCustomQuestion({
        subject: subject.trim(),
        topic: topic.trim() || undefined,
        question_text: questionText.trim(),
        question_type: type,
        criteria: cleaned.map((c, i) => ({ criterion_text: c.criterion_text.trim(), marks: Number(c.marks) || 0, order_index: i })),
        images,
        parts: parts
          .map((p) => ({ label: p.label.trim(), body: p.body.trim(), marks: p.marks === "" ? null : Number(p.marks), images: p.images }))
          .filter((p) => p.body || p.images.length > 0),
      });
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-sm p-0 sm:p-4">
      <div className="ed-card w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-b-none sm:rounded-[1.25rem] p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl font-semibold tracking-tight">New custom question</h2>
          <button onClick={onClose} className="ed-btn-ghost p-2">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="ed-label">Subject</label>
              <input list="subject-list" value={subject} onChange={(e) => setSubject(e.target.value)} className="ed-input mt-1 px-3 py-2.5 text-sm" />
              <datalist id="subject-list">
                {subjects.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="ed-label">Topic</label>
              <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Alkenes" className="ed-input mt-1 px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="ed-label">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as CustomQuestionType)} className="ed-input mt-1 px-3 py-2.5 text-sm">
                <option value="structured">Structured</option>
                <option value="extended">Extended</option>
                <option value="mcq">MCQ</option>
              </select>
            </div>
          </div>

          <div>
            <label className="ed-label">Question</label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              rows={3}
              placeholder="Type the question as students will see it…"
              className="ed-input mt-1 px-3 py-2.5 text-sm resize-none"
            />
          </div>

          <div>
            <label className="ed-label">Figures <span className="font-normal text-ink-faint">(optional)</span></label>
            <ImageRow images={images} onAdd={(files) => void uploadImages(files, "question")} onRemove={(i) => removeImage("question", i)} busy={imgBusy} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="ed-label">Parts <span className="font-normal text-ink-faint">(optional — split into (a), (b)…)</span></label>
              <button onClick={addPart} className="ed-btn-ghost px-3 py-1.5 text-xs">
                <Plus size={13} /> Add part
              </button>
            </div>
            {parts.length === 0 ? (
              <p className="text-xs text-ink-faint">Single-prompt question. Add parts to break it into (a), (b), … each with its own figures.</p>
            ) : (
              <div className="space-y-3">
                {parts.map((p, i) => (
                  <div key={i} className="rounded-xl border border-line p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <input value={p.label} onChange={(e) => setPart(i, { label: e.target.value })} placeholder="(a)" className="ed-input px-2 py-1.5 text-sm w-16" />
                      <input type="number" min={0} value={p.marks} onChange={(e) => setPart(i, { marks: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="marks" className="ed-input px-2 py-1.5 text-sm w-20" />
                      <span className="flex-1" />
                      <button onClick={() => removePart(i)} className="p-1 text-ink-faint hover:text-crimson" title="Remove part">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <textarea value={p.body} onChange={(e) => setPart(i, { body: e.target.value })} rows={2} placeholder="Part prompt…" className="ed-input px-3 py-2 text-sm resize-none" />
                    <ImageRow images={p.images} onAdd={(files) => void uploadImages(files, i)} onRemove={(idx) => removeImage(i, idx)} busy={imgBusy} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="ed-label">Mark scheme criteria</label>
              <span className="text-xs text-ink-muted">Total: <span className="font-semibold text-ink">{total}</span> marks</span>
            </div>
            <div className="space-y-2">
              {criteria.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="font-mono text-xs text-ink-faint w-5">{i + 1}.</span>
                  <input
                    value={c.criterion_text}
                    onChange={(e) => setCriterion(i, { criterion_text: e.target.value })}
                    placeholder="What earns the mark…"
                    className="ed-input px-3 py-2 text-sm flex-1"
                  />
                  <input
                    type="number"
                    min={0}
                    value={c.marks}
                    onChange={(e) => setCriterion(i, { marks: Number(e.target.value) })}
                    className="ed-input px-2 py-2 text-sm w-16"
                  />
                  {criteria.length > 1 && (
                    <button onClick={() => removeCriterion(i)} className="text-ink-faint hover:text-crimson p-1">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addCriterion} className="ed-btn-ghost mt-2 px-3 py-1.5 text-xs">
              <Plus size={13} /> Add criterion
            </button>
          </div>

          {error && <p className="text-sm text-crimson">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="ed-btn-ghost flex-1 justify-center py-2.5">
              Cancel
            </button>
            <button onClick={() => void submit()} disabled={saving || imgBusy} className="ed-btn-primary flex-1 justify-center py-2.5">
              {saving ? "Saving…" : "Save question"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Thumbnails + an upload tile for a question's or part's figures.
function ImageRow({ images, onAdd, onRemove, busy }: {
  images: CustomImage[];
  onAdd: (files: FileList | null) => void;
  onRemove: (i: number) => void;
  busy?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      {images.map((im, i) => (
        <div key={i} className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={im.data_url} alt={im.alt || "figure"} className="h-16 w-16 rounded-lg border border-line object-cover" />
          <button onClick={() => onRemove(i)} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink text-paper" title="Remove">
            <X size={11} />
          </button>
        </div>
      ))}
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="ed-btn-ghost flex h-16 w-16 flex-col justify-center gap-1 p-0 text-[0.65rem]"
      >
        <ImagePlus size={16} /> {busy ? "…" : "Add"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { onAdd(e.target.files); if (inputRef.current) inputRef.current.value = ""; }}
      />
    </div>
  );
}
