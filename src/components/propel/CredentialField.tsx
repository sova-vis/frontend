"use client";

import { useState } from "react";
import { Icon } from "@/components/propel/Icon";

/**
 * Inline display of an admin-issued login password: masked by default, with
 * Show/Hide and Copy. Renders nothing when there's no stored password (e.g. an
 * older account that hasn't been reset since credentials began being stored).
 */
export default function CredentialField({ value, label = "Password" }: { value: string | null | undefined; label?: string }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const copy = async () => {
    try { await navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };
  const btn: React.CSSProperties = { border: "none", background: "transparent", cursor: "pointer", fontWeight: 600, fontSize: 11.5, padding: 0, display: "inline-flex", alignItems: "center", gap: 3 };
  return (
    <span className="flex items-center gap-8 wrap" style={{ fontSize: 12.5 }}>
      <span className="faint" style={{ fontSize: 11 }}>{label}</span>
      <code className="mono" style={{ fontWeight: 600, color: "var(--ink)" }}>{show ? value : "•".repeat(Math.min(12, value.length))}</code>
      <button type="button" onClick={() => setShow((s) => !s)} style={{ ...btn, color: "var(--ink-soft)" }} title={show ? "Hide" : "Show"}><Icon name="eye" size={12} /> {show ? "Hide" : "Show"}</button>
      <button type="button" onClick={copy} style={{ ...btn, color: copied ? "var(--teal)" : "var(--crimson)" }} title="Copy"><Icon name={copied ? "check_circle" : "file_text"} size={12} /> {copied ? "Copied" : "Copy"}</button>
    </span>
  );
}
