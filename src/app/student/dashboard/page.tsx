"use client";

import { DashboardHeader, ContinueLearning } from "@/components/dashboard/HeaderAndContinue";
import ProgressSnapshot from "@/components/dashboard/ProgressSnapshot";
import ActionGrid from "@/components/dashboard/ActionGrid";
<<<<<<< HEAD
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

=======

export default function StudentDashboard() {
>>>>>>> c74dca7 (Initial foundation for an O/A Level exam-prep platform combining structured past papers, practice workflows, progress tracking, and future-ready AI evaluation and teacher support features)
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
<<<<<<< HEAD
=======

            {/* Recent Activity Mini-List could go here */}
            <div className="mt-8 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-4">Recent Activity</h3>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 items-start p-2 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer">
                    <div className="w-2 h-2 mt-2 rounded-full bg-primary shrink-0"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">Completed Past Paper 2021</p>
                      <p className="text-xs text-gray-500">2 hours ago • Mathematics</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
>>>>>>> c74dca7 (Initial foundation for an O/A Level exam-prep platform combining structured past papers, practice workflows, progress tracking, and future-ready AI evaluation and teacher support features)
          </div>
        </div>
      </div>
    </div>
  );
}
