import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
<<<<<<< HEAD
import { ClerkProvider } from "@clerk/nextjs";
=======
>>>>>>> c74dca7 (Initial foundation for an O/A Level exam-prep platform combining structured past papers, practice workflows, progress tracking, and future-ready AI evaluation and teacher support features)

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
<<<<<<< HEAD
    <ClerkProvider>
      <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
        <body className={outfit.className}>
          {children}
        </body>
      </html>
    </ClerkProvider>
=======
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className={outfit.className}>
        {children}
      </body>
    </html>
>>>>>>> c74dca7 (Initial foundation for an O/A Level exam-prep platform combining structured past papers, practice workflows, progress tracking, and future-ready AI evaluation and teacher support features)
  );
}
