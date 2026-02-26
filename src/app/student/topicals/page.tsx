"use client";

import { Layers, ChevronRight, Zap } from "lucide-react";

const topics = [
    { id: 1, name: "Algebra", count: 120, difficulty: "Medium", color: "bg-blue-500" },
    { id: 2, name: "Geometry", count: 85, difficulty: "Hard", color: "bg-purple-500" },
    { id: 3, name: "Calculus", count: 200, difficulty: "Hard", color: "bg-red-500" },
    { id: 4, name: "Statistics", count: 150, difficulty: "Easy", color: "bg-green-500" },
    { id: 5, name: "Kinematics", count: 90, difficulty: "Medium", color: "bg-orange-500" },
    { id: 6, name: "Electricity", count: 110, difficulty: "Hard", color: "bg-yellow-500" },
];

export default function TopicalsPage() {
    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold font-display text-gray-900">Topical Practice</h1>
                <p className="text-gray-500 mt-1">Master specific topics with targeted questions.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {topics.map((topic) => (
                    <div key={topic.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-xl ${topic.color} bg-opacity-10 text-${topic.color.split("-")[1]}-600`}>
                                <Layers size={24} className={topic.color.replace('bg-', 'text-')} />
                            </div>
                            <div className="bg-gray-100 px-2 py-1 rounded text-xs font-semibold text-gray-600">
                                {topic.difficulty}
                            </div>
                        </div>

                        <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-primary transition-colors">{topic.name}</h3>
                        <p className="text-sm text-gray-500 mb-4">{topic.count} Questions available</p>

                        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                            <div className={`h-full ${topic.color} w-1/3`}></div>
                        </div>
                        <div className="mt-4 flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
                            Start Practice <ChevronRight size={16} className="ml-1" />
                        </div>
                    </div>
                ))}

                {/* Recommendation Card */}
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-6 rounded-2xl text-white shadow-lg flex flex-col justify-between">
                    <div>
                        <div className="p-2 bg-white/10 w-fit rounded-lg mb-4">
                            <Zap className="text-yellow-400" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Smart Recommendation</h3>
                        <p className="text-gray-300 text-sm">Based on your recent mistakes, we recommend focusing on <span className="text-white font-semibold">Integrals</span>.</p>
                    </div>
                    <button className="mt-6 w-full py-3 bg-white text-gray-900 rounded-xl font-bold hover:bg-gray-100 transition-colors">
                        Start Integrals
                    </button>
                </div>
            </div>
        </div>
    );
}
