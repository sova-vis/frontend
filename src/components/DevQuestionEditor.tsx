"use client";

import { useEffect, useRef, useState } from "react";
import { Wrench, Save, Trash2, ImagePlus, RefreshCw } from "lucide-react";
import { patchQuestion, patchPart, fileToDataUrl, isDevUnlocked } from "@/lib/devMode";

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

function imgPayload(images: EditImage[]) {
  return images
    .filter((im) => im.src)
    .map((im) => ({ role: im.role || "figure", caption: im.caption ?? null, width: im.width ?? null, height: im.height ?? null, data_url: im.src as string }));
}

export default function DevQuestionEditor({ question, onSaved }: { question: EditQuestion; onSaved?: () => void }) {
  const [unlocked, setUnlocked] = useState(false);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(question.questionText || "");
  const [scheme, setScheme] = useState(question.markingScheme || "");
  const [correct, setCorrect] = useState(question.correctOption || "");
  const [images, setImages] = useState<EditImage[]>(question.images || []);
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

  if (!unlocked) return null;

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
  const persistImages = async (next: EditImage[]) => {
    if (!guardUid()) return;
    try { await patchQuestion(question.uid!, { images: imgPayload(next) }); question.images = next; setImages(next); onSaved?.(); flash("Images updated."); }
    catch (e) { fail(e); }
  };
  const deleteImage = (i: number) => persistImages(images.filter((_, idx) => idx !== i));
  const addImage = async (file: File, at: "start" | "end") => {
    const src = await fileToDataUrl(file);
    const im: EditImage = { role: "figure", caption: null, src };
    persistImages(at === "start" ? [im, ...images] : [...images, im]);
  };
  const replaceImage = async (i: number, file: File) => {
    const src = await fileToDataUrl(file);
    persistImages(images.map((im, idx) => (idx === i ? { ...im, src } : im)));
  };
  const savePart = async (p: EditPart, body: string, marks: string, answer: string) => {
    if (!p.uid) { setErr("This part has no id — cannot edit."); return; }
    try {
      const m = marks.trim() === "" ? null : Number(marks);
      await patchPart(p.uid, { body, marks: Number.isNaN(m as number) ? null : m, answer });
      p.body = body; p.marks = Number.isNaN(m as number) ? null : m; p.answer = answer;
      onSaved?.(); flash("Part saved.");
    } catch (e) { fail(e); }
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
                <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 6, width: 130 }}>
                  {im.src && <img src={im.src} alt="" style={{ width: "100%", height: 80, objectFit: "contain", background: "#fff" }} />}
                  <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                    <button style={{ ...btn, padding: "3px 6px", fontSize: 11 }} onClick={() => { replaceIdx.current = i; replaceRef.current?.click(); }}><RefreshCw size={11} /> Replace</button>
                    <button style={{ ...btn, padding: "3px 6px", fontSize: 11, color: "var(--crimson)" }} onClick={() => deleteImage(i)}><Trash2 size={11} /></button>
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

          {question.parts.length > 0 && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 700 }}>Parts</label>
              {question.parts.map((p, i) => <PartEditor key={i} part={p} onSave={savePart} />)}
            </div>
          )}

          {err && <p style={{ color: "var(--crimson)", fontSize: 13 }}>{err}</p>}
          {msg && <p style={{ color: "#059669", fontSize: 13 }}>{msg}</p>}
        </div>
      )}
    </div>
  );
}

function PartEditor({ part, onSave }: { part: EditPart; onSave: (p: EditPart, body: string, marks: string, answer: string) => void }) {
  const [body, setBody] = useState(part.body || "");
  const [marks, setMarks] = useState(part.marks == null ? "" : String(part.marks));
  const [answer, setAnswer] = useState(part.answer || "");
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 8, marginTop: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 700 }}>({part.label || "—"})</div>
      <textarea style={{ ...ta, minHeight: 44 }} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Part text" />
      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "6px 0" }}>
        <span style={{ fontSize: 12 }}>Marks:</span>
        <input value={marks} onChange={(e) => setMarks(e.target.value)} style={{ width: 60, padding: 5, border: "1px solid var(--line)", borderRadius: 6 }} />
      </div>
      <textarea style={{ ...ta, minHeight: 44 }} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Answer for this part" />
      <button style={{ ...btn, marginTop: 6 }} onClick={() => onSave(part, body, marks, answer)}><Save size={12} /> Save part</button>
    </div>
  );
}
