"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useClerkAuth } from "@/lib/useClerkAuth";
import { apiCall } from "@/lib/api";
import { Icon } from "@/components/propel/Icon";
import { subjectStyle } from "@/components/propel/subjects";

interface Citation {
  subject?: string; year?: number | string; session?: string; paper?: string;
  variant?: string; questionNumber?: string | number; topicSyllabus?: string; topicGeneral?: string;
}
interface MarkingPoint { point: string; marks?: number }
interface ChatMsg {
  role: "user" | "ai";
  text?: string;
  image?: string;         // data URL of an attached image (user bubble)
  citations?: Citation[];
  markingPoints?: MarkingPoint[];
  commonMistakes?: string[];
  error?: boolean;
}
interface Session { id: string; title: string; updatedAt: string; messages: ChatMsg[] }

const DEFAULT_PROMPTS = [
  { t: "Explain Le Chatelier's principle", icon: "beaker", subj: "chemistry" },
  { t: "Give me 5 MCQs on electrolysis", icon: "bolt", subj: "chemistry" },
  { t: "Why do I keep losing marks on Forces?", icon: "target", subj: "physics" },
  { t: "Summarise transport in plants", icon: "dna", subj: "biology" },
];

function citationLabel(c: Citation): string {
  const parts: string[] = [];
  if (c.subject) parts.push(String(c.subject));
  const bits = [c.paper, c.variant].filter(Boolean).join("/");
  const sess = [c.session, c.year].filter(Boolean).join(" ");
  const tail = [bits, sess].filter(Boolean).join(" ");
  if (tail) parts.push(tail);
  if (c.questionNumber) parts.push("Q" + c.questionNumber);
  return parts.join(" · ") || "Past paper";
}

