import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell, LegalSection, LegalList } from "@/components/legal/LegalShell";

export const metadata: Metadata = {
  title: "Terms & Conditions — Propel Cambridge",
  description: "The terms that govern your use of Propel Cambridge.",
};

const UPDATED = "17 September 2026";

export default function TermsPage() {
  return (
    <LegalShell
      title="Terms & Conditions"
      updated={UPDATED}
      intro="These terms govern your use of Propel, operated by Propel Cambridge (“Propel”, “we”, “us”). By using the service, you agree to them."
    >
      <LegalSection heading="1. The service">
        <p>
          Propel is an online assessment and revision platform for Cambridge O Level and A Level. You can practise
          questions, submit answers for marking and feedback, and track your progress.
        </p>
      </LegalSection>

      <LegalSection heading="2. Not affiliated with Cambridge">
        <p>
          Propel is an independent tool and is <strong>not affiliated with or endorsed by</strong> Cambridge Assessment
          International Education or any examination board. Past-paper questions remain the property of their respective
          boards and are used for educational purposes.
        </p>
      </LegalSection>

      <LegalSection heading="3. Your account">
        <p>
          You are responsible for keeping your account secure and for the accuracy of the information you provide. Use
          the account only for yourself, unless you are a teacher managing a class.
        </p>
      </LegalSection>

      <LegalSection heading="4. Trial, subscription and billing">
        <LegalList
          items={[
            "New users can start a 10-day free trial. Past Papers are free to browse; other features require an active trial or subscription.",
            "After the trial, continued access requires a paid subscription, billed in Pakistani Rupees (PKR).",
            "Subscriptions renew automatically until you cancel. You can cancel any time to stop future renewals.",
          ]}
        />
        <p>
          See our{" "}
          <Link href="/refund-policy" className="font-medium text-crimson hover:underline">
            Cancellation &amp; Refund Policy
          </Link>{" "}
          for details.
        </p>
      </LegalSection>

      <LegalSection heading="5. Acceptable use">
        <p>
          Do not attempt unauthorised access, copy or redistribute content, share or sell your account, or interfere
          with the service.
        </p>
      </LegalSection>

      <LegalSection heading="6. Content and accuracy">
        <p>
          The Propel software, design, and brand belong to Propel Cambridge; you keep ownership of your own answers.
          Marks and feedback are provided to help you study, may contain errors, and are not official Cambridge results.
        </p>
      </LegalSection>

      <LegalSection heading="7. Liability and governing law">
        <p>
          The service is provided “as is”. To the extent permitted by law, we are not liable for indirect or
          consequential losses. These terms are governed by the laws of the Islamic Republic of Pakistan.
        </p>
      </LegalSection>

      <LegalSection heading="8. Contact">
        <p>
          Questions? Email{" "}
          <a href="mailto:sovavis2025@gmail.com" className="font-medium text-crimson hover:underline">
            sovavis2025@gmail.com
          </a>{" "}
          or message{" "}
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
          .
        </p>
      </LegalSection>
    </LegalShell>
  );
}
