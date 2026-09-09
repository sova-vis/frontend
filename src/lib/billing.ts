/**
 * Billing API client (frontend). Thin wrappers over the /billing backend routes,
 * all funnelled through apiCall so the Supabase token is attached automatically.
 */
import { apiCall } from './api';
import { getDeviceHash } from './deviceId';

export interface BillingStatus {
  enforced: boolean;         // master switch — when false the UI shows no gating at all
  status: 'free' | 'trialing' | 'active' | 'past_due' | 'expired' | 'canceled' | string;
  isPro: boolean;            // true billing state (ignore unless enforced)
  trialAvailable: boolean;
  daysLeft: number | null;
  autoRenew: boolean;
  plan: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  trialDays: number;
  graceDays: number;
  price: { monthlyPkr: number; annualPkr: number | null };
}

export interface StartTrialResult {
  enforced: boolean;
  started: boolean;
  reason?: 'trial_already_used' | 'device_used' | 'not_eligible' | string;
  access: Omit<BillingStatus, 'enforced' | 'trialDays' | 'graceDays' | 'price'>;
}

export async function fetchBillingStatus(): Promise<BillingStatus | null> {
  try {
    const res = await apiCall('/billing/status');
    if (!res.ok) return null;
    return (await res.json()) as BillingStatus;
  } catch {
    return null;
  }
}

export async function startTrial(): Promise<StartTrialResult | null> {
  try {
    const res = await apiCall('/billing/start-trial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceHash: getDeviceHash() }),
    });
    if (!res.ok) return null;
    return (await res.json()) as StartTrialResult;
  } catch {
    return null;
  }
}

export interface CheckoutResult {
  ok: boolean;
  redirectUrl?: string;
  message?: string;          // shown to the user when payments aren't connected yet
}

export async function startCheckout(plan: 'monthly' | 'annual' = 'monthly'): Promise<CheckoutResult> {
  try {
    const res = await apiCall('/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.redirectUrl) return { ok: true, redirectUrl: data.redirectUrl as string };
    // 501 stub (Safepay not connected) or any other non-redirect response.
    return { ok: false, message: (data?.message as string) || 'Payments are not available yet.' };
  } catch {
    return { ok: false, message: 'Could not reach the billing service. Please try again.' };
  }
}

export async function cancelPro(): Promise<boolean> {
  try {
    const res = await apiCall('/billing/cancel', { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}

/** Reconcile after returning from checkout — activates Pro from the latest payment. */
export async function syncBilling(): Promise<boolean> {
  try {
    const res = await apiCall('/billing/sync', { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}
