"use client";

/**
 * DrawCanvas — a fullscreen sketch surface for answering by hand without a photo.
 * The student draws with mouse / stylus / finger (pen, eraser, text box, colours,
 * thickness); on save we composite the ink onto a white sheet and export a PNG
 * File, so it rides the EXACT same handwritten-answer pipeline as an uploaded
 * photo (no backend change — a drawing is just an image).
 *
 * Rendered as a plain fixed overlay (NOT a body portal) so it still shows when a
 * parent has entered the browser Fullscreen API — a body-portaled node would be
 * hidden behind the fullscreened element. Mount it as a child of the focus
 * surface and it works whether or not real fullscreen is active.
 */
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/propel/Icon";
import DrawLayer, { type DrawLayerHandle, type DrawTool } from "./drawing/DrawLayer";
import DrawToolbar from "./drawing/DrawToolbar";
import { DEFAULT_DRAW_COLOR, DEFAULT_DRAW_SIZE } from "./drawing/constants";

export default function DrawCanvas({ open, title, onClose, onSave, saving }: {
  open: boolean;
  title?: string;
  onClose: () => void;
  onSave: (file: File) => void;
  saving?: boolean;
}) {
  const layerRef = useRef<DrawLayerHandle>(null);
  const [tool, setTool] = useState<DrawTool>("pen");
  const [color, setColor] = useState<string>(DEFAULT_DRAW_COLOR);
  const [size, setSize] = useState<number>(DEFAULT_DRAW_SIZE);
  const [status, setStatus] = useState({ dirty: false, canUndo: false });

  // reset tool state each time it opens (the layer remounts via `key`)
  useEffect(() => {
    if (!open) return;
    setTool("pen");
    setStatus({ dirty: false, canUndo: false });
    const onKey = (e: KeyboardEvent) => {
      // Escape closes — but let a text box swallow its own Escape first
      if (e.key === "Escape" && !(e.target instanceof HTMLTextAreaElement)) { e.stopPropagation(); onClose(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  const save = async () => {
    if (!layerRef.current || !status.dirty) return;
    const blob = await layerRef.current.toBlob({ background: "white" });
    if (!blob) return;
    onSave(new File([blob], `drawing-${Date.now()}.png`, { type: "image/png" }));
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || "Draw your answer"}
      style={{ position: "fixed", inset: 0, zIndex: 5000, background: "rgba(10,12,16,.78)", backdropFilter: "blur(3px)", display: "flex", flexDirection: "column", padding: "clamp(10px,2vw,22px)" }}
    >
      <div className="pr" style={{ margin: "auto", width: "100%", maxWidth: 980, display: "flex", flexDirection: "column", gap: 10, minHeight: 0, flex: 1 }}>
        {/* toolbar */}
        <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 16 }}>
          <div className="flex items-center gap-8" style={{ minWidth: 0 }}>
            <Icon name="edit" size={16} style={{ color: "var(--crimson)", flex: "none" }} />
            <span style={{ fontWeight: 650, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "30vw" }}>{title || "Draw your answer"}</span>
          </div>
          <DrawToolbar tool={tool} setTool={setTool} color={color} setColor={setColor} size={size} setSize={setSize}
            onUndo={() => layerRef.current?.undo()} onClear={() => layerRef.current?.clear()}
            canUndo={status.canUndo} dirty={status.dirty} />
        </div>

        {/* drawing surface */}
        <DrawLayer
          key={open ? "open" : "closed"}
          ref={layerRef}
          tool={tool} color={color} size={size}
          whiteExport
          onStatusChange={setStatus}
          className="card"
          minHeight={240}
          style={{ flex: 1, minHeight: 240, padding: 0, background: "#fff", borderColor: "var(--line-strong)", borderRadius: 18 }}
        />

        {/* actions */}
        <div className="flex items-center gap-10 wrap" style={{ justifyContent: "flex-end" }}>
          <span className="faint" style={{ fontSize: 12, marginRight: "auto" }}>
            {tool === "text" ? "Tap the canvas to add text." : status.dirty ? "It'll be marked like a handwritten photo." : "Draw your working above."}
          </span>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}><Icon name="x" size={15} /> Cancel</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!status.dirty || saving}>
            {saving ? <><Icon name="refresh" size={15} className="spin" /> Saving…</> : <><Icon name="check_circle" size={15} /> Use this drawing</>}
          </button>
        </div>
      </div>
    </div>
  );
}
