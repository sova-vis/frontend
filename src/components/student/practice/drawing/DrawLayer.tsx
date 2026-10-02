"use client";

/**
 * DrawLayer — a single controlled ink surface.
 *
 * The canvas itself is TRANSPARENT and holds only the student's ink, so it can
 * be laid directly over a white sheet (topic answers) or over a rendered
 * past-paper page (full-paper draw) without hiding what's underneath. The
 * eraser removes ink (destination-out) rather than painting white, so it works
 * over any background. On export we composite the chosen background (a white
 * sheet, or the page image) under the ink into one PNG — exactly what the
 * handwritten-answer vision pipeline expects.
 *
 * Tool / colour / size are controlled by the parent (so one toolbar can drive
 * several layers — e.g. every page of a paper). Undo / clear / export are
 * exposed through a ref.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

export type DrawTool = "pen" | "eraser" | "text";

export interface DrawLayerHandle {
  undo: () => void;
  clear: () => void;
  isDirty: () => boolean;
  /** Composite the background + ink into a PNG blob (null if nothing to export). */
  toBlob: (opts?: { background?: "white" | "transparent" }) => Promise<Blob | null>;
}

const MAX_UNDO = 30;
// A concrete font stack — canvas `ctx.font` does NOT resolve CSS custom
// properties (`var(--…)`), so using one silently falls back to a tiny 10px
// default. Keep this a real family list, matched by the textarea preview below.
const INK_FONT = 'Georgia, "Times New Roman", serif';

type Props = {
  tool: DrawTool;
  color: string;
  size: number;
  /** Optional raster drawn UNDER the ink (shown behind the canvas and baked into exports). */
  backgroundSrc?: string;
  /** When true, exports fill white behind the ink (for a blank answer sheet). */
  whiteExport?: boolean;
  onStatusChange?: (status: { dirty: boolean; canUndo: boolean }) => void;
  /** Fires after each completed stroke / text stamp — lets the parent persist. */
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

  const [textBox, setTextBox] = useState<{ x: number; y: number; value: string } | null>(null);

  const emit = useCallback(() => {
    onStatusChange?.({ dirty: dirtyRef.current, canUndo: undoRef.current.length > 0 });
  }, [onStatusChange]);
  const setDirty = useCallback((value: boolean) => {
    dirtyRef.current = value;
    emit();
  }, [emit]);

  // Size the ink canvas to its box at the device pixel ratio, preserving the
  // existing ink across a resize.
  const fit = useCallback(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    // Skip while the box is effectively hidden (e.g. collapsed accordion) so we
    // never resize the canvas down to nothing and wipe the drawing.
    if (rect.width < 2 || rect.height < 2) return;
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
    // Size the canvas as soon as, and whenever, it actually has a box. We fit now,
    // next frame, and shortly after (to catch layout/animation settling), and keep
    // a ResizeObserver on the wrap for any later size change (open/expand/resize).
    // Belt-and-braces because a single rAF can be cancelled by React StrictMode's
    // double-mount and a collapsed box can report a zero box on the first tick.
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

  const pushUndo = useCallback(() => {
    const ctx = ctxRef.current, canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    try {
      undoRef.current.push({ image: ctx.getImageData(0, 0, canvas.width, canvas.height), dirty: dirtyRef.current });
      if (undoRef.current.length > MAX_UNDO) undoRef.current.shift();
    } catch { /* tainted canvas won't happen on a same-origin layer */ }
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
    // text tool: drop an input where you click; the stroke tools draw.
    if (toolRef.current === "text") {
      const p = pointAt(e);
      setTextBox({ x: p.x, y: p.y, value: "" });
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
    setDirty(true);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drawingRef.current) return;
    const ctx = ctxRef.current;
    const last = lastRef.current, prevMid = midRef.current;
    if (!ctx || !last || !prevMid) return;
    const p = pointAt(e);
    // quadratic smoothing: midpoint-to-midpoint with the real point as control
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

  // Stamp the typed text onto the canvas at the box origin, then clear the input.
  const commitText = useCallback((value: string, at: { x: number; y: number }) => {
    const ctx = ctxRef.current;
    const text = value.trim();
    if (ctx && text) {
      pushUndo();
      const fontPx = Math.max(14, Math.round(sizeRef.current * 4 + 10));
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = colorRef.current;
      ctx.font = `600 ${fontPx}px ${INK_FONT}`;
      ctx.textBaseline = "top";
      value.split("\n").forEach((line, i) => ctx.fillText(line, at.x, at.y + i * fontPx * 1.25));
      setDirty(true);
      onCommit?.();
    }
    setTextBox(null);
  }, [pushUndo, setDirty, onCommit]);

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
    if (!ctx || !canvas) return;
    pushUndo();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    setTextBox(null);
    setDirty(false);
  }, [pushUndo, setDirty]);

  const toBlob = useCallback<DrawLayerHandle["toBlob"]>((opts) => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) { resolve(null); return; }
      const out = document.createElement("canvas");
      out.width = canvas.width;
      out.height = canvas.height;
      const octx = out.getContext("2d");
      if (!octx) { resolve(null); return; }
      const paintInk = () => {
        octx.drawImage(canvas, 0, 0);
        out.toBlob((b) => resolve(b), "image/png");
      };
      const wantWhite = (opts?.background ?? (whiteExport ? "white" : "transparent")) === "white";
      if (backgroundSrc) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          if (wantWhite) { octx.fillStyle = "#ffffff"; octx.fillRect(0, 0, out.width, out.height); }
          octx.drawImage(img, 0, 0, out.width, out.height);
          paintInk();
        };
        img.onerror = () => {
          if (wantWhite) { octx.fillStyle = "#ffffff"; octx.fillRect(0, 0, out.width, out.height); }
          paintInk();
        };
        img.src = backgroundSrc;
      } else {
        if (wantWhite) { octx.fillStyle = "#ffffff"; octx.fillRect(0, 0, out.width, out.height); }
        paintInk();
      }
    });
  }, [backgroundSrc, whiteExport]);

  useImperativeHandle(ref, () => ({
    undo, clear, isDirty: () => dirtyRef.current, toBlob,
  }), [undo, clear, toBlob]);

  const cursor = tool === "text" ? "text" : "crosshair";

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
      {textBox && (
        <textarea
          autoFocus
          value={textBox.value}
          onChange={(e) => setTextBox((b) => (b ? { ...b, value: e.target.value } : b))}
          onBlur={(e) => commitText(e.currentTarget.value, { x: textBox.x, y: textBox.y })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitText(e.currentTarget.value, { x: textBox.x, y: textBox.y }); }
            if (e.key === "Escape") { e.preventDefault(); setTextBox(null); }
          }}
          placeholder="Type…"
          rows={1}
          style={{
            position: "absolute", left: textBox.x, top: textBox.y, zIndex: 2,
            minWidth: 120, maxWidth: "70%", resize: "none", lineHeight: 1.25,
            font: `600 ${Math.max(14, Math.round(size * 4 + 10))}px ${INK_FONT}`,
            color, background: "rgba(255,255,255,.9)", border: `1.5px dashed ${color}`,
            borderRadius: 6, padding: "2px 6px", outline: "none",
          }}
        />
      )}
    </div>
  );
});

export default DrawLayer;