function AskAIInner() {
  const { user } = useUser();
  const { profile } = useClerkAuth();
  const searchParams = useSearchParams();
  const name = (profile?.full_name || user?.firstName || "there").split(" ")[0];
  const storageKey = useMemo(() => `propel-ask-sessions-${user?.id || "anon"}`, [user?.id]);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [scopeSubject, setScopeSubject] = useState("");   // #26 syllabus scope
  const [toast, setToast] = useState("");                 // #30 transient error toast
  const [bootstrapped, setBootstrapped] = useState(false);
  const [attached, setAttached] = useState<{ file: File; url: string } | null>(null); // #27 image attach
  const prefillRef = useRef(false);
  const imageInput = useRef<HTMLInputElement | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);

  const subjectOptions = useMemo(
    () => (profile?.selected_subjects?.filter(Boolean) ?? []) as string[],
    [profile?.selected_subjects],
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed: Session[] = raw ? JSON.parse(raw) : [];
      setSessions(parsed);
      setActiveId(parsed[0]?.id ?? null);
    } catch { /* ignore */ }
    setBootstrapped(true);
  }, [storageKey]);

  // auto-dismiss the toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3400);
    return () => clearTimeout(t);
  }, [toast]);

  const persist = (next: Session[]) => {
    setSessions(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next.slice(0, 30))); } catch { /* ignore */ }
  };

  const active = sessions.find((s) => s.id === activeId) || null;
  const msgs = active?.messages ?? [];

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [msgs, loading]);

  const promptCards = useMemo(() => {
    const subs = profile?.selected_subjects?.filter(Boolean) ?? [];
    if (subs.length >= 2) {
      return subs.slice(0, 4).map((s) => ({
        t: `Give me 3 exam-style questions on ${s}`,
        icon: subjectStyle(s).icon,
        subj: s,
      }));
    }
    return DEFAULT_PROMPTS;
  }, [profile?.selected_subjects]);

  const newChat = () => setActiveId(null);

  const send = async (text: string) => {
    const trimmed = text.trim();
    const image = attached;                       // #27 capture attached image
    if ((!trimmed && !image) || loading) return;
    setInput("");
    setAttached(null);

    let sessionId = activeId;
    let working: Session[];
    if (!sessionId) {
      sessionId = Math.random().toString(36).slice(2);
      const fresh: Session = { id: sessionId, title: (trimmed || "Image question").slice(0, 48), updatedAt: new Date().toISOString(), messages: [] };
      working = [fresh, ...sessions];
      setActiveId(sessionId);
    } else {
      working = [...sessions];
    }

    const history = (working.find((s) => s.id === sessionId)?.messages ?? [])
      .filter((m) => m.text && !m.error)
      .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text as string }));

    const withUser = working.map((s) => s.id === sessionId
      ? { ...s, updatedAt: new Date().toISOString(), messages: [...s.messages, { role: "user" as const, text: trimmed || (image ? "Explain this image" : ""), image: image?.url }] }
      : s);
    persist(withUser);
    setLoading(true);

    try {
      let data: Record<string, unknown>;
      if (image) {
        // #27 image path → Grok vision
        const fd = new FormData();
        fd.append("question", trimmed || "Read the attached image and answer any question in it, explaining clearly.");
        if (scopeSubject) fd.append("subject", scopeSubject);
        fd.append("image", image.file, image.file.name);
        const res = await apiCall("/rag/ask-image", { method: "POST", body: fd });
        if (!res.ok) throw new Error(String(res.status));
        data = await res.json();
      } else {
        const res = await apiCall("/rag/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: trimmed, limit: 5, history, subject: scopeSubject || undefined }),
        });
        if (!res.ok) throw new Error(String(res.status));
        data = await res.json();
      }

      const citations: Citation[] = ((data.citations as Citation[]) || []).slice(0, 3);
      const aiMsg: ChatMsg = data.type === "smalltalk" || data.type === "image_answer"
        ? { role: "ai", text: (data.answer as string) || "" }
        : {
            role: "ai",
            text: (data.answer as string) || "",
            citations,
            markingPoints: Array.isArray(data.marking_points) ? (data.marking_points as MarkingPoint[]) : undefined,
            commonMistakes: Array.isArray(data.common_mistakes) ? (data.common_mistakes as string[]) : undefined,
          };

      // #29 auto-title the session by subject/topic instead of the raw first message
      const subj = String(scopeSubject || (data.subject as string) || citations[0]?.subject || "");
      const topic = citations[0]?.topicSyllabus || citations[0]?.topicGeneral || "";
      const smartTitle = subj ? [subj, topic].filter(Boolean).join(" · ").slice(0, 48) : (trimmed || "Image question").slice(0, 48);

      persist(withUser.map((s) => s.id === sessionId
        ? { ...s, title: s.messages.length <= 1 ? smartTitle : s.title, updatedAt: new Date().toISOString(), messages: [...s.messages, aiMsg] }
        : s));
    } catch (err) {
      setToast("Couldn't reach the AI — tap Try again.");
      console.warn("Ask AI request failed:", err instanceof Error ? err.message : err);
      persist(withUser.map((s) => s.id === sessionId
        ? { ...s, messages: [...s.messages, { role: "ai", error: true }] }
        : s));
    } finally {
      setLoading(false);
    }
  };

  // #20 deep link from a wrong MCQ ("Ask AI why…") — auto-send the ?q= once loaded
  useEffect(() => {
    if (!bootstrapped || prefillRef.current) return;
    const q = searchParams?.get("q");
    if (q && q.trim()) { prefillRef.current = true; setActiveId(null); void send(q); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapped, searchParams]);

  const lastUser = [...msgs].reverse().find((m) => m.role === "user")?.text;
  const empty = msgs.length === 0;

  return (
    <div className="pr">
      <div className="main">
        <div className="askai-layout">
          {/* history sidebar */}
          <aside className="card card-pad askai-rail" style={{ padding: 14, alignSelf: "start" }}>
            <button className="btn btn-primary btn-block btn-sm" onClick={newChat}><Icon name="plus" size={15} /> New chat</button>
            <div className="eyebrow" style={{ padding: "16px 8px 8px" }}>Recent</div>
            <div className="flex-col" style={{ gap: 2 }}>
              {sessions.length === 0 && <div className="faint" style={{ fontSize: 12.5, padding: "4px 8px" }}>No chats yet.</div>}
              {sessions.map((h) => (
                <button key={h.id} className={"drawer-link" + (h.id === activeId ? " active" : "")} style={{ padding: "9px 11px", fontSize: 13.5 }} onClick={() => setActiveId(h.id)}>
                  <Icon name="message" size={16} className="ic" />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.title}</span>
                </button>
              ))}
            </div>
          </aside>

          {/* chat */}
          <div className="card" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: "calc(100vh - 200px)" }}>
            <div className="flex items-center gap-10" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
              <div className="brand-mark" style={{ background: "linear-gradient(140deg,var(--purple),#4b32a8)", boxShadow: "none" }}><Icon name="sparkles" size={16} fill="#fff" stroke={0} /></div>
              <div>
                <div style={{ fontWeight: 600 }}>Ask AI</div>
                <div className="faint" style={{ fontSize: 12 }}>Powered by past papers</div>
              </div>
            </div>

            <div ref={scroller} style={{ flex: 1, overflowY: "auto", padding: 18 }}>
              {empty ? (
                <div style={{ maxWidth: 600, margin: "24px auto", textAlign: "center" }}>
                  <div className="empty-art" style={{ background: "var(--purple-soft)", color: "var(--purple)" }}><Icon name="sparkles" size={40} stroke={1.8} /></div>
                  <h2 style={{ fontSize: 24 }}>Hey {name}, what should we tackle?</h2>
                  <p className="muted mt-8">Ask anything — I&apos;ll explain it and show you the past-paper questions behind every answer.</p>
                  <div className="grid mt-24" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", textAlign: "left" }}>
                    {promptCards.map((p, i) => {
                      const s = subjectStyle(p.subj);
                      return (
                        <button key={i} className="card card-pad card-hover" style={{ padding: 14, display: "flex", gap: 11, alignItems: "center", textAlign: "left" }} onClick={() => send(p.t)}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, flex: "none", display: "grid", placeItems: "center", background: s.color + "1c", color: s.color }}><Icon name={p.icon} size={18} /></div>
                          <span style={{ fontSize: 13.5, fontWeight: 500 }}>{p.t}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex-col gap-18" style={{ maxWidth: 720, margin: "0 auto" }}>
                  {msgs.map((m, i) => <ChatBubble key={i} m={m} onRetry={() => lastUser && send(lastUser)} />)}
                  {loading && <Typing />}
                </div>
              )}
            </div>

            {/* composer */}
            <div style={{ padding: 14, borderTop: "1px solid var(--line)" }}>
              {/* #26 optional syllabus scope */}
              {subjectOptions.length > 0 && (
                <div className="flex items-center gap-8 wrap" style={{ maxWidth: 720, margin: "0 auto 8px" }}>
                  <span className="faint" style={{ fontSize: 12 }}>Scope:</span>
                  <label className="chip" style={{ padding: "0 6px 0 12px", gap: 4, cursor: "pointer" }}>
                    <Icon name="filter" size={13} className="faint" />
                    <select value={scopeSubject} onChange={(e) => setScopeSubject(e.target.value)}
                      style={{ border: "none", background: "transparent", padding: "6px 4px", fontWeight: 500, cursor: "pointer", outline: "none", color: "var(--ink)", fontSize: 12.5 }}>
                      <option value="">All subjects</option>
                      {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                </div>
              )}
              {/* #27 attached-image preview */}
              {attached && (
                <div className="flex items-center gap-10" style={{ maxWidth: 720, margin: "0 auto 8px", padding: "6px 10px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface-2)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={attached.url} alt="attachment" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{attached.file.name}</span>
                  <button className="icon-btn" aria-label="Remove image" onClick={() => { URL.revokeObjectURL(attached.url); setAttached(null); }} style={{ width: 28, height: 28 }}><Icon name="x" size={14} /></button>
                </div>
              )}
              <div className="search" style={{ height: "auto", padding: 8, alignItems: "flex-end", maxWidth: 720, margin: "0 auto" }}>
                <input ref={imageInput} type="file" accept="image/*" style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) { if (f.size > 12 * 1024 * 1024) { setToast("Image is larger than 12 MB."); } else setAttached({ file: f, url: URL.createObjectURL(f) }); } e.currentTarget.value = ""; }} />
                <button className="icon-btn" onClick={() => imageInput.current?.click()} disabled={loading} aria-label="Attach image"
                  title="Attach a diagram, graph or photo of a question" style={{ width: 38, height: 38, flex: "none", border: "1px solid var(--line-strong)" }}>
                  <Icon name="camera" size={17} />
                </button>
                <textarea value={input} onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                  placeholder={attached ? "Add a question about the image (optional)…" : "Ask about any topic, or paste a question…"} rows={1}
                  style={{ flex: 1, border: "none", background: "none", outline: "none", resize: "none", padding: "8px 6px", maxHeight: 120, fontFamily: "inherit" }} />
                <button className="btn btn-primary" style={{ padding: 10, borderRadius: 11 }} onClick={() => send(input)} disabled={(!input.trim() && !attached) || loading} aria-label="Send">
                  <Icon name="send" size={17} fill="#fff" stroke={0} />
                </button>
              </div>
              <div className="faint" style={{ fontSize: 11, textAlign: "center", marginTop: 8 }}>Answers cite real past-paper questions · attach a diagram or photo to ask about it.</div>
            </div>
          </div>
        </div>
      </div>

      {/* #30 non-intrusive transient error toast (thread is preserved) */}
      {toast && (
        <div style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 9999,
          background: "var(--ink)", color: "var(--canvas)", padding: "10px 16px", borderRadius: 12, fontSize: 13.5,
          boxShadow: "0 10px 30px rgba(0,0,0,.25)", display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="alert" size={15} /> {toast}
        </div>
      )}
    </div>
  );
}

