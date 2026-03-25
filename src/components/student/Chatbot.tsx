
"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { apiCall } from "@/lib/api";
import { useUser } from "@clerk/nextjs";
import { useClerkAuth } from "@/lib/useClerkAuth";
import { CircularOLogo } from "@/components/ui/Logo";
// ─── Types ───────────────────────────────────────────────────────────────────

interface Citation {
  subject: string;
  year: number;
  session?: string;
  paper?: string;
  variant?: string;
  similarity?: number;
  relation?: "direct" | "nearby";
  questionNumber?: string;
  subQuestion?: string;
  marks?: number;
  topicGeneral?: string;
  topicSyllabus?: string;
}

interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: string;
  citations?: Citation[];
  markingPoints?: Array<{ point: string; marks: number }>;
  commonMistakes?: string[];
  confidenceScore?: number;
  lowConfidence?: boolean;
  responseType?: "smalltalk" | "exam_question";
  nearbyReferences?: Citation[];
  sourceNote?: string;
  sourceType?: "past_paper" | "nearby_only" | "none";
  resolvedQuestion?: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  subjectName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PersistedChatState {
  activeChatId: string;
  sessions: ChatSession[];
}

const CHAT_STORAGE_PREFIX = "propel-chat-sessions-v1";
const MAX_STORED_SESSIONS = 30;

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeSession(session: ChatSession): ChatSession {
  return {
    ...session,
    messages: (session.messages || []).map((m) => ({
      ...m,
      timestamp: new Date(m.timestamp || Date.now()).toISOString(),
    })),
    createdAt: new Date(session.createdAt || Date.now()).toISOString(),
    updatedAt: new Date(session.updatedAt || Date.now()).toISOString(),
  };
}

function createEmptySession(): ChatSession {
  const now = new Date().toISOString();
  return {
    id: createId(),
    title: "New chat",
    messages: [],
    subjectName: null,
    createdAt: now,
    updatedAt: now,
  };
}

function buildChatTitle(firstPrompt: string): string {
  const normalized = firstPrompt.replace(/\s+/g, " ").trim();
  if (!normalized) return "New chat";

  const stripped = normalized.replace(
    /^(can you|could you|please|help me|i need help with|explain|tell me about)\s+/i,
    ""
  );

  const words = stripped.split(" ").filter(Boolean);
  const titleWords = words.slice(0, 9);
  const title = titleWords.join(" ");
  const finalTitle = title || normalized;

  if (finalTitle.length <= 58) return finalTitle;
  return `${finalTitle.slice(0, 58).trimEnd()}...`;
}

