"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
    Bookmark,
    Trash2,
    Eye,
    Download,
    FileText,
    FileCheck,
    ClipboardList,
    Search,
    Clock3,
    CheckCircle2,
} from "lucide-react";
import { getApiUrl } from "@/lib/api";
import {
    PaperStatus,
    TrackedPaper,
    clearTrackedPaper,
    loadTrackedPapersForUser,
    saveTrackedPapersForUser,
    toggleTrackedStatus,
} from "@/lib/paperTracking";
import { useAuth } from "@clerk/nextjs";

const STATUS_SECTIONS: Array<{
    key: PaperStatus;
    title: string;
    Icon: any;
    accent: string;
}> = [
    { key: "in_progress", title: "In Progress", Icon: Clock3, accent: "text-blue-600" },
    { key: "completed", title: "Completed", Icon: CheckCircle2, accent: "text-emerald-600" },
    { key: "bookmarked", title: "Bookmarked", Icon: Bookmark, accent: "text-primary" },
];

function formatDate(isoString: string): string {
    const saved = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - saved.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? "s" : ""} ago`;
    return saved.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function getTypeBadge(type: string) {
    switch (type) {
        case "Question Paper":
            return { bg: "bg-white", text: "text-gray-700", border: "border-gray-300", icon: <FileText size={13} /> };
        case "Mark Scheme":
            return { bg: "bg-gray-900", text: "text-white", border: "border-gray-900", icon: <FileCheck size={13} /> };
        case "Examiner Report":
            return { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-300", icon: <ClipboardList size={13} /> };
        default:
            return { bg: "bg-white", text: "text-gray-600", border: "border-gray-200", icon: <FileText size={13} /> };
    }
}

export default function BookmarksPage() {
    const { getToken } = useAuth();
    const [trackedPapers, setTrackedPapers] = useState<TrackedPaper[]>([]);
    const [viewingItem, setViewingItem] = useState<TrackedPaper | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        let active = true;

        const load = async () => {
            const items = await loadTrackedPapersForUser(getToken);
            if (!active) return;
            setTrackedPapers(items);
            setMounted(true);
        };

        load();

        return () => {
            active = false;
        };
    }, [getToken]);

    const hasStatus = (itemId: string, status: PaperStatus) => {
        const item = trackedPapers.find((paper) => paper.id === itemId);
        return item?.statuses.includes(status) ?? false;
    };

    const updateTrackedPapers = (next: TrackedPaper[]) => {
        setTrackedPapers(next);
        void saveTrackedPapersForUser(next, getToken);
    };

    const toggleStatus = (item: TrackedPaper, status: PaperStatus) => {
        const next = toggleTrackedStatus(
            trackedPapers,
            {
                id: item.id,
                name: item.name,
                type: item.type,
                viewUrl: item.viewUrl,
                downloadUrl: item.downloadUrl,
                embedUrl: item.embedUrl,
            },
            status
        );

        updateTrackedPapers(next);
    };

    const removeTrackedPaper = (id: string) => {
        const next = clearTrackedPaper(trackedPapers, id);
        updateTrackedPapers(next);
        if (viewingItem?.id === id) setViewingItem(null);
    };

    const handleDownload = (item: TrackedPaper) => {
        if (!item.downloadUrl) return;
        const link = document.createElement("a");
        link.href = `${getApiUrl()}${item.downloadUrl}`;
        link.download = item.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filtered = trackedPapers.filter(
        (b) =>
            b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            b.type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const grouped = useMemo(() => {
        return STATUS_SECTIONS.map((section) => ({
            ...section,
            items: filtered.filter((paper) => paper.statuses.includes(section.key)),
        }));
    }, [filtered]);

    const hasVisibleResults = grouped.some((section) => section.items.length > 0);

    const renderStatusButtons = (item: TrackedPaper, compact: boolean = false) => {
        const iconSize = compact ? 14 : 15;
        const buttonBase = compact
            ? "p-1.5 rounded-lg border transition-colors"
            : "p-2 rounded-lg border transition-colors";

        const actions: Array<{
            status: PaperStatus;
            label: string;
            icon: any;
            active: string;
            inactive: string;
            fillOnActive?: boolean;
        }> = [
            {
                status: "in_progress",
                label: "in progress",
                icon: Clock3,
                active: "text-blue-600 bg-blue-50 border-blue-200",
                inactive: "text-gray-400 bg-white border-gray-200 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50",
            },
            {
                status: "completed",
                label: "completed",
                icon: CheckCircle2,
                active: "text-emerald-600 bg-emerald-50 border-emerald-200",
                inactive: "text-gray-400 bg-white border-gray-200 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50",
            },
            {
                status: "bookmarked",
                label: "bookmarked",
                icon: Bookmark,
                active: "text-primary bg-primary/5 border-primary/20",
                inactive: "text-gray-400 bg-white border-gray-200 hover:text-primary hover:border-primary/20 hover:bg-primary/5",
                fillOnActive: true,
            },
        ];

        return actions.map((action) => {
            const active = hasStatus(item.id, action.status);
            const Icon = action.icon;
            return (
                <button
                    key={`${item.id}-${action.status}`}
                    onClick={() => toggleStatus(item, action.status)}
                    className={`${buttonBase} ${active ? action.active : action.inactive}`}
                    title={active ? `Remove ${action.label}` : `Mark as ${action.label}`}
                >
                    <Icon size={iconSize} fill={action.fillOnActive && active ? "currentColor" : "none"} />
                </button>
            );
        });
    };

    if (!mounted) return null;

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto">
            {/* PDF Viewer Modal */}
            {mounted && viewingItem && createPortal(
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 md:p-6">
                    <div className="bg-white w-[min(96vw,1500px)] h-[min(94dvh,1100px)] flex flex-col shadow-2xl rounded-2xl overflow-hidden border border-gray-200">
                        <div className="p-4 sm:p-5 border-b border-gray-200 bg-gray-50 space-y-3 sm:space-y-4">
                            <h3 className="font-semibold text-gray-900 text-center text-base sm:text-lg break-words leading-snug max-h-20 overflow-y-auto px-2">
                                {viewingItem.name}
                            </h3>
                            <div className="flex gap-2 items-center flex-wrap justify-center sm:justify-end">
                                {renderStatusButtons(viewingItem, true)}
                                <button
                                    onClick={() => handleDownload(viewingItem)}
                                    className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-black transition-colors"
                                >
                                    Download
                                </button>
                                <button
                                    onClick={() => setViewingItem(null)}
                                    className="px-4 py-2 text-sm bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                        <iframe
                            src={`${getApiUrl()}${viewingItem.embedUrl}`}
                            className="flex-1 w-full min-h-0"
                            title="PDF Viewer"
                        />
                    </div>
                </div>,
                document.body
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold font-display text-gray-900">Tracked Papers</h1>
                    <p className="text-gray-500 mt-1">
                        {trackedPapers.length > 0
                            ? `${trackedPapers.length} tracked paper${trackedPapers.length > 1 ? "s" : ""}`
                            : "No tracked papers yet"}
                    </p>
                </div>
                {trackedPapers.length > 0 && (
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search tracked papers..."
                            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-300 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                )}
            </div>

            {/* Empty state */}
            {trackedPapers.length === 0 && (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                    <div className="w-16 h-16 bg-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Clock3 className="text-primary" size={28} />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">No tracked papers yet</h3>
                    <p className="text-gray-500 text-sm mb-6">
                        Use in-progress, completed, important, or bookmark icons on past papers to track them here.
                    </p>
                    <a
                        href="/student/past-papers"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-black transition-colors"
                    >
                        Browse Past Papers
                    </a>
                </div>
            )}

            {/* Search no results */}
            {trackedPapers.length > 0 && !hasVisibleResults && (
                <div className="text-center py-16 text-gray-500">
                    No tracked papers match &ldquo;{searchTerm}&rdquo;
                </div>
            )}

            {trackedPapers.length > 0 && hasVisibleResults && (
                <div className="space-y-6">
                    {grouped.map((section) => {
                        const SectionIcon = section.Icon;
                        return (
                            <section key={section.key}>
                                <div className="flex items-center gap-2 mb-3">
                                    <SectionIcon size={18} className={section.accent} />
                                    <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                                        {section.items.length}
                                    </span>
                                </div>

                                {section.items.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-500 bg-white">
                                        No papers marked as {section.title.toLowerCase()}.
                                    </div>
                                ) : (
                                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                        {section.items.map((item, idx) => {
                                            const badge = getTypeBadge(item.type);
                                            return (
                                                <div
                                                    key={`${section.key}-${item.id}`}
                                                    className={`flex items-center justify-between p-4 gap-3 hover:bg-gray-50 transition-colors ${idx < section.items.length - 1 ? "border-b border-gray-100" : ""}`}
                                                >
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <div className={`p-2 rounded-lg border ${badge.bg} ${badge.border} ${badge.text} flex-shrink-0`}>
                                                            {badge.icon}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                                                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${badge.bg} ${badge.border} ${badge.text}`}>
                                                                    {item.type}
                                                                </span>
                                                                <span className="text-xs text-gray-400">{formatDate(item.savedAt)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 flex-shrink-0 flex-wrap items-center justify-end">
                                                        {renderStatusButtons(item)}
                                                        {item.embedUrl && (
                                                            <button
                                                                onClick={() => setViewingItem(item)}
                                                                className="p-2 text-white bg-gray-900 hover:bg-black rounded-lg transition-colors"
                                                                title="View"
                                                            >
                                                                <Eye size={15} />
                                                            </button>
                                                        )}
                                                        {item.downloadUrl && (
                                                            <button
                                                                onClick={() => handleDownload(item)}
                                                                className="p-2 text-gray-900 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors"
                                                                title="Download"
                                                            >
                                                                <Download size={15} />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => removeTrackedPaper(item.id)}
                                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 border border-gray-200 hover:border-red-200 rounded-lg transition-colors"
                                                            title="Remove from all sections"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        );
                    })}
                </div>
            )}

            {trackedPapers.length > 0 && (
                <p className="text-center text-xs text-gray-400 mt-6">
                    Tracking states are saved in your browser and persist across sessions.
                </p>
            )}
        </div>
    );
}
