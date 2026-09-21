"use client";

/**
 * Live subscription card for Settings — reflects the real billing state from
 * usePro (trial/active/past_due/expired/canceled) with the right days-left and
 * renew / cancel actions. Renders sensibly even when billing isn't enforced.
 */
import { useEffect, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { usePro } from '@/lib/usePro';
import { cancelPro, fetchMyRequest, type ProRequest } from '@/lib/billing';

export default function SubscriptionSettings() {
  const { enforced, status, daysLeft, trialAvailable, data, openUpgrade, refresh } = usePro();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<ProRequest | null>(null);

  // Surface a submitted-but-unapproved manual payment as a "pending" bar.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const r = await fetchMyRequest();
      if (alive) setPending(r && r.status === 'pending' ? r : null);
    })();
    return () => { alive = false; };
  }, [status]);

  const onCancel = async () => {
    setBusy(true);
    await cancelPro();
    await refresh();
    setBusy(false);
  };

  const d = daysLeft ?? 0;
  // 'manual' is an internal plan id — don't surface it as "(manual)".
  const plan = data?.plan && data.plan !== 'manual' ? ` (${data.plan})` : '';
  let title = 'Free plan';
  let sub = 'Past papers are always free.';
  let pill = { label: 'Free', cls: 'ed-pill' };
  let primary: { label: string; onClick: () => void } | null = null;
  let showCancel = false;

  if (!enforced) {
    title = 'Subscription';
    sub = 'Billing isn’t active on your account yet.';
  } else if (status === 'trialing') {
    title = 'Free trial';
    sub = d <= 0 ? 'Your trial ends today.' : `${d} day${d === 1 ? '' : 's'} left in your free trial.`;
    pill = { label: 'Trial', cls: 'ed-pill-gold' };
    primary = { label: 'Continue to Pro', onClick: openUpgrade };
  } else if (status === 'active') {
    title = `Propel Pro${plan}`;
    sub = `${d} day${d === 1 ? '' : 's'} left this period.`;
    pill = { label: 'Active', cls: 'ed-pill-mint' };
    primary = { label: 'Renew now', onClick: openUpgrade };
    showCancel = true;
  } else if (status === 'past_due') {
    title = 'Pro — renewal due';
    sub = `${d} grace day${d === 1 ? '' : 's'} left. Renew to keep full access.`;
    pill = { label: 'Past due', cls: 'ed-pill-gold' };
    primary = { label: 'Renew now', onClick: openUpgrade };
  } else if (status === 'canceled') {
    title = `Propel Pro${plan} — canceling`;
    sub = `Access continues for ${d} more day${d === 1 ? '' : 's'}.`;
    pill = { label: 'Canceling', cls: 'ed-pill-gold' };
    primary = { label: 'Resume Pro', onClick: openUpgrade };
  } else if (status === 'expired') {
    title = 'Pro access ended';
    sub = 'Go Pro to unlock everything again.';
    pill = { label: 'Expired', cls: 'ed-pill-crimson' };
    primary = { label: 'Go Pro', onClick: openUpgrade };
  } else {
    // enforced + free
    title = 'Free plan';
    sub = trialAvailable ? 'Start your free trial to unlock Pro features.' : 'Go Pro to unlock everything.';
    primary = { label: trialAvailable ? 'Start free trial' : 'Go Pro', onClick: openUpgrade };
  }

  // A submitted-but-unapproved manual payment takes over the bar until an admin approves it.
  if (pending && status !== 'active') {
    const when = pending.created_at
      ? new Date(pending.created_at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      : '';
    title = 'Pro — pending approval';
    sub = `We're verifying your payment${when ? ` from ${when}` : ''}. Pro activates as soon as it's approved.`;
    pill = { label: 'Pending', cls: 'ed-pill-gold' };
    primary = null;
    showCancel = false;
  }

  return (
    <div className="ed-card p-5 md:p-6">
      <h2 className="font-display text-lg font-semibold tracking-tight text-ink mb-4 flex items-center gap-2">
        <CreditCard size={20} className="text-crimson" /> Subscription
      </h2>
      <div className="ed-card-soft p-4 flex justify-between items-center gap-4">
        <div>
          <p className="font-semibold text-ink">{title}</p>
          <p className="text-sm text-ink-muted">{sub}</p>
        </div>
        <span className={`${pill.cls} uppercase tracking-wide whitespace-nowrap`}>{pill.label}</span>
      </div>
      {(primary || showCancel) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {primary && (
            <button type="button" className="ed-btn-primary" onClick={primary.onClick} disabled={busy}>
              {primary.label}
            </button>
          )}
          {showCancel && (
            <button type="button" className="ed-btn-ghost" onClick={onCancel} disabled={busy}>
              {busy ? 'Please wait…' : 'Cancel auto-renew'}
            </button>
          )}
        </div>
      )}
      <p className="mt-3 text-[11px] text-ink-faint">Past papers &amp; downloads are always free.</p>
    </div>
  );
}
