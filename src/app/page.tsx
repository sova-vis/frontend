'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/Button';
import { CheckCircle, ArrowRight, Mail, Instagram, X, Menu, Atom, Sigma, FlaskConical, Calculator, PenTool, FileCheck2, ListChecks, Target, School } from 'lucide-react';
import { motion, useScroll, useSpring } from 'framer-motion';
import { useUser, useSignIn } from '@clerk/nextjs';
import { useClerkAuth } from '@/lib/useClerkAuth';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { BrandLogo } from '@/components/ui/Logo';
import PropelLoader from '@/components/ui/PropelLoader';
import { showAuthSplash } from '@/lib/authSplash';
import { Reveal, Stagger, StaggerItem, CountUp, Marquee } from '@/components/ui/Motion';

/** Google 'G' mark for the single sign-in button. */
function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="shrink-0">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C39.9 36.7 44 31 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}

const FloatingHero = dynamic(() => import('@/components/PlayfulHero'), {
  loading: () => <div className="h-[70vh] animate-pulse bg-surface-soft" />,
  ssr: false,
});

/** Preload the Clerk auth chunk so Google sign-in starts instantly on click. */
function preloadClerk() {
  import('@clerk/nextjs').catch(() => {});
}

function destForUser(user: any, profile: { role?: string; onboarding_complete?: boolean } | null): string {
  const email = (user?.primaryEmailAddress?.emailAddress || "").toLowerCase();
  // No hardcoded admin account. Admin access comes only from a deliberately
  // assigned role (profile.role === 'admin'); optionally, an ops team can set
  // NEXT_PUBLIC_ADMIN_EMAILS to allow-list emails, but there is no default.
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
    .split(",").map((i) => i.trim().toLowerCase()).filter(Boolean);
  // A brand-new account (no profile, or onboarding not done) picks its role first.
  if (!profile || profile.onboarding_complete === false) {
    // Admin emails skip onboarding straight to the admin area.
    if (adminEmails.includes(email)) return "/admin/dashboard";
    return "/onboarding";
  }
  const metadataRole = typeof user?.publicMetadata?.role === "string" ? user.publicMetadata.role : null;
  const role = profile?.role || metadataRole || (adminEmails.includes(email) ? "admin" : "student");
  if (role === "teacher") return "/teacher/dashboard";
  if (role === "admin") return "/admin/dashboard";
  return "/student/dashboard";
}

