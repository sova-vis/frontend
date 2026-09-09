"use client";

/**
 * Wrap any Pro-only screen or section:  <ProGate feature="Ask AI">...</ProGate>
 *
 * While billing is off / loading / the user is Pro, it renders its children
 * unchanged (fail-open). Only when billing is enforced AND the user isn't Pro does
 * it replace the content with a lock panel that opens the upgrade modal — so the
 * page's own data hooks never run while locked.
 *
 * Server-side requirePro is the real enforcement; this is the friendly UI layer.
 */
import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { usePro } from '@/lib/usePro';

export default function ProGate({
  children,
  feature = 'This feature',
}: {
  children: ReactNode;
  feature?: string;
}) {
  const { enforced, isPro, loading, trialAvailable, data, openUpgrade } = usePro();

  if (!enforced || loading || isPro) return <>{children}</>;

  const trialDays = data?.trialDays ?? 10;

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-paper p-8 text-center shadow-crimson">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-crimson-soft">
          <Lock className="h-6 w-6 text-crimson-ink" />
        </div>
        <span className="ed-pill-crimson mb-3 inline-flex">Propel Pro</span>
        <h3 className="text-lg font-bold text-ink">{feature} is a Pro feature</h3>
        <p className="mt-2 text-sm text-ink-muted">
          {trialAvailable
            ? `Start your ${trialDays}-day free trial to unlock it — no card required.`
            : 'Go Pro to unlock it. Past papers stay free, always.'}
        </p>
        <button type="button" className="ed-btn-primary mt-5 w-full" onClick={openUpgrade}>
          {trialAvailable ? `Start ${trialDays}-day free trial` : 'Continue to Pro'}
        </button>
        <p className="mt-3 text-[11px] text-ink-faint">Past papers &amp; downloads are always free.</p>
      </div>
    </div>
  );
}
