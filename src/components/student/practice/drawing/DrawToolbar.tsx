"use client";

/** Shared drawing toolbar — pen / eraser / text, colour, nib size, undo, clear. */
import { Icon } from "@/components/propel/Icon";
import type { DrawTool } from "./DrawLayer";
import { DRAW_COLORS, DRAW_SIZES } from "./constants";

export default function DrawToolbar({
  tool, setTool, color, setColor, size, setSize, onUndo, onClear, canUndo, dirty, compact,
}: {
  tool: DrawTool; setTool: (t: DrawTool) => void;
  color: string; setColor: (c: string) => void;
  size: number; setSize: (s: number) => void;
  onUndo: () => void; onClear: () => void;
  canUndo?: boolean; dirty?: boolean; compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-8 wrap" style={{ minWidth: 0 }}>
      {/* tools */}
      <div className="seg" role="group" aria-label="Tool">
        <button type="button" className={tool === "pen" ? "on" : ""} onClick={() => setTool("pen")} title="Pen"><Icon name="pencil" size={14} />{!compact && " Pen"}</button>
        <button type="button" className={tool === "eraser" ? "on" : ""} onClick={() => setTool("eraser")} title="Eraser"><Icon name="minus" size={14} />{!compact && " Eraser"}</button>
        <button type="button" className={tool === "text" ? "on" : ""} onClick={() => setTool("text")} title="Text box"><Icon name="type" size={14} />{!compact && " Text"}</button>
      </div>

      {/* colours */}
      <div className="flex items-center gap-4" role="group" aria-label="Colour">
        {DRAW_COLORS.map((c) => {
          const on = color === c.value;
          return (
            <button key={c.value} type="button" aria-label={c.name} title={c.name}
              onClick={() => { setColor(c.value); if (tool === "eraser") setTool("pen"); }}
              style={{ width: 24, height: 24, borderRadius: "50%", cursor: "pointer", flex: "none",
                background: c.value, border: on ? "2.5px solid var(--ink)" : "2px solid var(--line-strong)",
                boxShadow: on ? "0 0 0 2px var(--surface), 0 0 0 3.5px var(--ink)" : "none", transition: "box-shadow .12s" }} />
          );
        })}
      </div>

      {/* nib size */}
      <div className="flex items-center gap-4" role="group" aria-label="Thickness">
        {DRAW_SIZES.map((s, i) => {
          const on = size === s;
          return (
            <button key={s} type="button" aria-label={`Thickness ${i + 1}`} title={`Thickness ${i + 1}`} onClick={() => setSize(s)}
              className="icon-btn" style={{ width: 30, height: 30, border: `1px solid ${on ? "var(--crimson)" : "var(--line-strong)"}`, background: on ? "var(--crimson-soft)" : "var(--surface)" }}>
              <span style={{ width: Math.min(s + 4, 16), height: Math.min(s + 4, 16), borderRadius: "50%", background: "var(--ink)" }} />
            </button>
          );
        })}
      </div>

      <button type="button" className="icon-btn" onClick={onUndo} disabled={!canUndo} title="Undo" style={{ width: 32, height: 32, border: "1px solid var(--line-strong)" }}>
        <Icon name="rotate" size={16} />
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onClear} disabled={!dirty} title="Erase everything">
        <Icon name="trash" size={14} />{!compact && " Erase all"}
      </button>
    </div>
  );
}
