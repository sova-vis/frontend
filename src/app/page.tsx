'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/Button';
import { BookOpen, Users, Award, TrendingUp, CheckCircle, ArrowRight, Mail, Instagram, X, Menu } from 'lucide-react';
import { motion } from 'framer-motion';
import { useUser } from '@clerk/nextjs';
import { useClerkAuth } from '@/lib/useClerkAuth';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { BrandLogo } from '@/components/ui/Logo';
import { Reveal, Stagger, StaggerItem } from '@/components/ui/Motion';

const FloatingHero = dynamic(() => import('@/components/FloatingHero'), {
  loading: () => <div className="h-[70vh] animate-pulse bg-surface-soft" />,
  ssr: false,
});
const SignIn = dynamic(() => import('@clerk/nextjs').then(m => ({ default: m.SignIn })), { ssr: false });
const SignUp = dynamic(() => import('@clerk/nextjs').then(m => ({ default: m.SignUp })), { ssr: false });

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
  const { profile, signOut, loading: profileLoading } = useClerkAuth();
  const [authModal, setAuthModal] = useState<"sign-in" | "sign-up" | null>(null);
  const [policyModal, setPolicyModal] = useState<"privacy" | "terms" | "cookies" | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [showNav, setShowNav] = useState(true);
  const lastScrollY = useRef(0);
  const router = useRouter();
  const searchParams = useSearchParams();

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

  // Redirect signed-in users to their dashboard
  useEffect(() => {
    if (!isLoaded || !user || profileLoading) {
      return;
    }

    const email = (user.primaryEmailAddress?.emailAddress || "").toLowerCase();
    const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "sovavis2025@gmail.com")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    const isAdminByEmail = adminEmails.includes(email);
    const metadataRole = typeof user.publicMetadata?.role === "string" ? user.publicMetadata.role : null;
    const role = profile?.role || metadataRole || (isAdminByEmail ? "admin" : null);

    // Avoid forcing student redirects when role data has not been resolved yet.
    if (!role) {
      return;
    }

    if (role === "teacher") {
      router.replace("/teacher/dashboard");
    } else if (role === "admin") {
      router.replace("/admin/dashboard");
    } else {
      router.replace("/student/dashboard");
    }
  }, [isLoaded, user, profile?.role, profileLoading, router]);

  // Close modal immediately when user signs in
  useEffect(() => {
    if (isLoaded && user) {
      setAuthModal(null);
    }
  }, [user, isLoaded]);

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

  return (
    <main className="min-h-screen bg-paper text-ink font-sans overflow-x-hidden">
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
              {isLoaded && user ? (
                <div className="flex items-center gap-2 md:gap-3">
                  <Link href={
                    (user.publicMetadata?.role === "teacher" || profile?.role === "teacher") ? "/teacher/dashboard" :
                      (user.publicMetadata?.role === "admin" || profile?.role === "admin") ? "/admin/dashboard" :
                        "/student/dashboard"
                  }>
                    <Button className="rounded-full px-5 md:px-7 h-10 md:h-11 text-xs md:text-sm">
                      <span className="hidden sm:inline">
                        {(user.publicMetadata?.role === "teacher" || profile?.role === "teacher") ? "Teacher " :
                          (user.publicMetadata?.role === "admin" || profile?.role === "admin") ? "Admin " :
                            ""}
                      </span>
                      <span>Dashboard</span>
                    </Button>
                  </Link>
                  <button
                    onClick={() => signOut()}
                    className="hidden md:flex font-bold text-ink-muted hover:text-crimson transition-colors px-3 h-11 items-center"
                  >
                    Logout
                  </button>
                </div>
              ) : isLoaded ? (
                <div className="flex items-center gap-2 md:gap-3">
                  <button
                    onClick={() => setAuthModal("sign-in")}
                    className="hidden md:block font-bold text-ink-muted hover:text-crimson transition-colors"
                  >
                    Log In
                  </button>
                  <Button
                    onClick={() => setAuthModal("sign-up")}
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
            {isLoaded && user ? (
              <>
                <Link href={
                  (user.publicMetadata?.role === "teacher" || profile?.role === "teacher") ? "/teacher/dashboard" :
                    (user.publicMetadata?.role === "admin" || profile?.role === "admin") ? "/admin/dashboard" :
                      "/student/dashboard"
                } className="block py-1 text-crimson" onClick={() => setIsMobileNavOpen(false)}>Dashboard</Link>
                <button onClick={() => signOut()} className="w-full text-left py-1 text-crimson">Logout</button>
              </>
            ) : (
              <button onClick={() => { setAuthModal("sign-in"); setIsMobileNavOpen(false); }} className="w-full text-left py-1">Log In</button>
            )}
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
        onSignUp={() => setAuthModal("sign-up")}
        onExplore={() => {
          document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
        }}
      />

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
              <Reveal key={idx} delay={idx * 0.12} className="relative">
                <div className="font-display text-7xl md:text-8xl font-black text-crimson/10 absolute -top-6 md:-top-8 -left-1">{item.step}</div>
                <div className="relative z-10 pt-10 md:pt-12">
                  <h3 className="font-display text-2xl font-semibold text-ink mb-3">{item.title}</h3>
                  <p className="text-base md:text-lg text-ink-muted leading-relaxed">{item.desc}</p>
                </div>
                {idx < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-5 transform -translate-y-1/2">
                    <ArrowRight className="w-7 h-7 text-crimson/30" />
                  </div>
                )}
              </Reveal>
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
          {user ? (
            <>
              <h2 className="font-display text-3xl md:text-5xl lg:text-6xl font-semibold tracking-tight mb-5">Welcome back, <span className="italic text-crimson">{profile?.full_name?.split(' ')[0] || user.firstName || 'Student'}</span></h2>
              <p className="text-lg md:text-xl text-white/60 mb-9 max-w-2xl mx-auto">Continue your learning journey and achieve your goals.</p>
              <Link href={
                (user.publicMetadata?.role === "teacher" || profile?.role === "teacher") ? "/teacher/dashboard" :
                  (user.publicMetadata?.role === "admin" || profile?.role === "admin") ? "/admin/dashboard" :
                    "/student/dashboard"
              }>
                <Button size="lg" className="h-14 rounded-full px-10 text-base md:text-lg shadow-crimson">
                  Continue learning <ArrowRight className="ml-1" size={20} />
                </Button>
              </Link>
            </>
          ) : (
            <>
              <h2 className="font-display text-3xl md:text-5xl lg:text-6xl font-semibold tracking-tight mb-5">Ready to <span className="italic text-crimson">propel</span> your success?</h2>
              <p className="text-lg md:text-xl text-white/60 mb-9 max-w-2xl mx-auto">Join thousands of students achieving their dream grades.</p>
              <Link href="/past-papers">
                <Button size="lg" className="h-14 rounded-full px-10 text-base md:text-lg shadow-crimson">
                  Explore past papers <ArrowRight className="ml-1" size={20} />
                </Button>
              </Link>
            </>
          )}
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
