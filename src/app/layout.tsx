import type { Metadata, Viewport } from "next";
import { Inter, Outfit, Fraunces, Hanken_Grotesk, Roboto_Mono } from "next/font/google";
import "./globals.css";
import "../styles/propel-scoped.css";
import { ClerkProvider } from "@clerk/nextjs";
import ThemeScript from "@/components/ui/ThemeScript";

// All fonts are self-hosted via next/font: preloaded, no render-blocking
// stylesheet request, and no layout shift. `display: swap` keeps text visible
// while the face loads. The propel-scoped CSS and inline styles reference these
// through their CSS variables.
const inter = Inter({ subsets: ["latin"], variable: '--font-inter', display: 'swap' });
const outfit = Outfit({ subsets: ["latin"], variable: '--font-outfit', display: 'swap' });
const fraunces = Fraunces({ subsets: ["latin"], variable: '--font-fraunces', display: 'swap' });
const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: '--font-hanken', display: 'swap' });
const robotoMono = Roboto_Mono({ subsets: ["latin"], variable: '--font-roboto-mono', display: 'swap' });

export const metadata: Metadata = {
  title: "Propel | Master Your O & A Levels",
  description: "The premium learning platform for ambitious O and A Level students. Expert tutors, topicals, AI answer grading, and interactive past papers.",
};

// Explicit, mobile-first viewport for every route. `viewport-fit=cover` lets
// the app use the full screen on notched phones; scaling stays enabled for
// accessibility (no maximum-scale lock).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBF7F0" },
    { media: "(prefers-color-scheme: dark)", color: "#1C1714" },
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
      signUpForceRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
    >
      <html
        lang="en"
        className={`${inter.variable} ${outfit.variable} ${fraunces.variable} ${hanken.variable} ${robotoMono.variable}`}
        suppressHydrationWarning
      >
        <head>
          <ThemeScript />
        </head>
        <body className={outfit.className}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
