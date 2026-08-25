"use client";

import { useEffect, useRef, useState } from "react";
import { Wrench, Save, Trash2, ImagePlus, RefreshCw, Plus, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, AlertTriangle } from "lucide-react";
import { patchQuestion, replaceParts, deleteQuestion, fileToDataUrl, isDevUnlocked } from "@/lib/devMode";

// Minimal structural shape of the practice question this editor touches.
type EditImage = { role?: string; caption?: string | null; src?: string | null; width?: number | null; height?: number | null };
type EditPart = { uid?: string; label: string; body: string; marks: number | null; answer: string | null };
type EditQuestion = {
  uid?: string;
  type: "mcq" | "structured";
  questionText: string;
  correctOption?: string | null;
  markingScheme?: string;
  images: EditImage[];
  parts: EditPart[];
};

const box: React.CSSProperties = { border: "1px dashed var(--crimson)", borderRadius: 12, padding: 12, background: "var(--crimson-soft, #fff5f5)" };
const ta: React.CSSProperties = { width: "100%", minHeight: 60, fontSize: 14, padding: 8, border: "1px solid var(--line)", borderRadius: 8, fontFamily: "inherit" };
const btn: React.CSSProperties = { fontSize: 12, fontWeight: 700, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 };
const iconBtn: React.CSSProperties = { ...btn, padding: "4px 7px" };

function imgPayload(images: EditImage[]) {
  return images
    .filter((im) => im.src)
    .map((im) => ({ role: im.role || "figure", caption: im.caption ?? null, width: im.width ?? null, height: im.height ?? null, data_url: im.src as string }));
}

const nextLabel = (n: number) => String.fromCharCode(97 + (n % 26)); // a, b, c, …

