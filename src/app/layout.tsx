import type { Metadata, Viewport } from "next";
import { Fraunces, Hanken_Grotesk, Roboto_Mono, Fredoka } from "next/font/google";
import "./globals.css";
import "../styles/propel-scoped.css";
import { ClerkProvider } from "@clerk/nextjs";
import ThemeScript from "@/components/ui/ThemeScript";
import AuthTransitionSplash from "@/components/AuthTransitionSplash";

// The three brand fonts, self-hosted via next/font: preloaded, no render-blocking
// stylesheet request, and no layout shift. `display: swap` keeps text visible
// while the face loads. Referenced through their CSS variables everywhere.
const fraunces = Fraunces({ subsets: ["latin"], variable: '--font-fraunces', display: 'swap' });
const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: '--font-hanken', display: 'swap' });
const robotoMono = Roboto_Mono({ subsets: ["latin"], variable: '--font-roboto-mono', display: 'swap' });
// Rounded, playful display face — used by the marketing hero headline.
const fredoka = Fredoka({ subsets: ["latin"], weight: ['400', '500', '600', '700'], variable: '--font-fredoka', display: 'swap' });

export const metadata: Metadata = {
  title: "Propel — AI marking for Cambridge O & A Level",
  description: "Propel is an AI-powered assessment platform for Cambridge O Level and A Level. Submit answers, get them marked against the official CAIE scheme, and see exactly where every mark went.",
};

// Explicit, mobile-first viewport for every route. `viewport-fit=cover` lets
// the app use the full screen on notched phones; scaling stays enabled for
// accessibility (no maximum-scale lock).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF6F0" },
    { media: "(prefers-color-scheme: dark)", color: "#161310" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInForceRedirectUrl="/"
      signInFallbackRedirectUrl="/"
      signUpForceRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
    >
      <html
        lang="en"
        className={`${fraunces.variable} ${hanken.variable} ${robotoMono.variable} ${fredoka.variable}`}
        suppressHydrationWarning
      >
        <head>
          <ThemeScript />
        </head>
        <body className={hanken.className}>
          {children}
          <AuthTransitionSplash />
        </body>
      </html>
    </ClerkProvider>
  );
}
