'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/Button';
import { Play, BookOpen, Users, Award, TrendingUp, CheckCircle, ArrowRight, Mail, Facebook, Twitter, Instagram, Linkedin, X, Menu } from 'lucide-react';
import { motion } from 'framer-motion';
import { useUser } from '@clerk/nextjs';
import { useClerkAuth } from '@/lib/useClerkAuth';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const FloatingHero = dynamic(() => import('@/components/FloatingHero'), {
  loading: () => <div className="h-[70vh] animate-pulse bg-slate-100 dark:bg-slate-900" />,
  ssr: false,
});
const SignIn = dynamic(() => import('@clerk/nextjs').then(m => ({ default: m.SignIn })), { ssr: false });
const SignUp = dynamic(() => import('@clerk/nextjs').then(m => ({ default: m.SignUp })), { ssr: false });

export default function HomePage() {
  const { user, isLoaded } = useUser();
  const { profile, signOut } = useClerkAuth();
  const [authModal, setAuthModal] = useState<"sign-in" | "sign-up" | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [showNav, setShowNav] = useState(true);
  const lastScrollY = useRef(0);

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

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-brand-pink selection:text-white overflow-x-hidden">
      {/* Navbar Container */}
      <div className="fixed top-3 md:top-6 left-0 right-0 z-50 flex justify-center px-3 md:px-4 w-full pointer-events-none">
        <motion.nav
          initial={{ y: -100, opacity: 0 }}
          animate={{
            y: showNav ? 0 : -100,
            opacity: showNav ? 1 : 0
          }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="w-full max-w-[1200px] px-4 md:px-8 py-3 md:py-4 flex justify-between items-center bg-slate-100/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-full shadow-2xl shadow-slate-200/50 border border-slate-200 dark:border-slate-700 pointer-events-auto"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-burgundy rounded-tr-[20px] rounded-bl-[20px] flex items-center justify-center shadow-lg shadow-brand-burgundy/20">
              <Play className="w-5 h-5 text-white fill-white ml-0.5" />
            </div>
            <span className="text-2xl font-black tracking-tight text-brand-burgundy font-display">Propel</span>
          </div>

          <div className="flex items-center gap-3 md:gap-8">
            <div className="hidden md:flex items-center gap-8 font-semibold text-slate-600 dark:text-slate-300">
              <a href="#features" className="cursor-pointer hover:text-brand-burgundy transition-colors">Features</a>
              <a href="#how-it-works" className="cursor-pointer hover:text-brand-burgundy transition-colors">How It Works</a>
              <Link href="/past-papers" className="cursor-pointer hover:text-brand-burgundy transition-colors">Past Papers</Link>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              <ThemeToggle className="shrink-0" />
              <button
                onClick={() => setIsMobileNavOpen((prev) => !prev)}
                className="md:hidden h-10 w-10 rounded-full border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-900/80 text-slate-700 dark:text-slate-100"
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
                    <Button className="bg-brand-red hover:bg-brand-red/90 text-white font-bold rounded-none px-4 md:px-8 h-10 md:h-12 shadow-lg shadow-brand-red/20 text-xs md:text-md transition-transform hover:scale-105 active:scale-95 border-0 flex items-center gap-1 md:gap-2">
                      <span className="hidden sm:inline">
                        {(user.publicMetadata?.role === "teacher" || profile?.role === "teacher") ? "Teacher" :
                          (user.publicMetadata?.role === "admin" || profile?.role === "admin") ? "Admin" :
                            ""}
                      </span>
                      <span>Dashboard</span>
                    </Button>
                  </Link>
                  <button
                    onClick={() => signOut()}
                    className="hidden md:flex font-bold text-slate-700 dark:text-slate-200 hover:text-brand-red transition-colors px-4 h-12 items-center"
                  >
                    Logout
                  </button>
                </div>
              ) : isLoaded ? (
                <div className="flex items-center gap-2 md:gap-3">
                  <button
                    onClick={() => setAuthModal("sign-in")}
                    className="hidden md:block font-bold text-slate-700 dark:text-slate-200 hover:text-brand-burgundy"
                  >
                    Log In
                  </button>
                  <Button
                    onClick={() => setAuthModal("sign-up")}
                    className="bg-brand-red hover:bg-brand-red/90 text-white font-bold rounded-none px-4 md:px-8 h-10 md:h-12 shadow-lg shadow-brand-red/20 text-xs md:text-md transition-transform hover:scale-105 active:scale-95 border-0"
                  >
                    Signup
                  </Button>
                </div>
              ) : (
                <div className="h-10 w-20 md:w-24 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
              )}
            </div>
          </div>
        </motion.nav>
      </div>

      {isMobileNavOpen && (
        <div className="fixed top-20 right-3 z-[60] w-64 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-4 shadow-2xl md:hidden">
          <div className="space-y-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <a href="#features" className="block py-1" onClick={() => setIsMobileNavOpen(false)}>Features</a>
            <a href="#how-it-works" className="block py-1" onClick={() => setIsMobileNavOpen(false)}>How It Works</a>
            <Link href="/past-papers" className="block py-1" onClick={() => setIsMobileNavOpen(false)}>Past Papers</Link>
            {isLoaded && user ? (
              <>
                <Link href={
                  (user.publicMetadata?.role === "teacher" || profile?.role === "teacher") ? "/teacher/dashboard" :
                    (user.publicMetadata?.role === "admin" || profile?.role === "admin") ? "/admin/dashboard" :
                      "/student/dashboard"
                } className="block py-1 text-brand-burgundy" onClick={() => setIsMobileNavOpen(false)}>Dashboard</Link>
                <button onClick={() => signOut()} className="w-full text-left py-1 text-brand-red">Logout</button>
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
              className="absolute -right-2 -top-2 z-10 bg-white rounded-full p-2 text-slate-700 hover:bg-brand-red hover:text-white transition-all shadow-lg"
              aria-label="Close authentication modal"
            >
              <X size={20} />
            </button>

            <div className="mb-3 flex items-center gap-2 justify-center">
              <button
                onClick={() => setAuthModal("sign-in")}
                className={`rounded-lg px-6 py-2.5 text-sm font-bold transition-all ${authModal === "sign-in" ? "bg-brand-burgundy text-white shadow-lg scale-105" : "bg-white/90 text-slate-700 hover:bg-white"}`}
              >
                Log In
              </button>
              <button
                onClick={() => setAuthModal("sign-up")}
                className={`rounded-lg px-6 py-2.5 text-sm font-bold transition-all ${authModal === "sign-up" ? "bg-brand-red text-white shadow-lg scale-105" : "bg-white/90 text-slate-700 hover:bg-white"}`}
              >
                Sign Up
              </button>
            </div>

            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border-2 border-slate-200 overflow-hidden">
              {authModal === "sign-in" ? (
                <SignIn
                  routing="hash"
                  signUpUrl="/"
                  afterSignInUrl="/"
                  fallbackRedirectUrl="/"
                  forceRedirectUrl="/"
                  appearance={{
                    elements: {
                      card: "shadow-none border-0 bg-transparent",
                      rootBox: "w-full",
                      cardBox: "shadow-none w-full",
                      main: "w-full",
                      identityPreview: "hidden",
                      identityPreviewText: "hidden",
                      identityPreviewEditButton: "hidden",
                      footerAction: "hidden",
                      formButtonPrimary: "bg-brand-burgundy hover:bg-brand-burgundy/90 text-white font-bold",
                      formFieldInput: "rounded-lg border-2 border-slate-200 focus:border-brand-burgundy",
                      headerTitle: "text-brand-burgundy font-black text-2xl",
                      headerSubtitle: "text-slate-500",
                      socialButtonsBlockButton: "border-2 border-slate-300 hover:border-brand-burgundy transition-all",
                      dividerLine: "bg-slate-300",
                      dividerText: "text-slate-500",
                    },
                  }}
                />
              ) : (
                <SignUp
                  routing="hash"
                  signInUrl="/"
                  afterSignUpUrl="/"
                  fallbackRedirectUrl="/"
                  forceRedirectUrl="/"
                  appearance={{
                    elements: {
                      card: "shadow-none border-0 bg-transparent",
                      rootBox: "w-full",
                      cardBox: "shadow-none w-full",
                      main: "w-full",
                      identityPreview: "hidden",
                      identityPreviewText: "hidden",
                      identityPreviewEditButton: "hidden",
                      footerAction: "hidden",
                      formButtonPrimary: "bg-brand-red hover:bg-brand-red/90 text-white font-bold",
                      formFieldInput: "rounded-lg border-2 border-slate-200 focus:border-brand-red",
                      headerTitle: "text-brand-red font-black text-2xl",
                      headerSubtitle: "text-slate-500",
                      socialButtonsBlockButton: "border-2 border-slate-300 hover:border-brand-red transition-all",
                      dividerLine: "bg-slate-300",
                      dividerText: "text-slate-500",
                    },
                  }}
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
      <section id="features" className="py-16 md:py-24 px-4 md:px-12 bg-slate-50 dark:bg-slate-900">
        <div className="max-w-[1400px] mx-auto">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-10 md:mb-16"
          >
            <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white mb-4">Why Choose <span className="text-brand-pink">Propel</span>?</h2>
            <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">Everything you need to excel in your O Level journey</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
            {[
              { icon: BookOpen, title: "Comprehensive Resources", desc: "Access past papers, topical questions, and study materials", iconClass: "text-brand-burgundy", bgClass: "bg-brand-burgundy/10" },
              { icon: Users, title: "Expert Teachers", desc: "Learn from experienced educators who know the curriculum", iconClass: "text-brand-pink", bgClass: "bg-brand-pink/10" },
              { icon: Award, title: "Track Progress", desc: "Monitor your performance with detailed analytics", iconClass: "text-brand-blue", bgClass: "bg-brand-blue/10" },
              { icon: TrendingUp, title: "Personalized Learning", desc: "Adaptive content tailored to your learning pace", iconClass: "text-brand-yellow", bgClass: "bg-brand-yellow/10" }
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ y: 50, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
                whileHover={{ y: -10, transition: { duration: 0.2 } }}
                className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all border border-slate-100 dark:border-slate-700"
              >
                <div className={`w-14 h-14 md:w-16 md:h-16 ${feature.bgClass} rounded-xl flex items-center justify-center mb-4 md:mb-6`}>
                  <feature.icon className={`w-7 h-7 md:w-8 md:h-8 ${feature.iconClass}`} />
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-2 md:mb-3">{feature.title}</h3>
                <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-16 md:py-24 px-4 md:px-12 bg-white dark:bg-slate-950">
        <div className="max-w-[1400px] mx-auto">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-10 md:mb-16"
          >
            <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white mb-4">How It <span className="text-brand-burgundy">Works</span></h2>
            <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">Get started in three simple steps</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {[
              { step: "01", title: "Sign Up", desc: "Create your account and complete your profile with your subjects and level" },
              { step: "02", title: "Choose Your Path", desc: "Select from past papers, topical practice, or guided lessons" },
              { step: "03", title: "Track & Excel", desc: "Monitor your progress and achieve your target grades" }
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ y: 50, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.2 }}
                className="relative"
              >
                <div className="text-6xl md:text-8xl font-black text-brand-pink/10 dark:text-brand-pink/5 absolute -top-6 md:-top-8 -left-2 md:-left-4">{item.step}</div>
                <div className="relative z-10 pt-10 md:pt-12">
                  <h3 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-3 md:mb-4">{item.title}</h3>
                  <p className="text-base md:text-lg text-slate-600 dark:text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
                {idx < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-6 transform -translate-y-1/2">
                    <ArrowRight className="w-8 h-8 text-brand-pink/30" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 md:py-24 px-4 md:px-12 bg-gradient-to-br from-brand-burgundy to-brand-pink text-white">
        <div className="max-w-[1400px] mx-auto">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-10 md:mb-16"
          >
            <h2 className="text-3xl md:text-5xl lg:text-6xl font-black mb-4">Student Success Stories</h2>
            <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto">See what our students have achieved</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {[
              { name: "Sarah Ahmed", grade: "A* in Mathematics", quote: "Propel helped me understand complex topics with ease. The practice questions were invaluable!" },
              { name: "Ali Hassan", grade: "A* in Physics", quote: "The structured approach and expert guidance made all the difference in my preparation." },
              { name: "Fatima Khan", grade: "A* in Chemistry", quote: "I improved from a B to an A* thanks to the personalized learning path and progress tracking." }
            ].map((testimonial, idx) => (
              <motion.div
                key={idx}
                initial={{ y: 50, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
                whileHover={{ y: -5 }}
                className="bg-white/10 backdrop-blur-sm p-6 md:p-8 rounded-2xl border border-white/20"
              >
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-brand-yellow" />
                  <span className="font-bold text-brand-yellow text-sm md:text-base">{testimonial.grade}</span>
                </div>
                <p className="text-base md:text-lg mb-4 md:mb-6 leading-relaxed">&ldquo;{testimonial.quote}&rdquo;</p>
                <p className="font-bold text-white">{testimonial.name}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 px-4 md:px-12 bg-slate-900 dark:bg-slate-950 text-white">
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          className="max-w-[1400px] mx-auto text-center"
        >
          {user ? (
            <>
              <h2 className="text-3xl md:text-5xl lg:text-6xl font-black mb-6">Welcome Back, <span className="text-brand-pink">{profile?.full_name?.split(' ')[0] || user.firstName || 'Student'}</span>!</h2>
              <p className="text-lg md:text-xl text-slate-400 mb-8 md:mb-10 max-w-2xl mx-auto">Continue your learning journey and achieve your goals</p>
              <Link href={
                (user.publicMetadata?.role === "teacher" || profile?.role === "teacher") ? "/teacher/dashboard" :
                  (user.publicMetadata?.role === "admin" || profile?.role === "admin") ? "/admin/dashboard" :
                    "/student/dashboard"
              }>
                <Button className="bg-brand-pink hover:bg-brand-pink/90 text-white font-bold rounded-none px-8 md:px-12 h-12 md:h-16 shadow-xl shadow-brand-pink/30 text-lg md:text-xl transition-all hover:scale-105">
                  Continue Learning <ArrowRight className="ml-2" size={20} />
                </Button>
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-3xl md:text-5xl lg:text-6xl font-black mb-6">Ready to <span className="text-brand-pink">Propel</span> Your Success?</h2>
              <p className="text-lg md:text-xl text-slate-400 mb-8 md:mb-10 max-w-2xl mx-auto">Join thousands of students achieving their dream grades</p>
              <Button
                onClick={() => setAuthModal("sign-up")}
                className="bg-brand-pink hover:bg-brand-pink/90 text-white font-bold rounded-none px-8 md:px-12 h-12 md:h-16 shadow-xl shadow-brand-pink/30 text-lg md:text-xl transition-all hover:scale-105"
              >
                Start Learning Today <ArrowRight className="ml-2" size={20} />
              </Button>
            </>
          )}
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-white py-12 md:py-16 px-4 md:px-12">
        <div className="max-w-[1400px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 mb-12">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-burgundy rounded-tr-[20px] rounded-bl-[20px] flex items-center justify-center">
                  <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                </div>
                <span className="text-2xl font-black text-white font-display">Propel</span>
              </div>
              <p className="text-slate-400 leading-relaxed text-sm md:text-base">Empowering O Level students to achieve academic excellence through expert guidance and comprehensive resources.</p>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-lg font-bold mb-4">Quick Links</h3>
              <ul className="space-y-2 text-slate-400 text-sm md:text-base">
                <li><Link href="/login" className="hover:text-brand-pink transition-colors">Login</Link></li>
                <li><Link href="/signup" className="hover:text-brand-pink transition-colors">Sign Up</Link></li>
                <li><a href="#features" className="hover:text-brand-pink transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-brand-pink transition-colors">How It Works</a></li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h3 className="text-lg font-bold mb-4">Resources</h3>
              <ul className="space-y-2 text-slate-400 text-sm md:text-base">
                <li><Link href="/past-papers" className="hover:text-brand-pink transition-colors">Past Papers</Link></li>
                <li><a href="#" className="hover:text-brand-pink transition-colors">Topical Questions</a></li>
                <li><a href="#" className="hover:text-brand-pink transition-colors">Study Guides</a></li>
                <li><a href="#" className="hover:text-brand-pink transition-colors">Progress Tracking</a></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="text-lg font-bold mb-4">Get In Touch</h3>
              <ul className="space-y-3 text-slate-400">
                <li className="flex items-center gap-2 text-sm md:text-base">
                  <Mail size={18} className="text-brand-pink flex-shrink-0" />
                  <a href="mailto:support@propel.com" className="hover:text-brand-pink transition-colors truncate">support@propel.com</a>
                </li>
              </ul>
              <div className="flex items-center gap-3 md:gap-4 mt-6">
                <a href="#" className="w-9 h-9 md:w-10 md:h-10 bg-slate-800 hover:bg-brand-pink rounded-lg flex items-center justify-center transition-colors">
                  <Facebook size={16} />
                </a>
                <a href="#" className="w-9 h-9 md:w-10 md:h-10 bg-slate-800 hover:bg-brand-pink rounded-lg flex items-center justify-center transition-colors">
                  <Twitter size={16} />
                </a>
                <a href="#" className="w-9 h-9 md:w-10 md:h-10 bg-slate-800 hover:bg-brand-pink rounded-lg flex items-center justify-center transition-colors">
                  <Instagram size={16} />
                </a>
                <a href="#" className="w-9 h-9 md:w-10 md:h-10 bg-slate-800 hover:bg-brand-pink rounded-lg flex items-center justify-center transition-colors">
                  <Linkedin size={16} />
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-500 text-sm">&copy; 2026 Propel. All rights reserved.</p>
            <div className="flex flex-wrap justify-center items-center gap-4 md:gap-6 text-sm text-slate-500">
              <a href="#" className="hover:text-brand-pink transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-brand-pink transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-brand-pink transition-colors">Cookie Policy</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
