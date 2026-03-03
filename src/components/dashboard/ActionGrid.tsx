import Link from "next/link";
import { FileText, Layers, Bookmark, MessageCircle, ChevronRight } from "lucide-react";

const actions = [
    {
        title: "Past Papers",
        description: "Browse and practice from our full library of CAIE past papers.",
        icon: FileText,
        href: "/student/past-papers",
    },
    {
        title: "Topicals",
        description: "Practice questions grouped by topic for focused revision.",
        icon: Layers,
        href: "/student/topicals",
    },
    {
        title: "Ask AI",
        description: "Get instant exam-style answers from our AI tutor.",
        icon: MessageCircle,
        href: "/student/ask",
        highlight: true,
    },
    {
        title: "Bookmarks",
        description: "Revisit papers you've saved for later review.",
        icon: Bookmark,
        href: "/student/bookmarks",
    },
];

export default function ActionGrid() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {actions.map((action) => (
                <Link
                    key={action.title}
                    href={action.href}
                    className={`group flex items-start gap-4 p-5 rounded-2xl border transition-all hover:shadow-md hover:-translate-y-0.5 ${
                        action.highlight
                            ? "bg-primary border-primary/20 text-white"
                            : "bg-white border-gray-100 text-gray-900 hover:border-gray-200"
                    }`}
                >
                    <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                        action.highlight
                            ? "bg-white/15"
                            : "bg-gray-100 group-hover:bg-gray-200 transition-colors"
                    }`}>
                        <action.icon size={18} className={action.highlight ? "text-white" : "text-gray-700"} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                            <span className={`font-semibold text-sm ${action.highlight ? "text-white" : "text-gray-900"}`}>
                                {action.title}
                            </span>
                            <ChevronRight
                                size={15}
                                className={`flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${action.highlight ? "text-white/80" : "text-gray-400"}`}
                            />
                        </div>
                        <p className={`text-xs mt-0.5 leading-relaxed ${action.highlight ? "text-white/75" : "text-gray-500"}`}>
                            {action.description}
                        </p>
                    </div>
                </Link>
            ))}
        </div>
    );
}
