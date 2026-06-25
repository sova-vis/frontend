import { SignIn } from "@clerk/nextjs";
import { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/ui/Logo";
import { GraduationCap, LineChart, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Sign In | Propel",
};

const authAppearance = {
  elements: {
    rootBox: "w-full",
    cardBox: "shadow-none w-full",
    card: "shadow-none border-0 bg-transparent p-0",
    headerTitle: "text-2xl font-black font-display text-crimson",
    headerSubtitle: "text-ink-muted",
    formButtonPrimary:
      "bg-crimson hover:bg-crimson-deep text-white font-bold rounded-xl shadow-sm transition-all",
    formFieldInput:
      "rounded-xl border border-line bg-surface text-ink focus:border-crimson",
    formFieldLabel: "text-ink-muted font-semibold",
    socialButtonsBlockButton:
      "border border-line bg-surface text-ink hover:border-crimson transition-all",
    socialButtonsBlockButtonText: "text-ink font-semibold",
    dividerLine: "bg-line",
    dividerText: "text-ink-faint",
    footerAction: "text-center mt-4",
    footerActionLink: "text-crimson hover:text-crimson-deep font-semibold",
    otpCodeFieldInput: "border-line bg-surface text-ink",
  },
};

export default function SignInPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#A8123C] to-[#760B28] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/[.06]" />
        <div className="absolute -bottom-24 -left-10 h-80 w-80 rounded-full bg-white/[.05]" />
        <Link href="/" className="relative z-10">
          <BrandLogo size={40} labelClassName="text-2xl text-white" />
        </Link>
        <div className="relative z-10 max-w-md">
          <h2 className="font-display text-4xl font-semibold leading-tight">
            Welcome back to your <span className="italic">study workspace</span>.
          </h2>
          <p className="mt-4 text-white/75">
            Pick up exactly where you left off — your papers, practice, and readiness score are waiting.
          </p>
          <div className="mt-10 space-y-4">
            {[
              { Icon: GraduationCap, label: "Track your exam readiness in real time" },
              { Icon: LineChart, label: "See accuracy trends across every subject" },
              { Icon: Sparkles, label: "AI grading on written answers, instantly" },
            ].map(({ Icon, label }) => (
              <div key={label} className="flex items-center gap-3 text-white/90">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                  <Icon size={18} />
                </span>
                <span className="text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="relative z-10 text-sm text-white/50">&copy; 2026 Propel. All rights reserved.</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-paper p-6 md:p-10">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 flex justify-center lg:hidden">
            <BrandLogo size={36} labelClassName="text-xl text-crimson" />
          </Link>
          <div className="ed-card p-6 md:p-8">
            <SignIn
              routing="path"
              path="/sign-in"
              forceRedirectUrl="/"
              fallbackRedirectUrl="/"
              appearance={authAppearance}
              signUpUrl="/sign-up"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
