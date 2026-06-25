"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
    FileText, Download, Eye, Search, Loader2, ChevronRight, ChevronDown,
    Atom, Calculator, BookOpen, Globe, Dna, FlaskConical, Languages,
    Calendar, FolderOpen, FileCheck, ClipboardList, BookMarked, Bookmark, Clock3, CheckCircle2,
    Target, SlidersHorizontal
} from "lucide-react";
import { apiCall, getApiUrl } from "@/lib/api";
import { useAuth, useUser } from "@clerk/nextjs";
import {
    PaperStatus,
    TrackedPaper,
    loadTrackedPapersForUser,
    saveTrackedPapersForUser,
    toggleTrackedStatus,
} from "@/lib/paperTracking";
import { hydrateSubjectsFromProfile, StudentSubject } from "@/lib/studentPersonalization";
import { useClerkAuth } from "@/lib/useClerkAuth";
import StudentPageLoading from "@/components/student/StudentPageLoading";
import { Reveal } from "@/components/ui/Motion";

interface FolderItem {
    id: string;
    name: string;
    isFolder: boolean;
    mimeType: string;
    size?: string;
    modifiedTime?: string;
    viewUrl?: string;
    downloadUrl?: string;
    embedUrl?: string;
    folderType?: string;
}

interface FolderCache {
    [folderId: string]: FolderItem[];
}

function getFileBadgeLabel(name: string): string {
    const n = name.toLowerCase();
    if (n.includes("qp") || n.includes("question")) return "Question Paper";
    if (n.includes("ms") || n.includes("mark") || n.includes("answer")) return "Mark Scheme";
    if (n.includes("er") || n.includes("examiner")) return "Examiner Report";
    return "Document";
}

