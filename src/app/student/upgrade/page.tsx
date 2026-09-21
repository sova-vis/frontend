"use client";

/**
 * Manual "Upgrade to Pro" page (while Safepay live keys are pending).
 * The student pays out-of-band by scanning a QR, then submits their details.
 * An admin reviews the request and activates a 30-day Pro period.
 *
 * A promo code swaps the QR (and optionally the price). This page is NOT Pro-gated
 * (it must be reachable while locked). No card numbers are collected — only the
 * cardholder/account name — so there is no sensitive payment data here.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Loader2, ShieldCheck, Sparkles, Clock, X, Tag } from "lucide-react";
import { useUser } from "@/lib/auth";
import { usePro } from "@/lib/usePro";
import { fetchPayInfo, submitProRequest, fetchMyRequest, type PayInfo, type ProRequest } from "@/lib/billing";

export default function UpgradePage() {
  const { user } = useUser();
  const { isPro, daysLeft, refresh } = usePro();

  const email = user?.primaryEmailAddress?.emailAddress || "";
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cardholder, setCardholder] = useState("");

  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<string>("");
  const [payInfo, setPayInfo] = useState<PayInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [promoBusy, setPromoBusy] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [myRequest, setMyRequest] = useState<ProRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Prefill the name once the account loads.
  useEffect(() => { if (user?.fullName && !name) setName(user.fullName); }, [user?.fullName]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPayInfo = useCallback(async (promo?: string) => {
    const info = await fetchPayInfo(promo);
    setPayInfo(info);
  }, []);

  // Initial load: existing pending request + pay info.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [req] = await Promise.all([fetchMyRequest(), loadPayInfo()]);
      if (!alive) return;
      if (req && req.status === "pending") setMyRequest(req);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [loadPayInfo]);

  const applyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    setPromoBusy(true);
    await loadPayInfo(code || undefined);
    setAppliedPromo(code);
    setPromoBusy(false);
  };
  const clearPromo = async () => {
    setPromoInput("");
    setAppliedPromo("");
    setPromoBusy(true);
    await loadPayInfo();
    setPromoBusy(false);
  };

  const amount = payInfo?.amountPkr ?? 999;
  const canSubmit = Boolean(name.trim() && phone.trim() && email);
  const promoApplied = payInfo?.promo?.applied;
  const promoInvalid = Boolean(appliedPromo) && payInfo?.promo && !payInfo.promo.applied;

  const onConfirmPaid = async () => {
    setSubmitting(true);
    setError(null);
    const result = await submitProRequest({
      name: name.trim(),
      phone: phone.trim(),
      cardholderName: cardholder.trim(),
      promoCode: appliedPromo || undefined,
    });
    setSubmitting(false);
    if (result.ok && result.request) {
      setMyRequest(result.request);
      setConfirmOpen(false);
      void refresh();
    } else {
      setError(result.message || "Something went wrong. Please try again.");
    }
  };

  const perks = useMemo(() => ([
    "Unlimited marking against the official scheme",
    "Every mark explained, point by point",
    "Topical practice & full past papers",
    "Progress tracking across your weak topics",
  ]), []);

  /* ---------- already Pro ---------- */
  if (!loading && isPro && !myRequest) {
    return (
      <Shell>
        <div className="ed-card mx-auto max-w-lg p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-mint-soft">
            <Check className="h-7 w-7 text-mint-ink" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-ink">You&apos;re on Propel Pro</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {typeof daysLeft === "number" ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left on your plan.` : "Full access is active on your account."}
          </p>
          <Link href="/student/dashboard" className="ed-btn-primary mt-6 inline-flex">Go to dashboard</Link>
        </div>
      </Shell>
    );
  }

  /* ---------- request pending ---------- */
  if (!loading && myRequest && myRequest.status === "pending") {
    return (
      <Shell>
        <div className="ed-card mx-auto max-w-lg p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold-soft">
            <Clock className="h-7 w-7 text-gold-ink" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-ink">Payment received — pending approval</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Thanks{name ? `, ${name.split(" ")[0]}` : ""}! We&apos;ve got your request and will verify your payment and activate
            Pro shortly. You&apos;ll get a confirmation email once it&apos;s live.
          </p>
          <div className="mt-5 rounded-xl border border-line bg-surface-soft p-4 text-left text-sm">
            <Row k="Name" v={myRequest.name} />
            <Row k="Email" v={myRequest.email} />
            <Row k="Phone" v={myRequest.phone} />
            {myRequest.promo_code && <Row k="Promo" v={myRequest.promo_code} />}
            <Row k="Submitted" v={myRequest.created_at ? new Date(myRequest.created_at).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null} />
            <Row k="Status" v="Pending review" />
          </div>
          <button className="ed-btn-ghost mt-5" onClick={() => { setMyRequest(null); }}>
            Submit a new request
          </button>
          <Link href="/student/dashboard" className="mt-2 block text-xs text-ink-muted underline">Back to dashboard</Link>
        </div>
      </Shell>
    );
  }

  /* ---------- payment form ---------- */
  return (
    <Shell>
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* LEFT — pay */}
        <div className="ed-card p-6 md:p-7">
          <span className="ed-pill-crimson inline-flex">Propel Pro</span>
          <h1 className="mt-3 font-display text-2xl font-semibold text-ink">Scan &amp; pay to go Pro</h1>
          <p className="mt-1 text-sm text-ink-muted">Pay the amount below, then fill in your details and hit <strong>I&apos;ve paid</strong>. We&apos;ll verify and activate your 30 days of Pro.</p>

          {/* amount + promo */}
          <div className="mt-5 flex items-end justify-between gap-3">
            <div>
              <p className="ed-label">Amount</p>
              <p className="font-display text-3xl font-semibold text-ink">Rs {amount.toLocaleString()}</p>
              {promoApplied && <p className="mt-1 text-xs font-semibold text-mint-ink">Promo {payInfo?.promo?.code} applied{payInfo?.promo?.label ? ` · ${payInfo.promo.label}` : ""}</p>}
            </div>
          </div>

          <div className="mt-4">
            <label className="ed-label mb-1 block">Have a promo code?</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <input
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  placeholder="e.g. EID20"
                  className="ed-input pl-9 uppercase"
                  disabled={promoBusy}
                />
              </div>
              {appliedPromo ? (
                <button className="ed-btn-ghost px-4" onClick={clearPromo} disabled={promoBusy}>Clear</button>
              ) : (
                <button className="ed-btn-primary px-4" onClick={applyPromo} disabled={promoBusy || !promoInput.trim()}>
                  {promoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                </button>
              )}
            </div>
            {promoInvalid && <p className="mt-1 text-xs text-crimson-ink">That code isn&apos;t valid — the standard QR is shown.</p>}
            {promoApplied && payInfo?.promo?.note && <p className="mt-1 text-xs text-ink-muted">{payInfo.promo.note}</p>}
          </div>

          {/* QR */}
          <div className="mt-5 rounded-2xl border border-line bg-surface-soft p-5 text-center">
            {payInfo?.qr ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={payInfo.qr} alt="Payment QR code" className="mx-auto h-56 w-56 rounded-lg bg-white object-contain p-2" />
                <p className="mt-2 text-xs text-ink-muted">Scan with your banking / wallet app to pay</p>
              </>
            ) : (
              <div className="py-10 text-sm text-ink-muted">
                <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-ink-faint" />
                Payment details are being set up. Please check back shortly or contact support.
              </div>
            )}
          </div>

          {/* payee details */}
          {(payInfo?.payee?.name || payInfo?.payee?.accountNumber || payInfo?.payee?.instructions) && (
            <div className="mt-4 rounded-xl border border-line bg-surface p-4 text-sm">
              {payInfo?.payee?.name && <Row k="Account name" v={payInfo.payee.name} />}
              {payInfo?.payee?.bankName && <Row k="Bank / wallet" v={payInfo.payee.bankName} />}
              {payInfo?.payee?.accountNumber && <Row k="Account / IBAN" v={payInfo.payee.accountNumber} copy />}
              {payInfo?.payee?.instructions && <p className="mt-2 whitespace-pre-wrap text-ink-muted">{payInfo.payee.instructions}</p>}
            </div>
          )}
        </div>

        {/* RIGHT — your details */}
        <div className="ed-card h-fit p-6 md:p-7">
          <h2 className="font-display text-lg font-semibold text-ink">Your details</h2>
          <p className="mt-1 text-sm text-ink-muted">So we can match your payment and activate your account.</p>

          <div className="mt-4 space-y-4">
            <Field label="Full name">
              <input value={name} onChange={(e) => setName(e.target.value)} className="ed-input" placeholder="Your name" />
            </Field>
            <Field label="Email (your sign-in email)">
              <input value={email} readOnly className="ed-input cursor-not-allowed bg-surface-soft text-ink-muted" />
            </Field>
            <Field label="Phone / WhatsApp number">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="ed-input" placeholder="03xx xxxxxxx" inputMode="tel" />
            </Field>
            <Field label="Account / card holder name (who paid)">
              <input value={cardholder} onChange={(e) => setCardholder(e.target.value)} className="ed-input" placeholder="Name on the account you paid from" />
            </Field>
          </div>

          <div className="mt-5 rounded-xl border border-crimson-soft bg-crimson-soft/40 p-3 text-xs text-crimson-ink">
            <strong>Important:</strong> only click <strong>“I&apos;ve paid”</strong> after you&apos;ve actually completed the transfer. We verify every payment before activating Pro.
          </div>

          <button
            className="ed-btn-primary mt-4 w-full"
            onClick={() => setConfirmOpen(true)}
            disabled={!canSubmit || !payInfo?.qr}
          >
            I&apos;ve paid
          </button>
          {!canSubmit && <p className="mt-2 text-center text-xs text-ink-faint">Fill in your name and phone to continue.</p>}

          <div className="mt-6 border-t border-line pt-4">
            <p className="ed-label mb-2">What you unlock</p>
            <ul className="space-y-1.5">
              {perks.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm text-ink-muted">
                  <Sparkles className="mt-0.5 h-4 w-4 flex-none text-crimson" /> {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* confirm dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={() => !submitting && setConfirmOpen(false)}>
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm rounded-2xl border border-ink/10 bg-paper p-6 shadow-crimson" onClick={(e) => e.stopPropagation()}>
            <button className="absolute right-4 top-4 text-ink-muted hover:text-ink" onClick={() => !submitting && setConfirmOpen(false)} aria-label="Close"><X size={18} /></button>
            <h3 className="font-display text-lg font-semibold text-ink">Have you completed the payment?</h3>
            <p className="mt-2 text-sm text-ink-muted">
              Please confirm you&apos;ve transferred <strong>Rs {amount.toLocaleString()}</strong>{appliedPromo ? ` (promo ${appliedPromo})` : ""}. We&apos;ll verify it and activate your Pro within a short while.
            </p>
            {error && <p className="mt-3 rounded-lg bg-crimson-soft px-3 py-2 text-xs text-crimson-ink">{error}</p>}
            <div className="mt-5 flex gap-3">
              <button className="ed-btn-ghost flex-1" onClick={() => setConfirmOpen(false)} disabled={submitting}>Not yet</button>
              <button className="ed-btn-primary flex-1" onClick={onConfirmPaid} disabled={submitting}>
                {submitting ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Sending…</> : "Yes, I've paid"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-full bg-paper px-4 py-8 md:px-8">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="ed-label mb-1 block">{label}</label>
      {children}
    </div>
  );
}

function Row({ k, v, copy }: { k: string; v: string | null; copy?: boolean }) {
  const [copied, setCopied] = useState(false);
  if (!v) return null;
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-ink-faint">{k}</span>
      <span className="flex items-center gap-2 font-semibold text-ink">
        {v}
        {copy && (
          <button
            onClick={() => { try { navigator.clipboard.writeText(v); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* ignore */ } }}
            className="text-xs font-medium text-crimson underline"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </span>
    </div>
  );
}
