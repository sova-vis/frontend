"use client";

/**
 * School login (auth redesign Stage 2). A tabbed modal on the landing page:
 *   - School (admin) + Teacher: their generated name@<short>propel.com login
 *     + one-time password (signInWithPassword) → routed by role via /dashboard.
 *   - Student: enters the teacher's class code, then Continue with Google; the
 *     code is stashed so the classroom joins them on return (Stage 3).
 * First-login password reset is handled app-wide by FirstLoginGate.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Mail } from "lucide-react";
import { BrandLogo } from "@/components/ui/Logo";
import { signInWithPassword, signInWithGoogle } from "@/lib/auth";

type Tab = "school" | "teacher" | "student";

function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.4 5.4 2.5 13.2l7.9 6.1C12.2 13.3 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7C43.7 37.9 46.5 31.8 46.5 24.5z" />
      <path fill="#FBBC05" d="M10.4 28.3c-.5-1.5-.8-3-.8-4.8s.3-3.3.8-4.8l-7.9-6.1C.9 15.7 0 19.7 0 23.5s.9 7.8 2.5 10.9l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.6l-7.3-5.7c-2 1.4-4.7 2.3-7.9 2.3-6.4 0-11.8-3.8-13.6-9.8l-7.9 6.1C6.4 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export default function SchoolLoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("school");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!open) return null;

  const staffLogin = async () => {
    if (!email.trim() || !password) { setErr("Enter your email and password."); return; }
    setBusy(true); setErr("");
    try { await signInWithPassword(email.trim(), password); router.replace("/dashboard"); }
    catch (e) { setErr(e instanceof Error ? e.message : "Login failed."); setBusy(false); }
  };

  const studentGoogle = async () => {
    if (!code.trim()) { setErr("Enter the class code your teacher gave you."); return; }
    setErr("");
    try { sessionStorage.setItem("pending_class_code", code.trim().toUpperCase()); } catch { /* ignore */ }
    try { await signInWithGoogle("/student/classroom"); }
    catch { setErr("Google sign-in isn't available right now — try again shortly."); }
  };

  const tabs: [Tab, string][] = [["school", "School"], ["teacher", "Teacher"], ["student", "Student"]];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-sm rounded-[1.5rem] border border-line bg-surface p-7 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-1.5 text-ink-muted hover:bg-surface-soft" aria-label="Close"><X size={18} /></button>
        <div className="flex justify-center"><BrandLogo size={34} labelClassName="text-xl" /></div>
        <h2 className="mt-3 text-center font-display text-lg font-semibold tracking-tight">School login</h2>

        <div className="mt-4 flex rounded-full border border-line bg-surface-soft p-1 text-xs font-semibold">
          {tabs.map(([t, label]) => (
            <button key={t} onClick={() => { setTab(t); setErr(""); }} className={`flex-1 rounded-full py-2 transition-colors ${tab === t ? "bg-crimson text-white" : "text-ink-muted hover:text-ink"}`}>{label}</button>
          ))}
        </div>

        {tab === "student" ? (
          <div className="mt-5 flex flex-col gap-3">
            <p className="text-sm text-ink-muted">Enter the class code from your teacher, then continue with Google.</p>
            <input
              value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="CLASS CODE"
              className="h-12 rounded-xl border border-line bg-surface px-4 text-sm uppercase tracking-[0.2em] outline-none focus:border-crimson"
            />
            <button onClick={() => void studentGoogle()} className="inline-flex h-12 items-center justify-center gap-3 rounded-full border border-line bg-surface px-5 font-semibold shadow-card transition-colors hover:bg-surface-soft">
              <GoogleG /> Continue with Google
            </button>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-3">
            <p className="text-sm text-ink-muted">
              {tab === "school" ? "School admin sign-in — use the login your platform owner gave you." : "Teacher sign-in — use the login your school admin gave you."}
            </p>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="name@schoolpropel.com" autoComplete="username"
              className="h-12 rounded-xl border border-line bg-surface px-4 text-sm outline-none focus:border-crimson"
            />
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Password" autoComplete="current-password"
              onKeyDown={(e) => { if (e.key === "Enter") void staffLogin(); }}
              className="h-12 rounded-xl border border-line bg-surface px-4 text-sm outline-none focus:border-crimson"
            />
            <button onClick={() => void staffLogin()} disabled={busy} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-crimson font-semibold text-white shadow-crimson transition-colors hover:bg-crimson-deep disabled:opacity-60">
              <Mail size={18} /> {busy ? "Signing in…" : "Log in"}
            </button>
          </div>
        )}

        {err && <p className="mt-3 text-center text-sm text-crimson">{err}</p>}
      </div>
    </div>
  );
}
