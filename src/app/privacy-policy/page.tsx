import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell, LegalSection, LegalList } from "@/components/legal/LegalShell";

export const metadata: Metadata = {
  title: "Privacy Policy — Propel Cambridge",
  description: "How Propel Cambridge collects, uses, and protects your data.",
};

const UPDATED = "17 September 2026";

export default function PrivacyPolicyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      updated={UPDATED}
      intro="This policy explains what information Propel Cambridge (“Propel”, “we”, “us”) collects, how we use it, and the choices you have."
    >
      <LegalSection heading="1. Information we collect">
        <LegalList
          items={[
            <><strong>Account details</strong> — your name and email address when you sign in.</>,
            <><strong>Learning data</strong> — your level, subjects, answers, results, and progress.</>,
            <><strong>Basic usage data</strong> — limited technical information needed to keep the service secure and working.</>,
            <><strong>Subscription status</strong> — payments are handled securely by a third-party payment provider.</>,
          ]}
        />
      </LegalSection>

      <LegalSection heading="2. How we use it">
        <p>
          We use your information only to provide and personalise the service, manage your subscription, keep the
          platform secure, and improve it. We do <strong>not</strong> sell your data.
        </p>
      </LegalSection>

      <LegalSection heading="3. Sharing">
        <p>
          We share information only with trusted providers who help us operate the service, with your teacher if you
          join a class, or where the law requires it.
        </p>
      </LegalSection>

      <LegalSection heading="4. Cookies">
        <p>
          We use essential cookies and local storage to keep you signed in and remember your preferences. We do not use
          them for third-party advertising.
        </p>
      </LegalSection>

      <LegalSection heading="5. Your rights">
        <p>
          You can access, correct, or delete your data at any time from your account settings, or by contacting us. We
          keep your data only while your account is active.
        </p>
      </LegalSection>

      <LegalSection heading="6. Contact">
        <p>
          Email{" "}
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
          <Link href="/terms" className="font-medium text-crimson hover:underline">
            Terms &amp; Conditions
          </Link>
          .
        </p>
      </LegalSection>
    </LegalShell>
  );
}
