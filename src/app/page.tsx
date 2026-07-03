'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/Button';
import { BookOpen, Users, Award, TrendingUp, CheckCircle, ArrowRight, Mail, Instagram, X, Menu, Atom, Sigma, FlaskConical, Calculator, GraduationCap, PenTool, Loader2 } from 'lucide-react';
import { motion, useScroll, useSpring } from 'framer-motion';
import { useUser } from '@clerk/nextjs';
import { useClerkAuth } from '@/lib/useClerkAuth';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { BrandLogo } from '@/components/ui/Logo';
import { Reveal, Stagger, StaggerItem, CountUp, Marquee } from '@/components/ui/Motion';

const AuthLoading = () => (
  <div className="flex items-center justify-center py-16">
    <Loader2 className="h-7 w-7 animate-spin text-crimson" />
  </div>
);

const FloatingHero = dynamic(() => import('@/components/FloatingHero'), {
  loading: () => <div className="h-[70vh] animate-pulse bg-surface-soft" />,
  ssr: false,
});
const SignIn = dynamic(() => import('@clerk/nextjs').then(m => ({ default: m.SignIn })), { ssr: false, loading: AuthLoading });
const SignUp = dynamic(() => import('@clerk/nextjs').then(m => ({ default: m.SignUp })), { ssr: false, loading: AuthLoading });

/** Preload the Clerk auth chunk so the modal opens instantly on first click. */
function preloadClerk() {
  import('@clerk/nextjs').catch(() => {});
}

function destForUser(user: any, profile: { role?: string } | null): string {
  const email = (user?.primaryEmailAddress?.emailAddress || "").toLowerCase();
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "sovavis2025@gmail.com")
    .split(",").map((i) => i.trim().toLowerCase()).filter(Boolean);
  const metadataRole = typeof user?.publicMetadata?.role === "string" ? user.publicMetadata.role : null;
  const role = profile?.role || metadataRole || (adminEmails.includes(email) ? "admin" : "student");
  if (role === "teacher") return "/teacher/dashboard";
  if (role === "admin") return "/admin/dashboard";
  return "/student/dashboard";
}

const clerkAppearance = (accent: 'sign-in' | 'sign-up') => ({
  elements: {
    card: "shadow-none border-0 bg-transparent",
    rootBox: "w-full",
    cardBox: "shadow-none w-full",
    main: "w-full",
    identityPreview: "hidden",
    identityPreviewText: "hidden",
    identityPreviewEditButton: "hidden",
    footerAction: "hidden",
    formButtonPrimary: "bg-crimson hover:bg-crimson-deep text-white font-bold",
    formFieldInput: "rounded-xl border border-line bg-surface text-ink focus:border-crimson",
    headerTitle: "text-crimson font-black text-2xl",
    headerSubtitle: "text-ink-muted",
    socialButtonsBlockButton: "border border-line hover:border-crimson transition-all bg-surface text-ink",
    socialButtonsBlockButtonText: "text-ink",
    dividerLine: "bg-line",
    dividerText: "text-ink-faint",
    formFieldLabel: "text-ink-muted",
    otpCodeFieldInput: "border-line bg-surface text-ink",
  },
});

