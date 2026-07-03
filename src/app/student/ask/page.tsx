"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

export default function AskAIPage() {
  const { user } = useUser();
  const { profile } = useClerkAuth();
  const name = (profile?.full_name || user?.firstName || "there").split(" ")[0];
  const storageKey = useMemo(() => `propel-ask-sessions-${user?.id || "anon"}`, [user?.id]);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed: Session[] = raw ? JSON.parse(raw) : [];
      setSessions(parsed);
      setActiveId(parsed[0]?.id ?? null);
    } catch { /* ignore */ }
  }, [storageKey]);

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
    if (!trimmed || loading) return;
    setInput("");

    let sessionId = activeId;
    let working: Session[];
    if (!sessionId) {
      sessionId = Math.random().toString(36).slice(2);
      const fresh: Session = { id: sessionId, title: trimmed.slice(0, 48), updatedAt: new Date().toISOString(), messages: [] };
      working = [fresh, ...sessions];
      setActiveId(sessionId);
    } else {
      working = [...sessions];
    }

    const history = (working.find((s) => s.id === sessionId)?.messages ?? [])
      .filter((m) => m.text && !m.error)
      .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text as string }));

    const withUser = working.map((s) => s.id === sessionId
      ? { ...s, updatedAt: new Date().toISOString(), messages: [...s.messages, { role: "user" as const, text: trimmed }] }
      : s);
    persist(withUser);
    setLoading(true);

    try {
      const res = await apiCall("/rag/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, limit: 5, history }),
      });
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();

      const aiMsg: ChatMsg = data.type === "smalltalk"
        ? { role: "ai", text: data.answer || "" }
        : {
            role: "ai",
            text: data.answer || "",
            citations: (data.citations || []).slice(0, 3),
            markingPoints: Array.isArray(data.marking_points) ? data.marking_points : undefined,
            commonMistakes: Array.isArray(data.common_mistakes) ? data.common_mistakes : undefined,
          };

      persist(withUser.map((s) => s.id === sessionId
        ? { ...s, updatedAt: new Date().toISOString(), messages: [...s.messages, aiMsg] }
        : s));
    } catch {
      persist(withUser.map((s) => s.id === sessionId
        ? { ...s, messages: [...s.messages, { role: "ai", error: true }] }
        : s));
    } finally {
      setLoading(false);
    }
  };

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
              <div className="search" style={{ height: "auto", padding: 8, alignItems: "flex-end", maxWidth: 720, margin: "0 auto" }}>
                <textarea value={input} onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                  placeholder="Ask about any topic, or paste a question…" rows={1}
                  style={{ flex: 1, border: "none", background: "none", outline: "none", resize: "none", padding: "8px 6px", maxHeight: 120, fontFamily: "inherit" }} />
                <button className="btn btn-primary" style={{ padding: 10, borderRadius: 11 }} onClick={() => send(input)} disabled={!input.trim() || loading} aria-label="Send">
                  <Icon name="send" size={17} fill="#fff" stroke={0} />
                </button>
              </div>
              <div className="faint" style={{ fontSize: 11, textAlign: "center", marginTop: 8 }}>Answers cite real past-paper questions from your syllabus.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ m, onRetry }: { m: ChatMsg; onRetry: () => void }) {
  if (m.role === "user") {
    return <div style={{ alignSelf: "flex-end", maxWidth: "82%", marginLeft: "auto", background: "linear-gradient(135deg,var(--crimson),var(--crimson-deep))", color: "#fff", padding: "11px 15px", borderRadius: "16px 16px 4px 16px" }}>{m.text}</div>;
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
                {m.citations.map((c, i) => {
                  const s = subjectStyle(c.subject);
                  return (
                    <div key={i} className="flex items-center gap-10" style={{ padding: "9px 12px", borderRadius: 11, border: "1px solid var(--line)", background: "var(--surface-2)" }}>
                      <span className="dot" style={{ background: s.color }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{citationLabel(c)}</div>
                        {(c.topicSyllabus || c.topicGeneral) && <div className="faint" style={{ fontSize: 11.5 }}>{c.topicSyllabus || c.topicGeneral}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
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
