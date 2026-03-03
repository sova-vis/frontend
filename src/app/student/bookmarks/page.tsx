"use client";

import { useState, useEffect } from "react";
import { Bookmark, Trash2, Eye, Download, FileText, FileCheck, ClipboardList, Search } from "lucide-react";
import { getApiUrl } from "@/lib/api";

interface BookmarkItem {
    id: string;
    name: string;
    type: string;
    viewUrl?: string;
    downloadUrl?: string;
    embedUrl?: string;
    savedAt: string;
}

const BOOKMARKS_KEY = "propel_bookmarks";

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
    const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
    const [viewingItem, setViewingItem] = useState<BookmarkItem | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        try {
            const stored = localStorage.getItem(BOOKMARKS_KEY);
            if (stored) setBookmarks(JSON.parse(stored));
        } catch {}
        setMounted(true);
    }, []);

    const removeBookmark = (id: string) => {
        const updated = bookmarks.filter((b) => b.id !== id);
        setBookmarks(updated);
        try {
            localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(updated));
        } catch {}
        if (viewingItem?.id === id) setViewingItem(null);
    };

    const handleDownload = (item: BookmarkItem) => {
        if (!item.downloadUrl) return;
        const link = document.createElement("a");
        link.href = `${getApiUrl()}${item.downloadUrl}`;
        link.download = item.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filtered = bookmarks.filter(
        (b) =>
            b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            b.type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!mounted) return null;

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto">
            {/* PDF Viewer Modal */}
            {viewingItem && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl">
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                            <h3 className="font-semibold text-gray-900 truncate flex-1 mr-4">{viewingItem.name}</h3>
                            <div className="flex gap-2 flex-shrink-0">
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
                            className="flex-1 w-full"
                            title="PDF Viewer"
                        />
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold font-display text-gray-900">Bookmarks</h1>
                    <p className="text-gray-500 mt-1">
                        {bookmarks.length > 0
                            ? `${bookmarks.length} saved paper${bookmarks.length > 1 ? "s" : ""}`
                            : "No bookmarks saved yet"}
                    </p>
                </div>
                {bookmarks.length > 0 && (
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search bookmarks..."
                            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-300 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                )}
            </div>

            {/* Empty state */}
            {bookmarks.length === 0 && (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                    <div className="w-16 h-16 bg-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Bookmark className="text-primary" size={28} />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">No bookmarks yet</h3>
                    <p className="text-gray-500 text-sm mb-6">
                        Bookmark past papers while browsing to save them here.
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
            {bookmarks.length > 0 && filtered.length === 0 && (
                <div className="text-center py-16 text-gray-500">
                    No bookmarks match &ldquo;{searchTerm}&rdquo;
                </div>
            )}

            {/* Bookmark list */}
            {filtered.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    {filtered.map((item, idx) => {
                        const badge = getTypeBadge(item.type);
                        return (
                            <div
                                key={item.id}
                                className={`flex items-center justify-between p-4 gap-3 hover:bg-gray-50 transition-colors ${idx < filtered.length - 1 ? "border-b border-gray-100" : ""}`}
                            >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className={`p-2 rounded-lg border ${badge.bg} ${badge.border} ${badge.text} flex-shrink-0`}>
                                        {badge.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${badge.bg} ${badge.border} ${badge.text}`}>
                                                {item.type}
                                            </span>
                                            <span className="text-xs text-gray-400">{formatDate(item.savedAt)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2 flex-shrink-0">
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
                                        onClick={() => removeBookmark(item.id)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 border border-gray-200 hover:border-red-200 rounded-lg transition-colors"
                                        title="Remove bookmark"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {bookmarks.length > 0 && (
                <p className="text-center text-xs text-gray-400 mt-6">
                    Bookmarks are saved in your browser and persist across sessions.
                </p>
            )}
        </div>
    );
}
