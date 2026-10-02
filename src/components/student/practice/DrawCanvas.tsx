"use client";

/**
 * DrawCanvas — a floating, draggable, resizable sketch panel for answering a
 * topic question by hand. It docks to the side so the question stays visible,
 * can be dragged by its title bar and resized from the corner, and exports the
 * ink composited onto a white sheet as a PNG File — riding the EXACT same
 * handwritten-answer pipeline as an uploaded photo (no backend change).
 *
 * Rendered as a plain fixed panel (NOT a body portal) so it still shows when a
 * parent has entered the browser Fullscreen API — a body-portaled node would be
 * hidden behind the fullscreened element. Mount it as a child of the focus
 * surface and it works whether or not real fullscreen is active.
 */
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Icon } from "@/components/propel/Icon";
import DrawLayer, { type DrawLayerHandle, type DrawTool } from "./drawing/DrawLayer";
import DrawToolbar from "./drawing/DrawToolbar";
import { DEFAULT_DRAW_COLOR, DEFAULT_DRAW_SIZE } from "./drawing/constants";

const MIN_W = 300, MIN_H = 320;

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

  const [mounted, setMounted] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [box, setBox] = useState({ w: 460, h: 560 });
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const rez = useRef<{ px: number; py: number; w: number; h: number } | null>(null);

  // place it on open: docked to the right (desktop) or near-fullscreen (phone)
  useEffect(() => {
    if (!open) return;
    setTool("pen");
    setStatus({ dirty: false, canUndo: false });
    setMounted(true);
    const vw = window.innerWidth, vh = window.innerHeight;
    const isMobile = vw < 700;
    setMobile(isMobile);
    if (isMobile) {
      setBox({ w: vw - 16, h: vh - 16 });
      setPos({ x: 8, y: 8 });
    } else {
      const w = Math.min(480, vw - 32), h = Math.min(600, vh - 96);
      setBox({ w, h });
      setPos({ x: Math.max(16, vw - w - 20), y: Math.max(64, Math.round((vh - h) / 2)) });
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target instanceof HTMLTextAreaElement)) { e.stopPropagation(); onClose(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  const startDrag = (e: ReactPointerEvent) => {
    if (!pos) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ox: pos.x, oy: pos.y };
  };
  const startResize = (e: ReactPointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    rez.current = { px: e.clientX, py: e.clientY, w: box.w, h: box.h };
  };
  const onMove = (e: ReactPointerEvent) => {
    const vw = window.innerWidth, vh = window.innerHeight;
    if (drag.current && pos) {
      const nx = drag.current.ox + (e.clientX - drag.current.px);
      const ny = drag.current.oy + (e.clientY - drag.current.py);
      setPos({ x: Math.min(Math.max(-box.w + 90, nx), vw - 90), y: Math.min(Math.max(0, ny), vh - 44) });
    } else if (rez.current && pos) {
      setBox({
        w: Math.max(MIN_W, Math.min(rez.current.w + (e.clientX - rez.current.px), vw - pos.x - 8)),
        h: Math.max(MIN_H, Math.min(rez.current.h + (e.clientY - rez.current.py), vh - pos.y - 8)),
      });
    }
  };
  const endMove = () => { drag.current = null; rez.current = null; };

  const save = async () => {
    if (!layerRef.current || !status.dirty) return;
    const blob = await layerRef.current.toBlob({ background: "white" });
    if (!blob) return;
    onSave(new File([blob], `drawing-${Date.now()}.png`, { type: "image/png" }));
  };

  if (!open || !mounted || !pos) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={title || "Write your answer on screen"}
      onPointerMove={onMove}
      onPointerUp={endMove}
      onPointerCancel={endMove}
      style={{
        position: "fixed", left: pos.x, top: pos.y, width: box.w, height: box.h, zIndex: 5000,
        display: "flex", flexDirection: "column", background: "var(--surface)",
        border: "1px solid var(--line-strong)", borderRadius: 18, overflow: "hidden",
        boxShadow: "0 30px 70px -18px rgba(0,0,0,.55)",
      }}
    >
      {/* drag header */}
      <div onPointerDown={startDrag}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px 9px 13px",
          borderBottom: "1px solid var(--line)", cursor: "grab", userSelect: "none", touchAction: "none", flex: "none" }}>
        <Icon name="edit" size={15} style={{ color: "var(--crimson)", flex: "none" }} />
        <span style={{ fontWeight: 650, fontSize: 13, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {title || "Write your answer on screen"}
        </span>
        <span className="faint" style={{ fontSize: 11, flex: "none" }}><Icon name="move" size={13} /> drag</span>
        <button className="icon-btn" aria-label="Close" onClick={onClose} onPointerDown={(e) => e.stopPropagation()}
          style={{ width: 28, height: 28, border: "1px solid var(--line)", flex: "none" }}><Icon name="x" size={14} /></button>
      </div>

      {/* toolbar */}
      <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)", flex: "none" }}>
        <DrawToolbar tool={tool} setTool={setTool} color={color} setColor={setColor} size={size} setSize={setSize}
          onUndo={() => layerRef.current?.undo()} onClear={() => layerRef.current?.clear()}
          canUndo={status.canUndo} dirty={status.dirty} compact />
      </div>

      {/* drawing surface */}
      <DrawLayer
        key={title || "draw"}
        ref={layerRef}
        tool={tool} color={color} size={size}
        whiteExport
        onStatusChange={setStatus}
        minHeight={0}
        style={{ flex: 1, minHeight: 0, background: "#fff" }}
      />

      {/* actions */}
      <div className="flex items-center gap-8 wrap" style={{ justifyContent: "flex-end", padding: "8px 10px", borderTop: "1px solid var(--line)", flex: "none" }}>
        <span className="faint" style={{ fontSize: 11.5, marginRight: "auto" }}>
          {tool === "text" ? "Tap to add text." : status.dirty ? "Marked like a handwritten photo." : "Write your working on screen."}
        </span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={saving}><Icon name="x" size={14} /> Cancel</button>
        <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={!status.dirty || saving}>
          {saving ? <><Icon name="refresh" size={14} className="spin" /> Saving…</> : <><Icon name="check_circle" size={14} /> Use this</>}
        </button>
      </div>

      {/* resize handle (hidden on phones, where it fills the screen) */}
      {!mobile && (
        <div onPointerDown={startResize} title="Drag to resize" aria-label="Resize"
          style={{ position: "absolute", right: 0, bottom: 0, width: 20, height: 20, cursor: "nwse-resize", touchAction: "none",
            background: "linear-gradient(135deg, transparent 50%, var(--line-strong) 50%)" }} />
      )}
    </div>
  );
}
