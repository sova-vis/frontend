"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Bookmark,
  Settings,
  LogOut,
  MessageCircle,
  ClipboardCheck,
  GraduationCap,
  LibraryBig,
  Braces,
  BookOpenCheck,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useClerk, useUser } from "@clerk/nextjs";
import { useClerkAuth } from "@/lib/useClerkAuth";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { BrandLogo } from "@/components/ui/Logo";

const navItems = [
  { name: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
  { name: "Subjects", href: "/student/subjects", icon: LibraryBig },
  { name: "Past Papers", href: "/student/past-papers", icon: FileText },
  { name: "Paper Practice", href: "/student/paper-practice", icon: BookOpenCheck },
  { name: "Practise", href: "/student/practise", icon: Braces },
  { name: "Ask AI", href: "/student/ask", icon: MessageCircle },
  { name: "Q/A Grading", href: "/student/qa-grading", icon: ClipboardCheck },
  { name: "Teachers", href: "/student/teachers", icon: GraduationCap },
  { name: "Bookmarks", href: "/student/bookmarks", icon: Bookmark },
];

export default function StudentNavbar() {
  const pathname = usePathname();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { profile } = useClerkAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const name = profile?.full_name || user?.firstName || "Student";
  const photoUrl = user?.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;

  const handleLogout = async () => {
    await signOut({ redirectUrl: "/" });
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return (pathname || "").startsWith(href);
  };

  const activeItem = navItems.find((item) => isActive(item.href));

  return (
    <>
      <nav className="sticky top-0 z-50 h-[76px] bg-white/90 dark:bg-gray-950/90 backdrop-blur-xl border-b border-gray-200/80 dark:border-gray-800 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <div className="max-w-[1360px] mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMenuOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:bg-gray-50 hover:text-primary dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
              aria-label="Open student menu"
            >
              <Menu size={20} />
            </button>

            <Link href="/student/dashboard" className="flex-shrink-0">
              <BrandLogo
                size={36}
                className="hidden sm:flex"
                labelClassName="text-[26px] text-primary dark:text-white"
              />
              <BrandLogo size={36} className="sm:hidden" label="" />
            </Link>
          </div>

          <div className="hidden min-w-0 flex-1 items-center justify-center sm:flex">
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-bold text-gray-700 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
              {activeItem && <activeItem.icon size={15} className="text-primary" />}
              <span className="truncate">{activeItem?.name ?? "Student"}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <ThemeToggle className="hidden sm:block shrink-0 h-9 w-9" />

            <div className="relative">
              <button
                onClick={() => setProfileOpen((value) => !value)}
                className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-full border border-gray-200 bg-white shadow-sm hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700 transition-colors"
              >
                <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-primary/20 shadow-sm">
                  <Image src={photoUrl} alt="Profile" width={32} height={32} className="w-full h-full object-cover" />
                </div>
                <span className="hidden sm:block text-sm font-semibold text-gray-700 dark:text-gray-200 max-w-[100px] truncate">
                  {name}
                </span>
                <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-2xl shadow-gray-200/60 dark:shadow-gray-950/60 overflow-hidden z-50"
                  >
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/60">
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{name}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{user?.primaryEmailAddress?.emailAddress}</p>
                    </div>
                    <div className="py-1">
                      <Link
                        href="/student/settings"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                      >
                        <Settings size={15} />
                        Settings
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <LogOut size={15} />
                        Log Out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 h-full w-[min(320px,85vw)] bg-white dark:bg-gray-900 z-50 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
                <Link href="/student/dashboard" className="flex items-center gap-2.5" onClick={() => setMenuOpen(false)}>
                  <BrandLogo size={32} labelClassName="text-xl text-primary dark:text-white" />
                </Link>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-lg"
                  aria-label="Close student menu"
                >
                  <X size={20} />
                </button>
              </div>

              <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">
                {navItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                        active
                          ? "text-primary bg-primary/10"
                          : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      <item.icon size={18} />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>

              <div className="p-4 border-t border-gray-100 dark:border-gray-800 space-y-0.5">
                <Link
                  href="/student/settings"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <Settings size={18} />
                  Settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <LogOut size={18} />
                  Log Out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {profileOpen && <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />}
    </>
  );
}