export default function AskAIPage() {
  return (
    <Suspense fallback={null}>
      <AskAIInner />
    </Suspense>
  );
}

function ChatBubble({ m, onRetry }: { m: ChatMsg; onRetry: () => void }) {
  if (m.role === "user") {
    return (
      <div style={{ alignSelf: "flex-end", maxWidth: "82%", marginLeft: "auto", background: "linear-gradient(135deg,var(--crimson),var(--crimson-deep))", color: "#fff", padding: "11px 15px", borderRadius: "16px 16px 4px 16px" }}>
        {m.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.image} alt="attachment" style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 10, marginBottom: m.text ? 8 : 0, display: "block" }} />
        )}
        {m.text}
      </div>
    );
  }
  if (m.error) {
    return (
      <div className="flex gap-12" style={{ maxWidth: "92%" }}>
        <AIAvatar />
        <div className="card card-pad" style={{ padding: 16, background: "var(--coral-soft)", border: "none" }}>
          <div className="flex items-center gap-8" style={{ color: "var(--coral)", fontWeight: 600 }}><Icon name="zap_off" size={18} /> We couldn&apos;t reach the AI</div>
          <p style={{ fontSize: 13.5, marginTop: 6 }}>Your connection or our model hiccuped — your question is safe. Give it another go.</p>
          <button className="btn btn-secondary btn-sm mt-12" onClick={onRetry}><Icon name="refresh" size={15} /> Try again</button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-12" style={{ maxWidth: "92%" }}>
      <AIAvatar />
      <div style={{ flex: 1 }}>
        <div className="card card-pad" style={{ padding: 16 }}>
          <div style={{ fontSize: 14.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{m.text}</div>

          {m.markingPoints && m.markingPoints.length > 0 && (
            <div className="mt-16">
              <div className="eyebrow" style={{ marginBottom: 8 }}>Mark scheme points</div>
              <div className="flex-col gap-8">
                {m.markingPoints.map((p, i) => (
                  <div key={i} className="flex gap-10 items-start" style={{ padding: "9px 12px", borderRadius: 11, background: "var(--surface-2)" }}>
                    <span className="badge teal" style={{ flex: "none" }}>+{p.marks ?? 1}</span>
                    <span style={{ fontSize: 13.5 }}>{p.point}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {m.commonMistakes && m.commonMistakes.length > 0 && (
            <div className="mt-16">
              <div className="eyebrow" style={{ marginBottom: 8 }}>Common mistakes</div>
              <div className="flex-col gap-6">
                {m.commonMistakes.map((c, i) => (
                  <div key={i} className="flex gap-8 items-start" style={{ fontSize: 13 }}>
                    <Icon name="alert" size={15} style={{ color: "var(--coral)", flex: "none", marginTop: 2 }} />
                    <span>{c}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {m.citations && m.citations.length > 0 && (
            <div className="mt-16">
              <div className="eyebrow" style={{ marginBottom: 8 }}>Sources · from past papers</div>
              <div className="flex-col gap-8">
                {m.citations.map((c, i) => <CitationRow key={i} c={c} />)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// #28 clickable citation → lazy-loads a preview of the cited question + mark scheme
function CitationRow({ c }: { c: Citation }) {
  const s = subjectStyle(c.subject);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<{ question: string; scheme: string } | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || detail || state === "loading") return;
    if (!c.subject || !c.year || !c.session || !c.paper) { setState("error"); return; }
    setState("loading");
    try {
      const params = new URLSearchParams({
        subject: String(c.subject), year: String(c.year), session: String(c.session),
        paper: String(c.paper), variant: c.variant ? String(c.variant) : "",
      });
      const res = await fetch(`/api/paper-practice?${params.toString()}`);
      const data = res.ok ? await res.json() : { questions: [] };
      const qn = String(c.questionNumber ?? "");
      const list = (data.questions || []) as Array<{ questionNumber?: string; questionText?: string; markingScheme?: string; parts?: Array<{ answer?: string | null }> }>;
      const q = list.find((x) => String(x.questionNumber) === qn) || list[0];
      if (q) {
        const scheme = [q.markingScheme, ...(((q.parts || []).map((p) => p.answer).filter(Boolean)) as string[])].filter(Boolean).join("\n");
        setDetail({ question: q.questionText || "", scheme });
        setState("idle");
      } else { setState("error"); }
    } catch { setState("error"); }
  };

  return (
    <div style={{ borderRadius: 11, border: "1px solid var(--line)", background: "var(--surface-2)", overflow: "hidden" }}>
      <button onClick={toggle} className="flex items-center gap-10" style={{ width: "100%", textAlign: "left", padding: "9px 12px", cursor: "pointer", background: "transparent" }}>
        <span className="dot" style={{ background: s.color }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{citationLabel(c)}</div>
          {(c.topicSyllabus || c.topicGeneral) && <div className="faint" style={{ fontSize: 11.5 }}>{c.topicSyllabus || c.topicGeneral}</div>}
        </div>
        <Icon name={open ? "chevron_down" : "chevron_right"} size={16} className="faint" />
      </button>
      {open && (
        <div style={{ padding: "0 12px 12px", fontSize: 13, lineHeight: 1.5 }}>
          {state === "loading" ? (
            <div className="flex items-center gap-8 faint"><Icon name="refresh" size={14} className="spin" /> Loading question…</div>
          ) : state === "error" || !detail ? (
            <div className="faint" style={{ fontSize: 12.5 }}>Preview unavailable — open this paper from the Papers tab to view it.</div>
          ) : (
            <>
              {detail.question && <p style={{ whiteSpace: "pre-wrap" }}>{detail.question}</p>}
              {detail.scheme && (
                <div style={{ marginTop: 8, borderRadius: 8, border: "1px solid var(--amber-soft)", background: "var(--amber-soft)", padding: 8, color: "var(--amber-deep)", fontSize: 12.5, whiteSpace: "pre-wrap" }}>
                  <b>Mark scheme:</b> {detail.scheme}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AIAvatar() {
  return <div style={{ width: 34, height: 34, borderRadius: 10, flex: "none", display: "grid", placeItems: "center", background: "linear-gradient(140deg,var(--purple),#4b32a8)", color: "#fff" }}><Icon name="sparkles" size={17} fill="#fff" stroke={0} /></div>;
}
function Typing() {
  return (
    <div className="flex gap-12" style={{ maxWidth: 720, margin: "0 auto", width: "100%" }}><AIAvatar />
      <div className="card card-pad" style={{ padding: "14px 16px", display: "flex", gap: 5 }}>
        {[0, 1, 2].map((i) => <span key={i} style={{ width: 7, height: 7, borderRadius: 5, background: "var(--ink-faint)", animation: `floaty 1s ease-in-out ${i * 0.15}s infinite` }} />)}
      </div>
    </div>
  );
}
