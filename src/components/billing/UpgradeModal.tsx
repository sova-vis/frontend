"use client";

/**
 * The single upgrade / start-trial modal. It's opened by the ProProvider whenever:
 *   - a Pro API call is blocked (HTTP 402 → 'propel:pro-required' event), or
 *   - a component calls openUpgrade() (e.g. a locked ProGate button).
 *
 * It shows the trial offer to users who haven't trialed, and the "Continue to Pro"
 * offer to everyone else. Paying is gated on Safepay: until it's connected, the
 * checkout call returns a friendly "coming soon" message shown inline.
 */
import { useEffect, useState } from 'react';
import { usePro } from '@/lib/usePro';
import { startCheckout } from '@/lib/billing';

export default function UpgradeModal() {
  const { upgradeOpen, closeUpgrade, trialAvailable, data, startTrialFlow } = usePro();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!upgradeOpen) {
      setBusy(false);
      setMessage(null);
    }
  }, [upgradeOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeUpgrade();
    };
    if (upgradeOpen) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [upgradeOpen, closeUpgrade]);

  if (!upgradeOpen) return null;

  const monthly = data?.price?.monthlyPkr ?? 999;
  const annual = data?.price?.annualPkr ?? null;
  const trialDays = data?.trialDays ?? 10;

  const onStartTrial = async () => {
    setBusy(true);
    setMessage(null);
    const result = await startTrialFlow();
    setBusy(false);
    if (result?.started) {
      closeUpgrade();
      return;
    }
    if (result?.reason === 'device_used') {
      setMessage('This device has already used a free trial. You can continue to Pro instead.');
    } else if (result?.reason === 'trial_already_used') {
      setMessage("You've already used your free trial. Continue to Pro to keep full access.");
    } else {
      setMessage('Could not start the trial right now. Please try again.');
    }
  };

  const onContinueToPro = async () => {
    setBusy(true);
    setMessage(null);
    const result = await startCheckout('monthly');
    setBusy(false);
    if (result.ok && result.redirectUrl) {
      window.location.href = result.redirectUrl;
      return;
    }
    setMessage(result.message || 'Payments are not available yet.');
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={closeUpgrade}
    >
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-2xl border border-ink/10 bg-paper p-6 shadow-crimson"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="ed-pill-crimson mb-3 inline-flex">Propel Pro</span>

        {trialAvailable ? (
          <>
            <h2 className="text-xl font-bold text-ink">Start your {trialDays}-day free trial</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Unlock AI marking, Ask-AI, Upload &amp; Check, analytics, the study planner and the
              paper generator — free for {trialDays} days. <strong>No card required.</strong>
            </p>
            <button
              type="button"
              className="ed-btn-primary mt-5 w-full"
              onClick={onStartTrial}
              disabled={busy}
            >
              {busy ? 'Starting…' : `Start ${trialDays}-day free trial`}
            </button>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold text-ink">Continue to Pro</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Your free access to this feature has ended. Go Pro to keep AI marking, Ask-AI,
              analytics and everything else. Past papers stay free, always.
            </p>
            <div className="mt-4 rounded-xl border border-ink/10 bg-paper-soft p-4">
              <div className="text-lg font-bold text-ink">
                Rs {monthly.toLocaleString()} <span className="text-sm font-medium text-ink-muted">/ month</span>
              </div>
              {annual != null && (
                <div className="mt-1 text-sm text-ink-muted">
                  or Rs {annual.toLocaleString()} / year — one payment, no monthly renewals
                </div>
              )}
            </div>
            <button
              type="button"
              className="ed-btn-primary mt-5 w-full"
              onClick={onContinueToPro}
              disabled={busy}
            >
              {busy ? 'Please wait…' : 'Continue to Pro'}
            </button>
          </>
        )}

        {message && (
          <p className="mt-3 rounded-lg bg-paper-soft px-3 py-2 text-center text-xs text-ink-muted">
            {message}
          </p>
        )}

        <button
          type="button"
          className="ed-btn-ghost mt-2 w-full"
          onClick={closeUpgrade}
          disabled={busy}
        >
          Maybe later
        </button>

        <p className="mt-3 text-center text-[11px] text-ink-faint">
          Past papers and downloads are always free.
        </p>
      </div>
    </div>
  );
}
