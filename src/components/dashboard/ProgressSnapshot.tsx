import { TrendingUp } from "lucide-react";

const subjects = [
    { name: "Mathematics", progress: 75, color: "bg-blue-500" },
    { name: "Physics", progress: 45, color: "bg-amber-500" },
    { name: "Chemistry", progress: 60, color: "bg-emerald-500" },
];

export default function ProgressSnapshot() {
    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-full">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <TrendingUp size={20} className="text-primary" />
                    Progress Snapshot
                </h3>
                <button className="text-sm text-primary font-medium hover:underline">View All</button>
            </div>

            <div className="space-y-5">
                {subjects.map((sub) => (
                    <div key={sub.name}>
                        <div className="flex justify-between text-sm mb-1.5">
                            <span className="font-medium text-gray-700">{sub.name}</span>
                            <span className="text-gray-500">{sub.progress}%</span>
                        </div>
                        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full ${sub.color}`}
                                style={{ width: `${sub.progress}%` }}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-50">
                <p className="text-xs text-gray-400 text-center">
                    You&apos;re doing great! Try to focus on <span className="text-amber-600 font-medium">Physics</span> this week.
                </p>
            </div>
        </div>
    );
}
