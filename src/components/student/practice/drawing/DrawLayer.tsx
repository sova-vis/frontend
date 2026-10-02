"use client";

/**
 * DrawLayer — a single controlled ink surface, plus movable/resizable text boxes.
 *
 * The canvas itself is TRANSPARENT and holds only the student's pen/eraser ink,
 * so it can be laid directly over a white sheet (topic answers) or over a
 * rendered past-paper page (full-paper) without hiding what's underneath. The
 * eraser removes ink (destination-out) rather than painting white.
 *
 * TEXT is NOT rasterised as you type — each text box is a real, editable overlay
 * you can drag to move and resize to expand. On export we (a) draw the ink and
 * (b) render each text box's typed text onto the composite PNG, so the marker
 * sees a clean, legible answer. `getText()` also returns the typed text so it can
 * be graded directly.
 *
 * Tool / colour / size are controlled by the parent; undo / clear / export /
 * getText are exposed through a ref.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

export type DrawTool = "pen" | "eraser" | "text";

export interface DrawLayerHandle {
  undo: () => void;
  clear: () => void;
  isDirty: () => boolean;
  /** Composite the background + ink + text into a PNG blob (null if empty). */
  toBlob: (opts?: { background?: "white" | "transparent" }) => Promise<Blob | null>;
  /** The typed text across all text boxes, top-to-bottom (for direct grading). */
  getText: () => string;
}

type TextBox = { id: string; x: number; y: number; text: string; color: string; fontPx: number };

const MAX_UNDO = 30;
// A concrete font stack — canvas `ctx.font` does NOT resolve CSS custom
// properties (`var(--…)`), so using one silently falls back to a tiny 10px
// default. Keep this a real family list, matched by the textarea styling.
const INK_FONT = 'Georgia, "Times New Roman", serif';
const nextId = () => `t${Date.now()}${Math.round(Math.random() * 1e4)}`;
// grow a text box's height to fit its content so nothing is clipped
const autoGrow = (el: HTMLTextAreaElement) => {
  el.style.height = "auto";
  el.style.height = `${Math.max(36, el.scrollHeight)}px`;
};

type Props = {
  tool: DrawTool;
  color: string;
  size: number;
  /** Optional raster drawn UNDER the ink (shown behind the canvas and baked into exports). */
  backgroundSrc?: string;
  /** When true, exports fill white behind the ink (for a blank answer sheet). */
  whiteExport?: boolean;
  onStatusChange?: (status: { dirty: boolean; canUndo: boolean }) => void;
  /** Fires after a completed stroke / text edit — lets the parent persist. */
  onCommit?: () => void;
  className?: string;
  style?: CSSProperties;
  minHeight?: number;
};

