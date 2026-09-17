import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell, LegalSection } from "@/components/legal/LegalShell";

export const metadata: Metadata = {
  title: "Cancellation & Refund Policy — Propel Cambridge",
  description: "How the Propel free trial, subscription, cancellation, and refunds work.",
};

const UPDATED = "17 September 2026";

export default function RefundPolicyPage() {
  return (
    <LegalShell
      title="Cancellation & Refund Policy"
      updated={UPDATED}
      intro="How billing, cancellation, and refunds work for the Propel Pro subscription."
    >
      <LegalSection heading="1. Free trial">
        <p>
          Every new user gets a <strong>10-day free trial</strong> to try Propel before any payment is taken. If it
          isn’t right for you, simply don’t subscribe.
        </p>
      </LegalSection>

      <LegalSection heading="2. Subscription">
        <p>
          After the trial, Propel Pro is billed in Pakistani Rupees (PKR) and renews automatically each period until you
          cancel.
        </p>
      </LegalSection>

      <LegalSection heading="3. Cancel any time">
        <p>
          You can cancel from your account settings or by emailing us. Cancelling stops all future charges, and you keep
          access until the end of the period you have already paid for.
        </p>
      </LegalSection>

      <LegalSection heading="4. Refunds">
        <p>
          Because a free trial lets you evaluate Propel before paying, payments are{" "}
          <strong>non-refundable once a charge has been made</strong>. The only exceptions are duplicate or accidental
          charges, which we will refund.
        </p>
      </LegalSection>

      <LegalSection heading="5. Contact">
        <p>
          For any billing question, email{" "}
          <a href="mailto:sovavis2025@gmail.com" className="font-medium text-crimson hover:underline">
            sovavis2025@gmail.com
          </a>
          . This policy forms part of our{" "}
          <Link href="/terms" className="font-medium text-crimson hover:underline">
            Terms &amp; Conditions
          </Link>
          .
        </p>
      </LegalSection>
    </LegalShell>
  );
}
