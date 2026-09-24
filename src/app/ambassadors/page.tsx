"use client";

/**
 * Student Ambassador Programme — a poster-style recruitment page linked from the
 * landing nav ("Ambassadors"). Built to match the Cohort 01 flyer: cream paper,
 * a big serif headline, four numbered benefit cards (the last one crimson), a
 * deadline row and an "Apply now" that opens the Google Form.
 */
import Link from "next/link";
import { ArrowRight, Home, Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/ui/Logo";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/Motion";

// Where every "Apply" action goes (the 7-minute Google Form).
const FORM_URL = "https://forms.gle/MVMCq8rQgnNsX7gMA";

const BENEFITS = [
  { n: "01", title: "Official ambassador title", sub: "Your role, on record." },
  { n: "02", title: "Certificate & reference letter", sub: "For university applications." },
  { n: "03", title: "Full Propel access", sub: "Every feature, free." },
  { n: "04", title: "Rewards for every paid referral", sub: "Tracked by your own code.", accent: true },
];

export default function AmbassadorsPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* nav */}
      <nav className="sticky top-0 z-40 border-b border-line bg-paper/85 px-5 py-4 backdrop-blur-xl md:px-8">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between">
          <Link href="/"><BrandLogo size={36} labelClassName="text-2xl text-crimson" /></Link>
          <div className="flex items-center gap-3">
            <Link href="/" className="hidden items-center gap-2 font-semibold text-ink-muted transition-colors hover:text-crimson sm:inline-flex">
              <Home size={18} /> Home
            </Link>
            <a href={FORM_URL} target="_blank" rel="noopener noreferrer" className="ed-btn-primary">
              Apply now <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-[1100px] px-5 pb-20 md:px-8">
        {/* hero */}
        <section className="pt-12 md:pt-16">
          <Reveal>
            <div className="flex items-start justify-between gap-4">
              <span className="ed-eyebrow text-crimson">Student Ambassador Programme</span>
              <span className="whitespace-nowrap font-mono text-[12px] font-medium uppercase tracking-[.13em] text-ink-faint">Cohort 01 · 2026</span>
            </div>
          </Reveal>

          <div className="mt-7 grid items-center gap-10 md:grid-cols-[1.15fr_.85fr]">
            <Reveal>
              <h1 className="font-display text-5xl font-semibold leading-[0.98] tracking-tight text-ink md:text-6xl lg:text-7xl">
                Represent <span className="italic text-crimson">Propel</span> at your school.
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-muted md:text-xl">
                We&apos;re selecting O Level and A Level students across Pakistan to represent
                Propel at their schools.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <a href={FORM_URL} target="_blank" rel="noopener noreferrer" className="ed-btn-primary h-12 px-7 text-base">
                  Apply now <ArrowRight size={18} />
                </a>
                <span className="text-sm text-ink-faint">Takes about 7 minutes.</span>
              </div>
            </Reveal>

            {/* poster-style crimson accent */}
            <Reveal delay={0.1}>
              <div className="relative hidden h-[300px] md:block">
                <div aria-hidden className="absolute right-4 top-2 h-36 w-36 rotate-12 rounded-[2rem] bg-crimson-soft" />
                <div aria-hidden className="absolute right-24 top-16 h-32 w-32 -rotate-6 rounded-[2rem] bg-crimson/10" />
                <div className="absolute inset-x-2 bottom-0 rounded-[1.75rem] bg-crimson p-8 text-white shadow-crimson">
                  <Sparkles size={22} className="text-white/80" />
                  <p className="mt-3 font-display text-3xl italic leading-tight">Be the change<br />at your school.</p>
                  <p className="mt-4 font-mono text-[11px] font-medium uppercase tracking-[.13em] text-white/75">O &amp; A Level · across Pakistan</p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* what you get */}
        <section className="mt-16 md:mt-24">
          <Reveal className="mb-8">
            <span className="ed-eyebrow">What you get</span>
          </Reveal>
          <Stagger className="grid gap-5 sm:grid-cols-2">
            {BENEFITS.map((b) => (
              <StaggerItem key={b.n}>
                <div className={`flex h-full flex-col rounded-[1.5rem] p-7 md:p-8 ${b.accent ? "bg-crimson text-white shadow-crimson" : "ed-card"}`}>
                  <span className={`font-mono text-sm font-medium tracking-[.13em] ${b.accent ? "text-white/70" : "text-crimson"}`}>{b.n}</span>
                  <h3 className={`mt-4 font-display text-2xl font-semibold leading-tight md:text-[26px] ${b.accent ? "text-white" : "text-ink"}`}>{b.title}</h3>
                  <p className={`mt-2 text-[15px] md:text-base ${b.accent ? "text-white/85" : "text-ink-muted"}`}>{b.sub}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        {/* deadline + apply */}
        <section className="mt-16 md:mt-24">
          <Reveal>
            <div className="flex flex-col gap-6 border-t border-line pt-10 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl">
                  Deadline: <span className="text-crimson">2nd Oct 2026</span>
                </h2>
                <p className="mt-2 text-ink-muted">A seven-minute form — that&apos;s all it takes to apply.</p>
              </div>
              <a href={FORM_URL} target="_blank" rel="noopener noreferrer" className="ed-btn-primary h-14 self-start px-9 text-base tracking-wide sm:self-auto md:text-lg">
                APPLY NOW <ArrowRight size={20} />
              </a>
            </div>
          </Reveal>
          <Reveal delay={0.05}>
            <p className="mt-8 text-center text-sm text-ink-faint">
              Know someone who&apos;d be a great fit? Share this page with them.
            </p>
          </Reveal>
        </section>
      </main>

      {/* footer strip */}
      <footer className="border-t border-line px-5 py-6 md:px-8">
        <div className="mx-auto max-w-[1100px] font-mono text-[12px] font-medium uppercase tracking-[.13em] text-ink-faint">
          Propelcambridge.com · @propelcambridge
        </div>
      </footer>
    </div>
  );
}
