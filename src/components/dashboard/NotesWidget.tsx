"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { StickyNote, Plus, Trash2, X } from "lucide-react";
import { useUser } from "@clerk/nextjs";

interface DashboardNote {
  id: string;
  text: string;
  createdAt: string;
}

interface WidgetPosition {
  x: number;
  y: number;
}

function makeStorageKey(userId?: string): string {
  return `propel_dashboard_notes_${userId || "guest"}`;
}

function makePositionStorageKey(userId?: string): string {
  return `propel_dashboard_notes_position_${userId || "guest"}`;
}

function formatCreatedAt(iso: string): string {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return "";
  return value.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotesWidget() {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<DashboardNote[]>([]);
  const [draft, setDraft] = useState("");
  const [fabPosition, setFabPosition] = useState<WidgetPosition>({ x: 0, y: 0 });

  const storageKey = useMemo(() => makeStorageKey(user?.id), [user?.id]);
  const positionStorageKey = useMemo(() => makePositionStorageKey(user?.id), [user?.id]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setNotes([]);
        return;
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        setNotes([]);
        return;
      }

      const validNotes = parsed
        .filter((item) => item && typeof item.id === "string" && typeof item.text === "string")
        .map((item) => ({
          id: item.id,
          text: item.text,
          createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
        })) as DashboardNote[];

      setNotes(validNotes);
    } catch {
      setNotes([]);
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(positionStorageKey);
      if (!raw) {
        setFabPosition({ x: 0, y: 0 });
        return;
      }

      const parsed = JSON.parse(raw);
      if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
        setFabPosition({ x: parsed.x, y: parsed.y });
      }
    } catch {
      setFabPosition({ x: 0, y: 0 });
    }
  }, [positionStorageKey]);

  const persist = (next: DashboardNote[]) => {
    setNotes(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const addNote = () => {
    const text = draft.trim();
    if (!text) return;

    const next: DashboardNote[] = [
      { id: `${Date.now()}`, text, createdAt: new Date().toISOString() },
      ...notes,
    ];

    persist(next);
    setDraft("");
  };

  const removeNote = (id: string) => {
    persist(notes.filter((note) => note.id !== id));
  };

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number; y: number } }) => {
    const next = {
      x: fabPosition.x + info.offset.x,
      y: fabPosition.y + info.offset.y,
    };

    setFabPosition(next);

    try {
      localStorage.setItem(positionStorageKey, JSON.stringify(next));
    } catch {
    }
  };

  return (
    <>
      <motion.div
        drag
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        style={{ x: fabPosition.x, y: fabPosition.y }}
        className="fixed right-6 bottom-6 z-[70] cursor-grab active:cursor-grabbing"
      >
        <button
          onClick={() => setOpen((value) => !value)}
          className="h-14 w-14 rounded-2xl bg-gray-950 text-white shadow-xl shadow-gray-900/20 hover:bg-black transition-colors flex items-center justify-center border border-white/10"
          aria-label={open ? "Close notes" : "Open notes"}
        >
          <StickyNote size={21} />
        </button>
      </motion.div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[69] bg-gray-950/20 backdrop-blur-[2px]"
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="fixed right-6 bottom-24 z-[70] w-[min(94vw,420px)] rounded-2xl border border-gray-200 bg-white text-gray-950 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/80">
                <div>
                  <h3 className="text-sm font-bold">My Notes</h3>
                  <p className="text-[11px] text-gray-500">Saved on this device</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  aria-label="Close notes panel"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-4 border-b border-gray-100">
                <div className="flex gap-2">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        addNote();
                      }
                    }}
                    placeholder="Write a quick note..."
                    className="flex-1 resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                    rows={2}
                  />
                  <button
                    onClick={addNote}
                    className="h-10 w-10 mt-auto rounded-xl bg-gray-950 text-white hover:bg-black transition-colors flex items-center justify-center"
                    title="Add note"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div className="max-h-[340px] overflow-y-auto p-4 space-y-2.5">
                {notes.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-center">
                    <p className="text-sm text-gray-500">No notes yet. Add your first note.</p>
                  </div>
                ) : (
                  notes.map((note) => (
                    <div key={note.id} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                      <div className="flex justify-between items-start gap-2">
                        <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{note.text}</p>
                        <button
                          onClick={() => removeNote(note.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Delete note"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <p className="mt-1 text-[11px] text-gray-400">{formatCreatedAt(note.createdAt)}</p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
