"use client";

import { DashboardHeader, ContinueLearning } from "@/components/dashboard/HeaderAndContinue";
import ProgressSnapshot from "@/components/dashboard/ProgressSnapshot";
import NotesWidget from "@/components/dashboard/NotesWidget";
import Link from "next/link";
import { MessageCircle, Calendar } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useClerkAuth } from "@/lib/useClerkAuth";
import { redirect } from "next/navigation";

export default function StudentDashboard() {
  const { user, isLoaded } = useUser();
  const { profile, loading } = useClerkAuth();

  // Redirect to sign-in if not authenticated
  if (isLoaded && !user) {
    redirect("/sign-in");
  }

  // Show loading state
  if (loading || !isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-black">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Redirect non-students to home
  if (profile && profile.role !== "student") {
    redirect("/");
  }

  return (
    <div className="p-4 md:p-8 pb-16 min-h-full dark:bg-black">
      <div className="max-w-6xl mx-auto">
        <DashboardHeader />

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 space-y-6">
            <ContinueLearning />
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-2">Need 1:1 Support?</h2>
              <p className="text-sm text-gray-600 mb-4">Open teacher support to request meetings and continue conversations.</p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/student/teachers"
                  className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  <Calendar size={14} />
                  Teachers & Meetings
                </Link>
                <Link
                  href="/student/teachers"
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700"
                >
                  <MessageCircle size={14} />
                  Open Chat
                </Link>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-72 xl:w-80 flex-shrink-0">
            <ProgressSnapshot />
          </div>
        </div>
      </div>
      <NotesWidget />
    </div>
  );
}
