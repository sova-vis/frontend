"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { SubjectStyle } from "./subjects";

/* ============================================================
   PROPEL — Shared UI primitives (ported from the reference)
   ============================================================ */

/* ---- count-up number ---- */
export function useCountUp(target: number, dur = 900, run = true) {
  const [v, setV] = useState(run ? 0 : target);
  useEffect(() => {
    if (!run) { setV(target); return; }
    if (typeof window === "undefined") { setV(target); return; }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(target); return; }
    if (document.hidden) { setV(target); return; }
    let raf = 0, start = 0, done = false;
    const finish = () => { done = true; setV(target); cancelAnimationFrame(raf); };
    const onVis = () => { if (document.hidden && !done) finish(); };
    document.addEventListener("visibilitychange", onVis);
    const safety = setTimeout(() => { if (!done) finish(); }, dur + 500);
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setV(target * e);
      if (p < 1) raf = requestAnimationFrame(tick); else done = true;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); clearTimeout(safety); document.removeEventListener("visibilitychange", onVis); };
  }, [target, run, dur]);
  return v;
}

export function CountUp({ value, decimals = 0, suffix = "", run = true }: { value: number; decimals?: number; suffix?: string; run?: boolean }) {
  const v = useCountUp(value, 900, run);
  return <span className="tnum">{v.toFixed(decimals)}{suffix}</span>;
}

/* ---- animated readiness ring ---- */
export function Ring({ value, size = 168, stroke = 14, label, sub, color = "#fff", track = "rgba(255,255,255,.22)", textColor = "#fff" }: {
  value: number; size?: number; stroke?: number; label?: string; sub?: string; color?: string; track?: string; textColor?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - value / 100);
  const v = useCountUp(value, 1100);
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} className="ring-prog"
          style={{ ["--ring-circ" as string]: circ + "px", animation: "ringDraw 1.2s cubic-bezier(.4,.8,.3,1) both", transition: "stroke-dashoffset .9s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
        <div>
          <div className="big-num" style={{ fontSize: size * 0.28, color: textColor, lineHeight: 1 }}>
            {Math.round(v)}<span style={{ fontSize: size * 0.13, opacity: 0.8 }}>%</span>
          </div>
          {label && <div style={{ fontSize: 12.5, fontWeight: 600, color: textColor, opacity: 0.9, marginTop: 4 }}>{label}</div>}
          {sub && <div style={{ fontSize: 11, color: textColor, opacity: 0.7 }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

/* ---- mini progress bar ---- */
export function Bar({ value, tone = "", height = 8 }: { value: number; tone?: string; height?: number }) {
  return (
    <div className={"bar " + tone} style={{ height }}>
      <i style={{ width: Math.max(2, value) + "%" }} />
    </div>
  );
}

export function accTone(v: number) { return v >= 75 ? "teal" : v >= 55 ? "amber" : "coral"; }
export function accBadge(v: number) { return v >= 75 ? "teal" : v >= 55 ? "amber" : "coral"; }

/* ---- subject glyph ---- */
export function SubjGlyph({ subj, size = 38, radius = 11 }: { subj: SubjectStyle; size?: number; radius?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: radius, flex: "none", display: "grid", placeItems: "center", background: subj.color + "1e", color: subj.color }}>
      <Icon name={subj.icon} size={size * 0.5} stroke={2} />
    </div>
  );
}

/* ---- delta pill ---- */
export function Delta({ value, suffix = "" }: { value: number; suffix?: string }) {
  if (value === 0) return <span className="delta faint" style={{ color: "var(--ink-faint)" }}>—</span>;
  const up = value > 0;
  return (
    <span className={"delta " + (up ? "up" : "down")}>
      <Icon name={up ? "trend_up" : "trend_down"} size={13} stroke={2.4} />
      {up ? "+" : ""}{value}{suffix}
    </span>
  );
}

/* ---- Toast system ---- */
type ToastFn = (msg: string, icon?: string) => void;
const ToastCtx = createContext<ToastFn>(() => {});
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<{ id: string; msg: string; icon: string }[]>([]);
  const push = useCallback((msg: string, icon = "check_circle") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, icon }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            <Icon name={t.icon} size={18} className="t-ic" />
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---- Empty state ---- */
export function EmptyState({ icon = "sparkles", title, body, cta, onCta }: { icon?: string; title: string; body?: string; cta?: string; onCta?: () => void }) {
  return (
    <div className="empty">
      <div className="empty-art"><Icon name={icon} size={42} stroke={1.8} /></div>
      <h3 style={{ fontSize: 19, marginBottom: 6 }}>{title}</h3>
      {body && <p className="muted" style={{ maxWidth: 360, margin: "0 auto 18px" }}>{body}</p>}
      {cta && <button className="btn btn-primary" onClick={onCta}>{cta}</button>}
    </div>
  );
}

/* ---- Modal ---- */
export function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}

/* ---- Segmented control ---- */
export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string; icon?: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value}
          className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)} type="button">
          {o.icon && <Icon name={o.icon} size={15} />}{o.label}
        </button>
      ))}
    </div>
  );
}
