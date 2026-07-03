import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import "../styles/propel-scoped.css";
import { ClerkProvider } from "@clerk/nextjs";
import ThemeScript from "@/components/ui/ThemeScript";

const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });
const outfit = Outfit({ subsets: ["latin"], variable: '--font-outfit' });

export const metadata: Metadata = {
  title: "Propel | Master Your O-Levels",
  description: "The premium learning platform for ambitious O-Level students. Expert tutors, topicals, and interactive past papers.",
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
      <html lang="en" className={`${inter.variable} ${outfit.variable}`} suppressHydrationWarning>
        <head>
          <ThemeScript />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link
            href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Hanken+Grotesk:wght@400;500;600;700&family=Roboto+Mono:wght@400;500&display=swap"
            rel="stylesheet"
          />
        </head>
        <body className={outfit.className}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
