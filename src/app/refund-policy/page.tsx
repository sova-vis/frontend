import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell, LegalSection, LegalList } from "@/components/legal/LegalShell";

export const metadata: Metadata = {
  title: "Cancellation & Refund Policy — Propel Cambridge",
  description:
    "How the Propel Cambridge free trial, Pro subscription, cancellation, and refunds work.",
};

const UPDATED = "17 September 2026";

export default function RefundPolicyPage() {
  return (
    <LegalShell
      title="Cancellation & Refund Policy"
      updated={UPDATED}
      intro="This policy explains how billing, cancellation, and refunds work for the Propel Pro subscription, operated by Propel Cambridge. Please read it alongside our Terms & Conditions."
    >
      <LegalSection heading="1. Try before you pay — 10-day free trial">
        <p>
          Every new user can start a <strong>10-day free trial</strong> of Propel Pro. Past Papers are always free to
          browse. The trial lets you evaluate the full platform — AI marking, explanations, topical practice, and
          progress tracking — <strong>before any payment is taken</strong>. If Propel isn’t right for you, simply don’t
          subscribe.
        </p>
      </LegalSection>

      <LegalSection heading="2. Subscription and billing">
        <LegalList
          items={[
            "After the free trial, Propel Pro is a paid subscription billed in Pakistani Rupees (PKR).",
            "Payments are processed securely by our payment partner, Safepay. We do not store your card details.",
            "Your subscription renews automatically at the end of each billing period until you cancel.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="3. Cancel any time">
        <p>You are in control of your subscription and can cancel whenever you like:</p>
        <LegalList
          items={[
            "Cancel from your account settings, or by emailing us at sovavis2025@gmail.com.",
            "Cancelling stops all future renewals and charges.",
            "When you cancel, you keep Pro access until the end of the period you have already paid for — it simply won’t renew after that.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="4. Refunds">
        <p>
          Because Propel is a digital service and every user gets a free trial to evaluate it before paying,{" "}
          <strong>payments are non-refundable once a subscription charge has been made.</strong> Cancelling stops future
          billing, but the current billing period is not refunded.
        </p>
        <p>The only exceptions are:</p>
        <LegalList
          items={[
            <><strong>Duplicate or accidental charges</strong> — if you are billed more than once for the same period, we will refund the duplicate.</>,
            <><strong>Billing errors</strong> — if you are charged in error or an amount that does not match the plan you selected, we will correct and refund the difference.</>,
            "Any refund required of us by applicable law.",
          ]}
        />
        <p>
          Approved refunds are returned through Safepay to your original payment method. Depending on your bank, it may
          take several business days for the refund to appear.
        </p>
      </LegalSection>

      <LegalSection heading="5. How to request a cancellation or refund">
        <p>
          To cancel, use your account settings or contact us. For a billing correction or refund under section 4, email{" "}
          <a href="mailto:sovavis2025@gmail.com" className="font-medium text-crimson hover:underline">
            sovavis2025@gmail.com
          </a>{" "}
          (or message us on Instagram{" "}
          <a
            href="https://www.instagram.com/propelcambridge/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-crimson hover:underline"
          >
            @propelcambridge
          </a>
          ) with the email on your account and the transaction date. We aim to respond within 3 business days.
        </p>
      </LegalSection>

      <LegalSection heading="6. Contact">
        <p>
          This policy forms part of our{" "}
          <Link href="/terms" className="font-medium text-crimson hover:underline">
            Terms &amp; Conditions
          </Link>
          . For anything about billing or your subscription, reach us at{" "}
          <a href="mailto:sovavis2025@gmail.com" className="font-medium text-crimson hover:underline">
            sovavis2025@gmail.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalShell>
  );
}
