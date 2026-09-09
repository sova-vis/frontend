"use client";

/**
 * A slim status strip shown at the top of the student workspace. Renders NOTHING
 * unless billing is enforced and the user is trialing / overdue / expired — so it's
 * invisible while the master switch is off. Drives trial→paid conversion.
 */
import { usePro } from '@/lib/usePro';

export default function TrialBanner() {
  const { enforced, status, daysLeft, openUpgrade } = usePro();

  if (!enforced) return null;
  if (status !== 'trialing' && status !== 'past_due' && status !== 'expired') return null;

  let text = '';
  let cta = 'Upgrade';
  if (status === 'trialing') {
    const d = daysLeft ?? 0;
    text = d <= 0 ? 'Your free trial ends today.' : `${d} day${d === 1 ? '' : 's'} left in your free trial.`;
    cta = 'Continue to Pro';
  } else if (status === 'past_due') {
    const d = daysLeft ?? 0;
    text = `Your Pro month ended — renew to keep full access${d > 0 ? ` (${d} day${d === 1 ? '' : 's'} left)` : ''}.`;
    cta = 'Renew Pro';
  } else if (status === 'expired') {
    text = 'Your Pro access has ended. Past papers are still free.';
    cta = 'Go Pro';
  }

  return (
    <div className="flex items-center justify-center gap-3 border-b border-ink/10 bg-crimson-soft px-4 py-2 text-center text-sm text-crimson-ink">
      <span className="font-medium">{text}</span>
      <button
        type="button"
        onClick={openUpgrade}
        className="rounded-full bg-crimson px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-crimson-deep"
      >
        {cta}
      </button>
    </div>
  );
}
