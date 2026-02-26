"use client";

import { DashboardHeader, ContinueLearning } from "@/components/dashboard/HeaderAndContinue";
import ProgressSnapshot from "@/components/dashboard/ProgressSnapshot";
import ActionGrid from "@/components/dashboard/ActionGrid";
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-red"></div>
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
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-10 pb-20">
      <div className="max-w-6xl mx-auto">
        <DashboardHeader />

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 space-y-8">
            <ContinueLearning />

            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Quick Actions</h2>
              </div>
              <ActionGrid />
            </section>
          </div>

          <div className="w-full lg:w-80 xl:w-96 flex-shrink-0">
            <ProgressSnapshot />
          </div>
        </div>
      </div>
    </div>
  );
}
