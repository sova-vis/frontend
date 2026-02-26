'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Play, BookOpen, Users, Award, TrendingUp, CheckCircle, ArrowRight, Mail, Facebook, Twitter, Instagram, Linkedin, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { SignIn, SignUp, useUser } from '@clerk/nextjs';
import { useClerkAuth } from '@/lib/useClerkAuth';
import StudyPortfolio from '@/components/StudyPortfolio';

export default function HomePage() {
  const { user, isLoaded } = useUser();
  const { profile, signOut } = useClerkAuth();
  const [authModal, setAuthModal] = useState<"sign-in" | "sign-up" | null>(null);

  // Close modal immediately when user signs in
  useEffect(() => {
    if (isLoaded && user) {
      setAuthModal(null);
    }
  }, [user, isLoaded]);
  
  return (
    <main className="min-h-screen bg-white text-slate-900 font-sans selection:bg-brand-pink selection:text-white overflow-x-hidden">
      {/* Navbar */}
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="px-6 md:px-12 py-6 flex justify-between items-center max-w-[1400px] mx-auto w-full sticky top-0 bg-white/80 backdrop-blur-md z-50 border-b border-slate-100"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-burgundy rounded-tr-[20px] rounded-bl-[20px] flex items-center justify-center shadow-lg shadow-brand-burgundy/20">
            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
          </div>
          <span className="text-2xl font-black tracking-tight text-brand-burgundy font-display">Propel</span>
        </div>

        <div className="flex items-center gap-12">
          <div className="hidden md:flex items-center gap-8 font-semibold text-slate-600">
            <a href="#features" className="cursor-pointer hover:text-brand-burgundy transition-colors">Features</a>
            <a href="#how-it-works" className="cursor-pointer hover:text-brand-burgundy transition-colors">How It Works</a>
            <Link href="/past-papers" className="cursor-pointer hover:text-brand-burgundy transition-colors">Past Papers</Link>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <Link href={
                  (profile?.role === "teacher" || user.publicMetadata?.role === "teacher") ? "/teacher/dashboard" :
                  (profile?.role === "admin" || user.publicMetadata?.role === "admin") ? "/admin/dashboard" :
                  "/student/dashboard"
                }>
                  <Button className="bg-brand-red hover:bg-brand-red/90 text-white font-bold rounded-none px-8 h-12 shadow-lg shadow-brand-red/20 text-md transition-transform hover:scale-105 active:scale-95 border-0 flex items-center gap-2">
                    <span>
                      {(profile?.role === "teacher" || user.publicMetadata?.role === "teacher") ? "Teacher Dashboard" : 
                       (profile?.role === "admin" || user.publicMetadata?.role === "admin") ? "Admin Dashboard" : 
                       "Student Dashboard"}
                    </span>
                    <span className="text-xs opacity-75">
                      ({profile?.full_name || user.fullName || user.firstName || "User"})
                    </span>
                  </Button>
                </Link>
                <button
                  onClick={() => signOut()}
                  className="font-bold text-slate-700 hover:text-brand-red transition-colors px-4 h-12 flex items-center"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setAuthModal("sign-in")}
                  className="font-bold text-slate-700 hover:text-brand-burgundy"
                >
                  Log In
                </button>
                <Button
                  onClick={() => setAuthModal("sign-up")}
                  className="bg-brand-red hover:bg-brand-red/90 text-white font-bold rounded-none px-8 h-12 shadow-lg shadow-brand-red/20 text-md transition-transform hover:scale-105 active:scale-95 border-0"
                >
                  Signup
                </Button>
              </div>
            )}
          </div>
        </div>
      </motion.nav>

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
      <section className="flex-grow flex flex-col lg:flex-row items-center justify-between px-6 md:px-12 py-16 max-w-[1320px] mx-auto w-full gap-12 lg:gap-8">
        {/* Left Content */}
        <motion.div
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="flex-1 space-y-10 max-w-xl"
        >
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tight text-slate-900">
            Propel Your Success<br />
            in <span className="text-brand-pink">O Levels</span><br />
            with <span className="text-brand-pink">Expert Teachers</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-500 max-w-lg font-medium leading-relaxed">
            Unlock your academic potential with interactive lessons, top resources, and real exam strategies for O Level students. Join a vibrant learning community and achieve your best results!
          </p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex items-center gap-4"
          >
            {user ? (
              <Link href={
                (profile?.role === "teacher" || user.publicMetadata?.role === "teacher") ? "/teacher/dashboard" :
                (profile?.role === "admin" || user.publicMetadata?.role === "admin") ? "/admin/dashboard" :
                "/student/dashboard"
              }>
                <Button className="bg-brand-burgundy hover:bg-brand-burgundy/90 text-white font-bold rounded-none px-10 h-14 shadow-xl shadow-brand-burgundy/30 text-lg transition-all hover:scale-105 active:scale-95">
                  Go to Dashboard <ArrowRight className="ml-2" size={20} />
                </Button>
              </Link>
            ) : (
              <>
                <Button 
                  onClick={() => setAuthModal("sign-up")}
                  className="bg-brand-burgundy hover:bg-brand-burgundy/90 text-white font-bold rounded-none px-10 h-14 shadow-xl shadow-brand-burgundy/30 text-lg transition-all hover:scale-105 active:scale-95"
                >
                  Get Started <ArrowRight className="ml-2" size={20} />
                </Button>
                <Button 
                  onClick={() => setAuthModal("sign-in")}
                  className="bg-transparent border-2 border-brand-burgundy text-brand-burgundy hover:bg-brand-burgundy hover:text-white font-bold rounded-none px-10 h-14 text-lg transition-all"
                >
                  Explore
                </Button>
              </>
            )}
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex items-center gap-16 pt-8 border-t border-slate-100/50"
          >
            <div>
              <p className="text-4xl font-black text-brand-blue/80">300+</p>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2">Courses</p>
            </div>
            <div>
              <p className="text-4xl font-black text-slate-300">50+</p>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2">Expert Mentors</p>
            </div>
            <div>
              <p className="text-4xl font-black text-brand-yellow">1000+</p>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2">Hours of Content</p>
            </div>
          </motion.div>
        </motion.div>

        {/* Right Content - Study Portfolio */}
        <motion.div
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="flex-1 w-full max-w-[520px] aspect-square relative"
        >
          <StudyPortfolio />
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 md:px-12 bg-slate-50">
        <div className="max-w-[1400px] mx-auto">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl md:text-6xl font-black text-slate-900 mb-4">Why Choose <span className="text-brand-pink">Propel</span>?</h2>
            <p className="text-xl text-slate-500 max-w-2xl mx-auto">Everything you need to excel in your O Level journey</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: BookOpen, title: "Comprehensive Resources", desc: "Access past papers, topical questions, and study materials", color: "brand-burgundy" },
              { icon: Users, title: "Expert Teachers", desc: "Learn from experienced educators who know the curriculum", color: "brand-pink" },
              { icon: Award, title: "Track Progress", desc: "Monitor your performance with detailed analytics", color: "brand-blue" },
              { icon: TrendingUp, title: "Personalized Learning", desc: "Adaptive content tailored to your learning pace", color: "brand-yellow" }
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ y: 50, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
                whileHover={{ y: -10, transition: { duration: 0.2 } }}
                className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all border border-slate-100"
              >
                <div className={`w-16 h-16 bg-${feature.color}/10 rounded-xl flex items-center justify-center mb-6`}>
                  <feature.icon className={`w-8 h-8 text-${feature.color}`} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 px-6 md:px-12 bg-white">
        <div className="max-w-[1400px] mx-auto">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl md:text-6xl font-black text-slate-900 mb-4">How It <span className="text-brand-burgundy">Works</span></h2>
            <p className="text-xl text-slate-500 max-w-2xl mx-auto">Get started in three simple steps</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-12">
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
                <div className="text-8xl font-black text-brand-pink/10 absolute -top-8 -left-4">{item.step}</div>
                <div className="relative z-10 pt-12">
                  <h3 className="text-3xl font-bold text-slate-900 mb-4">{item.title}</h3>
                  <p className="text-lg text-slate-600 leading-relaxed">{item.desc}</p>
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
      <section className="py-24 px-6 md:px-12 bg-gradient-to-br from-brand-burgundy to-brand-pink text-white">
        <div className="max-w-[1400px] mx-auto">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl md:text-6xl font-black mb-4">Student Success Stories</h2>
            <p className="text-xl text-white/80 max-w-2xl mx-auto">See what our students have achieved</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
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
                className="bg-white/10 backdrop-blur-sm p-8 rounded-2xl border border-white/20"
              >
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-6 h-6 text-brand-yellow" />
                  <span className="font-bold text-brand-yellow">{testimonial.grade}</span>
                </div>
                <p className="text-lg mb-6 leading-relaxed">&ldquo;{testimonial.quote}&rdquo;</p>
                <p className="font-bold text-white">{testimonial.name}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 md:px-12 bg-slate-900 text-white">
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          className="max-w-[1400px] mx-auto text-center"
        >
          {user ? (
            <>
              <h2 className="text-5xl md:text-6xl font-black mb-6">Welcome Back, <span className="text-brand-pink">{profile?.full_name?.split(' ')[0] || user.firstName || 'Student'}</span>!</h2>
              <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">Continue your learning journey and achieve your goals</p>
              <Link href={
                (profile?.role === "teacher" || user.publicMetadata?.role === "teacher") ? "/teacher/dashboard" :
                (profile?.role === "admin" || user.publicMetadata?.role === "admin") ? "/admin/dashboard" :
                "/student/dashboard"
              }>
                <Button className="bg-brand-pink hover:bg-brand-pink/90 text-white font-bold rounded-none px-12 h-16 shadow-xl shadow-brand-pink/30 text-xl transition-all hover:scale-105">
                  Continue Learning <ArrowRight className="ml-2" size={24} />
                </Button>
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-5xl md:text-6xl font-black mb-6">Ready to <span className="text-brand-pink">Propel</span> Your Success?</h2>
              <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">Join thousands of students achieving their dream grades</p>
              <Button 
                onClick={() => setAuthModal("sign-up")}
                className="bg-brand-pink hover:bg-brand-pink/90 text-white font-bold rounded-none px-12 h-16 shadow-xl shadow-brand-pink/30 text-xl transition-all hover:scale-105"
              >
                Start Learning Today <ArrowRight className="ml-2" size={24} />
              </Button>
            </>
          )}
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-white py-16 px-6 md:px-12">
        <div className="max-w-[1400px] mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            {/* Brand */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-burgundy rounded-tr-[20px] rounded-bl-[20px] flex items-center justify-center">
                  <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                </div>
                <span className="text-2xl font-black text-white font-display">Propel</span>
              </div>
              <p className="text-slate-400 leading-relaxed">Empowering O Level students to achieve academic excellence through expert guidance and comprehensive resources.</p>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-lg font-bold mb-4">Quick Links</h3>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#features" className="hover:text-brand-pink transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-brand-pink transition-colors">How It Works</a></li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h3 className="text-lg font-bold mb-4">Resources</h3>
              <ul className="space-y-2 text-slate-400">
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
                <li className="flex items-center gap-2">
                  <Mail size={18} className="text-brand-pink" />
                  <a href="mailto:support@propel.com" className="hover:text-brand-pink transition-colors">support@propel.com</a>
                </li>
              </ul>
              <div className="flex items-center gap-4 mt-6">
                <a href="#" className="w-10 h-10 bg-slate-800 hover:bg-brand-pink rounded-lg flex items-center justify-center transition-colors">
                  <Facebook size={18} />
                </a>
                <a href="#" className="w-10 h-10 bg-slate-800 hover:bg-brand-pink rounded-lg flex items-center justify-center transition-colors">
                  <Twitter size={18} />
                </a>
                <a href="#" className="w-10 h-10 bg-slate-800 hover:bg-brand-pink rounded-lg flex items-center justify-center transition-colors">
                  <Instagram size={18} />
                </a>
                <a href="#" className="w-10 h-10 bg-slate-800 hover:bg-brand-pink rounded-lg flex items-center justify-center transition-colors">
                  <Linkedin size={18} />
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-500 text-sm">© 2026 Propel. All rights reserved.</p>
            <div className="flex items-center gap-6 text-sm text-slate-500">
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