function HomePageContent() {
  const { user, isLoaded } = useUser();
  const { profile, loading: profileLoading } = useClerkAuth();
  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const [authOpen, setAuthOpen] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [policyModal, setPolicyModal] = useState<"privacy" | "terms" | "cookies" | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [showNav, setShowNav] = useState(true);
  const lastScrollY = useRef(0);
  const router = useRouter();

  const { scrollYProgress } = useScroll();
  const progressX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });

  // Single sign-in path: Google. Clerk signs in returning users and registers
  // first-timers through the same OAuth flow, returning to /sso-callback → "/".
  const continueWithGoogle = useCallback(async () => {
    if (googleBusy) return;
    preloadClerk();
    if (!signInLoaded || !signIn) return;
    setGoogleBusy(true);
    setAuthError("");
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        // Land on the neutral role-router (a splash-covered spinner), never the
        // marketing landing — that "/" briefly rendered and caused the flicker.
        redirectUrlComplete: "/dashboard",
      });
    } catch {
      setAuthError("Couldn't start Google sign-in. Please try again.");
      setGoogleBusy(false);
    }
  }, [signIn, signInLoaded, googleBusy]);

  // Every old sign-in/sign-up entry point now opens the single "Login" popup.
  const openAuth = useCallback((_mode?: "sign-in" | "sign-up") => { preloadClerk(); setAuthError(""); setAuthOpen(true); }, []);

  // Instant redirect the moment auth is confirmed — no lingering on the landing
  // page. Returning users are routed from their cached profile immediately; a
  // brand-new user (no cache yet) goes straight to onboarding without waiting on
  // the backend round-trip. The onboarding page bounces anyone already onboarded.
  // The moment auth is confirmed, raise the Propel splash so the landing →
  // onboarding → dashboard hand-off is covered by one animation, not a flicker
  // through each page. Each destination drops the splash once it's ready.
  useEffect(() => {
    if (isLoaded && user) showAuthSplash();
  }, [isLoaded, user]);

  useEffect(() => {
    if (!isLoaded || !user) return;

    let resolved: { role?: string; onboarding_complete?: boolean } | null = !profileLoading ? profile : null;
    if (!resolved && typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(`propel_profile_${user.id}`);
        if (raw) resolved = JSON.parse(raw);
      } catch { /* ignore */ }
    }

    if (resolved) {
      router.replace(destForUser(user, resolved));
    } else if (!profileLoading) {
      // Only once the profile has FINISHED loading and is genuinely absent do we
      // treat this as a new account. Routing to /onboarding while it's still
      // loading (e.g. right after a login, when the cached profile was cleared on
      // the previous sign-out) sent returning users to onboarding every time.
      // While it loads with no cache, we wait here — the splash covers the gap.
      router.replace(destForUser(user, profile));
    }
  }, [isLoaded, user, profileLoading, profile, router]);

  // Prefetch every dashboard + warm the Clerk auth chunk so both feel instant.
  useEffect(() => {
    router.prefetch("/student/dashboard");
    router.prefetch("/teacher/dashboard");
    router.prefetch("/admin/dashboard");

    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(preloadClerk);
      return () => w.cancelIdleCallback?.(id);
    }
    const t = setTimeout(preloadClerk, 1200);
    return () => clearTimeout(t);
  }, [router]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const previousScrollY = lastScrollY.current;
      const isScrollingDown = currentScrollY > previousScrollY;

      setShowNav(!(isScrollingDown && currentScrollY > 100));
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const policyContent: Record<"privacy" | "terms" | "cookies", { title: string; body: string[] }> = {
    privacy: {
      title: "Privacy Policy",
      body: [
        "We collect only the information needed to provide learning features such as progress tracking, question answering, and account personalization.",
        "Your profile and learning data are used to improve your study experience and are not sold to third parties.",
        "If you need data access, correction, or deletion requests, contact us at sovavis2025@gmailcom.",
      ],
    },
    terms: {
      title: "Terms of Service",
      body: [
        "This platform is intended for educational support and exam preparation.",
        "Users must avoid abuse, unauthorized access attempts, and content misuse.",
        "Service features may evolve over time, and continued use means acceptance of updated terms.",
      ],
    },
    cookies: {
      title: "Cookie Policy",
      body: [
        "We use essential cookies and local storage to keep sessions stable and improve platform usability.",
        "Performance and preference data may be stored to enhance speed, personalization, and reliability.",
        "By using this website, you agree to this cookie usage for core platform functionality.",
      ],
    },
  };

  // The four claims Propel leads with — assessment, not tutoring (brand book p4).
  const features = [
    { icon: FileCheck2, title: "Marked against the scheme", desc: "Typed or handwritten answers, scored against the official CAIE mark scheme.", iconWrap: "bg-crimson-soft text-crimson-ink" },
    { icon: ListChecks, title: "Every mark explained", desc: "Each mark traced to the exact scheme point that earned or lost it — no black box.", iconWrap: "bg-crimson-soft text-crimson-ink" },
    { icon: Target, title: "Weak topics, tracked", desc: "Topic-level analytics show exactly where your marks keep going, over time.", iconWrap: "bg-clay-soft text-clay-ink" },
    { icon: School, title: "Built for schools", desc: "A teacher portal and institution management, built in from the start — not bolted on.", iconWrap: "bg-crimson-soft text-crimson-ink" },
  ];

  // O and A tracks read as real, separate offerings (no "Add Maths" anywhere,
  // per the current curriculum) — but the landing presents both uniformly.
  const subjectsByLevel: Record<"O" | "A", string[]> = {
    O: ["Physics", "Chemistry", "Biology", "Mathematics", "Computer Science", "Economics", "Business Studies", "Accounting", "English Language", "Islamiyat", "Pakistan Studies", "Statistics"],
    A: ["Physics", "Chemistry", "Biology", "Mathematics", "Further Mathematics", "Computer Science", "Economics", "Business", "Accounting", "Psychology", "Sociology", "English Literature"],
  };
  // Marquee shows the full breadth across both levels (de-duplicated).
  const subjects = Array.from(new Set([...subjectsByLevel.O, ...subjectsByLevel.A]));

  const stats = [
    { to: 12000, suffix: "+", label: "Answers marked" },
    { to: 15, suffix: "+", label: "Paper years" },
    { to: 20, suffix: "+", label: "Subjects covered" },
    { to: 100, suffix: "%", label: "Marks explained" },
  ];

  // Once auth is confirmed, cover the page and redirect — the student never
  // lingers on the landing page after signing in / up.
  if (isLoaded && user) {
    return (
      <div className="fixed inset-0 z-[100] bg-paper">
        <PropelLoader fullScreen label="Getting things ready…" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-paper text-ink font-sans overflow-x-hidden">
      {/* Scroll progress bar */}
      <motion.div
        style={{ scaleX: progressX }}
        className="fixed top-0 left-0 right-0 z-[60] h-1 origin-left bg-gradient-to-r from-crimson to-gold"
      />

      {/* Navbar Container */}
      <div className="fixed top-3 md:top-6 left-0 right-0 z-50 flex justify-center px-3 md:px-4 w-full pointer-events-none">
        <motion.nav
          initial={{ y: -100, opacity: 0 }}
          animate={{
            y: showNav ? 0 : -100,
            opacity: showNav ? 1 : 0
          }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="w-full max-w-[1200px] px-4 md:px-7 py-3 flex justify-between items-center bg-surface/85 backdrop-blur-xl rounded-full shadow-card border border-line pointer-events-auto"
        >
          <BrandLogo size={38} labelClassName="text-2xl text-crimson" />

          <div className="flex items-center gap-3 md:gap-8">
            <div className="hidden md:flex items-center gap-8 font-semibold text-ink-muted">
              <a href="#features" className="cursor-pointer hover:text-crimson transition-colors">Features</a>
              <a href="#levels" className="cursor-pointer hover:text-crimson transition-colors">Levels</a>
              <a href="#how-it-works" className="cursor-pointer hover:text-crimson transition-colors">How It Works</a>
              <Link href="/past-papers" className="cursor-pointer hover:text-crimson transition-colors">Past Papers</Link>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              <ThemeToggle className="shrink-0" />
              <button
                onClick={() => setIsMobileNavOpen((prev) => !prev)}
                className="md:hidden h-10 w-10 rounded-full border border-line bg-surface text-ink"
                aria-label="Open menu"
              >
                <Menu size={18} className="mx-auto" />
              </button>
              {isLoaded ? (
                <Button
                  onClick={() => { setAuthError(""); setAuthOpen(true); }}
                  onMouseEnter={preloadClerk}
                  className="rounded-full px-5 md:px-7 h-10 md:h-11 text-xs md:text-sm"
                >
                  Login
                </Button>
              ) : (
                <div className="h-10 w-20 md:w-24 rounded-full bg-surface-soft animate-pulse" />
              )}
            </div>
          </div>
        </motion.nav>
      </div>

      {isMobileNavOpen && (
        <div className="fixed top-20 right-3 z-[60] w-64 rounded-2xl border border-line bg-surface/95 backdrop-blur-xl p-4 shadow-card md:hidden">
          <div className="space-y-4 text-sm font-semibold text-ink-muted">
            <a href="#features" className="block py-1" onClick={() => setIsMobileNavOpen(false)}>Features</a>
            <a href="#levels" className="block py-1" onClick={() => setIsMobileNavOpen(false)}>Levels</a>
            <a href="#how-it-works" className="block py-1" onClick={() => setIsMobileNavOpen(false)}>How It Works</a>
            <Link href="/past-papers" className="block py-1" onClick={() => setIsMobileNavOpen(false)}>Past Papers</Link>
            <button onClick={() => { setIsMobileNavOpen(false); setAuthError(""); setAuthOpen(true); }} className="mt-1 w-full rounded-full bg-crimson py-2 font-semibold text-white">
              Login
            </button>
          </div>
        </div>
      )}

      {/* Login popup — one tap, Google only. */}
      {authOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={() => setAuthOpen(false)}>
          <div className="relative w-full max-w-sm rounded-[1.5rem] border border-line bg-surface p-7 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setAuthOpen(false)}
              className="absolute right-4 top-4 rounded-full p-1.5 text-ink-muted hover:bg-surface-soft"
              aria-label="Close login"
            >
              <X size={18} />
            </button>
            <div className="flex justify-center"><BrandLogo size={38} labelClassName="text-2xl" /></div>
            <h2 className="mt-4 font-display text-xl font-semibold tracking-tight">Welcome to Propel</h2>
            <p className="mt-1 text-sm text-ink-muted">Log in or sign up in one tap.</p>
            <button
              onClick={() => void continueWithGoogle()}
              disabled={googleBusy}
              className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-full border border-line bg-surface px-5 py-3 font-semibold text-ink shadow-card transition-colors hover:bg-surface-soft disabled:opacity-60"
            >
              <GoogleG size={18} /> {googleBusy ? "Connecting…" : "Continue with Google"}
            </button>
            {authError && <p className="mt-3 text-sm text-crimson">{authError}</p>}
            <p className="mt-4 text-xs text-ink-faint">By continuing you agree to our Terms &amp; Privacy Policy.</p>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <FloatingHero
        user={user}
        profile={profile}
        onSignUp={() => openAuth("sign-up")}
        onExplore={() => {
          document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      {/* Subject ribbon marquee */}
      <section aria-hidden className="relative bg-paper py-5 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-paper to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-paper to-transparent" />
        <Marquee speed={42}>
          {subjects.map((s) => (
            <span key={s} className="inline-flex items-center gap-5 px-2.5 text-base font-medium text-ink-muted">
              {s} <span aria-hidden className="h-1 w-1 rounded-full bg-crimson/40" />
            </span>
          ))}
        </Marquee>
      </section>

      {/* Features Section */}
      <section id="features" className="relative py-20 md:py-28 px-5 md:px-12 bg-surface-soft">
        <div className="max-w-[1200px] mx-auto">
          <Reveal className="text-center mb-12 md:mb-16">
            <span className="ed-eyebrow justify-center">What Propel does</span>
            <h2 className="mt-3 font-display text-3xl md:text-5xl font-semibold tracking-tight text-ink">
              See exactly where your <span className="italic text-crimson">marks</span> go
            </h2>
            <p className="mt-4 text-lg text-ink-muted max-w-2xl mx-auto">Not tutoring — assessment. Your answers, marked against the official Cambridge scheme.</p>
          </Reveal>

          <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
            {features.map((feature, idx) => (
              <StaggerItem key={idx}>
                <motion.div
                  whileHover={{ y: -8 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                  className="ed-card h-full p-6 md:p-7 hover:shadow-card-hover"
                >
                  <div className={`w-14 h-14 ${feature.iconWrap} rounded-2xl flex items-center justify-center mb-5`}>
                    <feature.icon className="w-7 h-7" />
                  </div>
                  <h3 className="font-display text-xl font-semibold text-ink mb-2">{feature.title}</h3>
                  <p className="text-sm md:text-[15px] text-ink-muted leading-relaxed">{feature.desc}</p>
                </motion.div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Two levels, one platform */}
      <section id="levels" className="relative py-20 md:py-28 px-5 md:px-12 bg-paper">
        <div className="max-w-[1200px] mx-auto">
          <Reveal className="text-center mb-12 md:mb-16">
            <span className="ed-eyebrow justify-center">Built for both</span>
            <h2 className="mt-3 font-display text-3xl md:text-5xl font-semibold tracking-tight text-ink">
              Two levels, <span className="italic text-crimson">one platform</span>
            </h2>
            <p className="mt-4 text-lg text-ink-muted max-w-2xl mx-auto">
              Whether you&apos;re sitting O Levels or A Levels, Propel marks your work against the
              right CAIE scheme and tracks your weakest topics over time.
            </p>
          </Reveal>

          <Stagger className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {([
              { key: "O" as const, tag: "IGCSE / O Level", title: "O Levels", blurb: "Every core subject, marked against the O Level scheme with topic-level weakness tracking.", accent: "bg-crimson" },
              { key: "A" as const, tag: "AS & A Level", title: "A Levels", blurb: "Sciences, maths and humanities marked to A Level standard, every mark traced to the scheme.", accent: "bg-ink" },
            ]).map((lvl) => (
              <StaggerItem key={lvl.key}>
                <motion.div
                  whileHover={{ y: -6 }}
                  transition={{ type: "spring", stiffness: 300, damping: 22 }}
                  className="ed-card h-full p-7 md:p-8 hover:shadow-card-hover"
                >
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center rounded-full ${lvl.accent} px-3.5 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[.13em] text-cream`}>
                      {lvl.tag}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-mint">
                      <CheckCircle size={15} /> Full coverage
                    </span>
                  </div>
                  <h3 className="mt-5 font-display text-3xl font-semibold text-ink">{lvl.title}</h3>
                  <p className="mt-2 text-[15px] text-ink-muted leading-relaxed">{lvl.blurb}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {subjectsByLevel[lvl.key].slice(0, 8).map((s) => (
                      <span key={s} className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-ink-muted">
                        {s}
                      </span>
                    ))}
                    <span className="rounded-full bg-crimson-soft px-3 py-1 text-xs font-bold text-crimson-ink">
                      +{Math.max(0, subjectsByLevel[lvl.key].length - 8)} more
                    </span>
                  </div>
                  <div className="mt-6 flex items-center gap-5 border-t border-line pt-5 text-sm">
                    <span className="flex items-baseline gap-1.5">
                      <b className="font-display text-xl font-semibold text-ink">20+</b>
                      <span className="text-ink-faint">subjects</span>
                    </span>
                    <span className="flex items-baseline gap-1.5">
                      <b className="font-display text-xl font-semibold text-ink">15+</b>
                      <span className="text-ink-faint">years of past papers</span>
                    </span>
                  </div>
                </motion.div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Animated stats band */}
      <section className="relative overflow-hidden bg-[#1C1714] py-16 md:py-24 px-5 md:px-12 text-white">
        {[
          { Icon: Sigma, top: "18%", left: "7%", d: 0, s: 46 },
          { Icon: Atom, top: "64%", left: "13%", d: 1.2, s: 42 },
          { Icon: FlaskConical, top: "26%", left: "86%", d: 0.6, s: 40 },
          { Icon: Calculator, top: "70%", left: "80%", d: 1.8, s: 38 },
          { Icon: PenTool, top: "12%", left: "60%", d: 0.9, s: 34 },
        ].map((g, i) => (
          <motion.div
            key={i}
            aria-hidden
            className="pointer-events-none absolute text-white/[.07]"
            style={{ top: g.top, left: g.left }}
            animate={{ y: [0, -18, 0], rotate: [0, 8, 0] }}
            transition={{ duration: 7 + i, repeat: Infinity, ease: "easeInOut", delay: g.d }}
          >
            <g.Icon size={g.s} />
          </motion.div>
        ))}

        <div className="relative mx-auto max-w-[1200px]">
          <Reveal className="mb-10 text-center md:mb-14">
            <span className="inline-flex items-center gap-2 font-mono text-[12px] font-medium uppercase tracking-[.13em] text-cream/50">By the numbers</span>
            <h2 className="mt-3 font-display text-3xl md:text-5xl font-semibold tracking-tight">Precision you can measure</h2>
          </Reveal>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map((stat, i) => (
              <Reveal key={stat.label} delay={i * 0.1}>
                <div className="font-display text-4xl md:text-6xl font-semibold text-white">
                  <CountUp to={stat.to} suffix={stat.suffix} />
                </div>
                <div className="mx-auto mt-3 h-1 w-8 rounded-full bg-pink" />
                <p className="mt-3 text-sm text-white/60">{stat.label}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 md:py-28 px-5 md:px-12 bg-paper">
        <div className="max-w-[1200px] mx-auto">
          <Reveal className="text-center mb-12 md:mb-16">
            <span className="ed-eyebrow justify-center">Get started</span>
            <h2 className="mt-3 font-display text-3xl md:text-5xl font-semibold tracking-tight text-ink">
              How it <span className="italic text-crimson">works</span>
            </h2>
            <p className="mt-4 text-lg text-ink-muted max-w-2xl mx-auto">Three steps from your answer to an explained mark.</p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
            {[
              { step: "01", title: "Submit your answer", desc: "Type it, or upload a photo of your handwritten answer to any past-paper question." },
              { step: "02", title: "Marked against the scheme", desc: "Propel scores it against the official CAIE mark scheme, point by point." },
              { step: "03", title: "See where marks went", desc: "Every mark is explained and your weakest topics are tracked over time." }
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: idx % 2 === 0 ? -48 : 48, y: 16 }}
                whileInView={{ opacity: 1, x: 0, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: idx * 0.1 }}
                className="relative"
              >
                <div className="font-display text-7xl md:text-8xl font-black text-crimson/10 absolute -top-6 md:-top-8 -left-1">{item.step}</div>
                <div className="relative z-10 pt-10 md:pt-12">
                  <h3 className="font-display text-2xl font-semibold text-ink mb-3">{item.title}</h3>
                  <p className="text-base md:text-lg text-ink-muted leading-relaxed">{item.desc}</p>
                </div>
                {idx < 2 && (
                  <motion.div
                    className="hidden md:block absolute top-1/2 -right-5 transform -translate-y-1/2"
                    animate={{ x: [0, 6, 0] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <ArrowRight className="w-7 h-7 text-crimson/30" />
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section — dark "product" skin */}
      <section className="py-20 md:py-28 px-5 md:px-12 bg-[#161310] text-cream">
        <div className="max-w-[1200px] mx-auto">
          <Reveal className="text-center mb-12 md:mb-16">
            <span className="inline-flex items-center gap-2 font-mono text-[12px] font-medium uppercase tracking-[.13em] text-cream/50">What they see</span>
            <h2 className="mt-3 font-display text-3xl md:text-5xl font-semibold tracking-tight">Marks, finally explained</h2>
            <p className="mt-4 text-lg text-cream/70 max-w-2xl mx-auto">What students and teachers see on a real Propel screen.</p>
          </Reveal>

          <Stagger className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: "Sara — A Level", label: "Weak topic found", quote: "I finally knew which topics to redo. The breakdown showed every mark I dropped on evaluation points." },
              { name: "Ali — O Level", label: "Marked in minutes", quote: "I upload a photo of my answer and see exactly where the scheme gave and took marks. No guessing." },
              { name: "Ms Khan — Teacher", label: "Explained line by line", quote: "My class sees the reasoning, not just a score — and it saves me marking hours every week." }
            ].map((testimonial, idx) => (
              <StaggerItem key={idx}>
                <motion.div
                  whileHover={{ y: -6 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                  className="h-full bg-cream/[0.06] backdrop-blur-sm p-7 rounded-[1.25rem] border border-cream/10"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle className="w-5 h-5 text-mint" />
                    <span className="font-mono text-[11px] font-medium uppercase tracking-[.13em] text-mint">{testimonial.label}</span>
                  </div>
                  <p className="text-base md:text-[17px] mb-6 leading-relaxed text-cream/95">&ldquo;{testimonial.quote}&rdquo;</p>
                  <p className="font-semibold text-cream">{testimonial.name}</p>
                </motion.div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-28 px-5 md:px-12 bg-[#1C1714] text-white">
        <Reveal className="max-w-[1200px] mx-auto text-center">
          <h2 className="font-display text-3xl md:text-5xl lg:text-6xl font-semibold tracking-tight mb-5">Ready to <span className="italic text-pink">propel</span> your success?</h2>
          <p className="text-lg md:text-xl text-white/60 mb-9 max-w-2xl mx-auto">See exactly where your marks went — marked against the official Cambridge scheme.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button onClick={() => openAuth("sign-up")} onMouseEnter={preloadClerk} size="lg" className="h-14 rounded-full px-10 text-base md:text-lg shadow-crimson">
              Get started free <ArrowRight className="ml-1" size={20} />
            </Button>
            <Link href="/past-papers">
              <Button variant="ghost" size="lg" className="h-14 rounded-full border border-white/20 bg-white/5 px-10 text-base md:text-lg text-white hover:bg-white/10">
                Explore past papers
              </Button>
            </Link>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="bg-[#1C1714] text-white/80 py-14 md:py-16 px-5 md:px-12 border-t border-white/10">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 mb-12">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1 space-y-4">
              <BrandLogo size={38} tone="dark" labelClassName="text-2xl" />
              <p className="text-white/60 leading-relaxed text-sm md:text-[15px]">The AI-powered assessment platform for Cambridge O Level and A Level — every answer marked against the official scheme, every mark explained.</p>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-base font-bold mb-4 text-white">Quick Links</h3>
              <ul className="space-y-2.5 text-white/60 text-sm md:text-[15px]">
                <li><a href="#features" className="hover:text-pink transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-pink transition-colors">How It Works</a></li>
                <li><Link href="/past-papers" className="hover:text-pink transition-colors">Past Papers</Link></li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h3 className="text-base font-bold mb-4 text-white">Resources</h3>
              <ul className="space-y-2.5 text-white/60 text-sm md:text-[15px]">
                <li><Link href="/past-papers" className="hover:text-pink transition-colors">Past Papers</Link></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="text-base font-bold mb-4 text-white">Get In Touch</h3>
              <ul className="space-y-3 text-white/60">
                <li className="flex items-center gap-2 text-sm md:text-[15px]">
                  <Mail size={18} className="text-pink flex-shrink-0" />
                  <a href="mailto:sovavis2025@gmailcom" className="hover:text-pink transition-colors truncate">sovavis2025@gmailcom</a>
                </li>
              </ul>
              <div className="flex items-center gap-3 mt-6">
                <a href="#" className="w-10 h-10 bg-white/10 hover:bg-crimson rounded-xl flex items-center justify-center transition-colors text-white">
                  <Instagram size={16} />
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-white/40 text-sm">&copy; 2026 Propel. All rights reserved.</p>
            <div className="flex flex-wrap justify-center items-center gap-4 md:gap-6 text-sm text-white/40">
              <button onClick={() => setPolicyModal("privacy")} className="hover:text-pink transition-colors">Privacy Policy</button>
              <button onClick={() => setPolicyModal("terms")} className="hover:text-pink transition-colors">Terms of Service</button>
              <button onClick={() => setPolicyModal("cookies")} className="hover:text-pink transition-colors">Cookie Policy</button>
            </div>
          </div>
        </div>
      </footer>

      {policyModal && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          onClick={() => setPolicyModal(null)}
        >
          <div
            className="relative w-full max-w-2xl rounded-[1.5rem] border border-line bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPolicyModal(null)}
              className="absolute right-4 top-4 rounded-full p-2 text-ink-muted hover:bg-surface-soft hover:text-crimson"
              aria-label="Close policy modal"
            >
              <X size={18} />
            </button>

            <div className="px-6 py-6 md:px-8 md:py-8">
              <h3 className="font-display text-2xl font-semibold text-crimson mb-4">
                {policyContent[policyModal].title}
              </h3>
              <div className="space-y-3 text-ink-muted leading-relaxed">
                {policyContent[policyModal].body.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomePageContent />
    </Suspense>
  );
}