function HomePageContent() {
  const { user, isLoaded } = useUser();
  const { profile } = useClerkAuth();
  const [authModal, setAuthModal] = useState<"sign-in" | "sign-up" | null>(null);
  const [policyModal, setPolicyModal] = useState<"privacy" | "terms" | "cookies" | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [showNav, setShowNav] = useState(true);
  const lastScrollY = useRef(0);
  const router = useRouter();
  const searchParams = useSearchParams();

  const { scrollYProgress } = useScroll();
  const progressX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });

  const openAuth = useCallback((mode: "sign-in" | "sign-up") => {
    preloadClerk();
    setAuthModal(mode);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const auth = searchParams?.get("auth");

    if (auth !== "sign-in" && auth !== "sign-up") {
      return;
    }

    setAuthModal(auth);
    url.searchParams.delete("auth");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [searchParams]);

  // Instant redirect: the moment auth is confirmed, leave the landing page.
  // Default to the student dashboard immediately (the common case) instead of
  // waiting on the backend profile round-trip, so a new user never lingers here.
  useEffect(() => {
    if (!isLoaded || !user) return;
    setAuthModal(null);
    router.replace(destForUser(user, profile));
  }, [isLoaded, user, profile?.role, router]);

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

  const features = [
    { icon: BookOpen, title: "Comprehensive resources", desc: "Past papers, topical questions, and study materials in one organized place.", pill: "ed-pill-crimson", iconWrap: "bg-crimson-soft text-crimson-ink" },
    { icon: Users, title: "Expert teachers", desc: "Learn from experienced educators who know exactly what the exam wants.", pill: "ed-pill-mint", iconWrap: "bg-mint-soft text-mint-ink" },
    { icon: Award, title: "Track readiness", desc: "Monitor performance with accuracy trends and exam-readiness scoring.", pill: "ed-pill-gold", iconWrap: "bg-gold-soft text-gold-ink" },
    { icon: TrendingUp, title: "Personalized path", desc: "Adaptive practice that targets your weak spots first for the fastest gains.", pill: "ed-pill-clay", iconWrap: "bg-clay-soft text-clay-ink" },
  ];

  const subjects = ["Physics", "Chemistry", "Biology", "Mathematics", "Add Maths", "Computer Science", "Economics", "Business", "English", "Islamiyat", "Pakistan Studies", "Accounting"];

  const stats = [
    { to: 12000, suffix: "+", label: "Questions solved" },
    { to: 50, suffix: "+", label: "Paper years" },
    { to: 12, suffix: "", label: "Subjects covered" },
    { to: 94, suffix: "%", label: "Hit their target" },
  ];

  // Once auth is confirmed, cover the page and redirect — the student never
  // lingers on the landing page after signing in / up.
  if (isLoaded && user) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-paper text-ink">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <BrandLogo size={46} labelClassName="text-2xl text-crimson" />
        </motion.div>
        <div className="flex items-center gap-3 text-ink-muted">
          <Loader2 className="h-5 w-5 animate-spin text-crimson" />
          <span className="text-sm font-semibold">Taking you to your dashboard…</span>
        </div>
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
                <div className="flex items-center gap-2 md:gap-3">
                  <button
                    onClick={() => openAuth("sign-in")}
                    onMouseEnter={preloadClerk}
                    className="hidden md:block font-bold text-ink-muted hover:text-crimson transition-colors"
                  >
                    Log In
                  </button>
                  <Button
                    onClick={() => openAuth("sign-up")}
                    onMouseEnter={preloadClerk}
                    className="rounded-full px-5 md:px-7 h-10 md:h-11 text-xs md:text-sm"
                  >
                    Sign up
                  </Button>
                </div>
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
            <a href="#how-it-works" className="block py-1" onClick={() => setIsMobileNavOpen(false)}>How It Works</a>
            <Link href="/past-papers" className="block py-1" onClick={() => setIsMobileNavOpen(false)}>Past Papers</Link>
            <button onClick={() => { openAuth("sign-in"); setIsMobileNavOpen(false); }} className="w-full text-left py-1">Log In</button>
            <button onClick={() => { openAuth("sign-up"); setIsMobileNavOpen(false); }} className="w-full text-left py-1 text-crimson">Sign up</button>
          </div>
        </div>
      )}

      {authModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={() => setAuthModal(null)}>
          <div className="relative w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setAuthModal(null)}
              className="absolute -right-2 -top-2 z-10 bg-surface rounded-full p-2 text-ink hover:bg-crimson hover:text-white transition-all shadow-lg"
              aria-label="Close authentication modal"
            >
              <X size={20} />
            </button>

            <div className="mb-3 flex items-center gap-2 justify-center">
              <button
                onClick={() => setAuthModal("sign-in")}
                className={`rounded-full px-6 py-2.5 text-sm font-bold transition-all ${authModal === "sign-in" ? "bg-crimson text-white shadow-lg scale-105" : "bg-surface/90 text-ink-muted hover:bg-surface"}`}
              >
                Log In
              </button>
              <button
                onClick={() => setAuthModal("sign-up")}
                className={`rounded-full px-6 py-2.5 text-sm font-bold transition-all ${authModal === "sign-up" ? "bg-crimson text-white shadow-lg scale-105" : "bg-surface/90 text-ink-muted hover:bg-surface"}`}
              >
                Sign Up
              </button>
            </div>

            <div className="bg-surface/95 backdrop-blur-md rounded-[1.5rem] shadow-2xl border border-line overflow-hidden">
              {authModal === "sign-in" ? (
                <SignIn
                  routing="hash"
                  signUpUrl="/"
                  afterSignInUrl="/"
                  fallbackRedirectUrl="/"
                  forceRedirectUrl="/"
                  appearance={clerkAppearance('sign-in')}
                />
              ) : (
                <SignUp
                  routing="hash"
                  signInUrl="/?auth=sign-in"
                  afterSignUpUrl="/"
                  fallbackRedirectUrl="/"
                  forceRedirectUrl="/"
                  appearance={clerkAppearance('sign-up')}
                />
              )}
            </div>
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
      <section aria-hidden className="relative border-y border-line bg-paper py-5 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-paper to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-paper to-transparent" />
        <Marquee speed={42}>
          {subjects.map((s) => (
            <span key={s} className="mx-2.5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink-muted">
              <GraduationCap size={15} className="text-crimson" /> {s}
            </span>
          ))}
        </Marquee>
      </section>

      {/* Features Section */}
      <section id="features" className="relative py-20 md:py-28 px-5 md:px-12 bg-surface-soft">
        <div className="max-w-[1200px] mx-auto">
          <Reveal className="text-center mb-12 md:mb-16">
            <span className="ed-eyebrow justify-center">Why Propel</span>
            <h2 className="mt-3 font-display text-3xl md:text-5xl font-semibold tracking-tight text-ink">
              Everything you need to <span className="italic text-crimson">excel</span>
            </h2>
            <p className="mt-4 text-lg text-ink-muted max-w-2xl mx-auto">Built around the way O Level students actually revise.</p>
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
            <span className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[.14em] text-white/50">By the numbers</span>
            <h2 className="mt-3 font-display text-3xl md:text-5xl font-semibold tracking-tight">Momentum you can measure</h2>
          </Reveal>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map((stat, i) => (
              <Reveal key={stat.label} delay={i * 0.1}>
                <div className="font-display text-4xl md:text-6xl font-semibold text-white">
                  <CountUp to={stat.to} suffix={stat.suffix} />
                </div>
                <div className="mx-auto mt-3 h-1 w-8 rounded-full bg-crimson" />
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
            <p className="mt-4 text-lg text-ink-muted max-w-2xl mx-auto">Three simple steps to your target grade.</p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
            {[
              { step: "01", title: "Sign up", desc: "Create your account and pick your subjects and level in under a minute." },
              { step: "02", title: "Choose your path", desc: "Jump into past papers, topical practice, or AI-graded written answers." },
              { step: "03", title: "Track & excel", desc: "Watch your readiness score climb and lock in your target grades." }
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

      {/* Testimonials Section */}
      <section className="py-20 md:py-28 px-5 md:px-12 bg-gradient-to-br from-[#A8123C] to-[#760B28] text-white">
        <div className="max-w-[1200px] mx-auto">
          <Reveal className="text-center mb-12 md:mb-16">
            <span className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[.14em] text-white/60">Success stories</span>
            <h2 className="mt-3 font-display text-3xl md:text-5xl font-semibold tracking-tight">Students who propelled ahead</h2>
            <p className="mt-4 text-lg text-white/75 max-w-2xl mx-auto">Real results from focused revision.</p>
          </Reveal>

          <Stagger className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: "Sarah Ahmed", grade: "A* in Mathematics", quote: "Propel helped me understand complex topics with ease. The practice questions were invaluable!" },
              { name: "Ali Hassan", grade: "A* in Physics", quote: "The structured approach and expert guidance made all the difference in my preparation." },
              { name: "Fatima Khan", grade: "A* in Chemistry", quote: "I improved from a B to an A* thanks to the personalized learning path and progress tracking." }
            ].map((testimonial, idx) => (
              <StaggerItem key={idx}>
                <motion.div
                  whileHover={{ y: -6 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                  className="h-full bg-white/10 backdrop-blur-sm p-7 rounded-[1.25rem] border border-white/15"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle className="w-5 h-5 text-[#FFD9A8]" />
                    <span className="font-bold text-[#FFD9A8] text-sm">{testimonial.grade}</span>
                  </div>
                  <p className="text-base md:text-[17px] mb-6 leading-relaxed text-white/95">&ldquo;{testimonial.quote}&rdquo;</p>
                  <p className="font-bold text-white">{testimonial.name}</p>
                </motion.div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-28 px-5 md:px-12 bg-[#1C1714] text-white">
        <Reveal className="max-w-[1200px] mx-auto text-center">
          <h2 className="font-display text-3xl md:text-5xl lg:text-6xl font-semibold tracking-tight mb-5">Ready to <span className="italic text-crimson">propel</span> your success?</h2>
          <p className="text-lg md:text-xl text-white/60 mb-9 max-w-2xl mx-auto">Join thousands of students achieving their dream grades.</p>
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
              <BrandLogo size={38} labelClassName="text-2xl text-white" />
              <p className="text-white/60 leading-relaxed text-sm md:text-[15px]">Empowering O Level students to achieve academic excellence through expert guidance and comprehensive resources.</p>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-base font-bold mb-4 text-white">Quick Links</h3>
              <ul className="space-y-2.5 text-white/60 text-sm md:text-[15px]">
                <li><a href="#features" className="hover:text-crimson transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-crimson transition-colors">How It Works</a></li>
                <li><Link href="/past-papers" className="hover:text-crimson transition-colors">Past Papers</Link></li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h3 className="text-base font-bold mb-4 text-white">Resources</h3>
              <ul className="space-y-2.5 text-white/60 text-sm md:text-[15px]">
                <li><Link href="/past-papers" className="hover:text-crimson transition-colors">Past Papers</Link></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="text-base font-bold mb-4 text-white">Get In Touch</h3>
              <ul className="space-y-3 text-white/60">
                <li className="flex items-center gap-2 text-sm md:text-[15px]">
                  <Mail size={18} className="text-crimson flex-shrink-0" />
                  <a href="mailto:sovavis2025@gmailcom" className="hover:text-crimson transition-colors truncate">sovavis2025@gmailcom</a>
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
              <button onClick={() => setPolicyModal("privacy")} className="hover:text-crimson transition-colors">Privacy Policy</button>
              <button onClick={() => setPolicyModal("terms")} className="hover:text-crimson transition-colors">Terms of Service</button>
              <button onClick={() => setPolicyModal("cookies")} className="hover:text-crimson transition-colors">Cookie Policy</button>
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