export default function PastPapersPage() {
    const { user } = useUser();
    const { getToken } = useAuth();
    const { profile } = useClerkAuth();
    const [rootFolderId, setRootFolderId] = useState<string | null>(null);
    const [folderCache, setFolderCache] = useState<FolderCache>({});
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());
    const [viewingPaper, setViewingPaper] = useState<FolderItem | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [initialLoading, setInitialLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [trackedPapers, setTrackedPapers] = useState<TrackedPaper[]>([]);
    const [selectedSubjects, setSelectedSubjects] = useState<StudentSubject[]>([]);
    const [mounted, setMounted] = useState(false);

    // Load root folder + tracked statuses on mount
    useEffect(() => {
        setMounted(true);
        loadRootFolder();
        let active = true;

        const load = async () => {
            const items = await loadTrackedPapersForUser(getToken);
            if (!active) return;
            setTrackedPapers(items);
        };

        load();

        return () => {
            active = false;
        };
    }, [getToken]);

    useEffect(() => {
        setSelectedSubjects(hydrateSubjectsFromProfile(profile));

        const onChange = (event: Event) => {
            const customEvent = event as CustomEvent<StudentSubject[]>;
            setSelectedSubjects(customEvent.detail ?? []);
        };

        window.addEventListener("propel:selected-subjects-change", onChange);
        return () => window.removeEventListener("propel:selected-subjects-change", onChange);
    }, [profile]);

    const hasStatus = (itemId: string, status: PaperStatus) => {
        const item = trackedPapers.find((paper) => paper.id === itemId);
        return item?.statuses.includes(status) ?? false;
    };

    const togglePaperStatus = (item: FolderItem, status: PaperStatus) => {
        if (!user) return;

        const next = toggleTrackedStatus(
            trackedPapers,
            {
                id: item.id,
                name: item.name,
                type: getFileBadgeLabel(item.name),
                viewUrl: item.viewUrl,
                downloadUrl: item.downloadUrl,
                embedUrl: item.embedUrl,
            },
            status
        );

        setTrackedPapers(next);
        void saveTrackedPapersForUser(next, getToken);
    };

    const loadRootFolder = async () => {
        try {
            setInitialLoading(true);
            setError(null);

            const response = await apiCall('/papers/browse');

            if (!response.ok) {
                let backendMessage = 'Failed to load folders';
                try {
                    const errorData = await response.json();
                    backendMessage = errorData?.error || backendMessage;
                } catch { }
                throw new Error(backendMessage);
            }

            const data = await response.json();
            setRootFolderId(data.folderId);
            setFolderCache({ [data.folderId]: data.items });
        } catch (err) {
            console.error('Error loading root folder:', err);
            setError(err instanceof Error ? err.message : 'Failed to load past papers.');
        } finally {
            setInitialLoading(false);
        }
    };

    const loadFolder = async (folderId: string) => {
        if (folderCache[folderId]) return;
        try {
            setLoadingFolders(prev => new Set(prev).add(folderId));
            const response = await apiCall(`/papers/browse/${folderId}`);
            if (!response.ok) throw new Error('Failed to load folder');
            const data = await response.json();
            setFolderCache(prev => ({ ...prev, [folderId]: data.items }));
        } catch (err) {
            console.error('Error loading folder:', err);
        } finally {
            setLoadingFolders(prev => {
                const newSet = new Set(prev);
                newSet.delete(folderId);
                return newSet;
            });
        }
    };

    const toggleFolder = async (folderId: string) => {
        const isExpanded = expandedFolders.has(folderId);
        if (isExpanded) {
            setExpandedFolders(prev => {
                const newSet = new Set(prev);
                newSet.delete(folderId);
                return newSet;
            });
        } else {
            if (!folderCache[folderId]) await loadFolder(folderId);
            setExpandedFolders(prev => new Set(prev).add(folderId));
        }
    };

    const handleView = (paper: FolderItem) => setViewingPaper(paper);

    const handleDownload = (paper: FolderItem) => {
        if (paper.downloadUrl) {
            const link = document.createElement('a');
            link.href = `${getApiUrl()}${paper.downloadUrl}`;
            link.download = paper.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const getSubjectIcon = (subjectName: string) => {
        const name = subjectName.toLowerCase();
        if (name.includes('chemistry') || name.includes('5070')) return <FlaskConical className="w-5 h-5" />;
        if (name.includes('physics') || name.includes('5054')) return <Atom className="w-5 h-5" />;
        if (name.includes('math') || name.includes('4037')) return <Calculator className="w-5 h-5" />;
        if (name.includes('biology') || name.includes('5090')) return <Dna className="w-5 h-5" />;
        if (name.includes('english') || name.includes('1123')) return <Languages className="w-5 h-5" />;
        if (name.includes('islamiyat') || name.includes('2058')) return <BookOpen className="w-5 h-5" />;
        if (name.includes('pakistan') || name.includes('2059')) return <Globe className="w-5 h-5" />;
        return <BookMarked className="w-5 h-5" />;
    };

    const getPaperIcon = (fileName: string) => {
        const name = fileName.toLowerCase();
        if (name.includes('qp') || name.includes('question')) return <FileText className="w-4 h-4" />;
        if (name.includes('ms') || name.includes('mark') || name.includes('answer')) return <FileCheck className="w-4 h-4" />;
        if (name.includes('er') || name.includes('examiner')) return <ClipboardList className="w-4 h-4" />;
        return <FileText className="w-4 h-4" />;
    };

    const renderStatusButtons = (item: FolderItem, compact: boolean = false) => {
        if (!user) return null;

        const iconSize = compact ? 14 : 16;
        const baseClass = compact
            ? "p-1.5 rounded-lg transition-colors border"
            : "p-2 rounded-lg transition-colors border";

        const statusActions: Array<{
            status: PaperStatus;
            label: string;
            icon: any;
            active: string;
            inactive: string;
            fillOnActive?: boolean;
        }> = [
            {
                status: "goal",
                label: "goal",
                icon: Target,
                active: "text-gold-ink bg-gold-soft border-gold/30",
                inactive: "text-ink-faint bg-surface border-line hover:text-gold-ink hover:border-gold/30 hover:bg-gold-soft",
            },
            {
                status: "in_progress",
                label: "in progress",
                icon: Clock3,
                active: "text-clay-ink bg-clay-soft border-clay/30",
                inactive: "text-ink-faint bg-surface border-line hover:text-clay-ink hover:border-clay/30 hover:bg-clay-soft",
            },
            {
                status: "completed",
                label: "completed",
                icon: CheckCircle2,
                active: "text-mint-ink bg-mint-soft border-mint/30",
                inactive: "text-ink-faint bg-surface border-line hover:text-mint-ink hover:border-mint/30 hover:bg-mint-soft",
            },
            {
                status: "bookmarked",
                label: "bookmarked",
                icon: Bookmark,
                active: "text-crimson bg-crimson-soft border-crimson/20",
                inactive: "text-ink-faint bg-surface border-line hover:text-crimson hover:border-crimson/20 hover:bg-crimson-soft",
                fillOnActive: true,
            },
        ];

        return statusActions.map((action) => {
            const active = hasStatus(item.id, action.status);
            const Icon = action.icon;
            return (
                <button
                    key={action.status}
                    onClick={() => togglePaperStatus(item, action.status)}
                    className={`${baseClass} ${active ? action.active : action.inactive}`}
                    title={active ? `Remove ${action.label}` : `Mark as ${action.label}`}
                >
                    <Icon size={iconSize} fill={action.fillOnActive && active ? "currentColor" : "none"} />
                </button>
            );
        });
    };

    const renderFolder = (item: FolderItem, depth: number = 0) => {
        const isExpanded = expandedFolders.has(item.id);
        const isLoading = loadingFolders.has(item.id);
        const children = folderCache[item.id] || [];
        const paddingLeft = depth * 24;

        const getFolderStyle = () => {
            switch (item.folderType) {
                case 'subject':
                    return { icon: getSubjectIcon(item.name), color: 'text-crimson', bgColor: 'bg-crimson-soft', borderColor: 'border-crimson/20', label: 'Subject' };
                case 'category':
                    return { icon: <FolderOpen className="w-5 h-5" />, color: 'text-ink-muted', bgColor: 'bg-surface-soft', borderColor: 'border-line', label: 'Category' };
                case 'year':
                    return { icon: <Calendar className="w-5 h-5" />, color: 'text-ink-muted', bgColor: 'bg-surface-soft', borderColor: 'border-line', label: 'Year' };
                case 'month':
                    return { icon: <Calendar className="w-5 h-5" />, color: 'text-ink-muted', bgColor: 'bg-surface-soft', borderColor: 'border-line', label: 'Session' };
                default:
                    return { icon: <FolderOpen className="w-5 h-5" />, color: 'text-ink-muted', bgColor: 'bg-surface-soft', borderColor: 'border-line', label: '' };
            }
        };

        const folderStyle = getFolderStyle();

        return (
            <div key={item.id} className="border-b border-line last:border-b-0">
                <button
                    onClick={() => toggleFolder(item.id)}
                    className="w-full p-3 flex items-center gap-3 hover:bg-surface-soft transition-colors"
                    style={{ paddingLeft: `${paddingLeft + 12}px` }}
                >
                    {isLoading ? (
                        <Loader2 className="w-4 h-4 text-ink-faint animate-spin flex-shrink-0" />
                    ) : (
                        <div className="flex-shrink-0">
                            {isExpanded ? <ChevronDown className="w-5 h-5 text-ink-muted" /> : <ChevronRight className="w-5 h-5 text-ink-muted" />}
                        </div>
                    )}
                    <div className={`p-2.5 rounded-xl ${folderStyle.bgColor} border ${folderStyle.borderColor} flex-shrink-0 ${folderStyle.color}`}>
                        {folderStyle.icon}
                    </div>
                    <div className="flex-1 text-left">
                        <span className={`font-semibold ${folderStyle.color}`}>{item.name}</span>
                        {folderStyle.label && (
                            <span className="ml-2 text-xs text-ink-faint">({folderStyle.label})</span>
                        )}
                    </div>
                </button>

                {isExpanded && !isLoading && (
                    <div>
                        {children.map(child => child.isFolder ? renderFolder(child, depth + 1) : renderFile(child, depth + 1))}
                        {children.length === 0 && (
                            <div className="p-3 text-sm text-ink-muted italic" style={{ paddingLeft: `${paddingLeft + 48}px` }}>
                                Empty folder
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderFile = (item: FolderItem, depth: number = 0) => {
        const paddingLeft = depth * 24;
        const fileIcon = getPaperIcon(item.name);

        const getFileBadge = () => {
            const name = item.name.toLowerCase();
            if (name.includes('qp') || name.includes('question'))
                return { bg: 'bg-crimson-soft', text: 'text-crimson-ink', border: 'border-crimson/20', label: 'Question Paper' };
            if (name.includes('ms') || name.includes('mark') || name.includes('answer'))
                return { bg: 'bg-ink', text: 'text-paper', border: 'border-ink', label: 'Mark Scheme' };
            if (name.includes('er') || name.includes('examiner'))
                return { bg: 'bg-gold-soft', text: 'text-gold-ink', border: 'border-gold/30', label: 'Examiner Report' };
            return { bg: 'bg-surface-soft', text: 'text-ink-muted', border: 'border-line', label: 'Document' };
        };

        const fileBadge = getFileBadge();

        return (
            <div
                key={item.id}
                className="p-3 flex items-center justify-between hover:bg-surface-soft transition-all border-b border-line last:border-b-0 group"
                style={{ paddingLeft: `${paddingLeft + 12}px` }}
            >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`p-2 rounded-lg ${fileBadge.bg} border ${fileBadge.border} ${fileBadge.text} flex-shrink-0`}>
                        {fileIcon}
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-sm text-ink truncate font-medium">{item.name}</span>
                        <span className="text-xs text-ink-muted font-medium">{fileBadge.label}</span>
                    </div>
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-2 flex-wrap">
                    {renderStatusButtons(item)}
                    <button
                        onClick={() => handleView(item)}
                        className="p-2 text-paper bg-crimson hover:bg-crimson-deep rounded-lg transition-colors"
                        title="View"
                    >
                        <Eye size={16} />
                    </button>
                    <button
                        onClick={() => handleDownload(item)}
                        className="p-2 text-ink bg-surface hover:bg-surface-soft border border-line rounded-lg transition-colors"
                        title="Download"
                    >
                        <Download size={16} />
                    </button>
                </div>
            </div>
        );
    };

    const getFilteredItems = () => {
        if (!rootFolderId || !folderCache[rootFolderId]) return [];
        const selectedIds = new Set(selectedSubjects.map((subject) => subject.id));
        const selectedNames = new Set(selectedSubjects.map((subject) => subject.name.toLowerCase()));
        const scopedItems = selectedIds.size === 0
            ? folderCache[rootFolderId]
            : folderCache[rootFolderId].filter((item) => {
                if (!item.isFolder) return true;
                return selectedIds.has(item.id) || selectedNames.has(item.name.toLowerCase());
            });
        if (!searchTerm) return scopedItems;
        return scopedItems.filter(item =>
            item.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    };

    if (initialLoading) {
        return <StudentPageLoading label="Loading past papers..." />;
    }

    if (error) {
        return (
            <div className="p-8 max-w-7xl mx-auto">
                <div className="bg-crimson-soft border border-crimson/20 rounded-[1.25rem] p-6 text-center">
                    <p className="text-crimson-ink font-medium">{error}</p>
                    <button onClick={loadRootFolder} className="mt-4 px-4 py-2 bg-crimson text-white rounded-xl hover:bg-crimson-deep transition-colors">
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    const filteredItems = getFilteredItems();

    return (
        <div className="min-h-full bg-transparent p-4 md:p-8 max-w-7xl mx-auto text-ink">
            {/* PDF Viewer Modal */}
            {mounted && viewingPaper && createPortal(
                <div className="fixed inset-0 bg-ink/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 md:p-6">
                    <div className="bg-surface w-[min(96vw,1500px)] h-[min(94dvh,1100px)] flex flex-col shadow-2xl rounded-2xl overflow-hidden border border-line">
                        <div className="p-4 sm:p-5 border-b border-line bg-surface-soft space-y-3 sm:space-y-4">
                            <h3 className="font-display font-semibold text-ink text-center text-base sm:text-lg break-words leading-snug max-h-20 overflow-y-auto px-2">
                                {viewingPaper.name}
                            </h3>
                            <div className="flex gap-2 items-center flex-wrap justify-center sm:justify-end">
                                {renderStatusButtons(viewingPaper, true)}
                                <button
                                    onClick={() => handleDownload(viewingPaper)}
                                    className="px-4 py-2 text-sm bg-crimson text-white rounded-lg hover:bg-crimson-deep transition-colors"
                                >
                                    Download
                                </button>
                                <button
                                    onClick={() => setViewingPaper(null)}
                                    className="px-4 py-2 text-sm bg-surface text-ink-muted border border-line rounded-lg hover:bg-surface-soft transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                        <iframe
                            src={`${getApiUrl()}${viewingPaper.embedUrl}`}
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
                        <h1 className="text-2xl md:text-3xl font-bold font-display tracking-tight text-ink">Past Papers <span className="italic text-crimson">Library</span></h1>
                        <p className="text-ink-muted mt-1">
                            {selectedSubjects.length > 0
                                ? `Showing ${selectedSubjects.length} selected subject${selectedSubjects.length > 1 ? "s" : ""}.`
                                : "Browse past papers organized by subject, year, and session."}
                        </p>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto items-center flex-wrap">
                        <a
                            href="/student/subjects"
                            className="flex items-center gap-1.5 px-3 py-2 bg-surface border border-line text-ink-muted rounded-xl text-sm font-semibold hover:bg-surface-soft transition-colors flex-shrink-0"
                        >
                            <SlidersHorizontal size={14} />
                            Subjects
                        </a>
                        <a
                            href="/student/goals"
                            className="flex items-center gap-1.5 px-3 py-2 bg-gold-soft border border-gold/30 text-gold-ink rounded-xl text-sm font-semibold hover:bg-gold-soft/70 transition-colors flex-shrink-0"
                        >
                            <Target size={14} />
                            Goals
                        </a>
                        {user && trackedPapers.length > 0 && (
                            <a
                                href="/student/bookmarks"
                                className="flex items-center gap-1.5 px-3 py-2 bg-crimson-soft border border-crimson/20 text-crimson rounded-xl text-sm font-semibold hover:bg-crimson-soft/70 transition-colors flex-shrink-0"
                            >
                                <Bookmark size={14} fill="currentColor" />
                                {trackedPapers.length}
                            </a>
                        )}
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint z-10" size={20} />
                            <input
                                type="text"
                                placeholder="Search subjects..."
                                className="ed-input pl-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </Reveal>

            {/* Folder Tree */}
            <Reveal delay={0.1}>
                <div className="ed-card overflow-hidden">
                    {filteredItems.length === 0 ? (
                        <div className="p-12 text-center text-ink-muted">
                            {searchTerm ? 'No subjects found matching your search.' : 'No folders found.'}
                        </div>
                    ) : (
                        <div>
                            {filteredItems.map(item => item.isFolder ? renderFolder(item) : renderFile(item))}
                        </div>
                    )}
                </div>
            </Reveal>
        </div>
    );
}
