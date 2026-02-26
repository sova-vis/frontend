import Link from "next/link";
import { FileText, Layers, Bookmark, PieChart, ChevronRight } from "lucide-react";

const actions = [
    {
        title: "Past Papers",
        description: "Browse extensive library",
        icon: FileText,
        href: "/student/past-papers",
        color: "text-blue-600",
        bg: "bg-blue-50",
    },
    {
        title: "Topical Practice",
        description: "Target specific topics",
        icon: Layers,
        href: "/student/topicals",
        color: "text-purple-600",
        bg: "bg-purple-50",
    },
    {
        title: "Bookmarks",
        description: "Saved questions & notes",
        icon: Bookmark,
        href: "/student/bookmarks",
        color: "text-amber-600",
        bg: "bg-amber-50",
    },
    {
        title: "My Progress",
        description: "Track your performance",
        icon: PieChart,
        href: "/student/progress",
        color: "text-emerald-600",
        bg: "bg-emerald-50",
    },
];

export default function ActionGrid() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {actions.map((action) => (
                <Link
                    key={action.title}
                    href={action.href}
                    className="group flex flex-col justify-between p-5 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-all hover:-translate-y-1"
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className={`p-3 rounded-xl ${action.bg} ${action.color}`}>
                            <action.icon size={24} />
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400">
                            <ChevronRight size={20} />
                        </div>
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 text-lg mb-1">{action.title}</h3>
                        <p className="text-sm text-gray-500">{action.description}</p>
                    </div>
                </Link>
            ))}
        </div>
    );
}
