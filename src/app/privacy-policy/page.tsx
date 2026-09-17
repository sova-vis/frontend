import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell, LegalSection, LegalList } from "@/components/legal/LegalShell";

export const metadata: Metadata = {
  title: "Privacy Policy — Propel Cambridge",
  description:
    "How Propel Cambridge collects, uses, and protects your data on the Propel AI assessment platform for Cambridge O Level and A Level.",
};

const UPDATED = "17 September 2026";

export default function PrivacyPolicyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      updated={UPDATED}
      intro="This Privacy Policy explains what information Propel Cambridge (“Propel”, “we”, “us”) collects when you use propelcambridge.com and the Propel platform, how we use it, and the choices you have. By using Propel you agree to the practices described here."
    >
      <LegalSection heading="1. Who we are">
        <p>
          Propel Cambridge operates Propel, an AI-powered assessment platform for Cambridge O Level and A Level
          students. Propel is based in Pakistan. You can reach us any time at{" "}
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
          .
        </p>
      </LegalSection>

      <LegalSection heading="2. Information we collect">
        <p>We collect only what we need to run the service:</p>
        <LegalList
          items={[
            <><strong>Account information</strong> — when you sign in with Google, we receive your name, email address, and profile picture.</>,
            <><strong>Learning profile</strong> — the level (O Level / A Level) and subjects you choose, plus preferences such as your study goals and planner.</>,
            <><strong>Your work and progress</strong> — the answers you type, handwritten answers you upload for marking, questions you ask the AI, marks and feedback, attempts, bookmarks, and topic-level progress.</>,
            <><strong>Usage and device data</strong> — basic technical information (browser, device, approximate region, and a device identifier used only to prevent free-trial abuse) needed to keep the service secure and reliable.</>,
            <><strong>Payment information</strong> — subscription and billing are handled by our payment processor, Safepay. We receive your subscription status and a transaction reference. <strong>We never see or store your full card number.</strong></>,
          ]}
        />
      </LegalSection>

      <LegalSection heading="3. How we use your information">
        <LegalList
          items={[
            "Provide core features: mark answers against the official scheme, explain marks, answer questions, and track progress.",
            "Personalise your experience to your level, subjects, and goals.",
            "Operate subscriptions, free trials, and billing.",
            "Keep the platform secure, prevent abuse of the free trial, and diagnose problems.",
            "Improve the accuracy and quality of the service.",
          ]}
        />
        <p>We do <strong>not</strong> sell your personal data or your learning data to anyone.</p>
      </LegalSection>

      <LegalSection heading="4. AI processing">
        <p>
          To mark your answers and power the Ask AI features, the relevant question text and the answer or question you
          submit are sent to trusted third-party AI providers for processing. These providers process the content only
          to return a result to you. AI-generated marking and explanations are provided to help you study and may
          contain errors — they are not official Cambridge results.
        </p>
      </LegalSection>

      <LegalSection heading="5. Cookies and local storage">
        <p>
          We use essential cookies and browser local storage to keep you signed in, remember preferences (such as your
          active level and theme), and keep practice sessions stable. These are required for the platform to work; we do
          not use them for third-party advertising.
        </p>
      </LegalSection>

      <LegalSection heading="6. How we share information">
        <p>We share information only with the service providers that help us run Propel, and only as needed:</p>
        <LegalList
          items={[
            <><strong>Supabase</strong> — secure database, authentication, and file storage.</>,
            <><strong>AI providers</strong> — to generate marking, feedback, and answers (see section 4).</>,
            <><strong>Safepay</strong> — to process subscription payments securely.</>,
            <><strong>Your teacher or institution</strong> — if you join a class with a code, your teacher can see the work and progress you complete within that class.</>,
            "Authorities, where we are legally required to do so.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="7. Data retention">
        <p>
          We keep your account and learning data for as long as your account is active so your progress is available to
          you. If you delete your account, we remove your personal data within a reasonable period, except where we must
          retain limited records (for example, transaction records) to meet legal or accounting obligations.
        </p>
      </LegalSection>

      <LegalSection heading="8. Your rights and choices">
        <p>
          You can access, correct, export, or delete your data. Account deletion is available in your settings, and you
          can contact us at{" "}
          <a href="mailto:sovavis2025@gmail.com" className="font-medium text-crimson hover:underline">
            sovavis2025@gmail.com
          </a>{" "}
          for any privacy request. We will respond within a reasonable time.
        </p>
      </LegalSection>

      <LegalSection heading="9. Students and young users">
        <p>
          Propel is built for exam preparation and is often used by school-age students. Where a student uses Propel
          through a school or teacher, the school is responsible for obtaining any consent required under local law. If
          you believe a child has provided us personal data without appropriate consent, contact us and we will remove
          it.
        </p>
      </LegalSection>

      <LegalSection heading="10. Security">
        <p>
          We use industry-standard measures — encrypted connections, access controls, and a managed database — to
          protect your data. No system is perfectly secure, but we work to keep your information safe and to respond
          quickly to any issue.
        </p>
      </LegalSection>

      <LegalSection heading="11. Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. When we do, we will change the “Last updated” date above,
          and significant changes will be reflected on this page.
        </p>
      </LegalSection>

      <LegalSection heading="12. Contact us">
        <p>
          Questions about this policy or your data? Email{" "}
          <a href="mailto:sovavis2025@gmail.com" className="font-medium text-crimson hover:underline">
            sovavis2025@gmail.com
          </a>{" "}
          or message us on Instagram{" "}
          <a
            href="https://www.instagram.com/propelcambridge/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-crimson hover:underline"
          >
            @propelcambridge
          </a>
          . See also our{" "}
          <Link href="/terms" className="font-medium text-crimson hover:underline">
            Terms &amp; Conditions
          </Link>{" "}
          and{" "}
          <Link href="/refund-policy" className="font-medium text-crimson hover:underline">
            Refund Policy
          </Link>
          .
        </p>
      </LegalSection>
    </LegalShell>
  );
}
