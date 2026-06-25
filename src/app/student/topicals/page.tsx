"use client";

import { Layers, ChevronRight, Zap } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/Motion";

const topics = [
    { id: 1, name: "Algebra", count: 120, difficulty: "Medium", bar: "bg-crimson", iconBg: "bg-crimson-soft", iconText: "text-crimson" },
    { id: 2, name: "Geometry", count: 85, difficulty: "Hard", bar: "bg-clay", iconBg: "bg-clay-soft", iconText: "text-clay-ink" },
    { id: 3, name: "Calculus", count: 200, difficulty: "Hard", bar: "bg-crimson-deep", iconBg: "bg-crimson-soft", iconText: "text-crimson-ink" },
    { id: 4, name: "Statistics", count: 150, difficulty: "Easy", bar: "bg-mint", iconBg: "bg-mint-soft", iconText: "text-mint-ink" },
    { id: 5, name: "Kinematics", count: 90, difficulty: "Medium", bar: "bg-clay", iconBg: "bg-clay-soft", iconText: "text-clay-ink" },
    { id: 6, name: "Electricity", count: 110, difficulty: "Hard", bar: "bg-gold", iconBg: "bg-gold-soft", iconText: "text-gold-ink" },
];

export default function TopicalsPage() {
    return (
        <div className="min-h-full bg-transparent p-4 py-6 md:p-8 max-w-7xl mx-auto">
            <Reveal>
                <header className="mb-8">
                    <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-ink">
                        Topical <span className="italic text-crimson">Practice</span>
                    </h1>
                    <p className="mt-1 text-sm text-ink-muted">Master specific topics with targeted questions.</p>
                </header>
            </Reveal>

            <Stagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {topics.map((topic) => (
                    <StaggerItem key={topic.id} className="ed-card p-5 md:p-6 hover:shadow-card-hover hover:-translate-y-0.5 transition-all cursor-pointer group">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-xl ${topic.iconBg}`}>
                                <Layers size={24} className={topic.iconText} />
                            </div>
                            <div className="bg-surface-soft px-2 py-1 rounded text-xs font-semibold text-ink-muted">
                                {topic.difficulty}
                            </div>
                        </div>

                        <h3 className="font-display text-lg font-semibold tracking-tight text-ink mb-1 group-hover:text-crimson transition-colors">{topic.name}</h3>
                        <p className="text-sm text-ink-muted mb-4">{topic.count} Questions available</p>

                        <div className="w-full bg-surface-soft h-1.5 rounded-full overflow-hidden">
                            <div className={`h-full ${topic.bar} w-1/3`}></div>
                        </div>
                        <div className="mt-4 flex items-center text-sm font-semibold text-crimson opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
                            Start Practice <ChevronRight size={16} className="ml-1" />
                        </div>
                    </StaggerItem>
                ))}

                {/* Recommendation Card */}
                <StaggerItem className="relative overflow-hidden bg-ink p-6 rounded-[1.25rem] text-paper shadow-card flex flex-col justify-between">
                    <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/[.06]" />
                    <div className="relative">
                        <div className="p-2 bg-white/10 w-fit rounded-lg mb-4">
                            <Zap className="text-gold" />
                        </div>
                        <h3 className="font-display text-xl font-semibold tracking-tight mb-2">Smart Recommendation</h3>
                        <p className="text-paper/70 text-sm">Based on your recent mistakes, we recommend focusing on <span className="text-paper font-semibold">Integrals</span>.</p>
                    </div>
                    <button className="relative mt-6 w-full py-3 bg-paper text-ink rounded-xl font-bold hover:opacity-90 transition-opacity">
                        Start Integrals
                    </button>
                </StaggerItem>
            </Stagger>
        </div>
    );
}
