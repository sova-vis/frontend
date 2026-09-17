import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell, LegalSection } from "@/components/legal/LegalShell";

export const metadata: Metadata = {
  title: "Ownership Statement — Propel Cambridge",
  description: "Ownership and operation of Propel.",
};

const UPDATED = "17 September 2026";

export default function OwnershipPage() {
  return (
    <LegalShell
      title="Ownership Statement"
      updated={UPDATED}
      intro="This statement confirms who owns and operates this website and service."
    >
      <LegalSection heading="1. Owner and operator">
        <p>
          The website <strong>propelcambridge.com</strong> and the Propel service are owned and operated by{" "}
          <strong>Propel Cambridge</strong>, based in Pakistan. Propel Cambridge is the provider of the service and the
          recipient of any subscription payments made through this website.
        </p>
      </LegalSection>

      <LegalSection heading="2. Nature of the business">
        <p>
          Propel Cambridge provides a subscription-based online assessment and revision platform for Cambridge O Level
          and A Level students. Subscriptions are billed in Pakistani Rupees (PKR).
        </p>
      </LegalSection>

      <LegalSection heading="3. Ownership of content">
        <p>
          The Propel software, brand, and website are the property of Propel Cambridge. Past-paper questions remain the
          property of their respective examination boards, and users keep ownership of their own answers.
        </p>
      </LegalSection>

      <LegalSection heading="4. Independence from Cambridge">
        <p>
          Propel Cambridge is independent and is <strong>not affiliated with or endorsed by</strong> Cambridge
          Assessment International Education or any examination board.
        </p>
      </LegalSection>

      <LegalSection heading="5. Contact">
        <p>
          Contact us at{" "}
          <a href="mailto:sovavis2025@gmail.com" className="font-medium text-crimson hover:underline">
            sovavis2025@gmail.com
          </a>{" "}
          or{" "}
          <a
            href="https://www.instagram.com/propelcambridge/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-crimson hover:underline"
          >
            @propelcambridge
          </a>
          . See also our{" "}
          <Link href="/privacy-policy" className="font-medium text-crimson hover:underline">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/terms" className="font-medium text-crimson hover:underline">
            Terms &amp; Conditions
          </Link>
          .
        </p>
      </LegalSection>
    </LegalShell>
  );
}