function sortSessionsByRecent(sessions: ChatSession[]): ChatSession[] {
  return [...sessions].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

function dedupeCitationList(items: Citation[] = []): Citation[] {
  const deduped = new Map<string, Citation>();

  for (const item of items) {
    const dedupeKey = `${item.subject}-${item.year}-${item.session || ""}-${item.paper || ""}-${item.variant || ""}-${item.relation || ""}`;

    const existing = deduped.get(dedupeKey);
    const existingScore = typeof existing?.similarity === "number" ? existing.similarity : -1;
    const currentScore = typeof item.similarity === "number" ? item.similarity : -1;
    if (!existing || currentScore >= existingScore) deduped.set(dedupeKey, item);
  }

  return Array.from(deduped.values()).sort(
    (a, b) => (typeof b.similarity === "number" ? b.similarity : -1) - (typeof a.similarity === "number" ? a.similarity : -1)
  );
}

function humanizePaperValue(value?: string): string {
  if (!value) return "?";
  return value
    .replace(/^paper[_\s-]*/i, "")
    .replace(/^variant[_\s-]*/i, "")
    .replace(/_/g, " ")
    .trim();
}

function humanizeSessionValue(value?: string): string {
  if (!value) return "Session unknown";
  return value
    .replace(/_/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

function buildCitationQuestionRef(c: Citation): string {
  const q = (c.questionNumber || "").trim();
  const sub = (c.subQuestion || "").trim();
  if (!q && !sub) return "";
  if (q && sub) return `Question ${q} ${sub}`;
  return q ? `Question ${q}` : `Question ${sub}`;
}

function formatCitationReference(c: Citation): string {
  const session = humanizeSessionValue(c.session);
  const questionRef = buildCitationQuestionRef(c);
  const questionSuffix = questionRef ? `, ${questionRef}` : "";
  return `${c.subject}, ${c.year} ${session}, Paper ${humanizePaperValue(c.paper)}, Variant ${humanizePaperValue(c.variant)}${questionSuffix}`
    .replace(/\s+/g, " ")
    .trim();
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

function parseMarkdownTableRow(rawLine: string): string[] {
  const normalized = rawLine.trim().replace(/^\|/, "").replace(/\|$/, "");
  return normalized.split("|").map((cell) => cell.trim());
}

function isMarkdownSeparatorRow(rawLine: string): boolean {
  const cells = parseMarkdownTableRow(rawLine);
  if (!cells.length) return false;
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, "")));
}

function renderMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];

  const lines = text.replace(/\r/g, "").split("\n");
  const nodes: React.ReactNode[] = [];
  let paragraphLines: string[] = [];
  let bulletLines: string[] = [];
  let numberedLines: string[] = [];

  const flushParagraph = () => {
    if (!paragraphLines.length) return;
    const key = `p-${nodes.length}`;
    nodes.push(
      <p key={key} className="text-[16px] leading-relaxed text-gray-700 dark:text-gray-300">
        {paragraphLines.map((line, idx) => (
          <span key={idx}>
            {renderInline(line)}
            {idx < paragraphLines.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
    paragraphLines = [];
  };

  const flushBullets = () => {
    if (!bulletLines.length) return;
    const key = `ul-${nodes.length}`;
    nodes.push(
      <ul key={key} className="list-disc list-inside space-y-1 my-2">
        {bulletLines.map((line, idx) => (
          <li key={idx} className="text-[16px] leading-relaxed text-gray-700 dark:text-gray-300">
            {renderInline(line)}
          </li>
        ))}
      </ul>
    );
    bulletLines = [];
  };

  const flushNumbered = () => {
    if (!numberedLines.length) return;
    const key = `ol-${nodes.length}`;
    nodes.push(
      <ol key={key} className="list-decimal list-inside space-y-1 my-2">
        {numberedLines.map((line, idx) => (
          <li key={idx} className="text-[16px] leading-relaxed text-gray-700 dark:text-gray-300">
            {renderInline(line)}
          </li>
        ))}
      </ol>
    );
    numberedLines = [];
  };

  const flushLists = () => {
    flushBullets();
    flushNumbered();
  };

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushParagraph();
      flushLists();
      continue;
    }

    const codeFence = trimmed.match(/^```([a-zA-Z0-9_-]+)?\s*$/);
    if (codeFence) {
      flushParagraph();
      flushLists();

      const language = (codeFence[1] || "").trim();
      const codeLines: string[] = [];

      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }

      const codeText = codeLines.join("\n");
      const looksLikeDiagram = /[+|\\/<>*]|->|<-|\^|v|\(|\)/.test(codeText);

      nodes.push(
        <div key={`code-${nodes.length}`} className="my-2">
          {language ? (
            <p className="mb-1 text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">
              {language}
            </p>
          ) : null}
          <pre
            className={`overflow-x-auto rounded-lg border px-3 py-2 text-[12px] leading-relaxed font-mono whitespace-pre ${
              looksLikeDiagram
                ? "border-slate-300/70 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
            }`}
          >
            <code>{codeText || " "}</code>
          </pre>
        </div>
      );
      continue;
    }

    const canStartTable =
      trimmed.startsWith("|") &&
      i + 1 < lines.length &&
      lines[i + 1].trim().startsWith("|") &&
      isMarkdownSeparatorRow(lines[i + 1]);

    if (canStartTable) {
      flushParagraph();
      flushLists();

      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i += 1;
      }
      i -= 1;

      const headerCells = parseMarkdownTableRow(tableLines[0] || "");
      const bodyRows = tableLines
        .slice(2)
        .map((line) => parseMarkdownTableRow(line));

      const colCount = headerCells.length;
      const normalizedRows = bodyRows.map((row) => {
        const next = [...row];
        while (next.length < colCount) next.push("");
        return next.slice(0, colCount);
      });

      nodes.push(
        <div key={`table-${nodes.length}`} className="my-2 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full border-collapse text-[13px]">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                {headerCells.map((cell, idx) => (
                  <th
                    key={`th-${idx}`}
                    className="px-3 py-2 text-left font-semibold text-gray-800 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700"
                  >
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {normalizedRows.map((row, rowIdx) => (
                <tr key={`tr-${rowIdx}`} className="odd:bg-white even:bg-gray-50/70 dark:odd:bg-gray-900 dark:even:bg-gray-900/60">
                  {row.map((cell, cellIdx) => (
                    <td
                      key={`td-${rowIdx}-${cellIdx}`}
                      className="px-3 py-2 align-top text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-800"
                    >
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushLists();

      const level = headingMatch[1].length;
      const headingText = headingMatch[2].trim();
      const headingClass = level <= 2
        ? "text-[18px] sm:text-[19px] font-semibold text-gray-900 dark:text-gray-100 mt-2"
        : "text-[17px] sm:text-[18px] font-semibold text-gray-900 dark:text-gray-100 mt-2";

      nodes.push(
        <h3 key={`h-${nodes.length}`} className={headingClass}>
          {renderInline(headingText)}
        </h3>
      );
      continue;
    }

    const bulletMatch = trimmed.match(/^[-•*]\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph();
      flushNumbered();
      bulletLines.push(bulletMatch[1]);
      continue;
    }

    const numberedMatch = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (numberedMatch) {
      flushParagraph();
      flushBullets();
      numberedLines.push(numberedMatch[1]);
      continue;
    }

    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushLists();

  return nodes;
}

// ─── Greeting helper ──────────────────────────────────────────────────────────

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Chatbot() {
  const { user } = useUser();
  const { profile } = useClerkAuth();
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>("");
  const [isHydrated, setIsHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);

  const userName = profile?.full_name?.split(" ")[0] || user?.firstName || "Student";
  const storageKey = `${CHAT_STORAGE_PREFIX}-${user?.id || "anon"}`;
  const activeChat = useMemo(
    () => chatSessions.find((s) => s.id === activeChatId) || null,
    [chatSessions, activeChatId]
  );
  const messages = useMemo(() => activeChat?.messages || [], [activeChat]);
  const latestAssistantMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].type === "assistant") return messages[i].id;
    }
    return null;
  }, [messages]);
  const isEmptyChat = messages.filter((m) => m.type === "user").length === 0;

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
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        const first = createEmptySession();
        setChatSessions([first]);
        setActiveChatId(first.id);
        setIsHydrated(true);
        return;
      }

      const parsed = JSON.parse(raw) as PersistedChatState;
      const normalized = Array.isArray(parsed?.sessions)
        ? parsed.sessions.map(normalizeSession).slice(0, MAX_STORED_SESSIONS)
        : [];

      if (normalized.length === 0) {
        const first = createEmptySession();
        setChatSessions([first]);
        setActiveChatId(first.id);
        setIsHydrated(true);
        return;
      }

      const sorted = sortSessionsByRecent(normalized);
      const preferredId = parsed?.activeChatId;
      const activeExists = sorted.some((s) => s.id === preferredId);

      setChatSessions(sorted);
      setActiveChatId(activeExists ? preferredId : sorted[0].id);
    } catch {
      const first = createEmptySession();
      setChatSessions([first]);
      setActiveChatId(first.id);
    } finally {
      setIsHydrated(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") return;
    if (chatSessions.length === 0) return;

    const stateToPersist: PersistedChatState = {
      activeChatId,
      sessions: chatSessions.slice(0, MAX_STORED_SESSIONS),
    };

    window.localStorage.setItem(storageKey, JSON.stringify(stateToPersist));
  }, [isHydrated, chatSessions, activeChatId, storageKey]);

  useEffect(() => {
    if (!isHydrated) return;
    if (chatSessions.length > 0 && chatSessions.some((s) => s.id === activeChatId)) {
      return;
    }

    if (chatSessions.length === 0) {
      const first = createEmptySession();
      setChatSessions([first]);
      setActiveChatId(first.id);
      return;
    }

    setActiveChatId(chatSessions[0].id);
  }, [isHydrated, chatSessions, activeChatId]);

  const updateActiveSession = useCallback(
    (updater: (session: ChatSession) => ChatSession) => {
      setChatSessions((prev) =>
        sortSessionsByRecent(
          prev.map((session) => {
            if (session.id !== activeChatId) return session;
            return normalizeSession(updater(session));
          })
        )
      );
    },
    [activeChatId]
  );

  const handleNewChat = useCallback(() => {
    const next = createEmptySession();
    setChatSessions((prev) =>
      sortSessionsByRecent([next, ...prev].slice(0, MAX_STORED_SESSIONS))
    );
    setActiveChatId(next.id);
    setInput("");
    setLoading(false);
    setTypingMessageId(null);
    setMobileSidebarOpen(false);
  }, []);

  const handleDeleteChat = useCallback(
    (sessionId: string, e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      const remaining = chatSessions.filter((s) => s.id !== sessionId);
      setChatSessions(remaining);

      if (activeChatId === sessionId) {
        if (remaining.length > 0) {
          setActiveChatId(remaining[0].id);
        } else {
          const next = createEmptySession();
          setChatSessions([next]);
          setActiveChatId(next.id);
          setInput("");
          setLoading(false);
        }
      }
    },
    [activeChatId, chatSessions]
  );

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || !activeChatId) return;

    const nowIso = new Date().toISOString();

    const userMsg: Message = {
      id: createId(),
      type: "user",
      content: trimmed,
      timestamp: nowIso,
    };

    const historyMessages = messages.slice(-8).map((m) => ({
      role: m.type === "user" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }));

    updateActiveSession((session) => {
      const userCount = session.messages.filter((m) => m.type === "user").length;
      const nextTitle = userCount === 0 ? buildChatTitle(trimmed) : session.title;
      return {
        ...session,
        title: nextTitle,
        updatedAt: nowIso,
        messages: [...session.messages, userMsg],
      };
    });

    setInput("");
    setLoading(true);

    try {
      const body: any = { question: trimmed, limit: 5, history: historyMessages };

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
      let sourceNote: string | undefined;
      let sourceType: Message["sourceType"];
      let resolvedQuestion: string | undefined;
      const responseType: Message["responseType"] = data.type === "smalltalk" ? "smalltalk" : "exam_question";

      if (data.type === "smalltalk") {
        content = data.answer;
      } else {
        if (!data?.answer) throw new Error("Invalid response");
        content = data.answer;
        citations = dedupeCitationList((data.citations || []).map((c: any) => ({
          subject: c.subject,
          year: c.year,
          session: c.session,
          paper: c.paper,
          variant: c.variant,
          similarity: c.similarity,
          relation: c.relation,
          questionNumber: c.questionNumber,
          subQuestion: c.subQuestion,
          marks: c.marks,
          topicGeneral: c.topicGeneral,
          topicSyllabus: c.topicSyllabus,
        }))).slice(0, 1);
        markingPoints = data.marking_points;
        commonMistakes = data.common_mistakes;
        confidenceScore = data.confidence_score;
        lowConfidence = data.low_confidence;
        sourceNote = typeof data.source_note === "string" ? data.source_note : undefined;
        sourceType =
          data.source_type === "past_paper" ||
          data.source_type === "nearby_only" ||
          data.source_type === "none"
            ? data.source_type
            : undefined;
        resolvedQuestion =
          typeof data.resolved_question === "string"
            ? data.resolved_question
            : undefined;
      }

      const assistantTimestamp = new Date().toISOString();
      const assistantMessageId = createId();
      updateActiveSession((session) => ({
        ...session,
        updatedAt: assistantTimestamp,
        messages: [
          ...session.messages,
          {
            id: assistantMessageId,
            type: "assistant",
            content,
            timestamp: assistantTimestamp,
            citations: citations?.length ? citations : undefined,
            markingPoints,
            commonMistakes,
            confidenceScore,
            lowConfidence,
            responseType,
            sourceNote,
            sourceType,
            resolvedQuestion,
          },
        ],
      }));
      setTypingMessageId(assistantMessageId);
    } catch {
      const assistantTimestamp = new Date().toISOString();
      const assistantMessageId = createId();
      updateActiveSession((session) => ({
        ...session,
        updatedAt: assistantTimestamp,
        messages: [
          ...session.messages,
          {
            id: assistantMessageId,
            type: "assistant",
            content: "Something went wrong. Please try again.",
            timestamp: assistantTimestamp,
          },
        ],
      }));
      setTypingMessageId(assistantMessageId);
    } finally {
      setLoading(false);
    }
  }, [
    input,
    loading,
    activeChatId,
    messages,
    updateActiveSession,
  ]);

  const showCenteredComposer = isEmptyChat && !loading;

  const renderComposer = ({ centered = false }: { centered?: boolean } = {}) => {
    if (centered) {
      return (
        <div className="w-full max-w-4xl">
          <div className="rounded-[26px] border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/90 shadow-sm px-5 sm:px-6 py-5 min-h-[150px] flex flex-col">
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
              placeholder="How can I help you today?"
              className="w-full resize-none outline-none text-[17px] sm:text-[18px] text-gray-800 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-500 bg-transparent min-h-[64px] max-h-40 leading-relaxed"
            />

            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                className="w-8 h-8 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="More options"
              >
                <span className="text-[30px] leading-none">+</span>
              </button>

              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 bg-primary hover:bg-primary/90 shadow-sm shadow-primary/20 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:shadow-none disabled:cursor-not-allowed"
                aria-label="Send"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22,2 15,22 11,13 2,9" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-3xl mx-auto">
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
            placeholder="Ask an exam question or explore topics..."
            className="flex-1 resize-none outline-none text-[16px] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 bg-transparent min-h-[24px] max-h-40 leading-relaxed"
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
    );
  };

  const sidebarContent = (
    <>
      {/* New chat */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-800">
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


      {/* Chat history */}
      {/* Chat history */}
      <div className="flex-1 overflow-y-auto p-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 px-1 mb-2">Chats</p>
        {chatSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-10 gap-2">
            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400 dark:text-gray-500">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">No messages yet.<br />Ask something to start.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {chatSessions.map((session) => {
              const isActive = session.id === activeChatId;

              return (
                <div key={session.id} className="group relative">
                  <button
                    onClick={() => {
                      setActiveChatId(session.id);
                      setMobileSidebarOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors border pr-12 ${
                      isActive
                        ? "bg-primary/5 border-primary/20"
                        : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <p className={`text-xs leading-relaxed line-clamp-2 ${isActive ? "text-primary font-semibold" : "text-gray-700 dark:text-gray-200 font-medium"}`}>
                      {session.title}
                    </p>
                  </button>
                  <button
                    onClick={(e) => handleDeleteChat(session.id, e)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                    title="Delete chat"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sidebar footer */}
      <div className="p-3 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <CircularOLogo size={28} />
          <div>
            <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Propel AI</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">Powered by past papers</p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="relative flex h-full bg-gray-50/30 dark:bg-gray-950 font-sans antialiased overflow-hidden">
      <button
        onClick={() => setMobileSidebarOpen((v) => !v)}
        className="fixed top-[88px] z-[60] p-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-primary hover:bg-primary/5 transition-all duration-200 shadow-sm lg:hidden"
        style={{ left: mobileSidebarOpen ? "calc(18rem + 0.75rem)" : "1rem" }}
        aria-label={mobileSidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        {mobileSidebarOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* ── Sidebar Overlay ── */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-x-0 bottom-0 top-[74px] z-40 bg-black/45 backdrop-blur-sm"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed left-0 top-[74px] h-[calc(100vh-74px)] w-72 z-50 flex flex-col bg-white dark:bg-black border-r border-gray-100 dark:border-gray-800 shadow-2xl"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <aside className="hidden lg:flex lg:w-72 lg:flex-col bg-white dark:bg-black border-r border-gray-100 dark:border-gray-800 shadow-sm">
        {sidebarContent}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-y-auto">
          {showCenteredComposer ? (
            <div className="h-full flex flex-col items-center justify-center px-4">
              <div className="mb-4">
                <CircularOLogo size={44} />
              </div>
              <h1 className="text-3xl sm:text-4xl font-semibold text-gray-800 dark:text-gray-100 mb-1.5">
                {getTimeGreeting()}, {userName}
              </h1>
              <p className="text-gray-400 dark:text-gray-500 text-lg">How can I help you study today?</p>
              <div className="mt-8 w-full flex justify-center">
                {renderComposer({ centered: true })}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
              {messages.map((msg) => (
                <MessageRow
                  key={msg.id}
                  msg={msg}
                  shouldAnimateTyping={
                    Boolean(typingMessageId) &&
                    typingMessageId === msg.id &&
                    latestAssistantMessageId === msg.id
                  }
                  onTypingComplete={() => {
                    if (typingMessageId === msg.id) setTypingMessageId(null);
                  }}
                />
              ))}

              {loading && (
                <div className="flex gap-3 items-start">
                  <div className="flex-shrink-0 mt-0.5">
                    <CircularOLogo size={32} />
                  </div>
                  <div className="flex items-center gap-1.5 px-4 py-3 rounded-2xl rounded-tl-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {!showCenteredComposer && (
          <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 px-4 sm:px-6 py-4">
            {renderComposer()}
          </div>
        )}
      </div>
    </div>
  );
}

function AssistantTypedContent({
  text,
  animate,
  onComplete,
}: {
  text: string;
  animate: boolean;
  onComplete?: () => void;
}) {
  const [visible, setVisible] = useState(animate ? "" : text);

  useEffect(() => {
    if (!animate) {
      setVisible(text);
      return;
    }

    let idx = 0;
    const step = Math.max(1, Math.ceil(text.length / 120));
    const timer = setInterval(() => {
      idx = Math.min(text.length, idx + step);
      setVisible(text.slice(0, idx));
      if (idx >= text.length) {
        clearInterval(timer);
        onComplete?.();
      }
    }, 18);

    return () => clearInterval(timer);
  }, [text, animate, onComplete]);

  const typingDone = visible.length >= text.length;

  return (
    <div className="space-y-2">
      {renderMarkdown(visible)}
      {animate && !typingDone && (
        <span className="inline-block text-primary/80 text-sm font-medium animate-pulse">|</span>
      )}
    </div>
  );
}

function MessageRow({
  msg,
  shouldAnimateTyping,
  onTypingComplete,
}: {
  msg: Message;
  shouldAnimateTyping?: boolean;
  onTypingComplete?: () => void;
}) {
  if (msg.type === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] sm:max-w-[85%] px-4 py-3 rounded-2xl rounded-br-sm bg-primary text-white shadow-sm shadow-primary/20">
          <p className="text-[16px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
          <p className="text-[10px] mt-1.5 text-white/60 text-right">
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>
    );
  }

  const primaryCitation = msg.citations?.[0];
  const sourceType = msg.sourceType || (primaryCitation ? "past_paper" : "none");
  const sourceNote =
    msg.sourceNote ||
    (primaryCitation
      ? `A similar question appeared in ${formatCitationReference(primaryCitation)}.`
      : "");
  const showSourceCard =
    msg.responseType === "exam_question" &&
    (Boolean(primaryCitation) || Boolean(sourceNote));

  const sourceCardClass =
    sourceType === "past_paper"
      ? "border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/25"
      : sourceType === "nearby_only"
        ? "border-blue-100 dark:border-blue-900/50 bg-blue-50/70 dark:bg-blue-950/25"
        : "border-amber-100 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/25";

  const sourceTextClass =
    sourceType === "past_paper"
      ? "text-emerald-900 dark:text-emerald-200"
      : sourceType === "nearby_only"
        ? "text-blue-900 dark:text-blue-200"
        : "text-amber-900 dark:text-amber-200";

  return (
    <div className="flex gap-2 sm:gap-3 items-start">
      <div className="flex-shrink-0 mt-0.5">
        <CircularOLogo size={32} />
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        <div className="bg-gradient-to-b from-white to-slate-50/70 dark:from-slate-800 dark:to-slate-900/95 rounded-2xl rounded-tl-sm border border-slate-200/80 dark:border-slate-700 shadow-sm px-4 py-3.5">
          <AssistantTypedContent
            text={msg.content}
            animate={Boolean(shouldAnimateTyping)}
            onComplete={onTypingComplete}
          />
        </div>

        {showSourceCard && (
          <div className={`rounded-xl border p-3.5 ${sourceCardClass}`}>
            <p className={`text-[13px] leading-relaxed ${sourceTextClass}`}>{sourceNote}</p>

            {primaryCitation && (
              <div className="mt-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2">
                <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Similar Past Paper
                </p>
                <p className="mt-1 text-[12px] text-gray-700 dark:text-gray-300 leading-snug">
                  {primaryCitation.subject} · {primaryCitation.year} {humanizeSessionValue(primaryCitation.session)} · Paper {humanizePaperValue(primaryCitation.paper)} · Variant {humanizePaperValue(primaryCitation.variant)}
                </p>

                {buildCitationQuestionRef(primaryCitation) && (
                  <p className="mt-1 text-[12px] text-gray-700 dark:text-gray-300 leading-snug">
                    {buildCitationQuestionRef(primaryCitation)}
                    {Number.isFinite(primaryCitation.marks)
                      ? ` (${primaryCitation.marks} marks)`
                      : ""}
                  </p>
                )}

                {primaryCitation.topicSyllabus && (
                  <p className="mt-1 text-[12px] text-gray-600 dark:text-gray-400 leading-snug">
                    Topic: {primaryCitation.topicSyllabus}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

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

        {msg.commonMistakes && msg.commonMistakes.length > 0 && (
          <div className="rounded-xl border border-red-100 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/30 overflow-hidden">
            <div className="px-4 py-2 bg-red-100/60 dark:bg-red-900/30 border-b border-red-100 dark:border-red-900/50">
              <h4 className="text-[11px] font-semibold text-red-500 dark:text-red-400 uppercase tracking-wider">Common Mistakes</h4>
            </div>
            <ul className="p-4 space-y-2">
              {msg.commonMistakes.map((mistake, i) => (
                <li key={i} className="text-[14px] text-red-700 dark:text-red-400 flex items-start gap-2 leading-snug">
                  <span className="flex-shrink-0 text-red-400 dark:text-red-500 font-bold mt-0.5">x</span>
                  <span>{mistake}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}
