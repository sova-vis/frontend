"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/propel/Icon";
import type { Annotation } from "@/lib/review";

/**
 * Overlay for "red pen" marking on a student's answer. Wrap the answer content
 * as children; ticks / crosses / note-pins are positioned as a percentage of this
 * box, so the same marks render in the same spots for the teacher (editable) and
 * the student (read-only). Images in the wrapped content should render full-width
 * with preserved aspect ratio so the percentages line up across both views.
 */

const PEN = "#dc2743";

let _seq = 0;
const newId = () => `a${Date.now().toString(36)}${(_seq++).toString(36)}`;

export default function AnswerAnnotator({
  annotations, editable = false, onChange, children,
}: {
  annotations: Annotation[];
  editable?: boolean;
  onChange?: (next: Annotation[]) => void;
  children: React.ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<"note" | "tick" | "cross" | null>(null);
  const [openNote, setOpenNote] = useState<string | null>(null);

  const place = (e: React.MouseEvent) => {
    if (!editable || !tool || !wrapRef.current || !onChange) return;
    const rect = wrapRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    const id = newId();
    const a: Annotation = tool === "note" ? { id, kind: "note", x, y, text: "" } : { id, kind: tool, x, y };
    onChange([...annotations, a]);
    if (tool === "note") setOpenNote(id);
  };

  const update = (id: string, patch: Partial<Annotation>) =>
    onChange?.(annotations.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const remove = (id: string) => {
    onChange?.(annotations.filter((a) => a.id !== id));
    if (openNote === id) setOpenNote(null);
  };

  const noteOrder = annotations.filter((a) => a.kind === "note").map((a) => a.id);

  return (
    <div>
      {editable && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: PEN, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Icon name="edit" size={13} /> Red pen
          </span>
          {([["tick", "✓ Tick"], ["cross", "✗ Cross"], ["note", "+ Note"]] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTool(tool === k ? null : k)}
              style={{
                padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: `1.5px solid ${tool === k ? PEN : "rgba(128,128,128,.4)"}`,
                background: tool === k ? PEN : "transparent", color: tool === k ? "#fff" : "inherit",
              }}
            >
              {label}
            </button>
          ))}
          {tool && <span style={{ fontSize: 11.5, opacity: 0.7 }}>Tap the answer to place · tap a mark to remove</span>}
        </div>
      )}

      <div ref={wrapRef} style={{ position: "relative" }}>
        {children}

        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {annotations.map((a) => {
            const common: React.CSSProperties = {
              position: "absolute", left: `${a.x}%`, top: `${a.y}%`,
              transform: "translate(-50%, -50%)", pointerEvents: "auto",
            };
            if (a.kind === "tick" || a.kind === "cross") {
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => editable && remove(a.id)}
                  title={editable ? "Remove" : undefined}
                  style={{
                    ...common, border: "none", background: "transparent",
                    cursor: editable ? "pointer" : "default", color: PEN, fontWeight: 900,
                    fontSize: 24, lineHeight: 1, padding: 0, textShadow: "0 0 3px #fff, 0 0 3px #fff, 0 0 3px #fff",
                  }}
                >
                  {a.kind === "tick" ? "✓" : "✗"}
                </button>
              );
            }
            const n = noteOrder.indexOf(a.id) + 1;
            const open = openNote === a.id;
            return (
              <div key={a.id} style={common}>
                <button
                  type="button"
                  onClick={() => setOpenNote(open ? null : a.id)}
                  style={{
                    width: 20, height: 20, borderRadius: "50%", border: "2px solid #fff", background: PEN,
                    color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer",
                    boxShadow: "0 1px 3px rgba(0,0,0,.35)", display: "grid", placeItems: "center", padding: 0,
                  }}
                >
                  {n}
                </button>
                {open && (
                  <div
                    style={{
                      position: "absolute", top: 25, left: "50%", transform: "translateX(-50%)", width: 210,
                      background: "#fff", color: "#1a1a1a", borderRadius: 8, boxShadow: "0 6px 20px rgba(0,0,0,.22)",
                      padding: 8, zIndex: 6, border: "1px solid rgba(0,0,0,.12)",
                    }}
                  >
                    {editable ? (
                      <>
                        <textarea
                          autoFocus
                          value={a.text ?? ""}
                          onChange={(e) => update(a.id, { text: e.target.value })}
                          placeholder="Note for the student…"
                          style={{
                            width: "100%", minHeight: 54, fontSize: 12.5, border: "1px solid rgba(0,0,0,.15)",
                            borderRadius: 6, padding: 6, resize: "vertical", fontFamily: "inherit",
                            color: "#1a1a1a", background: "#fff", boxSizing: "border-box",
                          }}
                        />
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                          <button type="button" onClick={() => remove(a.id)} style={{ fontSize: 11.5, color: PEN, fontWeight: 600, border: "none", background: "transparent", cursor: "pointer", padding: 0 }}>Delete</button>
                          <button type="button" onClick={() => setOpenNote(null)} style={{ fontSize: 11.5, fontWeight: 600, border: "none", background: "transparent", cursor: "pointer", padding: 0 }}>Done</button>
                        </div>
                      </>
                    ) : (
                      <p style={{ fontSize: 12.5, whiteSpace: "pre-wrap", margin: 0 }}>{a.text || "—"}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Placement catcher sits on top while a tool is armed. */}
          {editable && tool && (
            <div onClick={place} style={{ position: "absolute", inset: 0, pointerEvents: "auto", cursor: "crosshair" }} />
          )}
        </div>
      </div>
    </div>
  );
}
