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
  paymentsMode?: 'manual' | 'safepay';   // 'manual' hides Safepay, uses the QR flow
  price: { monthlyPkr: number; annualPkr: number | null };
}

/* ---- Manual payment flow (while Safepay live keys are pending) ---- */
export interface PayInfo {
  mode: 'manual' | 'safepay';
  amountPkr: number;
  qr: string | null;                 // base64 data URL of the QR to scan
  configured: boolean;               // false → admin hasn't uploaded a QR yet
  payee: { name: string | null; accountNumber: string | null; bankName: string | null; instructions: string | null };
  promo: { applied: boolean; code: string; label: string | null; note: string | null } | null;
}

export interface ProRequest {
  id: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  name: string | null;
  email: string | null;
  phone: string | null;
  cardholder_name: string | null;
  promo_code: string | null;
  amount_pkr: number | null;
  created_at: string;
}

export async function fetchPayInfo(promo?: string): Promise<PayInfo | null> {
  try {
    const qs = promo ? `?promo=${encodeURIComponent(promo)}` : '';
    const res = await apiCall(`/billing/pay-info${qs}`);
    if (!res.ok) return null;
    return (await res.json()) as PayInfo;
  } catch {
    return null;
  }
}

export async function submitProRequest(body: { name: string; phone: string; cardholderName: string; promoCode?: string }): Promise<{ ok: boolean; request?: ProRequest; message?: string }> {
  try {
    const res = await apiCall('/billing/pro-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok) return { ok: true, request: data.request as ProRequest };
    return { ok: false, message: (data?.message as string) || 'Could not submit your request. Please try again.' };
  } catch {
    return { ok: false, message: 'Could not reach the server. Please try again.' };
  }
}

export async function fetchMyRequest(): Promise<ProRequest | null> {
  try {
    const res = await apiCall('/billing/my-request');
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.request as ProRequest) ?? null;
  } catch {
    return null;
  }
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
