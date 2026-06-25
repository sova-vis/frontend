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
import { Reveal } from "@/components/ui/Motion";

const STATUS_SECTIONS: Array<{
    key: PaperStatus;
    title: string;
    Icon: any;
    accent: string;
}> = [
    { key: "in_progress", title: "In Progress", Icon: Clock3, accent: "text-gold" },
    { key: "completed", title: "Completed", Icon: CheckCircle2, accent: "text-mint" },
    { key: "bookmarked", title: "Bookmarked", Icon: Bookmark, accent: "text-crimson" },
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
            return { bg: "bg-surface", text: "text-ink-muted", border: "border-line", icon: <FileText size={13} /> };
        case "Mark Scheme":
            return { bg: "bg-ink", text: "text-paper", border: "border-ink", icon: <FileCheck size={13} /> };
        case "Examiner Report":
            return { bg: "bg-surface-soft", text: "text-ink-muted", border: "border-line", icon: <ClipboardList size={13} /> };
        default:
            return { bg: "bg-surface", text: "text-ink-muted", border: "border-line", icon: <FileText size={13} /> };
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
                active: "text-gold-ink bg-gold-soft border-gold/20",
                inactive: "text-ink-faint bg-surface border-line hover:text-gold-ink hover:border-gold/20 hover:bg-gold-soft",
            },
            {
                status: "completed",
                label: "completed",
                icon: CheckCircle2,
                active: "text-mint-ink bg-mint-soft border-mint/20",
                inactive: "text-ink-faint bg-surface border-line hover:text-mint-ink hover:border-mint/20 hover:bg-mint-soft",
            },
            {
                status: "bookmarked",
                label: "bookmarked",
                icon: Bookmark,
                active: "text-crimson bg-crimson/5 border-crimson/20",
                inactive: "text-ink-faint bg-surface border-line hover:text-crimson hover:border-crimson/20 hover:bg-crimson/5",
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
        <div className="min-h-full bg-transparent p-4 md:p-8 max-w-5xl mx-auto">
            {/* PDF Viewer Modal */}
            {mounted && viewingItem && createPortal(
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 md:p-6">
                    <div className="bg-surface w-[min(96vw,1500px)] h-[min(94dvh,1100px)] flex flex-col shadow-2xl rounded-2xl overflow-hidden border border-line">
                        <div className="p-4 sm:p-5 border-b border-line bg-surface-soft space-y-3 sm:space-y-4">
                            <h3 className="font-display font-semibold text-ink text-center text-base sm:text-lg break-words leading-snug max-h-20 overflow-y-auto px-2">
                                {viewingItem.name}
                            </h3>
                            <div className="flex gap-2 items-center flex-wrap justify-center sm:justify-end">
                                {renderStatusButtons(viewingItem, true)}
                                <button
                                    onClick={() => handleDownload(viewingItem)}
                                    className="px-4 py-2 text-sm bg-ink text-paper rounded-lg hover:bg-crimson transition-colors"
                                >
                                    Download
                                </button>
                                <button
                                    onClick={() => setViewingItem(null)}
                                    className="px-4 py-2 text-sm bg-surface text-ink-muted border border-line rounded-lg hover:bg-surface-soft transition-colors"
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
            <Reveal>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold font-display tracking-tight text-ink">
                            Tracked <span className="italic text-crimson">Papers</span>
                        </h1>
                        <p className="text-ink-muted mt-1">
                            {trackedPapers.length > 0
                                ? `${trackedPapers.length} tracked paper${trackedPapers.length > 1 ? "s" : ""}`
                                : "No tracked papers yet"}
                        </p>
                    </div>
                    {trackedPapers.length > 0 && (
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint z-10" size={18} />
                            <input
                                type="text"
                                placeholder="Search tracked papers..."
                                className="ed-input pl-9 text-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    )}
                </div>
            </Reveal>

            {/* Empty state */}
            {trackedPapers.length === 0 && (
                <Reveal delay={0.1}>
                    <div className="text-center py-20 bg-surface rounded-2xl border border-dashed border-line">
                        <div className="w-16 h-16 bg-crimson/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Clock3 className="text-crimson" size={28} />
                        </div>
                        <h3 className="text-lg font-display font-semibold text-ink mb-1">No tracked papers yet</h3>
                        <p className="text-ink-muted text-sm mb-6">
                            Use in-progress, completed, important, or bookmark icons on past papers to track them here.
                        </p>
                        <a
                            href="/student/past-papers"
                            className="ed-btn-ink inline-flex items-center gap-2 px-5 py-2.5 text-sm"
                        >
                            Browse Past Papers
                        </a>
                    </div>
                </Reveal>
            )}

            {/* Search no results */}
            {trackedPapers.length > 0 && !hasVisibleResults && (
                <div className="text-center py-16 text-ink-muted">
                    No tracked papers match &ldquo;{searchTerm}&rdquo;
                </div>
            )}

            {trackedPapers.length > 0 && hasVisibleResults && (
                <div className="space-y-6">
                    {grouped.map((section, sectionIdx) => {
                        const SectionIcon = section.Icon;
                        return (
                            <Reveal key={section.key} delay={0.05 * sectionIdx}>
                                <section>
                                    <div className="flex items-center gap-2 mb-3">
                                        <SectionIcon size={18} className={section.accent} />
                                        <h2 className="text-lg font-display font-semibold text-ink">{section.title}</h2>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-surface-soft text-ink-muted border border-line">
                                            {section.items.length}
                                        </span>
                                    </div>

                                    {section.items.length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-line p-4 text-sm text-ink-muted bg-surface">
                                            No papers marked as {section.title.toLowerCase()}.
                                        </div>
                                    ) : (
                                        <div className="ed-card overflow-hidden">
                                            {section.items.map((item, idx) => {
                                                const badge = getTypeBadge(item.type);
                                                return (
                                                    <div
                                                        key={`${section.key}-${item.id}`}
                                                        className={`flex items-center justify-between p-4 gap-3 hover:bg-surface-soft transition-colors ${idx < section.items.length - 1 ? "border-b border-line" : ""}`}
                                                    >
                                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                                            <div className={`p-2 rounded-lg border ${badge.bg} ${badge.border} ${badge.text} flex-shrink-0`}>
                                                                {badge.icon}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium text-ink truncate">{item.name}</p>
                                                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${badge.bg} ${badge.border} ${badge.text}`}>
                                                                        {item.type}
                                                                    </span>
                                                                    <span className="text-xs text-ink-faint">{formatDate(item.savedAt)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2 flex-shrink-0 flex-wrap items-center justify-end">
                                                            {renderStatusButtons(item)}
                                                            {item.embedUrl && (
                                                                <button
                                                                    onClick={() => setViewingItem(item)}
                                                                    className="p-2 text-paper bg-ink hover:bg-crimson rounded-lg transition-colors"
                                                                    title="View"
                                                                >
                                                                    <Eye size={15} />
                                                                </button>
                                                            )}
                                                            {item.downloadUrl && (
                                                                <button
                                                                    onClick={() => handleDownload(item)}
                                                                    className="p-2 text-ink bg-surface hover:bg-surface-soft border border-line rounded-lg transition-colors"
                                                                    title="Download"
                                                                >
                                                                    <Download size={15} />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => removeTrackedPaper(item.id)}
                                                                className="p-2 text-ink-faint hover:text-crimson hover:bg-crimson/5 border border-line hover:border-crimson/20 rounded-lg transition-colors"
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
                            </Reveal>
                        );
                    })}
                </div>
            )}

            {trackedPapers.length > 0 && (
                <p className="text-center text-xs text-ink-faint mt-6">
                    Tracking states are saved in your browser and persist across sessions.
                </p>
            )}
        </div>
    );
}
