"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Send, Trash2 } from "lucide-react";
import {
  MentoringConversation,
  MentoringMessage,
  deleteConversationMessage,
  getConversationMessages,
  sendConversationMessage,
} from "@/lib/api";

interface ChatModalProps {
  isOpen: boolean;
  token: string;
  currentClerkId: string;
  conversation: MentoringConversation | null;
  onClose: () => void;
}

export default function ChatModal({
  isOpen,
  token,
  currentClerkId,
  conversation,
  onClose,
}: ChatModalProps) {
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
  }, [isOpen, conversation?.id, token]);

  const handleSend = async () => {
    if (!conversation?.id) return;
    const text = draft.trim();
    if (!text) return;

    setSending(true);
    setError("");

    try {
      const created = await sendConversationMessage(token, conversation.id, text);
      setMessages((current) => [...current, created]);
      setDraft("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!conversation?.id) return;

    const confirmed = window.confirm("Delete this message?");
    if (!confirmed) return;

    setError("");
    try {
      await deleteConversationMessage(token, conversation.id, messageId);
      setMessages((current) => current.filter((message) => message.id !== messageId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete message");
    }
  };

  if (!isOpen || !conversation) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Chat</h3>
            <p className="text-sm text-gray-500">Conversation with {partnerName}</p>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-800"
          >
            <X size={16} />
          </button>
        </div>

        <div className="h-[360px] overflow-y-auto px-4 py-3 space-y-3 bg-gray-50">
          {loading && <p className="text-sm text-gray-500">Loading messages...</p>}
          {!loading && messages.length === 0 && (
            <p className="text-sm text-gray-500">No messages yet. Start the conversation.</p>
          )}
          {messages.map((message) => {
            const mine = message.sender_clerk_id === currentClerkId;
            return (
              <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    mine ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-800"
                  }`}
                >
                  {mine && (
                    <div className="flex justify-end mb-1">
                      <button
                        onClick={() => void handleDelete(message.id)}
                        className={`inline-flex items-center gap-1 text-[11px] ${mine ? "text-gray-300 hover:text-white" : "text-gray-400"}`}
                        title="Delete message"
                      >
                        <Trash2 size={11} />
                        Delete
                      </button>
                    </div>
                  )}
                  <p>{message.body}</p>
                  <p className={`mt-1 text-[11px] ${mine ? "text-gray-300" : "text-gray-400"}`}>
                    {new Date(message.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {error && <p className="px-4 py-2 text-sm text-red-600">{error}</p>}

        <div className="p-4 border-t border-gray-100 flex items-center gap-2">
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
            className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
          />
          <button
            onClick={() => void handleSend()}
            disabled={sending || !draft.trim()}
            className="h-10 px-4 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-60 inline-flex items-center gap-2"
          >
            <Send size={14} />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
