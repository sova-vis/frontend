"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useClerkAuth } from "@/lib/useClerkAuth";
import { apiCall } from "@/lib/api";
import { Icon } from "@/components/propel/Icon";
import { subjectStyle } from "@/components/propel/subjects";

interface Citation {
  subject?: string; year?: number | string; session?: string; paper?: string;
  variant?: string; questionNumber?: string | number; topicSyllabus?: string; topicGeneral?: string;
  preview?: string; pageImageUrl?: string;
}
interface MarkingPoint { point: string; marks?: number }
interface ChatMsg {
  role: "user" | "ai";
  text?: string;
  image?: string;         // data URL of an attached image (user bubble)
  citations?: Citation[];
  markingPoints?: MarkingPoint[];
  commonMistakes?: string[];
  mode?: "ask" | "find";
  error?: boolean;
}
type Mode = "ask" | "find";
interface Session { id: string; title: string; updatedAt: string; messages: ChatMsg[] }

const DEFAULT_PROMPTS = [
  { t: "Explain Le Chatelier's principle", icon: "beaker", subj: "chemistry" },
  { t: "Give me 5 MCQs on electrolysis", icon: "bolt", subj: "chemistry" },
  { t: "Why do I keep losing marks on Forces?", icon: "target", subj: "physics" },
  { t: "Summarise transport in plants", icon: "dna", subj: "biology" },
];

const MAX_STORED_SESSIONS = 10;

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

