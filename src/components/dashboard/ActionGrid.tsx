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
                    className={`group flex items-start gap-4 p-5 rounded-[1.25rem] border transition-all hover:shadow-card-hover hover:-translate-y-0.5 ${
                        action.highlight
                            ? "bg-crimson border-crimson/20 text-white shadow-crimson"
                            : "ed-card text-ink hover:border-line"
                    }`}
                >
                    <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                        action.highlight
                            ? "bg-white/15"
                            : "bg-crimson-soft group-hover:bg-crimson/15 transition-colors"
                    }`}>
                        <action.icon size={18} className={action.highlight ? "text-white" : "text-crimson"} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                            <span className={`font-semibold text-sm ${action.highlight ? "text-white" : "text-ink"}`}>
                                {action.title}
                            </span>
                            <ChevronRight
                                size={15}
                                className={`flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${action.highlight ? "text-white/80" : "text-ink-faint"}`}
                            />
                        </div>
                        <p className={`text-xs mt-0.5 leading-relaxed ${action.highlight ? "text-white/75" : "text-ink-muted"}`}>
                            {action.description}
                        </p>
                    </div>
                </Link>
            ))}
        </div>
    );
}
