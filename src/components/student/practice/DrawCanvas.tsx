"use client";

/**
 * DrawCanvas — an in-app sketch surface for answering by hand without a photo.
 * The student draws with mouse / stylus / finger; on save we export the canvas
 * as a PNG File and hand it back, so it rides the EXACT same handwritten-answer
 * pipeline as an uploaded photo (no backend change — a drawing is just an image).
 *
 * Rendered as a plain fixed overlay (NOT a body portal) so it still shows when a
 * parent has entered the browser Fullscreen API — a body-portaled node would be
 * hidden behind the fullscreened element. Mount it as a child of the focus
 * surface and it works whether or not real fullscreen is active.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Icon } from "@/components/propel/Icon";

type Tool = "pen" | "eraser";
const PEN_SIZES = [2.5, 5, 9] as const;
const ERASER_SIZE = 26;
const MAX_UNDO = 25;

export default function DrawCanvas({ open, title, onClose, onSave, saving }: {
  open: boolean;
  title?: string;
  onClose: () => void;
  onSave: (file: File) => void;
  saving?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawingRef = useRef(false);
  const undoRef = useRef<ImageData[]>([]);
  const [tool, setTool] = useState<Tool>("pen");
  const [penSize, setPenSize] = useState<number>(PEN_SIZES[1]);
  const [dirty, setDirty] = useState(false);
  const [canUndo, setCanUndo] = useState(false);

  // Paint the backing store white so the exported PNG looks like paper (and the
  // vision model reads dark ink on light, exactly like a scanned script).
  const fillWhite = useCallback((ctx: CanvasRenderingContext2D, wCss: number, hCss: number) => {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
    void wCss; void hCss;
  }, []);

  // Size the canvas to its box at the device pixel ratio for crisp strokes,
  // preserving whatever is already drawn across a resize.
  const fit = useCallback(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const wCss = Math.max(1, Math.floor(rect.width));
    const hCss = Math.max(1, Math.floor(rect.height));
    // nothing to do if unchanged (avoids wiping the drawing on no-op layouts)
    if (canvas.width === Math.floor(wCss * dpr) && canvas.height === Math.floor(hCss * dpr)) return;
    const prev = canvas.width ? canvas.toDataURL() : null;
    canvas.width = Math.floor(wCss * dpr);
    canvas.height = Math.floor(hCss * dpr);
    canvas.style.width = `${wCss}px`;
    canvas.style.height = `${hCss}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctxRef.current = ctx;
    fillWhite(ctx, wCss, hCss);
    if (prev) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, wCss, hCss);
      img.src = prev;
    }
  }, [fillWhite]);

  // (re)initialise on open
  useEffect(() => {
    if (!open) return;
    undoRef.current = [];
    setDirty(false);
    setCanUndo(false);
    // defer so the overlay has laid out and the wrap has a real size
    const id = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (canvas) { canvas.width = 0; canvas.height = 0; } // force a real fit
      fit();
    });
    const onResize = () => fit();
    window.addEventListener("resize", onResize);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, fit, onClose]);

  const pushUndo = useCallback(() => {
    const ctx = ctxRef.current, canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    try {
      const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
      undoRef.current.push(snap);
      if (undoRef.current.length > MAX_UNDO) undoRef.current.shift();
      setCanUndo(true);
    } catch { /* tainted canvas should never happen here */ }
  }, []);

  const pointAt = (e: ReactPointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    const ctx = ctxRef.current, canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    pushUndo();
    drawingRef.current = true;
    const { x, y } = pointAt(e);
    ctx.strokeStyle = tool === "eraser" ? "#ffffff" : "#15171c";
    ctx.lineWidth = tool === "eraser" ? ERASER_SIZE : penSize;
    ctx.beginPath();
    ctx.moveTo(x, y);
    // a dot for a single tap
    ctx.lineTo(x + 0.01, y + 0.01);
    ctx.stroke();
    setDirty(true);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drawingRef.current) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { x, y } = pointAt(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const endStroke = (e: ReactPointerEvent) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    canvasRef.current?.releasePointerCapture?.(e.pointerId);
  };

  const undo = () => {
    const ctx = ctxRef.current;
    const snap = undoRef.current.pop();
    if (!ctx || !snap) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.putImageData(snap, 0, 0);
    ctx.restore();
    setCanUndo(undoRef.current.length > 0);
    setDirty(undoRef.current.length > 0 || dirty);
  };

  const clear = () => {
    const ctx = ctxRef.current, canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    pushUndo();
    fillWhite(ctx, canvas.clientWidth, canvas.clientHeight);
    setDirty(false);
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas || !dirty) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `drawing-${Date.now()}.png`, { type: "image/png" });
      onSave(file);
    }, "image/png");
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || "Draw your answer"}
      style={{ position: "fixed", inset: 0, zIndex: 5000, background: "rgba(10,12,16,.78)", backdropFilter: "blur(3px)", display: "flex", flexDirection: "column", padding: "clamp(10px,2vw,22px)" }}
    >
      <div className="pr" style={{ margin: "auto", width: "100%", maxWidth: 960, display: "flex", flexDirection: "column", gap: 10, minHeight: 0, flex: 1 }}>
        {/* toolbar */}
        <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between", padding: "8px 12px" }}>
          <div className="flex items-center gap-8" style={{ minWidth: 0 }}>
            <Icon name="edit" size={16} style={{ color: "var(--crimson)", flex: "none" }} />
            <span style={{ fontWeight: 650, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title || "Draw your answer"}</span>
          </div>
          <div className="flex items-center gap-6 wrap">
            {/* pen + sizes */}
            <div className="seg" role="group" aria-label="Tool">
              <button type="button" className={tool === "pen" ? "on" : ""} onClick={() => setTool("pen")}><Icon name="pencil" size={14} /> Pen</button>
              <button type="button" className={tool === "eraser" ? "on" : ""} onClick={() => setTool("eraser")}><Icon name="minus" size={14} /> Eraser</button>
            </div>
            <div className="flex items-center gap-4" style={{ opacity: tool === "pen" ? 1 : 0.45, pointerEvents: tool === "pen" ? "auto" : "none" }}>
              {PEN_SIZES.map((s, i) => (
                <button key={s} type="button" aria-label={`Pen size ${i + 1}`} onClick={() => setPenSize(s)}
                  className="icon-btn" style={{ width: 30, height: 30, border: `1px solid ${penSize === s ? "var(--crimson)" : "var(--line-strong)"}`, background: penSize === s ? "var(--crimson-soft)" : "var(--surface)" }}>
                  <span style={{ width: s + 3, height: s + 3, borderRadius: "50%", background: "var(--ink)" }} />
                </button>
              ))}
            </div>
            <button type="button" className="icon-btn" onClick={undo} disabled={!canUndo} title="Undo" style={{ width: 32, height: 32, border: "1px solid var(--line-strong)" }}>
              <Icon name="rotate" size={16} />
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={clear} disabled={!dirty} title="Clear the canvas">
              <Icon name="trash" size={14} /> Clear
            </button>
          </div>
        </div>

        {/* drawing surface */}
        <div ref={wrapRef} className="card" style={{ flex: 1, minHeight: 240, padding: 0, overflow: "hidden", background: "#fff", borderColor: "var(--line-strong)" }}>
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            onPointerLeave={endStroke}
            style={{ display: "block", width: "100%", height: "100%", touchAction: "none", cursor: "crosshair" }}
          />
        </div>

        {/* actions */}
        <div className="flex items-center gap-10 wrap" style={{ justifyContent: "flex-end" }}>
          <span className="faint" style={{ fontSize: 12, marginRight: "auto" }}>{dirty ? "Drawing ready — it'll be marked like a handwritten photo." : "Draw your working above."}</span>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}><Icon name="x" size={15} /> Cancel</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty || saving}>
            {saving ? <><Icon name="refresh" size={15} className="spin" /> Marking…</> : <><Icon name="check_circle" size={15} /> Use this drawing</>}
          </button>
        </div>
      </div>
    </div>
  );
}
