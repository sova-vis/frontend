"use client";

/**
 * InlineDrawBox — an in-place, expandable draw area for ONE answer slot of a
 * topic question. It sits inline in the question card and slides open / closed
 * like an accordion. The ink canvas stays MOUNTED while collapsed (just clipped)
 * so the drawing is never lost when you slide it shut and open it again.
 *
 * It registers an exporter with the parent (a ref registry) instead of pushing
 * its pixels into React state on every stroke — so drawing stays smooth and the
 * card never re-renders mid-stroke. "Mark my answer" pulls the latest drawing
 * from the registry on demand.
 */
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/propel/Icon";
import DrawLayer, { type DrawLayerHandle, type DrawTool } from "./drawing/DrawLayer";
import DrawToolbar from "./drawing/DrawToolbar";
import { DEFAULT_DRAW_COLOR, DEFAULT_DRAW_SIZE } from "./drawing/constants";

export type DrawExporter = () => Promise<File | null>;

const BASE_H = 300, TALL_H = 520;

export default function InlineDrawBox({ partKey, label, register, unregister }: {
  partKey: string;
  label: string;
  register: (partKey: string, exporter: DrawExporter) => void;
  unregister: (partKey: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tall, setTall] = useState(false);
  const [tool, setTool] = useState<DrawTool>("pen");
  const [color, setColor] = useState<string>(DEFAULT_DRAW_COLOR);
  const [size, setSize] = useState<number>(DEFAULT_DRAW_SIZE);
  const [status, setStatus] = useState({ dirty: false, canUndo: false });
  const layerRef = useRef<DrawLayerHandle>(null);

  // Expose an on-demand exporter to the parent (used at marking time). Only
  // returns an image when there's actually ink, so a blank box contributes nothing.
  useEffect(() => {
    const exporter: DrawExporter = async () => {
      if (!layerRef.current?.isDirty()) return null;
      const blob = await layerRef.current.toBlob({ background: "white" });
      return blob ? new File([blob], `drawing-${Date.now()}.png`, { type: "image/png" }) : null;
    };
    register(partKey, exporter);
    return () => unregister(partKey);
  }, [partKey, register, unregister]);

  const title = `Write your answer${label ? ` for ${label}` : ""}`;
  const H = tall ? TALL_H : BASE_H;

  return (
    <div style={{ marginTop: 8, borderRadius: 12, border: "1px solid var(--line-strong)", background: "var(--surface)", overflow: "hidden" }}>
      {/* header — tap to slide open / closed */}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
          background: open ? "var(--crimson-soft)" : "var(--surface)", border: "none", cursor: "pointer", textAlign: "left" }}>
        <Icon name="edit" size={15} style={{ color: "var(--crimson)", flex: "none" }} />
        <span style={{ fontWeight: 600, fontSize: 13, color: open ? "var(--crimson)" : "var(--ink)", flex: 1 }}>{title}</span>
        {status.dirty && <span className="badge teal" style={{ fontSize: 10.5, flex: "none" }}><Icon name="check_circle" size={12} /> answered</span>}
        <span className="faint" style={{ fontSize: 11.5, flex: "none" }}>{open ? "Hide" : "Write"}</span>
        <Icon name={open ? "chevron_down" : "chevron_right"} size={16} style={{ color: "var(--ink-faint)", flex: "none" }} />
      </button>

      {/* slide-down surface — the canvas stays mounted while collapsed so ink persists */}
      <div style={{ maxHeight: open ? H + 120 : 0, overflow: "hidden", transition: "max-height .28s ease" }}>
        <div style={{ padding: "8px 10px", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
          <DrawToolbar tool={tool} setTool={setTool} color={color} setColor={setColor} size={size} setSize={setSize}
            onUndo={() => layerRef.current?.undo()} onClear={() => layerRef.current?.clear()}
            canUndo={status.canUndo} dirty={status.dirty} compact />
        </div>
        <DrawLayer
          ref={layerRef}
          tool={tool} color={color} size={size}
          whiteExport
          onStatusChange={setStatus}
          minHeight={H}
          style={{ height: H, background: "#fff" }}
        />
        <div className="flex items-center gap-8" style={{ justifyContent: "space-between", padding: "8px 10px" }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTall((t) => !t)}>
            <Icon name={tall ? "minus" : "plus"} size={14} /> {tall ? "Shrink" : "Expand"}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>
            <Icon name="check_circle" size={14} /> Done
          </button>
        </div>
      </div>
    </div>
  );
}
