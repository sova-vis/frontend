import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell, LegalSection, LegalList } from "@/components/legal/LegalShell";

export const metadata: Metadata = {
  title: "Terms & Conditions — Propel Cambridge",
  description:
    "The terms that govern your use of Propel Cambridge, the AI assessment platform for Cambridge O Level and A Level.",
};

const UPDATED = "17 September 2026";

export default function TermsPage() {
  return (
    <LegalShell
      title="Terms & Conditions"
      updated={UPDATED}
      intro="These Terms & Conditions govern your use of propelcambridge.com and the Propel platform, operated by Propel Cambridge (“Propel”, “we”, “us”). By creating an account or using the service, you agree to these terms."
    >
      <LegalSection heading="1. The service">
        <p>
          Propel is an AI-powered assessment and revision platform for Cambridge O Level and A Level. It lets you
          practise past-paper and topical questions, submit typed or handwritten answers for AI marking against the
          official mark scheme, receive explanations, and track your progress.
        </p>
      </LegalSection>

      <LegalSection heading="2. Not affiliated with Cambridge">
        <p>
          Propel is an independent study tool. It is <strong>not affiliated with, endorsed by, or connected to</strong>{" "}
          Cambridge Assessment International Education (CAIE), the University of Cambridge, or any examination board.
          “Cambridge”, “O Level”, and “A Level” are used only to describe the syllabuses the platform supports.
          Past-paper questions remain the property of their respective examination boards and are used for educational
          purposes.
        </p>
      </LegalSection>

      <LegalSection heading="3. Accounts and eligibility">
        <LegalList
          items={[
            "You sign in with Google. You are responsible for keeping access to your account secure.",
            "You agree to provide accurate information and to use the account only for yourself, unless you are a teacher managing a class.",
            "If you are under the age of majority in your country, you should use Propel with the involvement of a parent, guardian, or school.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="4. Free trial, subscriptions and billing">
        <LegalList
          items={[
            <><strong>Free trial.</strong> New users may start a 10-day free trial. Past Papers are free to browse; other Pro features require an active trial or subscription.</>,
            <><strong>Pro subscription.</strong> After the trial, continued access to Pro features requires a paid subscription, billed in Pakistani Rupees (PKR) through our payment processor, Safepay.</>,
            <><strong>Renewal.</strong> Subscriptions renew automatically for the same period until you cancel. You can cancel at any time to stop future renewals.</>,
            <><strong>Price changes.</strong> We may change prices or plan features; any change applies to future billing periods, and we will make current pricing clear before you pay.</>,
          ]}
        />
        <p>
          Cancellation and refunds are described in our{" "}
          <Link href="/refund-policy" className="font-medium text-crimson hover:underline">
            Cancellation &amp; Refund Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection heading="5. Acceptable use">
        <p>When using Propel, you agree not to:</p>
        <LegalList
          items={[
            "Attempt to gain unauthorised access to the platform, other accounts, or our systems.",
            "Copy, scrape, resell, or redistribute content or questions from the platform.",
            "Share, transfer, or sell your account, or use it on behalf of others outside a teacher–class relationship.",
            "Misuse the AI features, upload unlawful content, or interfere with the service’s operation.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="6. Intellectual property">
        <p>
          The Propel platform — including its software, design, branding, and the “Propel” and “Propel Cambridge” names
          — is owned by Propel Cambridge. You keep ownership of the answers and content you create. Past-paper questions
          and mark schemes remain the property of their respective examination boards.
        </p>
      </LegalSection>

      <LegalSection heading="7. AI-assisted marking — no guarantee of accuracy">
        <p>
          Marking, feedback, and explanations are generated with the assistance of AI and are provided for study
          purposes only. They may contain errors and are <strong>not</strong> official grades or predictions of exam
          results. Always rely on your teacher and official Cambridge materials for authoritative marking.
        </p>
      </LegalSection>

      <LegalSection heading="8. Disclaimers and limitation of liability">
        <p>
          The service is provided “as is” and “as available”. To the fullest extent permitted by law, Propel Cambridge
          is not liable for indirect or consequential losses, or for outcomes based on AI-generated content. Nothing in
          these terms limits any liability that cannot be limited under applicable law.
        </p>
      </LegalSection>

      <LegalSection heading="9. Suspension and termination">
        <p>
          You may stop using Propel and delete your account at any time. We may suspend or terminate access if these
          terms are breached or if required to protect the service or other users.
        </p>
      </LegalSection>

      <LegalSection heading="10. Governing law">
        <p>
          These terms are governed by the laws of the Islamic Republic of Pakistan, and any disputes are subject to the
          courts of Pakistan.
        </p>
      </LegalSection>

      <LegalSection heading="11. Changes and contact">
        <p>
          We may update these terms; the “Last updated” date above shows the latest version, and continued use means you
          accept the updated terms. Questions? Email{" "}
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
