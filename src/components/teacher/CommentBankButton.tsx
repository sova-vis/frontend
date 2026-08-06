"use client";

import { useEffect, useRef, useState } from "react";
import { BookMarked, Plus } from "lucide-react";
import { CommentBankEntry, addToCommentBank, getCommentBank } from "@/lib/feedbackRelease";

// Topic-filtered comment bank picker (§10.3): insert a saved snippet into a
// comment field, or save the current text back to the bank in one click.
export default function CommentBankButton({
  topic,
  currentText,
  onInsert,
}: {
  topic?: string | null;
  currentText: string;
  onInsert: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<CommentBankEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getCommentBank(topic || undefined)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [open, topic]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const saveCurrent = async () => {
    if (!currentText.trim()) return;
    try {
      const created = await addToCommentBank(currentText.trim(), topic || undefined);
      setEntries((prev) => [created, ...prev]);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="ed-btn-ghost px-2 py-1 text-[0.7rem]" title="Comment bank">
        <BookMarked size={12} /> Bank
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-64 ed-card p-2 max-h-64 overflow-y-auto">
          {currentText.trim() && (
            <button onClick={() => void saveCurrent()} className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-crimson hover:bg-crimson-soft text-left">
              <Plus size={12} /> Save current comment to bank
            </button>
          )}
          {loading ? (
            <p className="text-xs text-ink-faint px-2 py-2">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-xs text-ink-faint px-2 py-2">No saved comments{topic ? ` for ${topic}` : ""} yet.</p>
          ) : (
            entries.map((e) => (
              <button
                key={e.id}
                onClick={() => {
                  onInsert(e.text);
                  setOpen(false);
                }}
                className="w-full rounded-lg px-2 py-1.5 text-xs text-ink hover:bg-surface-soft text-left"
              >
                {e.text}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
