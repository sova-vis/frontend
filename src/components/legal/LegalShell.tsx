import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/ui/Logo";

// The four verification pages, cross-linked at the foot of every legal page and
// listed in the site footer. Distinct routes (not modals) so a payment processor
// can verify each one at its own URL.
export const LEGAL_LINKS = [
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/refund-policy", label: "Cancellation & Refund Policy" },
  { href: "/ownership", label: "Ownership Statement" },
] as const;

/** Shared chrome for the legal pages — brand header, title block, cross-links, footer. */
export function LegalShell({ title, updated, intro, children }: {
  title: string;
  updated: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-surface text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[880px] items-center justify-between px-5 md:px-8">
          <Link href="/" aria-label="Propel home">
            <BrandLogo size={30} tone="light" labelClassName="text-xl" />
          </Link>
          <Link href="/" className="text-sm font-medium text-ink-muted transition-colors hover:text-crimson">
            ← Back to home
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-[760px] px-5 py-10 md:px-8 md:py-16">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-crimson">Legal</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl">{title}</h1>
        <p className="mt-3 text-sm text-ink-faint">Last updated: {updated}</p>
        {intro && <p className="mt-6 text-[15px] leading-relaxed text-ink-muted md:text-base">{intro}</p>}

        <div className="mt-9 space-y-8">{children}</div>

        <nav className="mt-14 border-t border-line pt-8">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">More legal pages</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {LEGAL_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-ink-muted transition-colors hover:text-crimson">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </article>

      <footer className="border-t border-line py-8">
        <div className="mx-auto flex max-w-[760px] flex-col items-center justify-between gap-3 px-5 text-sm text-ink-faint sm:flex-row md:px-8">
          <span>© 2026 Propel Cambridge. All rights reserved.</span>
          <a
            href="https://www.instagram.com/propelcambridge/"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-crimson"
          >
            @propelcambridge
          </a>
        </div>
      </footer>
    </main>
  );
}

/** A titled section of legal copy. */
export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-semibold text-ink">{heading}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-ink-muted">{children}</div>
    </section>
  );
}

/** A bulleted list inside a legal section. */
export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-crimson">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}
