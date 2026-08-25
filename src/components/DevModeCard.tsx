"use client";

import { useEffect, useState } from "react";
import { Wrench, Lock, Unlock } from "lucide-react";
import { devStatus, setDevPassword, unlockDev, clearDevToken, isDevUnlocked } from "@/lib/devMode";

export default function DevModeCard() {
  const [loading, setLoading] = useState(true);
  const [passwordSet, setPasswordSet] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    devStatus()
      .then((s) => { if (alive) { setPasswordSet(s.passwordSet); setUnlocked(isDevUnlocked()); } })
      .finally(() => { if (alive) setLoading(false); });
    const onChange = () => setUnlocked(isDevUnlocked());
    window.addEventListener("propel:dev-change", onChange);
    return () => { alive = false; window.removeEventListener("propel:dev-change", onChange); };
  }, []);

  const run = async (fn: () => Promise<void>, successMsg: string) => {
    setBusy(true); setError(null); setOk(null);
    try {
      await fn();
      setPw("");
      setUnlocked(isDevUnlocked());
      setPasswordSet(true);
      setOk(successMsg);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const lock = () => { clearDevToken(); setUnlocked(false); setOk("Dev mode locked."); };

  return (
    <div className="ed-card p-5 md:p-6">
      <h2 className="font-display text-lg font-semibold tracking-tight text-ink mb-1 flex items-center gap-2">
        <Wrench size={20} className="text-crimson" /> Dev mode
      </h2>
      <p className="text-sm text-ink-muted mb-4">
        Fix extraction mistakes directly in Practice — edit question text, answers and images. Changes are
        saved to the live bank and every user sees them. Works for both O- and A-Levels (switch level as usual).
      </p>

      {loading ? (
        <p className="text-sm text-ink-muted">Checking…</p>
      ) : unlocked ? (
        <div className="ed-card-soft p-4 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600">
            <Unlock size={16} /> Dev mode is ON — open any paper in Practice to edit.
          </span>
          <button onClick={lock} className="inline-flex items-center gap-2 rounded-lg border border-ink/15 px-3 py-2 text-sm font-semibold hover:bg-ink/5">
            <Lock size={14} /> Lock
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          <label className="ed-label block">{passwordSet ? "Enter dev password" : "Set a dev password"}</label>
          <div className="flex gap-2">
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder={passwordSet ? "Dev password" : "New password (min 6 chars)"}
              className="ed-input flex-1"
              onKeyDown={(e) => { if (e.key === "Enter" && pw && !busy) run(() => (passwordSet ? unlockDev(pw) : setDevPassword(pw)), passwordSet ? "Unlocked." : "Password set — dev mode on."); }}
            />
            <button
              disabled={busy || pw.length < (passwordSet ? 1 : 6)}
              onClick={() => run(() => (passwordSet ? unlockDev(pw) : setDevPassword(pw)), passwordSet ? "Unlocked." : "Password set — dev mode on.")}
              className="ed-btn-primary px-5 disabled:opacity-50"
            >
              {busy ? "…" : passwordSet ? "Unlock" : "Set"}
            </button>
          </div>
          {!passwordSet && <p className="text-xs text-ink-muted">This shared password unlocks editing for anyone who enters it — keep it private.</p>}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-crimson">{error}</p>}
      {ok && <p className="mt-3 text-sm text-emerald-600">{ok}</p>}
    </div>
  );
}
