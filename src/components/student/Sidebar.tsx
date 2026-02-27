"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    FileText,
    Layers,
    Bookmark,
    PieChart,
    Settings,
    LogOut,
    ChevronLeft,
    MessageCircle,
    Home
} from "lucide-react";
import { motion } from "framer-motion";
import { useClerk } from "@clerk/nextjs";

const navItems = [
    { name: "Home", href: "/", icon: Home },
    { name: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
    { name: "Past Papers", href: "/student/past-papers", icon: FileText },
    { name: "Topicals", href: "/student/topicals", icon: Layers },
    { name: "Ask Question", href: "/student/ask", icon: MessageCircle },
    { name: "Bookmarks", href: "/student/bookmarks", icon: Bookmark },
    { name: "Progress", href: "/student/progress", icon: PieChart },
];

export default function StudentSidebar({ isOpen, onClose }: { isOpen?: boolean, onClose?: () => void }) {
    const pathname = usePathname();
    const { signOut } = useClerk();

    const handleLogout = async () => {
        try {
            console.log("Logging out...");
            await signOut({ redirectUrl: "/" });
            console.log("Logout successful");
        } catch (error) {
            console.error("Logout error:", error);
        } finally {
            if (onClose) onClose();
        }
    };

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden glassmorphism"
                    onClick={onClose}
                />
            )}

            <aside className={`fixed left-0 top-0 h-screen w-64 bg-white/90 backdrop-blur-xl border-r border-gray-100 flex flex-col z-50 transition-transform duration-300 ${isOpen ? "translate-x-0" : "-translate-x-full"
                }`}>
                <div className="p-8 pb-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold font-display text-primary tracking-tight">
                        Propel
                    </h1>
                    <button onClick={onClose} className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                        <ChevronLeft size={20} />
                    </button>
                    {/* Desktop Toggle - visible only on desktop */}
                    <button onClick={onClose} className="hidden md:block p-2 text-gray-400 hover:text-primary transition-colors hover:bg-gray-50 rounded-lg">
                        <ChevronLeft size={20} className={`transition-transform duration-300 ${!isOpen ? "rotate-180" : ""}`} />
                    </button>
                </div>

                <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto custom-scrollbar">
                    {navItems.map((item) => {
                        const isActive = (pathname || "").startsWith(item.href);

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={onClose}
                                className={`relative flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${isActive
                                    ? "text-primary bg-primary/5"
                                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                                    }`}
                            >
                                <item.icon size={20} />
                                <span>{item.name}</span>
                                {isActive && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full"
                                    />
                                )}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 mt-auto border-t border-gray-50 space-y-2">
                    <Link
                        href="/student/settings"
                        onClick={onClose}
                        className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-500 rounded-xl hover:text-gray-900 hover:bg-gray-50 transition-colors"
                    >
                        <Settings size={20} />
                        <span>Settings</span>
                    </Link>
                    <button 
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-500 rounded-xl hover:bg-red-50 transition-colors text-left"
                    >
                        <LogOut size={20} />
                        <span>Log Out</span>
                    </button>
                </div>
            </aside>
        </>
    );
}
