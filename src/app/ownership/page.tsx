import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell, LegalSection, LegalList } from "@/components/legal/LegalShell";

export const metadata: Metadata = {
  title: "Ownership Statement — Propel Cambridge",
  description:
    "Ownership and operation of propelcambridge.com and the Propel AI assessment platform.",
};

const UPDATED = "17 September 2026";

export default function OwnershipPage() {
  return (
    <LegalShell
      title="Ownership Statement"
      updated={UPDATED}
      intro="This statement confirms who owns and operates this website and the Propel service."
    >
      <LegalSection heading="1. Owner and operator">
        <p>
          The website <strong>propelcambridge.com</strong> and the Propel platform are owned and operated by{" "}
          <strong>Propel Cambridge</strong>, based in Pakistan. Propel Cambridge is the provider of the service and the
          recipient of any subscription payments made through this website.
        </p>
      </LegalSection>

      <LegalSection heading="2. Nature of the business">
        <p>
          Propel Cambridge provides a subscription-based educational technology service: an AI-powered assessment and
          revision platform for Cambridge O Level and A Level students. Subscriptions are billed in Pakistani Rupees
          (PKR), and payments are processed securely by our payment partner, Safepay. Propel Cambridge does not store
          customers’ card details.
        </p>
      </LegalSection>

      <LegalSection heading="3. Ownership of content and brand">
        <LegalList
          items={[
            <>The Propel software, website, user interface, and the “Propel” and “Propel Cambridge” names and logo are the property of Propel Cambridge.</>,
            "Past-paper questions and mark schemes remain the property of their respective examination boards and are used for educational purposes only.",
            "Users retain ownership of the answers and study content they create on the platform.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="4. Independence from Cambridge">
        <p>
          Propel Cambridge is an independent business and is <strong>not affiliated with, endorsed by, or connected to</strong>{" "}
          Cambridge Assessment International Education (CAIE), the University of Cambridge, or any examination board. Any
          reference to “Cambridge”, “O Level”, or “A Level” describes only the syllabuses the platform supports.
        </p>
      </LegalSection>

      <LegalSection heading="5. Contact">
        <p>
          For any question about ownership, this website, or the business, contact Propel Cambridge at{" "}
          <a href="mailto:sovavis2025@gmail.com" className="font-medium text-crimson hover:underline">
            sovavis2025@gmail.com
          </a>{" "}
          or on Instagram{" "}
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
          </Link>
          ,{" "}
          <Link href="/terms" className="font-medium text-crimson hover:underline">
            Terms &amp; Conditions
          </Link>
          , and{" "}
          <Link href="/refund-policy" className="font-medium text-crimson hover:underline">
            Cancellation &amp; Refund Policy
          </Link>
          .
        </p>
      </LegalSection>
    </LegalShell>
  );
}
