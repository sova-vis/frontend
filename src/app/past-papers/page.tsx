"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
    FileText, Download, Eye, Search, Loader2, ChevronRight, ChevronDown,
    Atom, Beaker, Calculator, BookOpen, Globe, Dna, FlaskConical, Languages,
    Calendar, FolderOpen, FileCheck, ClipboardList, BookMarked, Home, LogIn, X
} from "lucide-react";
import { useClerkAuth } from "@/lib/useClerkAuth";
import { useUser } from "@clerk/nextjs";
import { apiCall } from "@/lib/api";
import { SignIn, SignUp } from "@clerk/nextjs";

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
    const [authModal, setAuthModal] = useState<"sign-in" | "sign-up" | null>(null);
    const [rootFolderId, setRootFolderId] = useState<string | null>(null);
    const [folderCache, setFolderCache] = useState<FolderCache>({});
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());
    const [viewingPaper, setViewingPaper] = useState<FolderItem | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [initialLoading, setInitialLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Close auth modal when user signs in
    useEffect(() => {
        if (isLoaded && user) {
            setAuthModal(null);
        }
    }, [user, isLoaded]);

    // Navigation component
    const Navigation = () => (
        <nav className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
                <Link href="/" className="text-2xl font-black text-brand-burgundy">Propel</Link>
                <div className="flex items-center gap-4">
                    <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-brand-burgundy font-semibold">
                        <Home size={18} />
                        Home
                    </Link>
                    {user && profile ? (
                        <Link href={
                            profile.role === "teacher" ? "/teacher/dashboard" :
                            profile.role === "admin" ? "/admin/dashboard" :
                            "/student/dashboard"
                        } className="flex items-center gap-2 px-4 py-2 bg-brand-burgundy text-white rounded-lg hover:bg-brand-burgundy/90 font-semibold">
                            Dashboard
                        </Link>
                    ) : (
                        <button onClick={() => setAuthModal("sign-in")} className="flex items-center gap-2 px-4 py-2 bg-brand-burgundy text-white rounded-lg hover:bg-brand-burgundy/90 font-semibold">
                            <LogIn size={18} />
                            Login
                        </button>
                    )}
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
                        color: 'text-gray-700', 
                        bgColor: 'bg-white', 
                        borderColor: 'border-gray-300',
                        label: 'Subject' 
                    };
                case 'category':
                    return { 
                        icon: <FolderOpen className="w-5 h-5" />, 
                        color: 'text-gray-600', 
                        bgColor: 'bg-gray-50', 
                        borderColor: 'border-gray-200',
                        label: 'Category' 
                    };
                case 'year':
                    return { 
                        icon: <Calendar className="w-5 h-5" />, 
                        color: 'text-gray-600', 
                        bgColor: 'bg-gray-50', 
                        borderColor: 'border-gray-200',
                        label: 'Year' 
                    };
                case 'month':
                    return { 
                        icon: <Calendar className="w-5 h-5" />, 
                        color: 'text-gray-600', 
                        bgColor: 'bg-gray-50', 
                        borderColor: 'border-gray-200',
                        label: 'Session' 
                    };
                default:
                    return { 
                        icon: <FolderOpen className="w-5 h-5" />, 
                        color: 'text-gray-600', 
                        bgColor: 'bg-gray-50', 
                        borderColor: 'border-gray-200',
                        label: '' 
                    };
            }
        };

        const folderStyle = getFolderStyle();

        return (
            <div key={item.id} className="border-b border-gray-100 last:border-b-0">
                {/* Folder Header */}
                <button
                    onClick={() => toggleFolder(item.id)}
                    className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                    style={{ paddingLeft: `${paddingLeft + 12}px` }}
                >
                    {isLoading ? (
                        <Loader2 className="w-4 h-4 text-gray-400 animate-spin flex-shrink-0" />
                    ) : (
                        <div className="flex-shrink-0">
                            {isExpanded ? (
                                <ChevronDown className="w-5 h-5 text-gray-500" />
                            ) : (
                                <ChevronRight className="w-5 h-5 text-gray-500" />
                            )}
                        </div>
                    )}
                    <div className={`p-2.5 rounded-xl ${folderStyle.bgColor} border ${folderStyle.borderColor} flex-shrink-0 ${folderStyle.color}`}>
                        {folderStyle.icon}
                    </div>
                    <div className="flex-1 text-left">
                        <span className={`font-semibold ${folderStyle.color}`}>{item.name}</span>
                        {folderStyle.label && (
                            <span className="ml-2 text-xs text-gray-400">({folderStyle.label})</span>
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
                                className="p-3 text-sm text-gray-500 italic"
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
                return { bg: 'bg-white', text: 'text-gray-700', border: 'border-gray-300', label: 'Question Paper' };
            } else if (name.includes('ms') || name.includes('mark') || name.includes('answer')) {
                return { bg: 'bg-gray-900', text: 'text-white', border: 'border-gray-900', label: 'Mark Scheme' };
            } else if (name.includes('er') || name.includes('examiner')) {
                return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', label: 'Examiner Report' };
            } else {
                return { bg: 'bg-white', text: 'text-gray-600', border: 'border-gray-200', label: 'Document' };
            }
        };

        const fileBadge = getFileBadge();

        return (
            <div
                key={item.id}
                className="p-3 flex items-center justify-between hover:bg-gray-50 transition-all border-b border-gray-100 last:border-b-0 group"
                style={{ paddingLeft: `${paddingLeft + 12}px` }}
            >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`p-2 rounded-lg ${fileBadge.bg} border ${fileBadge.border} ${fileBadge.text} flex-shrink-0`}>
                        {fileIcon}
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-sm text-gray-900 truncate font-medium">{item.name}</span>
                        <span className={`text-xs ${fileBadge.text} font-medium`}>{fileBadge.label}</span>
                    </div>
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => handleView(item)}
                        className="p-2 text-white bg-gray-900 hover:bg-black rounded-lg transition-colors"
                        title="View"
                    >
                        <Eye size={16} />
                    </button>
                    <button
                        onClick={() => handleDownload(item)}
                        className="p-2 text-gray-900 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors"
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
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
                <nav className="bg-white border-b border-gray-200 px-6 py-4">
                    <div className="max-w-7xl mx-auto flex justify-between items-center">
                        <Link href="/" className="text-2xl font-black text-brand-burgundy">Propel</Link>
                        <div className="flex items-center gap-4">
                            <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-brand-burgundy font-semibold">
                                <Home size={18} />
                                Home
                            </Link>
                            <button onClick={() => setAuthModal("sign-in")} className="flex items-center gap-2 px-4 py-2 bg-brand-burgundy text-white rounded-lg hover:bg-brand-burgundy/90 font-semibold">
                                <LogIn size={18} />
                                Login
                            </button>
                        </div>
                    </div>
                </nav>
                
                <div className="p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <Loader2 className="w-12 h-12 text-brand-burgundy animate-spin mx-auto mb-4" />
                        <p className="text-gray-600">Loading past papers...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Navigation />
                
                <div className="p-8 max-w-7xl mx-auto">
                    <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                        <p className="text-red-600 font-medium">{error}</p>
                        <button
                            onClick={loadRootFolder}
                            className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black"
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
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <Link href="/" className="text-2xl font-black text-brand-burgundy">Propel</Link>
                    <div className="flex items-center gap-4">
                        <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-brand-burgundy font-semibold">
                            <Home size={18} />
                            Home
                        </Link>
                        {user && profile ? (
                            <Link href={
                                profile.role === "teacher" ? "/teacher/dashboard" :
                                profile.role === "admin" ? "/admin/dashboard" :
                                "/student/dashboard"
                            } className="flex items-center gap-2 px-4 py-2 bg-brand-burgundy text-white rounded-lg hover:bg-brand-burgundy/90 font-semibold">
                                Dashboard
                            </Link>
                        ) : (
                            <button onClick={() => setAuthModal("sign-in")} className="flex items-center gap-2 px-4 py-2 bg-brand-burgundy text-white rounded-lg hover:bg-brand-burgundy/90 font-semibold">
                                <LogIn size={18} />
                                Login
                            </button>
                        )}
                    </div>
                </div>
            </nav>

            <div className="p-8 max-w-7xl mx-auto">
                {/* PDF Viewer Modal */}
                {viewingPaper && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl">
                            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                                <h3 className="font-semibold text-gray-900">{viewingPaper.name}</h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleDownload(viewingPaper)}
                                        className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-black transition-colors"
                                    >
                                        Download
                                    </button>
                                    <button
                                        onClick={() => setViewingPaper(null)}
                                        className="px-4 py-2 text-sm bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
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
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold font-display text-gray-900">Past Papers Library</h1>
                        <p className="text-gray-600 mt-1">Browse past papers organized by subject, year, and session. Free access for everyone!</p>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="Search subjects..."
                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-burgundy focus:border-brand-burgundy"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Call to Action Banner - Only show for non-logged-in users */}
                {!user && (
                    <div className="bg-gradient-to-r from-brand-burgundy to-brand-pink text-white rounded-xl p-6 mb-6 flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-bold mb-2">Want to track your progress?</h3>
                            <p className="text-white/90">Sign up for a free account to bookmark papers, track your learning, and get personalized recommendations.</p>
                        </div>
                        <button onClick={() => setAuthModal("sign-up")} className="px-6 py-3 bg-white text-brand-burgundy font-bold rounded-lg hover:bg-gray-100 transition-colors whitespace-nowrap">
                            Sign Up Free
                        </button>
                    </div>
                )}

                {/* Folder Tree */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    {filteredItems.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
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

            {/* Auth Modal */}
            {authModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={() => setAuthModal(null)}>
                    <div className="relative w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => setAuthModal(null)}
                            className="absolute -right-2 -top-2 z-10 bg-white rounded-full p-2 text-slate-700 hover:bg-brand-red hover:text-white transition-all shadow-lg"
                            aria-label="Close authentication modal"
                        >
                            <X size={20} />
                        </button>

                        <div className="mb-3 flex items-center gap-2 justify-center">
                            <button
                                onClick={() => setAuthModal("sign-in")}
                                className={`rounded-lg px-6 py-2.5 text-sm font-bold transition-all ${authModal === "sign-in" ? "bg-brand-burgundy text-white shadow-lg scale-105" : "bg-white/90 text-slate-700 hover:bg-white"}`}
                            >
                                Log In
                            </button>
                            <button
                                onClick={() => setAuthModal("sign-up")}
                                className={`rounded-lg px-6 py-2.5 text-sm font-bold transition-all ${authModal === "sign-up" ? "bg-brand-red text-white shadow-lg scale-105" : "bg-white/90 text-slate-700 hover:bg-white"}`}
                            >
                                Sign Up
                            </button>
                        </div>

                        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border-2 border-slate-200 overflow-hidden">
                            {authModal === "sign-in" ? (
                                <SignIn
                                    routing="hash"
                                    signUpUrl="/"
                                    afterSignInUrl="/past-papers"
                                    fallbackRedirectUrl="/past-papers"
                                    forceRedirectUrl="/past-papers"
                                    appearance={{
                                        elements: {
                                            card: "shadow-none border-0 bg-transparent",
                                            rootBox: "w-full",
                                            cardBox: "shadow-none w-full",
                                            main: "w-full",
                                            identityPreview: "hidden",
                                            identityPreviewText: "hidden",
                                            identityPreviewEditButton: "hidden",
                                            footerAction: "hidden",
                                            formButtonPrimary: "bg-brand-burgundy hover:bg-brand-burgundy/90 text-white font-bold",
                                            formFieldInput: "rounded-lg border-2 border-slate-200 focus:border-brand-burgundy",
                                            headerTitle: "text-brand-burgundy font-black text-2xl",
                                            headerSubtitle: "text-slate-500",
                                            socialButtonsBlockButton: "border-2 border-slate-300 hover:border-brand-burgundy transition-all",
                                            dividerLine: "bg-slate-300",
                                            dividerText: "text-slate-500",
                                        },
                                    }}
                                />
                            ) : (
                                <SignUp
                                    routing="hash"
                                    signInUrl="/"
                                    afterSignUpUrl="/past-papers"
                                    fallbackRedirectUrl="/past-papers"
                                    forceRedirectUrl="/past-papers"
                                    appearance={{
                                        elements: {
                                            card: "shadow-none border-0 bg-transparent",
                                            rootBox: "w-full",
                                            cardBox: "shadow-none w-full",
                                            main: "w-full",
                                            identityPreview: "hidden",
                                            identityPreviewText: "hidden",
                                            identityPreviewEditButton: "hidden",
                                            footerAction: "hidden",
                                            formButtonPrimary: "bg-brand-red hover:bg-brand-red/90 text-white font-bold",
                                            formFieldInput: "rounded-lg border-2 border-slate-200 focus:border-brand-red",
                                            headerTitle: "text-brand-red font-black text-2xl",
                                            headerSubtitle: "text-slate-500",
                                            socialButtonsBlockButton: "border-2 border-slate-300 hover:border-brand-red transition-all",
                                            dividerLine: "bg-slate-300",
                                            dividerText: "text-slate-500",
                                        },
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
