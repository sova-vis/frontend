"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { X, Send } from "lucide-react";
import {
  MentoringConversation,
  MentoringMessage,
  getConversationMessages,
  sendConversationMessage,
} from "@/lib/api";

interface ChatModalProps {
  isOpen: boolean;
  currentClerkId: string;
  conversation: MentoringConversation | null;
  onClose: () => void;
}

export default function ChatModal({
  isOpen,
  currentClerkId,
  conversation,
  onClose,
}: ChatModalProps) {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<MentoringMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const partnerName = useMemo(() => {
    if (!conversation) return "";
    if (conversation.student_clerk_id === currentClerkId) {
      return conversation.teacher_profile?.full_name || conversation.teacher_profile?.email || "Teacher";
    }
    return conversation.student_profile?.full_name || conversation.student_profile?.email || "Student";
  }, [conversation, currentClerkId]);

  useEffect(() => {
    if (!isOpen || !conversation?.id) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    const fetchMessages = async (isInitial = false) => {
      try {
        const token = await getToken();
        if (!token) {
          throw new Error("Session expired. Please sign in again.");
        }
        const rows = await getConversationMessages(token, conversation.id);
        if (!cancelled) {
          setMessages((current) => {
            if (current.length === rows.length) {
              let changed = false;
              for (let i = 0; i < rows.length; i += 1) {
                if (rows[i]?.id !== current[i]?.id || rows[i]?.body !== current[i]?.body) {
                  changed = true;
                  break;
                }
              }
              return changed ? rows : current;
            }
            return rows;
          });
        }
      } catch (err: unknown) {
        if (!cancelled && isInitial) {
          setError(err instanceof Error ? err.message : "Failed to load chat messages");
        }
      } finally {
        if (!cancelled && isInitial) {
          setLoading(false);
        }
      }
    };

    void fetchMessages(true);

    // Poll every 2 seconds while modal is open for near real-time chat updates.
    const interval = window.setInterval(() => {
      void fetchMessages(false);
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isOpen, conversation?.id, getToken]);

  const handleSend = async () => {
    if (!conversation?.id) return;
    const text = draft.trim();
    if (!text) return;

    setSending(true);
    setError("");

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Session expired. Please sign in again.");
      }
      const created = await sendConversationMessage(token, conversation.id, text);
      setMessages((current) => [...current, created]);
      setDraft("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  if (!isOpen || !conversation) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] bg-ink/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="ed-card w-full max-w-xl shadow-card-hover" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div>
            <h3 className="font-display text-lg font-semibold tracking-tight text-ink">Chat</h3>
            <p className="text-sm text-ink-muted">Conversation with {partnerName}</p>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-full border border-line flex items-center justify-center text-ink-muted hover:text-ink hover:bg-surface-soft transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="h-[360px] overflow-y-auto custom-scrollbar px-4 py-3 space-y-3 bg-surface-soft">
          {loading && <p className="text-sm text-ink-muted">Loading messages...</p>}
          {!loading && messages.length === 0 && (
            <p className="text-sm text-ink-muted">No messages yet. Start the conversation.</p>
          )}
          {messages.map((message) => {
            const mine = message.sender_clerk_id === currentClerkId;
            return (
              <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    mine ? "bg-crimson text-white" : "ed-card border border-line text-ink"
                  }`}
                >
                  <p>{message.body}</p>
                  <p className={`mt-1 text-[11px] ${mine ? "text-white/70" : "text-ink-faint"}`}>
                    {new Date(message.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {error && <p className="px-4 py-2 text-sm text-crimson">{error}</p>}

        <div className="p-4 border-t border-line flex items-center gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Type a message"
            className="ed-input flex-1 px-3 py-2 text-sm"
          />
          <button
            onClick={() => void handleSend()}
            disabled={sending || !draft.trim()}
            className="ed-btn-primary h-10 px-4 disabled:opacity-60"
          >
            <Send size={14} />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
