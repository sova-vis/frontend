"use client";

import { TrendingUp, Target, Award } from "lucide-react";

export default function ProgressPage() {
    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold font-display text-gray-900">Your Progress</h1>
                <p className="text-gray-500 mt-1">Track your performance and identify areas for improvement.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Total Practice Time</p>
                            <h3 className="text-2xl font-bold text-gray-900">12h 45m</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                            <Target size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Questions Attempted</p>
                            <h3 className="text-2xl font-bold text-gray-900">342</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                            <Award size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Average Score</p>
                            <h3 className="text-2xl font-bold text-gray-900">76%</h3>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Subject Performance</h3>
                <div className="space-y-6">
                    {[
                        { subject: "Mathematics", score: 85, color: "bg-blue-500" },
                        { subject: "Physics", score: 62, color: "bg-amber-500" },
                        { subject: "Chemistry", score: 78, color: "bg-emerald-500" },
                        { subject: "Biology", score: 90, color: "bg-red-500" },
                    ].map((item) => (
                        <div key={item.subject}>
                            <div className="flex justify-between mb-2">
                                <span className="font-medium text-gray-700">{item.subject}</span>
                                <span className="font-bold text-gray-900">{item.score}%</span>
                            </div>
                            <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.score}%` }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