const DrawLayer = forwardRef<DrawLayerHandle, Props>(function DrawLayer(
  { tool, color, size, backgroundSrc, whiteExport, onStatusChange, onCommit, className, style, minHeight = 240 },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const midRef = useRef<{ x: number; y: number } | null>(null);
  const undoRef = useRef<{ image: ImageData; dirty: boolean }[]>([]);
  const dirtyRef = useRef(false);
  // live tool settings in refs so pointer handlers always read the latest
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const sizeRef = useRef(size);
  toolRef.current = tool;
  colorRef.current = color;
  sizeRef.current = size;

  // text boxes (persistent, movable, resizable)
  const [boxes, setBoxes] = useState<TextBox[]>([]);
  const boxesRef = useRef<TextBox[]>([]);
  boxesRef.current = boxes;
  const taRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const [focusId, setFocusId] = useState<string | null>(null);
  const moveRef = useRef<{ id: string; px: number; py: number; ox: number; oy: number } | null>(null);

  const emit = useCallback(() => {
    const textDirty = boxesRef.current.some((b) => b.text.trim());
    onStatusChange?.({ dirty: dirtyRef.current || textDirty, canUndo: undoRef.current.length > 0 });
  }, [onStatusChange]);
  const setInkDirty = useCallback((value: boolean) => { dirtyRef.current = value; emit(); }, [emit]);

  // Size the ink canvas to its box at the device pixel ratio, preserving ink.
  const fit = useCallback(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return; // hidden/collapsed — don't wipe
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const wCss = Math.max(1, Math.floor(rect.width));
    const hCss = Math.max(1, Math.floor(rect.height));
    if (canvas.width === Math.floor(wCss * dpr) && canvas.height === Math.floor(hCss * dpr)) return;
    const prev = canvas.width ? canvas.toDataURL() : null;
    canvas.width = Math.floor(wCss * dpr);
    canvas.height = Math.floor(hCss * dpr);
    canvas.style.width = `${wCss}px`;
    canvas.style.height = `${hCss}px`;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctxRef.current = ctx;
    if (prev) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, wCss, hCss);
      img.src = prev;
    }
  }, []);

  useEffect(() => {
    fit();
    const raf = requestAnimationFrame(fit);
    const t = setTimeout(fit, 80);
    const onResize = () => fit();
    window.addEventListener("resize", onResize);
    let ro: ResizeObserver | null = null;
    if (wrapRef.current && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => fit());
      ro.observe(wrapRef.current);
    }
    return () => { cancelAnimationFrame(raf); clearTimeout(t); window.removeEventListener("resize", onResize); ro?.disconnect(); };
  }, [fit]);

  // focus a newly-created text box on the next frame
  useEffect(() => {
    if (!focusId) return;
    const id = requestAnimationFrame(() => taRefs.current.get(focusId)?.focus());
    return () => cancelAnimationFrame(id);
  }, [focusId]);

  const pushUndo = useCallback(() => {
    const ctx = ctxRef.current, canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    try {
      undoRef.current.push({ image: ctx.getImageData(0, 0, canvas.width, canvas.height), dirty: dirtyRef.current });
      if (undoRef.current.length > MAX_UNDO) undoRef.current.shift();
    } catch { /* same-origin, won't taint */ }
  }, []);

  const pointAt = (e: ReactPointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const applyStrokeStyle = (ctx: CanvasRenderingContext2D) => {
    if (toolRef.current === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.fillStyle = "rgba(0,0,0,1)";
      ctx.lineWidth = Math.max(16, sizeRef.current * 3);
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = colorRef.current;
      ctx.fillStyle = colorRef.current;
      ctx.lineWidth = sizeRef.current;
    }
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    const ctx = ctxRef.current, canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    // text tool: drop a NEW text box where you click (clicking an existing box is
    // handled by the box itself, since it sits above the canvas).
    if (toolRef.current === "text") {
      e.preventDefault();
      const p = pointAt(e);
      const id = nextId();
      const fontPx = Math.max(16, Math.round(sizeRef.current * 4 + 10));
      setBoxes((prev) => [...prev, { id, x: p.x, y: p.y, text: "", color: colorRef.current, fontPx }]);
      setFocusId(id);
      return;
    }
    e.preventDefault();
    try { canvas.setPointerCapture?.(e.pointerId); } catch { /* already gone */ }
    pushUndo();
    drawingRef.current = true;
    const p = pointAt(e);
    applyStrokeStyle(ctx);
    const w = ctx.lineWidth;
    lastRef.current = p;
    midRef.current = p;
    ctx.beginPath();
    ctx.arc(p.x, p.y, w / 2, 0, Math.PI * 2);
    ctx.fill();
    setInkDirty(true);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drawingRef.current) return;
    const ctx = ctxRef.current;
    const last = lastRef.current, prevMid = midRef.current;
    if (!ctx || !last || !prevMid) return;
    const p = pointAt(e);
    const mid = { x: (last.x + p.x) / 2, y: (last.y + p.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(prevMid.x, prevMid.y);
    ctx.quadraticCurveTo(last.x, last.y, mid.x, mid.y);
    ctx.stroke();
    lastRef.current = p;
    midRef.current = mid;
  };

  const endStroke = (e: ReactPointerEvent) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastRef.current = null;
    midRef.current = null;
    const ctx = ctxRef.current;
    if (ctx) ctx.globalCompositeOperation = "source-over";
    try { canvasRef.current?.releasePointerCapture?.(e.pointerId); } catch { /* noop */ }
    onCommit?.();
  };

  /* ---- text box editing / moving / deleting ---- */
  const setBoxText = (id: string, text: string) => {
    setBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, text } : b)));
    // emit after state flushes so the parent's "dirty" tracks typed text
    requestAnimationFrame(emit);
  };
  const deleteBox = (id: string) => {
    taRefs.current.delete(id);
    setBoxes((prev) => prev.filter((b) => b.id !== id));
    requestAnimationFrame(() => { emit(); onCommit?.(); });
  };
  const startMove = (e: ReactPointerEvent, id: string) => {
    e.preventDefault(); e.stopPropagation();
    const b = boxesRef.current.find((x) => x.id === id);
    if (!b) return;
    moveRef.current = { id, px: e.clientX, py: e.clientY, ox: b.x, oy: b.y };
    try { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); } catch { /* fine */ }
  };
  const onMoveDrag = (e: ReactPointerEvent) => {
    const m = moveRef.current, wrap = wrapRef.current;
    if (!m || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const nx = Math.max(0, Math.min(m.ox + (e.clientX - m.px), rect.width - 40));
    const ny = Math.max(0, Math.min(m.oy + (e.clientY - m.py), rect.height - 20));
    setBoxes((prev) => prev.map((b) => (b.id === m.id ? { ...b, x: nx, y: ny } : b)));
  };
  const endMove = () => { if (moveRef.current) { moveRef.current = null; onCommit?.(); } };

  const undo = useCallback(() => {
    const ctx = ctxRef.current;
    const snap = undoRef.current.pop();
    if (!ctx || !snap) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.putImageData(snap.image, 0, 0);
    ctx.restore();
    dirtyRef.current = snap.dirty;
    emit();
  }, [emit]);

  const clear = useCallback(() => {
    const ctx = ctxRef.current, canvas = canvasRef.current;
    if (ctx && canvas) {
      pushUndo();
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    taRefs.current.clear();
    setBoxes([]);
    setInkDirty(false);
  }, [pushUndo, setInkDirty]);

  const getText = useCallback(() => {
    return [...boxesRef.current]
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((b) => b.text.trim())
      .filter(Boolean)
      .join("\n");
  }, []);

  // draw each text box's typed text onto the output canvas (wrapped to its width)
  const renderText = (octx: CanvasRenderingContext2D, dpr: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    octx.textBaseline = "top";
    octx.globalCompositeOperation = "source-over";
    for (const b of boxesRef.current) {
      const text = b.text.trim();
      if (!text) continue;
      const ta = taRefs.current.get(b.id);
      const r = ta?.getBoundingClientRect();
      const x = (r ? r.left - canvasRect.left : b.x) + 4;
      const y = (r ? r.top - canvasRect.top : b.y) + 4;
      const maxW = ((r?.width ?? 200) - 10) * dpr;
      const fontPx = b.fontPx * dpr;
      octx.font = `600 ${fontPx}px ${INK_FONT}`;
      octx.fillStyle = b.color;
      let line = 0;
      for (const para of b.text.split("\n")) {
        const words = para.split(" ");
        let cur = "";
        const flush = () => { octx.fillText(cur, x * dpr, y * dpr + line * fontPx * 1.3); line++; cur = ""; };
        for (const word of words) {
          const test = cur ? `${cur} ${word}` : word;
          if (octx.measureText(test).width > maxW && cur) flush();
          else cur = test;
          if (!cur) cur = word;
        }
        flush();
      }
    }
  };

  const toBlob = useCallback<DrawLayerHandle["toBlob"]>((opts) => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) { resolve(null); return; }
      const out = document.createElement("canvas");
      out.width = canvas.width;
      out.height = canvas.height;
      const octx = out.getContext("2d");
      if (!octx) { resolve(null); return; }
      const dpr = canvas.width / Math.max(1, canvas.getBoundingClientRect().width);
      const paint = () => {
        octx.drawImage(canvas, 0, 0);
        renderText(octx, dpr);
        out.toBlob((b) => resolve(b), "image/png");
      };
      const wantWhite = (opts?.background ?? (whiteExport ? "white" : "transparent")) === "white";
      if (backgroundSrc) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          if (wantWhite) { octx.fillStyle = "#ffffff"; octx.fillRect(0, 0, out.width, out.height); }
          octx.drawImage(img, 0, 0, out.width, out.height);
          paint();
        };
        img.onerror = () => {
          if (wantWhite) { octx.fillStyle = "#ffffff"; octx.fillRect(0, 0, out.width, out.height); }
          paint();
        };
        img.src = backgroundSrc;
      } else {
        if (wantWhite) { octx.fillStyle = "#ffffff"; octx.fillRect(0, 0, out.width, out.height); }
        paint();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backgroundSrc, whiteExport]);

  useImperativeHandle(ref, () => ({
    undo, clear,
    isDirty: () => dirtyRef.current || boxesRef.current.some((b) => b.text.trim()),
    toBlob, getText,
  }), [undo, clear, toBlob, getText]);

  const cursor = tool === "text" ? "text" : "crosshair";
  const editing = tool === "text";

  return (
    <div ref={wrapRef} className={className}
      style={{ position: "relative", minHeight, overflow: "hidden", touchAction: "none", ...style }}>
      {backgroundSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={backgroundSrc} alt="" aria-hidden draggable={false}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "fill", userSelect: "none", pointerEvents: "none" }} />
      )}
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onPointerLeave={endStroke}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none", cursor }}
      />
      {boxes.map((b) => (
        <div key={b.id} style={{ position: "absolute", left: b.x, top: b.y, zIndex: 3, pointerEvents: editing ? "auto" : "none" }}>
          {editing && (
            <div className="flex items-center" style={{ position: "absolute", top: -20, left: 0, gap: 6, height: 18 }}>
              <span onPointerDown={(e) => startMove(e, b.id)} onPointerMove={onMoveDrag} onPointerUp={endMove} onPointerCancel={endMove}
                title="Drag to move"
                style={{ cursor: "move", fontSize: 11, fontWeight: 700, color: "#fff", background: b.color, borderRadius: 5, padding: "1px 7px", touchAction: "none", userSelect: "none", whiteSpace: "nowrap" }}>
                ⠿ move
              </span>
              <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => deleteBox(b.id)} aria-label="Delete text"
                style={{ cursor: "pointer", width: 18, height: 18, borderRadius: 5, border: "none", background: "rgba(0,0,0,.55)", color: "#fff", fontSize: 12, lineHeight: 1, display: "grid", placeItems: "center" }}>×</button>
            </div>
          )}
          <textarea
            ref={(el) => { if (el) { taRefs.current.set(b.id, el); autoGrow(el); } else taRefs.current.delete(b.id); }}
            value={b.text}
            readOnly={!editing}
            onChange={(e) => { setBoxText(b.id, e.target.value); autoGrow(e.currentTarget); }}
            onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); (e.currentTarget as HTMLTextAreaElement).blur(); } }}
            placeholder="Type your answer…"
            rows={1}
            style={{
              display: "block", minWidth: 140, minHeight: 36, width: 220, boxSizing: "border-box",
              resize: editing ? "horizontal" : "none", lineHeight: 1.3, overflow: "hidden",
              font: `600 ${b.fontPx}px ${INK_FONT}`, color: b.color,
              background: editing ? "rgba(255,255,255,.92)" : "transparent",
              border: editing ? `1.5px dashed ${b.color}` : "none",
              borderRadius: 6, padding: "3px 6px", outline: "none",
            }}
          />
        </div>
      ))}
    </div>
  );
});

export default DrawLayer;
