"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { apiCall } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Citation {
  subject: string;
  subjectName: string;
  year: number;
  session?: string;
  file_type: string;
  similarity?: number;
}

interface RelatedQuestion {
  type: "exact" | "similar";
  text: string;
  source: { subject: string; year: number; session: string; paper: string; file_type: string };
  similarity: number;
}

interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
  citations?: Citation[];
  markingPoints?: Array<{ point: string; marks: number }>;
  commonMistakes?: string[];
  confidenceScore?: number;
  lowConfidence?: boolean;
  responseType?: "smalltalk" | "paper_lookup" | "exam_question";
  paperResults?: any[];
  availableSubjects?: Array<{ code: string; name: string; level: string }>;
  relatedQuestion?: RelatedQuestion;
}

interface Subject {
  code: string;
  name: string;
  level: string;
}

// ─── Markdown renderer ───────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} className="font-semibold text-gray-900 dark:text-gray-100">{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={i}>{part.slice(1, -1)}</em>;
    return <span key={i}>{part}</span>;
  });
}

function renderMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];
  const blocks = text.split(/\n{2,}/);
  return blocks.map((block, bi) => {
    const lines = block.split("\n");
    const isBullet = lines.every((l) => /^[-•*]\s/.test(l.trim()));
    if (isBullet)
      return (
        <ul key={bi} className="list-disc list-inside space-y-1 my-2">
          {lines.map((l, li) => (
            <li key={li} className="text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">
              {renderInline(l.replace(/^[-•*]\s+/, ""))}
            </li>
          ))}
        </ul>
      );
    const isNumbered = lines.every((l) => /^\d+[.)]\s/.test(l.trim()));
    if (isNumbered)
      return (
        <ol key={bi} className="list-decimal list-inside space-y-1 my-2">
          {lines.map((l, li) => (
            <li key={li} className="text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">
              {renderInline(l.replace(/^\d+[.)]\s+/, ""))}
            </li>
          ))}
        </ol>
      );
    return (
      <p key={bi} className="text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">
        {lines.map((line, li) => (
          <span key={li}>
            {renderInline(line)}
            {li < lines.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
  });
}

// ─── Welcome message ─────────────────────────────────────────────────────────

const WELCOME: Message = {
  id: "welcome",
  type: "assistant",
  content:
    "Hello! I'm your O-Level AI study assistant, trained on real Cambridge past papers and mark schemes.\n\nTry asking:\n- **explain the process of osmosis**\n- **what causes acid rain in chemistry**\n- **islamiyat papers 2022**\n- **physics past papers 2019**",
  timestamp: new Date(),
  responseType: "smalltalk",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [showSubjects, setShowSubjects] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
    }
  }, [input]);

  useEffect(() => {
    apiCall("/rag/subjects")
      .then((r) => r.json())
      .then((data: Subject[]) => {
        if (Array.isArray(data)) setSubjects(data);
      })
      .catch(() => {});
  }, []);

  const handleNewChat = useCallback(() => {
    setMessages([{ ...WELCOME, id: "welcome-" + Date.now(), timestamp: new Date() }]);
    setInput("");
    setSelectedSubject(null);
    setMobileSidebarOpen(false);
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      type: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const historyMessages = messages
        .filter((m) => !m.id.startsWith("welcome"))
        .slice(-8)
        .map((m) => ({
          role: m.type === "user" ? ("user" as const) : ("assistant" as const),
          content: m.content,
        }));

      const body: any = { question: trimmed, limit: 5, history: historyMessages };
      if (selectedSubject) body.filters = { subject: selectedSubject.code };

      const response = await apiCall("/rag/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error(response.statusText);
      const data = await response.json();

      let content = "";
      let citations: Citation[] | undefined;
      let markingPoints: Message["markingPoints"];
      let commonMistakes: Message["commonMistakes"];
      let confidenceScore: number | undefined;
      let lowConfidence: boolean | undefined;
      let paperResults: any[] | undefined;
      let availableSubjects: Message["availableSubjects"];
      let relatedQuestion: RelatedQuestion | undefined;
      const responseType: Message["responseType"] = data.type || "exam_question";

      if (data.type === "smalltalk") {
        content = data.answer;
      } else if (data.type === "paper_lookup") {
        content = data.answer;
        paperResults = data.results || [];
        availableSubjects = data.available_subjects;
      } else {
        if (!data?.answer) throw new Error("Invalid response");
        content = data.answer;
        citations = data.citations?.slice(0, 5).map((c: any) => ({
          subject: c.subject,
          subjectName: c.subjectName || c.subject,
          year: c.year,
          session: c.session,
          file_type: c.file_type,
          similarity: c.similarity,
        }));
        markingPoints = data.marking_points;
        commonMistakes = data.common_mistakes;
        confidenceScore = data.confidence_score;
        lowConfidence = data.low_confidence;
        relatedQuestion = data.related_question;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          type: "assistant",
          content,
          timestamp: new Date(),
          citations: citations?.length ? citations : undefined,
          markingPoints,
          commonMistakes,
          confidenceScore,
          lowConfidence,
          responseType,
          paperResults,
          availableSubjects,
          relatedQuestion,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          type: "assistant",
          content: "Something went wrong. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, selectedSubject]);

  const userMessages = messages.filter((m) => m.type === "user");

  const sidebarContent = (
    <>
      {/* New chat */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-800">
        <div className="mb-3">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">AI Study Assistant</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Cambridge O-Level · Past Papers</p>
        </div>
        <button
          onClick={handleNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 transition-colors text-sm font-medium text-white shadow-sm shadow-primary/20"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New chat
        </button>
      </div>

      {/* Subject filter */}
      <div className="p-3 border-b border-gray-100 dark:border-gray-800">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 px-1 mb-2">Filter by subject</p>
        <button
          onClick={() => setShowSubjects((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-xs text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
        >
          <span className="flex items-center gap-2">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46" />
            </svg>
            <span className={selectedSubject ? "text-primary font-semibold" : ""}>{selectedSubject ? selectedSubject.name : "All subjects"}</span>
          </span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform duration-200 ${showSubjects ? "rotate-180" : ""}`}>
            <polyline points="6,9 12,15 18,9" />
          </svg>
        </button>

        {showSubjects && subjects.length > 0 && (
          <div className="mt-1.5 max-h-48 overflow-y-auto rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg divide-y divide-gray-100 dark:divide-gray-700">
            <button
              onClick={() => { setSelectedSubject(null); setShowSubjects(false); }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${!selectedSubject ? "text-primary font-semibold" : "text-gray-600 dark:text-gray-300"}`}
            >
              All subjects
            </button>
            {subjects.map((s) => (
              <button
                key={s.code}
                onClick={() => { setSelectedSubject(s); setShowSubjects(false); }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-between ${selectedSubject?.code === s.code ? "text-primary font-semibold" : "text-gray-600 dark:text-gray-300"}`}
              >
                <span>{s.name}</span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500">{s.level}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chat history */}
      <div className="flex-1 overflow-y-auto p-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 px-1 mb-2">This session</p>
        {userMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-10 gap-2">
            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400 dark:text-gray-500">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">No messages yet.<br />Ask something to start.</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {userMessages.map((msg, i) => (
              <div
                key={msg.id}
                className={`px-3 py-2.5 rounded-lg cursor-default transition-colors group ${i === userMessages.length - 1 ? "bg-primary/5 border border-primary/10" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}
              >
                <p className={`text-xs line-clamp-2 leading-relaxed ${i === userMessages.length - 1 ? "text-primary" : "text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300"}`}>
                  {msg.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sidebar footer */}
      <div className="p-3 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[10px] font-bold">AI</span>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Propel AI</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">Powered by past papers</p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-full bg-gray-50/30 dark:bg-gray-950 font-sans antialiased overflow-hidden">

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex w-64 flex-shrink-0 flex-col bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 shadow-sm">
        {sidebarContent}
      </aside>

      {/* ── Mobile Sidebar Overlay ── */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="md:hidden fixed left-0 top-0 h-full w-72 z-50 flex flex-col bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 shadow-2xl"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">Study Assistant</span>
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main chat area ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <div className="h-12 flex items-center justify-between px-4 sm:px-6 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-1.5 text-gray-500 dark:text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
            >
              <Menu size={18} />
            </button>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {selectedSubject ? `${selectedSubject.name} — Study Assistant` : "Study Assistant"}
            </span>
            {selectedSubject && (
              <button
                onClick={() => setSelectedSubject(null)}
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            )}
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">Cambridge · O-Level</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
            {messages.map((msg) => (
              <MessageRow key={msg.id} msg={msg} />
            ))}

            {loading && (
              <div className="flex gap-3 items-start">
                <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-primary">P</span>
                </div>
                <div className="flex items-center gap-1.5 px-4 py-3 rounded-2xl rounded-tl-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm mt-0.5">
                  <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 px-4 sm:px-6 py-4">
          <div className="max-w-2xl mx-auto">
            {selectedSubject && (
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs text-gray-400 dark:text-gray-500">Filtering by:</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/5 text-primary text-xs font-medium border border-primary/20">
                  {selectedSubject.name} ({selectedSubject.level})
                  <button onClick={() => setSelectedSubject(null)} className="hover:opacity-70 ml-0.5">✕</button>
                </span>
              </div>
            )}
            <div className="flex gap-3 items-end rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all duration-200 px-4 py-3">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={selectedSubject ? `Ask about ${selectedSubject.name}…` : "Ask an exam question, find papers, or explore topics…"}
                className="flex-1 resize-none outline-none text-[15px] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 bg-transparent min-h-[24px] max-h-40 leading-relaxed"
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 bg-primary hover:bg-primary/90 shadow-sm shadow-primary/20 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:shadow-none disabled:cursor-not-allowed"
                aria-label="Send"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22,2 15,22 11,13 2,9" />
                </svg>
              </button>
            </div>
            <p className="text-center text-[11px] text-gray-400 dark:text-gray-500 mt-2">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Message row ──────────────────────────────────────────────────────────────

function MessageRow({ msg }: { msg: Message }) {
  if (msg.type === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] sm:max-w-[78%] px-4 py-3 rounded-2xl rounded-br-sm bg-primary text-white shadow-sm shadow-primary/20">
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
          <p className="text-[10px] mt-1.5 text-white/60 text-right">
            {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 sm:gap-3 items-start">
      {/* Avatar */}
      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-[10px] sm:text-xs font-bold text-primary">P</span>
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        {/* Answer bubble */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl rounded-tl-sm border border-gray-100 dark:border-gray-700 shadow-sm px-4 py-3.5">
          <div className="space-y-2">{renderMarkdown(msg.content)}</div>
        </div>

        {/* Paper lookup results */}
        {msg.paperResults && msg.paperResults.length > 0 && (
          <PaperResults results={msg.paperResults} />
        )}

        {/* Available subjects hint */}
        {msg.availableSubjects && msg.availableSubjects.length > 0 && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3.5">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 mb-2">Available subjects in database:</p>
            <div className="flex flex-wrap gap-1.5">
              {msg.availableSubjects.map((s) => (
                <span key={s.code} className="px-2.5 py-1 rounded-full bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-700 text-xs text-amber-800 dark:text-amber-400 font-medium">
                  {s.name} <span className="text-amber-400">({s.level})</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Source question from paper */}
        {msg.relatedQuestion && (
          <div className={`rounded-xl overflow-hidden border ${msg.relatedQuestion.type === "exact" ? "border-primary/30 bg-primary/5 dark:bg-primary/10" : "border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/30"}`}>
            <div className={`px-4 py-2 border-b flex items-center gap-2 flex-wrap ${msg.relatedQuestion.type === "exact" ? "bg-primary/10 dark:bg-primary/15 border-primary/20" : "bg-blue-100/60 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800"}`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`flex-shrink-0 ${msg.relatedQuestion.type === "exact" ? "text-primary" : "text-blue-600 dark:text-blue-400"}`}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14,2 14,8 20,8" />
              </svg>
              <h4 className={`text-[11px] font-semibold uppercase tracking-wider ${msg.relatedQuestion.type === "exact" ? "text-primary" : "text-blue-700 dark:text-blue-400"}`}>
                {msg.relatedQuestion.type === "exact" ? "Exact question found in paper" : "Similar question found in paper"}
              </h4>
              <span className="ml-auto text-[10px] font-medium text-gray-400 dark:text-gray-500 hidden sm:block">
                {msg.relatedQuestion.source.subject} · {msg.relatedQuestion.source.year} {msg.relatedQuestion.source.session} · {msg.relatedQuestion.source.paper} · {msg.relatedQuestion.source.file_type}
              </span>
            </div>
            <div className="px-4 py-3">
              <p className="text-[13px] sm:text-[14px] text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap font-mono">{msg.relatedQuestion.text}</p>
              <p className="sm:hidden mt-2 text-[10px] text-gray-400 dark:text-gray-500">
                {msg.relatedQuestion.source.subject} · {msg.relatedQuestion.source.year} {msg.relatedQuestion.source.session}
              </p>
            </div>
          </div>
        )}

        {/* Marking points */}
        {msg.markingPoints && msg.markingPoints.length > 0 && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/60 overflow-hidden">
            <div className="px-4 py-2 bg-gray-100/80 dark:bg-gray-700/60 border-b border-gray-200 dark:border-gray-700">
              <h4 className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Marking Points</h4>
            </div>
            <div className="p-4 space-y-2.5">
              {msg.markingPoints.map((item, i) => (
                <div key={i} className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 flex-1">
                    <span className="text-primary text-xs mt-0.5 font-bold flex-shrink-0">{i + 1}.</span>
                    <p className="text-[14px] text-gray-700 dark:text-gray-300 leading-snug">{item.point}</p>
                  </div>
                  <span className="flex-shrink-0 inline-block px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                    {item.marks}m
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Common mistakes */}
        {msg.commonMistakes && msg.commonMistakes.length > 0 && (
          <div className="rounded-xl border border-red-100 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/30 overflow-hidden">
            <div className="px-4 py-2 bg-red-100/60 dark:bg-red-900/30 border-b border-red-100 dark:border-red-900/50">
              <h4 className="text-[11px] font-semibold text-red-500 dark:text-red-400 uppercase tracking-wider">Common Mistakes</h4>
            </div>
            <ul className="p-4 space-y-2">
              {msg.commonMistakes.map((m, i) => (
                <li key={i} className="text-[14px] text-red-700 dark:text-red-400 flex items-start gap-2 leading-snug">
                  <span className="flex-shrink-0 text-red-400 dark:text-red-500 font-bold mt-0.5">✗</span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Citations */}
        {msg.citations && msg.citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {msg.citations.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                {c.subjectName} · {c.year} {c.session} · {c.file_type}
              </span>
            ))}
          </div>
        )}

        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

// ─── Paper results ─────────────────────────────────────────────────────────────

function PaperResults({ results }: { results: any[] }) {
  return (
    <div className="space-y-3">
      {results.map((r, i) => (
        <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{r.subjectName || r.subject}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">{r.year}</span>
              <span className="px-2 py-0.5 rounded-md text-[10px] bg-primary/10 text-primary font-semibold">{r.level || "O"}-Level</span>
            </div>
          </div>
          <div className="px-4 py-3 space-y-3">
            {Object.values(r.sessions).map((s: any, si: number) => (
              <div key={si}>
                <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Session: {s.session}</p>
                <div className="flex flex-wrap gap-2">
                  {Object.values(s.papers).map((p: any, pi: number) => (
                    <div key={pi} className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">{p.paper}:</span>
                      {Object.keys(p.files).map((ft) => (
                        <span key={ft} className="px-2.5 py-1 rounded-lg bg-primary/5 text-primary text-xs font-semibold border border-primary/15 hover:bg-primary/10 transition-colors cursor-default">
                          {ft}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
