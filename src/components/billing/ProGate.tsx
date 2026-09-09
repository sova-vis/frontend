"use client";

/**
 * Wrap any Pro-only screen or section:  <ProGate>...</ProGate>
 *
 * While billing is off / loading / the user is Pro, it renders its children
 * unchanged (fail-open). Only when billing is enforced AND the user isn't Pro does
 * it replace the content with a lock card that opens the upgrade modal.
 *
 * Server-side requirePro is the real enforcement; this is the friendly UI layer.
 */
import type { ReactNode } from 'react';
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
    <div className="mx-auto my-10 max-w-md rounded-2xl border border-ink/10 bg-paper p-6 text-center shadow-crimson">
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
    </div>
  );
}