export default function DevQuestionEditor({ question, onSaved, onDeleted }: { question: EditQuestion; onSaved?: () => void; onDeleted?: () => void }) {
  const [unlocked, setUnlocked] = useState(false);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(question.questionText || "");
  const [scheme, setScheme] = useState(question.markingScheme || "");
  const [correct, setCorrect] = useState(question.correctOption || "");
  const [images, setImages] = useState<EditImage[]>(question.images || []);
  const [parts, setParts] = useState<EditPart[]>(question.parts || []);
  const [savingParts, setSavingParts] = useState(false);
  const [danger, setDanger] = useState<null | "delete" | "rebuild">(null);
  const [gone, setGone] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const replaceIdx = useRef<number | null>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUnlocked(isDevUnlocked());
    const on = () => setUnlocked(isDevUnlocked());
    window.addEventListener("propel:dev-change", on);
    return () => window.removeEventListener("propel:dev-change", on);
  }, []);

  if (!unlocked || gone) return null;

  const flash = (m: string) => { setMsg(m); setErr(null); setTimeout(() => setMsg(null), 2500); };
  const fail = (e: unknown) => setErr(e instanceof Error ? e.message : "Save failed");
  const guardUid = () => { if (!question.uid) { setErr("This question has no id — cannot edit."); return false; } return true; };

  const saveText = async () => { if (!guardUid()) return; try { await patchQuestion(question.uid!, { question_text: text }); question.questionText = text; onSaved?.(); flash("Question text saved."); } catch (e) { fail(e); } };
  const saveAnswer = async () => {
    if (!guardUid()) return;
    try {
      const patch = question.type === "mcq" ? { correct_option: correct || null, marking_scheme: scheme } : { marking_scheme: scheme };
      await patchQuestion(question.uid!, patch);
      if (question.type === "mcq") question.correctOption = correct || null;
      question.markingScheme = scheme;
      onSaved?.(); flash("Answer saved.");
    } catch (e) { fail(e); }
  };

  // ---- images: add / delete / replace / reorder (each persists immediately) --
  const persistImages = async (next: EditImage[]) => {
    if (!guardUid()) return;
    try { await patchQuestion(question.uid!, { images: imgPayload(next) }); question.images = next; setImages(next); onSaved?.(); flash("Images updated."); }
    catch (e) { fail(e); }
  };
  const deleteImage = (i: number) => persistImages(images.filter((_, idx) => idx !== i));
  const moveImage = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    const next = images.slice();
    [next[i], next[j]] = [next[j], next[i]];
    persistImages(next);
  };
  const addImage = async (file: File, at: "start" | "end") => {
    const src = await fileToDataUrl(file);
    const im: EditImage = { role: "figure", caption: null, src };
    persistImages(at === "start" ? [im, ...images] : [...images, im]);
  };
  const replaceImage = async (i: number, file: File) => {
    const src = await fileToDataUrl(file);
    persistImages(images.map((im, idx) => (idx === i ? { ...im, src } : im)));
  };

  // ---- parts: edit locally, then save the whole ordered set in one call ------
  const updatePart = (i: number, patch: Partial<EditPart>) => setParts((ps) => ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const addPart = () => setParts((ps) => [...ps, { label: nextLabel(ps.length), body: "", marks: null, answer: null }]);
  const deletePart = (i: number) => setParts((ps) => ps.filter((_, idx) => idx !== i));
  const movePart = (i: number, dir: -1 | 1) => setParts((ps) => {
    const j = i + dir;
    if (j < 0 || j >= ps.length) return ps;
    const next = ps.slice();
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const saveAllParts = async () => {
    if (!guardUid()) return;
    setSavingParts(true);
    try {
      const saved = await replaceParts(question.uid!, parts.map((p) => ({ label: p.label, body: p.body, marks: p.marks, answer: p.answer })));
      const mapped: EditPart[] = saved.map((s) => ({ uid: s.id, label: s.label, body: s.body, marks: s.marks, answer: s.answer }));
      question.parts = mapped; setParts(mapped); onSaved?.(); flash(`Saved ${mapped.length} part${mapped.length === 1 ? "" : "s"}.`);
    } catch (e) { fail(e); } finally { setSavingParts(false); }
  };

  // ---- destructive: wipe-and-rebuild (keeps the paper slot) / hard delete ----
  const doRebuild = async () => {
    if (!guardUid()) return;
    setDanger(null);
    try {
      await patchQuestion(question.uid!, { question_text: "", marking_scheme: "", correct_option: null, images: [] });
      await replaceParts(question.uid!, []);
      question.questionText = ""; question.markingScheme = ""; question.correctOption = null; question.images = []; question.parts = [];
      setText(""); setScheme(""); setCorrect(""); setImages([]); setParts([]);
      onSaved?.(); flash("Blanked. Build the new question, then save each section.");
    } catch (e) { fail(e); }
  };
  const doDelete = async () => {
    if (!guardUid()) return;
    setDanger(null);
    try { await deleteQuestion(question.uid!); if (onDeleted) onDeleted(); else { setGone(true); } }
    catch (e) { fail(e); }
  };

  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={() => setOpen((o) => !o)} style={{ ...btn, borderColor: "var(--crimson)", color: "var(--crimson)" }}>
        <Wrench size={13} /> {open ? "Close dev edit" : "Dev edit"}
      </button>
      {open && (
        <div style={{ ...box, marginTop: 8, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700 }}>Question text</label>
            <textarea style={ta} value={text} onChange={(e) => setText(e.target.value)} />
            <button style={{ ...btn, marginTop: 6 }} onClick={saveText}><Save size={13} /> Save text</button>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700 }}>{question.type === "mcq" ? "Correct answer + explanation" : "Answer / mark scheme"}</label>
            {question.type === "mcq" && (
              <div style={{ margin: "6px 0" }}>
                Correct option:{" "}
                <select value={correct} onChange={(e) => setCorrect(e.target.value)} style={{ padding: 6, border: "1px solid var(--line)", borderRadius: 8 }}>
                  <option value="">—</option>{["A", "B", "C", "D"].map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            )}
            <textarea style={ta} value={scheme} onChange={(e) => setScheme(e.target.value)} placeholder="Mark scheme / model answer" />
            <button style={{ ...btn, marginTop: 6 }} onClick={saveAnswer}><Save size={13} /> Save answer</button>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700 }}>Images ({images.length})</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 6 }}>
              {images.map((im, i) => (
                <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 6, width: 140 }}>
                  {im.src && <img src={im.src} alt="" style={{ width: "100%", height: 80, objectFit: "contain", background: "#fff" }} />}
                  <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                    <button title="Move left" style={{ ...iconBtn, fontSize: 11 }} onClick={() => moveImage(i, -1)} disabled={i === 0}><ArrowLeft size={11} /></button>
                    <button title="Move right" style={{ ...iconBtn, fontSize: 11 }} onClick={() => moveImage(i, 1)} disabled={i === images.length - 1}><ArrowRight size={11} /></button>
                    <button title="Replace" style={{ ...iconBtn, fontSize: 11 }} onClick={() => { replaceIdx.current = i; replaceRef.current?.click(); }}><RefreshCw size={11} /></button>
                    <button title="Delete" style={{ ...iconBtn, fontSize: 11, color: "var(--crimson)" }} onClick={() => deleteImage(i)}><Trash2 size={11} /></button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button style={btn} onClick={() => { addRef.current?.setAttribute("data-at", "start"); addRef.current?.click(); }}><ImagePlus size={13} /> Add before</button>
              <button style={btn} onClick={() => { addRef.current?.setAttribute("data-at", "end"); addRef.current?.click(); }}><ImagePlus size={13} /> Add after</button>
            </div>
            <input ref={addRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; const at = (addRef.current?.getAttribute("data-at") as "start" | "end") || "end"; if (f) addImage(f, at); e.target.value = ""; }} />
            <input ref={replaceRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f && replaceIdx.current !== null) replaceImage(replaceIdx.current, f); e.target.value = ""; }} />
          </div>

          {question.type === "structured" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <label style={{ fontSize: 12, fontWeight: 700 }}>Parts ({parts.length})</label>
                <button style={btn} onClick={addPart}><Plus size={13} /> Add part</button>
              </div>
              {parts.map((p, i) => (
                <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 8, marginTop: 6, background: "#fff" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>Label</span>
                    <input value={p.label} onChange={(e) => updatePart(i, { label: e.target.value })} style={{ width: 80, padding: 5, border: "1px solid var(--line)", borderRadius: 6 }} placeholder="a" />
                    <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                      <button title="Move up" style={iconBtn} onClick={() => movePart(i, -1)} disabled={i === 0}><ArrowUp size={12} /></button>
                      <button title="Move down" style={iconBtn} onClick={() => movePart(i, 1)} disabled={i === parts.length - 1}><ArrowDown size={12} /></button>
                      <button title="Delete part" style={{ ...iconBtn, color: "var(--crimson)" }} onClick={() => deletePart(i)}><Trash2 size={12} /></button>
                    </div>
                  </div>
                  <textarea style={{ ...ta, minHeight: 44 }} value={p.body} onChange={(e) => updatePart(i, { body: e.target.value })} placeholder="Part text" />
                  <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "6px 0" }}>
                    <span style={{ fontSize: 12 }}>Marks:</span>
                    <input value={p.marks == null ? "" : String(p.marks)} onChange={(e) => { const v = e.target.value.trim(); updatePart(i, { marks: v === "" ? null : Number.isNaN(Number(v)) ? p.marks : Number(v) }); }} style={{ width: 60, padding: 5, border: "1px solid var(--line)", borderRadius: 6 }} />
                  </div>
                  <textarea style={{ ...ta, minHeight: 44 }} value={p.answer || ""} onChange={(e) => updatePart(i, { answer: e.target.value })} placeholder="Answer for this part" />
                </div>
              ))}
              <button style={{ ...btn, marginTop: 8, borderColor: "var(--crimson)", color: "var(--crimson)" }} onClick={saveAllParts} disabled={savingParts}>
                <Save size={13} /> {savingParts ? "Saving…" : "Save all parts"}
              </button>
              <p style={{ fontSize: 11, color: "var(--ink-muted, #888)", marginTop: 4 }}>Parts save together — add, delete, rename and reorder above, then Save all parts.</p>
            </div>
          )}

          {/* danger zone: rebuild in place or delete the whole question */}
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {danger === null && (
              <>
                <button style={{ ...btn }} onClick={() => setDanger("rebuild")}><RefreshCw size={13} /> Rebuild from scratch</button>
                <button style={{ ...btn, borderColor: "var(--crimson)", color: "var(--crimson)" }} onClick={() => setDanger("delete")}><Trash2 size={13} /> Delete question</button>
              </>
            )}
            {danger === "rebuild" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}><AlertTriangle size={13} /> Blank the text, answer, images and parts (keeps this question&rsquo;s place in the paper)?</span>
                <button style={{ ...btn, borderColor: "var(--crimson)", color: "var(--crimson)" }} onClick={doRebuild}>Yes, blank it</button>
                <button style={btn} onClick={() => setDanger(null)}>Cancel</button>
              </div>
            )}
            {danger === "delete" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}><AlertTriangle size={13} /> Permanently remove this question for everyone?</span>
                <button style={{ ...btn, background: "var(--crimson)", color: "#fff", borderColor: "var(--crimson)" }} onClick={doDelete}>Delete permanently</button>
                <button style={btn} onClick={() => setDanger(null)}>Cancel</button>
              </div>
            )}
          </div>

          {err && <p style={{ color: "var(--crimson)", fontSize: 13 }}>{err}</p>}
          {msg && <p style={{ color: "#059669", fontSize: 13 }}>{msg}</p>}
        </div>
      )}
    </div>
  );
}
