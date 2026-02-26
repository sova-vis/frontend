"use client";

import { Users, BookOpen, Calendar, Settings } from "lucide-react";

export default function TeacherDashboard() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <nav className="bg-white border-b border-gray-100 px-8 py-4 flex justify-between items-center sticky top-0 z-30">
        <h1 className="text-xl font-bold font-display text-primary">Propel Teacher</h1>
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-sm font-bold text-gray-900">Teacher Account</p>
            <p className="text-xs text-gray-500">teacher@school.com</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
            T
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-8">
        <div className="mb-10">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">My Classes</h2>
          <p className="text-gray-500">Manage your students and assignments.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                <Users size={24} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-900">Mathematics 9709</h3>
                <p className="text-sm text-gray-500">Class 11-A</p>
              </div>
            </div>
            <div className="flex justify-between items-center text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
              <span>24 Students</span>
              <span className="text-green-600 font-medium">Active</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-purple-100 text-purple-600 rounded-xl">
                <Users size={24} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-900">Physics 9702</h3>
                <p className="text-sm text-gray-500">Class 12-B</p>
              </div>
            </div>
            <div className="flex justify-between items-center text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
              <span>18 Students</span>
              <span className="text-green-600 font-medium">Active</span>
            </div>
          </div>

          <div className="border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center p-6 text-gray-400 hover:border-gray-300 hover:bg-gray-50 transition-all cursor-pointer">
            <BookOpen size={32} className="mb-2" />
            <span className="font-semibold">Create New Class</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-12">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button className="p-4 bg-white border border-gray-200 rounded-xl text-left hover:border-primary/50 transition-colors group">
              <Calendar size={20} className="text-gray-400 group-hover:text-primary mb-2" />
              <span className="font-semibold text-gray-700 group-hover:text-gray-900">Schedule Exam</span>
            </button>
            <button className="p-4 bg-white border border-gray-200 rounded-xl text-left hover:border-primary/50 transition-colors group">
              <BookOpen size={20} className="text-gray-400 group-hover:text-primary mb-2" />
              <span className="font-semibold text-gray-700 group-hover:text-gray-900">Upload Resources</span>
            </button>
            <button className="p-4 bg-white border border-gray-200 rounded-xl text-left hover:border-primary/50 transition-colors group">
              <Settings size={20} className="text-gray-400 group-hover:text-primary mb-2" />
              <span className="font-semibold text-gray-700 group-hover:text-gray-900">Settings</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
