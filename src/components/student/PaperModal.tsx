"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/propel/Icon";

// Floating viewer for a question's ORIGINAL past-paper PDF, jumped to the page
// the question is on (the backend resolves the paper from subject/year/session/
// paper/variant and locates the page by matching the question text). Shared by
// Practice ("View in paper") and Ask AI (Find matches).
//
// Desktop: a small, draggable window with no scrim — the page behind stays
// usable so the window can be dragged aside to compare. Move it by its title
// bar; resize from the bottom-right corner. Phones: a full-screen modal with a
// large close button (the draggable panel was unusable there).
export default function PaperModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const DEF_W = 420, DEF_H = 460;
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState({ w: DEF_W, h: DEF_H });
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const resize = useRef<{ px: number; py: number; w: number; h: number } | null>(null);

  useEffect(() => {
    setMounted(true);
    // open small, docked to the right, clamped to the viewport
    const w = Math.min(DEF_W, window.innerWidth - 24);
    const h = Math.min(DEF_H, window.innerHeight - 24);
    setSize({ w, h });
    setPos({ x: Math.max(12, window.innerWidth - w - 16), y: Math.max(12, (window.innerHeight - h) / 2) });
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted || !pos) return null;

  const startDrag = (e: ReactPointerEvent) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ox: pos.x, oy: pos.y };
  };
  const startResize = (e: ReactPointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    resize.current = { px: e.clientX, py: e.clientY, w: size.w, h: size.h };
  };
  const onMove = (e: ReactPointerEvent) => {
    if (drag.current) {
      const nx = drag.current.ox + (e.clientX - drag.current.px);
      const ny = drag.current.oy + (e.clientY - drag.current.py);
      // keep the title bar reachable on screen
      setPos({
        x: Math.min(Math.max(-size.w + 80, nx), window.innerWidth - 80),
        y: Math.min(Math.max(0, ny), window.innerHeight - 40),
      });
    } else if (resize.current) {
      setSize({
        w: Math.max(320, Math.min(resize.current.w + (e.clientX - resize.current.px), window.innerWidth - pos.x - 8)),
        h: Math.max(260, Math.min(resize.current.h + (e.clientY - resize.current.py), window.innerHeight - pos.y - 8)),
      });
    }
  };
  const endMove = () => { drag.current = null; resize.current = null; };

  // Portal INTO the app's .pr root so the theme vars resolve; portaling to body
  // and adding className="pr" would repaint .pr's full-viewport background over
  // the page. .pr has no transform, so fixed positioning still tracks the viewport.
  const target = (typeof document !== "undefined" && document.querySelector(".pr")) || (typeof document !== "undefined" ? document.body : null);
  if (!target) return null;

  const isMobile = window.innerWidth < 700;

  const header = (
    <>
      <span style={{ fontWeight: 700, fontSize: 12.5, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {title}
      </span>
      <div className="flex gap-8 items-center" style={{ flex: "none" }} onPointerDown={(e) => e.stopPropagation()}>
        <a className="icon-btn" href={url} target="_blank" rel="noopener noreferrer"
          title="Open in a new tab" aria-label="Open in a new tab"
          style={{ width: isMobile ? 36 : 26, height: isMobile ? 36 : 26, border: "1px solid var(--line)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="file_text" size={isMobile ? 17 : 14} />
        </a>
        <button className="icon-btn" onClick={onClose} title="Close" aria-label="Close"
          style={{ width: isMobile ? 36 : 26, height: isMobile ? 36 : 26, border: "1px solid var(--line)" }}>
          <Icon name="x" size={isMobile ? 19 : 14} />
        </button>
      </div>
    </>
  );

  const iframeEl = (
    <iframe src={url} title={title} style={{ width: "100%", height: "100%", border: 0, background: "#525659", display: "block" }} />
  );

  if (isMobile) {
    return createPortal(
      <div role="dialog" aria-label={title}
        style={{ position: "fixed", inset: 0, zIndex: 3000, background: "var(--surface)", color: "var(--ink)", display: "flex", flexDirection: "column" }}>
        <div className="row-between" style={{ gap: 10, padding: "10px 12px", borderBottom: "1px solid var(--line)", flex: "none" }}>
          {header}
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>{iframeEl}</div>
      </div>,
      target,
    );
  }

  return createPortal(
    <div
      role="dialog"
      aria-label={title}
      onPointerMove={onMove}
      onPointerUp={endMove}
      onPointerCancel={endMove}
      style={{
        position: "fixed", left: pos.x, top: pos.y, width: size.w, height: size.h,
        zIndex: 3000, background: "var(--surface)", color: "var(--ink)",
        border: "1px solid var(--line-strong, var(--line))", borderRadius: 12,
        boxShadow: "0 24px 60px -12px rgba(0,0,0,.45)", overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}
    >
      <div
        onPointerDown={startDrag}
        className="row-between"
        style={{
          gap: 10, padding: "9px 10px 9px 12px", background: "var(--surface)",
          borderBottom: "1px solid var(--line)", cursor: "grab", userSelect: "none",
          touchAction: "none",
        }}
      >
        {header}
      </div>
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        {iframeEl}
        <div
          onPointerDown={startResize}
          title="Drag to resize"
          style={{
            position: "absolute", right: 0, bottom: 0, width: 18, height: 18,
            cursor: "nwse-resize", touchAction: "none",
            background: "linear-gradient(135deg, transparent 50%, var(--line-strong, #999) 50%)",
          }}
        />
      </div>
    </div>,
    target,
  );
}
