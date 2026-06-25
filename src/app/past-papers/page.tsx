"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    FileText, Download, Eye, Search, Loader2, ChevronRight, ChevronDown,
    Atom, Beaker, Calculator, BookOpen, Globe, Dna, FlaskConical, Languages,
    Calendar, FolderOpen, FileCheck, ClipboardList, BookMarked, Home
} from "lucide-react";
import { useClerkAuth } from "@/lib/useClerkAuth";
import { useUser } from "@clerk/nextjs";
import { apiCall } from "@/lib/api";
import { BrandLogo } from "@/components/ui/Logo";
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

export default function PublicPastPapersPage() {
    const { user, isLoaded } = useUser();
    const { profile } = useClerkAuth();
    const [rootFolderId, setRootFolderId] = useState<string | null>(null);
    const [folderCache, setFolderCache] = useState<FolderCache>({});
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());
    const [viewingPaper, setViewingPaper] = useState<FolderItem | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [initialLoading, setInitialLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Navigation component
    const Navigation = () => (
        <nav className="bg-surface/85 backdrop-blur-xl border-b border-line px-4 md:px-6 py-4">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
                <Link href="/">
                    <BrandLogo size={36} labelClassName="text-2xl text-crimson" />
                </Link>
                <div className="flex items-center gap-2 md:gap-4">
                    <Link href="/" className="hidden sm:flex items-center gap-2 text-ink-muted hover:text-crimson font-semibold transition-colors">
                        <Home size={18} />
                        Home
                    </Link>
                    {user && profile ? (
                        <Link href={
                            profile.role === "teacher" ? "/teacher/dashboard" :
                                profile.role === "admin" ? "/admin/dashboard" :
                                    "/student/dashboard"
                        } className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 bg-crimson text-white shadow-crimson hover:bg-crimson-deep font-bold transition-all active:scale-[0.98]">
                            Dashboard
                        </Link>
                    ) : null}
                </div>
            </div>
        </nav>
    );

    // Load root folder on mount
    useEffect(() => {
        loadRootFolder();
    }, []);

    const loadRootFolder = async () => {
        try {
            setInitialLoading(true);
            setError(null);

            // Browse root folder (no folderId means use default from env)
            const response = await apiCall('/papers/browse');

            if (!response.ok) {
                throw new Error('Failed to load folders');
            }

            const data = await response.json();

            // Cache the root folder contents
            setRootFolderId(data.folderId);
            setFolderCache({ [data.folderId]: data.items });
        } catch (err) {
            console.error('Error loading root folder:', err);
            setError('Failed to load past papers. Make sure the backend is running.');
        } finally {
            setInitialLoading(false);
        }
    };

    const loadFolder = async (folderId: string) => {
        // Check if already cached
        if (folderCache[folderId]) {
            return;
        }

        try {
            setLoadingFolders(prev => new Set(prev).add(folderId));

            const response = await apiCall(`/papers/browse/${folderId}`);

            if (!response.ok) {
                throw new Error('Failed to load folder');
            }

            const data = await response.json();

            // Cache the folder contents
            setFolderCache(prev => ({
                ...prev,
                [folderId]: data.items
            }));
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
            // Collapse
            setExpandedFolders(prev => {
                const newSet = new Set(prev);
                newSet.delete(folderId);
                return newSet;
            });
        } else {
            // Expand - load if not cached
            if (!folderCache[folderId]) {
                await loadFolder(folderId);
            }

            setExpandedFolders(prev => new Set(prev).add(folderId));
        }
    };

    const handleView = (paper: FolderItem) => {
        setViewingPaper(paper);
    };

    const handleDownload = (paper: FolderItem) => {
        if (paper.downloadUrl) {
            const link = document.createElement('a');
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
            link.href = `${baseUrl}${paper.downloadUrl}`;
            link.download = paper.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const getSubjectIcon = (subjectName: string) => {
        const name = subjectName.toLowerCase();

        if (name.includes('chemistry') || name.includes('5070')) {
            return <FlaskConical className="w-5 h-5" />;
        } else if (name.includes('physics') || name.includes('5054')) {
            return <Atom className="w-5 h-5" />;
        } else if (name.includes('math') || name.includes('4037')) {
            return <Calculator className="w-5 h-5" />;
        } else if (name.includes('biology') || name.includes('5090')) {
            return <Dna className="w-5 h-5" />;
        } else if (name.includes('english') || name.includes('1123')) {
            return <Languages className="w-5 h-5" />;
        } else if (name.includes('islamiyat') || name.includes('2058')) {
            return <BookOpen className="w-5 h-5" />;
        } else if (name.includes('pakistan') || name.includes('2059')) {
            return <Globe className="w-5 h-5" />;
        } else {
            return <BookMarked className="w-5 h-5" />;
        }
    };

    const getPaperIcon = (fileName: string) => {
        const name = fileName.toLowerCase();

        if (name.includes('qp') || name.includes('question')) {
            return <FileText className="w-4 h-4" />;
        } else if (name.includes('ms') || name.includes('mark') || name.includes('answer')) {
            return <FileCheck className="w-4 h-4" />;
        } else if (name.includes('er') || name.includes('examiner')) {
            return <ClipboardList className="w-4 h-4" />;
        } else {
            return <FileText className="w-4 h-4" />;
        }
    };

    const renderFolder = (item: FolderItem, depth: number = 0) => {
        const isExpanded = expandedFolders.has(item.id);
        const isLoading = loadingFolders.has(item.id);
        const children = folderCache[item.id] || [];
        const paddingLeft = depth * 24;

        // Determine folder icon and color based on type
        const getFolderStyle = () => {
            switch (item.folderType) {
                case 'subject':
                    return {
                        icon: getSubjectIcon(item.name),
                        color: 'text-crimson',
                        bgColor: 'bg-crimson-soft',
                        borderColor: 'border-crimson/20',
                        label: 'Subject'
                    };
                case 'category':
                    return {
                        icon: <FolderOpen className="w-5 h-5" />,
                        color: 'text-ink-muted',
                        bgColor: 'bg-surface-soft',
                        borderColor: 'border-line',
                        label: 'Category'
                    };
                case 'year':
                    return {
                        icon: <Calendar className="w-5 h-5" />,
                        color: 'text-ink-muted',
                        bgColor: 'bg-surface-soft',
                        borderColor: 'border-line',
                        label: 'Year'
                    };
                case 'month':
                    return {
                        icon: <Calendar className="w-5 h-5" />,
                        color: 'text-ink-muted',
                        bgColor: 'bg-surface-soft',
                        borderColor: 'border-line',
                        label: 'Session'
                    };
                default:
                    return {
                        icon: <FolderOpen className="w-5 h-5" />,
                        color: 'text-ink-muted',
                        bgColor: 'bg-surface-soft',
                        borderColor: 'border-line',
                        label: ''
                    };
            }
        };

        const folderStyle = getFolderStyle();

        return (
            <div key={item.id} className="border-b border-line last:border-b-0">
                {/* Folder Header */}
                <button
                    onClick={() => toggleFolder(item.id)}
                    className="w-full p-3 flex items-center gap-3 hover:bg-surface-soft transition-colors"
                    style={{ paddingLeft: `${paddingLeft + 12}px` }}
                >
                    {isLoading ? (
                        <Loader2 className="w-4 h-4 text-ink-faint animate-spin flex-shrink-0" />
                    ) : (
                        <div className="flex-shrink-0">
                            {isExpanded ? (
                                <ChevronDown className="w-5 h-5 text-ink-faint" />
                            ) : (
                                <ChevronRight className="w-5 h-5 text-ink-faint" />
                            )}
                        </div>
                    )}
                    <div className={`p-2.5 rounded-xl ${folderStyle.bgColor} border ${folderStyle.borderColor} flex-shrink-0 ${folderStyle.color}`}>
                        {folderStyle.icon}
                    </div>
                    <div className="flex-1 text-left">
                        <span className={`font-semibold ${folderStyle.color === 'text-crimson' ? 'text-ink' : folderStyle.color}`}>{item.name}</span>
                        {folderStyle.label && (
                            <span className="ml-2 text-xs text-ink-faint">({folderStyle.label})</span>
                        )}
                    </div>
                </button>

                {/* Folder Contents */}
                {isExpanded && !isLoading && (
                    <div>
                        {children.map(child => {
                            if (child.isFolder) {
                                return renderFolder(child, depth + 1);
                            } else {
                                return renderFile(child, depth + 1);
                            }
                        })}
                        {children.length === 0 && (
                            <div
                                className="p-3 text-sm text-ink-faint italic"
                                style={{ paddingLeft: `${paddingLeft + 48}px` }}
                            >
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

        // Determine file badge color based on type
        const getFileBadge = () => {
            const name = item.name.toLowerCase();
            if (name.includes('qp') || name.includes('question')) {
                return { bg: 'bg-crimson-soft', text: 'text-crimson-ink', border: 'border-crimson/20', label: 'Question Paper' };
            } else if (name.includes('ms') || name.includes('mark') || name.includes('answer')) {
                return { bg: 'bg-mint-soft', text: 'text-mint-ink', border: 'border-mint/20', label: 'Mark Scheme' };
            } else if (name.includes('er') || name.includes('examiner')) {
                return { bg: 'bg-gold-soft', text: 'text-gold-ink', border: 'border-gold/20', label: 'Examiner Report' };
            } else {
                return { bg: 'bg-surface-soft', text: 'text-ink-muted', border: 'border-line', label: 'Document' };
            }
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
                        <span className={`text-xs ${fileBadge.text} font-medium`}>{fileBadge.label}</span>
                    </div>
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => handleView(item)}
                        className="p-2 text-white bg-crimson hover:bg-crimson-deep rounded-lg transition-colors"
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

    // Filter folders/files based on search
    const getFilteredItems = () => {
        if (!rootFolderId || !folderCache[rootFolderId]) return [];

        if (!searchTerm) return folderCache[rootFolderId];

        return folderCache[rootFolderId].filter(item =>
            item.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    };

    if (initialLoading) {
        return (
            <div className="min-h-screen bg-paper">
                {/* Header */}
                <nav className="bg-surface/85 backdrop-blur-xl border-b border-line px-4 md:px-6 py-4">
                    <div className="max-w-7xl mx-auto flex justify-between items-center">
                        <Link href="/">
                            <BrandLogo size={36} labelClassName="text-2xl text-crimson" />
                        </Link>
                        <div className="flex items-center gap-4">
                            <Link href="/" className="flex items-center gap-2 text-ink-muted hover:text-crimson font-semibold transition-colors">
                                <Home size={18} />
                                Home
                            </Link>
                        </div>
                    </div>
                </nav>

                <div className="p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <Loader2 className="w-12 h-12 text-crimson animate-spin mx-auto mb-4" />
                        <p className="text-ink-muted">Loading past papers...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-paper">
                <Navigation />

                <div className="p-8 max-w-7xl mx-auto">
                    <div className="bg-crimson-soft border border-crimson/20 rounded-[1.25rem] p-6 text-center">
                        <p className="text-crimson-ink font-medium">{error}</p>
                        <button
                            onClick={loadRootFolder}
                            className="mt-4 inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 bg-crimson text-white font-bold shadow-crimson hover:bg-crimson-deep transition-all active:scale-[0.98]"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const filteredItems = getFilteredItems();

    return (
        <div className="min-h-screen bg-paper">
            <nav className="bg-surface/85 backdrop-blur-xl border-b border-line px-4 md:px-6 py-4 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <Link href="/">
                        <BrandLogo size={36} labelClassName="text-2xl text-crimson" />
                    </Link>
                    <div className="flex items-center gap-4">
                        <Link href="/" className="flex items-center gap-2 text-ink-muted hover:text-crimson font-semibold transition-colors">
                            <Home size={18} />
                            Home
                        </Link>
                        {user && profile ? (
                            <Link href={
                                profile.role === "teacher" ? "/teacher/dashboard" :
                                    profile.role === "admin" ? "/admin/dashboard" :
                                        "/student/dashboard"
                            } className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 bg-crimson text-white shadow-crimson hover:bg-crimson-deep font-bold transition-all active:scale-[0.98]">
                                Dashboard
                            </Link>
                        ) : null}
                    </div>
                </div>
            </nav>

            <div className="p-4 md:p-8 max-w-7xl mx-auto">
                {/* PDF Viewer Modal */}
                {viewingPaper && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-surface rounded-[1.25rem] w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl">
                            <div className="flex items-center justify-between p-4 border-b border-line bg-surface-soft">
                                <h3 className="font-display font-semibold text-ink">{viewingPaper.name}</h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleDownload(viewingPaper)}
                                        className="px-4 py-2 text-sm font-bold bg-crimson text-white rounded-full hover:bg-crimson-deep transition-colors"
                                    >
                                        Download
                                    </button>
                                    <button
                                        onClick={() => setViewingPaper(null)}
                                        className="px-4 py-2 text-sm font-bold bg-surface text-ink border border-line rounded-full hover:bg-surface-soft transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                            <iframe
                                src={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}${viewingPaper.embedUrl}`}
                                className="flex-1 w-full"
                                title="PDF Viewer"
                            />
                        </div>
                    </div>
                )}

                {/* Header */}
                <Reveal>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                        <div>
                            <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-ink">Past Papers <span className="italic text-crimson">Library</span></h1>
                            <p className="text-ink-muted mt-1">Browse past papers organized by subject, year, and session. Free access for everyone!</p>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
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

                {/* Call to Action Banner - Only show for non-logged-in users */}
                {!user && (
                    <Reveal delay={0.1}>
                        <div className="bg-gradient-to-r from-[#A8123C] to-[#760B28] text-white rounded-[1.25rem] p-4 md:p-6 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-crimson">
                            <div>
                                <h3 className="font-display text-xl font-semibold mb-2">Want to track your progress?</h3>
                                <p className="text-white/90">Create an account from the home page top navigation to bookmark papers, track learning, and get personalized recommendations.</p>
                            </div>
                        </div>
                    </Reveal>
                )}

                {/* Folder Tree */}
                <div className="ed-card overflow-hidden">
                    {filteredItems.length === 0 ? (
                        <div className="p-12 text-center text-ink-faint">
                            {searchTerm ? 'No subjects found matching your search.' : 'No folders found.'}
                        </div>
                    ) : (
                        <div>
                            {filteredItems.map(item => {
                                if (item.isFolder) {
                                    return renderFolder(item);
                                } else {
                                    return renderFile(item);
                                }
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
