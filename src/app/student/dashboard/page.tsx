"use client";

import { DashboardHeader, ContinueLearning } from "@/components/dashboard/HeaderAndContinue";
import ProgressSnapshot from "@/components/dashboard/ProgressSnapshot";
import NotesWidget from "@/components/dashboard/NotesWidget";
import Link from "next/link";
import { BookOpen, Braces, FileText, LibraryBig, Target } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useClerkAuth } from "@/lib/useClerkAuth";
import { redirect } from "next/navigation";
import StudentPageLoading from "@/components/student/StudentPageLoading";

export default function StudentDashboard() {
  const { user, isLoaded } = useUser();
  const { profile, loading } = useClerkAuth();

  // Redirect to sign-in if not authenticated
  if (isLoaded && !user) {
    redirect("/sign-in");
  }

  // Show loading state
  if (loading || !isLoaded) {
    return <StudentPageLoading label="Loading dashboard..." />;
  }

  // Redirect non-students to home
  if (profile && profile.role !== "student") {
    redirect("/");
  }

  return (
    <div className="p-4 md:p-8 pb-16 min-h-full bg-[linear-gradient(120deg,#fbfcff_0%,#ffffff_42%,#fff8f4_100%)]">
      <div className="max-w-7xl mx-auto">
        <DashboardHeader />

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-6">
            <ContinueLearning />

            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link
                href="/student/past-papers"
                className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-gray-300"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-gray-950 text-white flex items-center justify-center">
                    <FileText size={20} />
                  </div>
                  <span className="text-xs font-bold text-primary bg-primary/5 px-2.5 py-1 rounded-full">Personalized</span>
                </div>
                <h2 className="mt-5 text-lg font-bold text-gray-950">Past Papers</h2>
                <p className="mt-1 text-sm text-gray-500 leading-relaxed">Browse papers filtered by the subjects you selected.</p>
              </Link>

              <Link
                href="/student/goals"
                className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-gray-300"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
                    <Target size={20} />
                  </div>
                  <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">Tracker</span>
                </div>
                <h2 className="mt-5 text-lg font-bold text-gray-950">Goals</h2>
                <p className="mt-1 text-sm text-gray-500 leading-relaxed">Set target papers and track what you have completed.</p>
              </Link>

              <Link
                href="/student/subjects"
                className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-gray-300 md:col-span-2"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <LibraryBig size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-gray-950">Subjects</h2>
                      <BookOpen size={16} className="text-gray-300 group-hover:text-primary transition-colors" />
                    </div>
                    <p className="mt-1 text-sm text-gray-500 leading-relaxed">Update your subject list to keep past papers and goals focused.</p>
                  </div>
                </div>
              </Link>

              <Link
                href="/student/paper-parser"
                className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-gray-300 md:col-span-2"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-gray-100 text-gray-800 flex items-center justify-center">
                    <Braces size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-gray-950">Paper Parser</h2>
                      <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">JSON</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500 leading-relaxed">Upload a past paper and structure every question into clean frontend-ready JSON.</p>
                  </div>
                </div>
              </Link>
            </section>
          </div>

          <div className="w-full">
            <ProgressSnapshot />
          </div>
        </div>
      </div>
      <NotesWidget />
    </div>
  );
}