// Inline markdown: **bold** and [text](url) links.
function renderInline(text: string, keyPrefix = ""): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${keyPrefix}${i}`} style={{ fontSize: "1.08em", color: "#2563EB" }}>{part.slice(2, -2)}</strong>;
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a key={`${keyPrefix}${i}`} href={linkMatch[2]} target="_blank" rel="noopener noreferrer"
          style={{ color: "var(--crimson)", textDecoration: "underline" }}>
          {linkMatch[1]}
        </a>
      );
    }
    return <span key={`${keyPrefix}${i}`}>{part}</span>;
  });
}

// Block-level markdown: headings (###), bullet lists (- ), and paragraphs -
// built for the chatbot's Ask-mode answers (worked examples + marking points).
function renderMarkdown(text: string): ReactNode[] {
  if (!text) return [];
  const lines = text.replace(/\r/g, "").split("\n");
  const nodes: ReactNode[] = [];
  let para: string[] = [];
  let bullets: string[] = [];

  const flushPara = () => {
    if (!para.length) return;
    nodes.push(
      <p key={`p-${nodes.length}`} style={{ margin: "0 0 10px", fontSize: 14.5, lineHeight: 1.6 }}>
        {para.map((line, i) => (
          <span key={i}>{renderInline(line, `pl${nodes.length}-${i}-`)}{i < para.length - 1 && <br />}</span>
        ))}
      </p>
    );
    para = [];
  };
  const flushBullets = () => {
    if (!bullets.length) return;
    nodes.push(
      <div key={`ul-${nodes.length}`} style={{ margin: "0 0 10px" }}>
        {bullets.map((b, i) => (
          <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 44, lineHeight: 1, fontWeight: 700, color: "var(--crimson)", flex: "none" }}>.</span>
            <span style={{ fontSize: 14.5, lineHeight: 1.6 }}>{renderInline(b, `bl${nodes.length}-${i}-`)}</span>
          </div>
        ))}
      </div>
    );
    bullets = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushPara(); flushBullets(); continue; }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushPara(); flushBullets();
      const level = heading[1].length;
      nodes.push(
        level <= 3 ? (
          <div key={`h-${nodes.length}`} className="eyebrow" style={{ fontSize: 12.5, color: "var(--purple)", marginTop: nodes.length ? 16 : 0, marginBottom: 8 }}>
            {heading[2]}
          </div>
        ) : (
          <div key={`h-${nodes.length}`} style={{ fontSize: 19, fontWeight: 700, color: "var(--ink)", marginTop: nodes.length ? 16 : 0, marginBottom: 6 }}>
            {heading[2]}
          </div>
        )
      );
      continue;
    }

    const bullet = line.match(/^[-•*]\s+(.*)$/);
    if (bullet) { flushPara(); bullets.push(bullet[1]); continue; }

    flushBullets();
    para.push(line);
  }
  flushPara(); flushBullets();
  return nodes;
}

function AskAIInner() {
  const { user } = useUser();
  const { profile } = useClerkAuth();
  const searchParams = useSearchParams();
  const name = (profile?.full_name || user?.firstName || "there").split(" ")[0];
  const [mode, setMode] = useState<Mode>("ask");
  // Separate storage key per mode - Ask and Find are independent
  // conversations, same as the underlying chatbot's own UI keeps them.
  const storageKey = useMemo(() => `propel-ask-sessions-${mode}-${user?.id || "anon"}`, [user?.id, mode]);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [scopeSubject, setScopeSubject] = useState("");   // syllabus scope filter
  const [toast, setToast] = useState("");                 // transient error toast
  const [bootstrapped, setBootstrapped] = useState(false);
  const [attached, setAttached] = useState<{ file: File; url: string } | null>(null); // image attach
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
      // Trim on load too, not just on new-session writes - localStorage may
      // already hold more than the cap from before this limit existed.
      const trimmed = parsed.slice(0, MAX_STORED_SESSIONS);
      setSessions(trimmed);
      if (trimmed.length !== parsed.length) {
        try { localStorage.setItem(storageKey, JSON.stringify(trimmed)); } catch { /* ignore */ }
      }
      // Always start on a fresh, blank chat - history is still there in the
      // Recent list to click back into, just never auto-resumed.
      setActiveId(null);
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
    // New sessions are always prepended (index 0 = most recent), so keeping
    // the first MAX_STORED_SESSIONS here correctly evicts the oldest ones
    // once the list grows past the cap.
    const trimmed = next.slice(0, MAX_STORED_SESSIONS);
    setSessions(trimmed);
    try { localStorage.setItem(storageKey, JSON.stringify(trimmed)); } catch { /* ignore */ }
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
    const image = attached;
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
        // Image path -> Grok vision, bypasses the Ask/Find text pipeline entirely.
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
          body: JSON.stringify({ question: trimmed, limit: 5, history, mode, subject: scopeSubject || undefined }),
        });
        if (!res.ok) throw new Error(String(res.status));
        data = await res.json();
      }
      const responseMode: Mode = data.mode === "find" ? "find" : "ask";

      const citations: Citation[] = (data.citations as Citation[]) || [];
      const aiMsg: ChatMsg = data.type === "smalltalk" || data.type === "image_answer"
        ? { role: "ai", text: (data.answer as string) || "" }
        : {
            role: "ai",
            text: (data.answer as string) || "",
            mode: responseMode,
            citations,
            markingPoints: Array.isArray(data.marking_points) ? (data.marking_points as MarkingPoint[]) : undefined,
            commonMistakes: Array.isArray(data.common_mistakes) ? (data.common_mistakes as string[]) : undefined,
          };

      // Auto-title the session by subject/topic instead of the raw first message.
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

  // Deep link from a wrong MCQ ("Ask AI why…") — auto-send the ?q= once loaded.
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
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>Ask AI</div>
                <div className="faint" style={{ fontSize: 12 }}>Powered by past papers</div>
              </div>
              <div className="flex" style={{ background: "var(--surface-2)", borderRadius: 10, padding: 3, gap: 2 }}>
                {(["ask", "find"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={"btn btn-sm" + (mode === m ? " btn-primary" : "")}
                    style={mode === m ? { padding: "6px 14px" } : { padding: "6px 14px", background: "transparent", border: "none", color: "var(--ink-muted)" }}
                    title={m === "ask" ? "Explain a concept, grounded in the papers and the web" : "Look up exactly which years/papers a topic was asked in"}
                  >
                    {m === "ask" ? "Ask" : "Find"}
                  </button>
                ))}
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
              {/* optional syllabus scope */}
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
              {/* attached-image preview */}
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

      {/* non-intrusive transient error toast (thread is preserved) */}
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
          <div>{renderMarkdown(m.text || "")}</div>

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
            <div className="mt-16" style={{ overflowX: "auto" }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                {m.mode === "find" ? `Matching questions (${m.citations.length})` : "Sources · from past papers"}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--line)" }}>
                    {["Subject", "Year", "Session", "Paper", "Variant", "Q#", "Question"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "6px 10px", fontSize: 11.5, fontWeight: 600, color: "var(--ink-muted)", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {m.citations.map((c, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{c.subject ?? "-"}</td>
                      <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{c.year ?? "-"}</td>
                      <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{(c.session || "").replace(/_/g, "/") || "-"}</td>
                      <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{c.paper ?? "-"}</td>
                      <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{c.variant ?? "-"}</td>
                      <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{c.questionNumber ?? "-"}</td>
                      <td style={{ padding: "8px 10px" }}>
                        {c.pageImageUrl ? (
                          <a href={c.pageImageUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--crimson)", textDecoration: "underline" }}>
                            {c.preview || citationLabel(c)}
                          </a>
                        ) : (c.preview || citationLabel(c))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
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
