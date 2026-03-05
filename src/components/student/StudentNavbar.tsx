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
  Menu,
  X,
  ChevronDown,
  Play,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useClerk } from "@clerk/nextjs";
import { useUser } from "@clerk/nextjs";
import { useClerkAuth } from "@/lib/useClerkAuth";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const navItems = [
  { name: "Dashboard",   href: "/student/dashboard",   icon: LayoutDashboard },
  { name: "Past Papers", href: "/student/past-papers",  icon: FileText },
  { name: "Ask AI",      href: "/student/ask",          icon: MessageCircle },
  { name: "Bookmarks",   href: "/student/bookmarks",    icon: Bookmark },
];

export default function StudentNavbar() {
  const pathname = usePathname();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { profile } = useClerkAuth();

  const [mobileOpen, setMobileOpen] = useState(false);
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

  return (
    <>
      <nav className="sticky top-0 z-50 h-[74px] bg-white dark:bg-gray-950 border-b border-gray-200/80 dark:border-gray-800 shadow-[0_1px_0_rgba(15,23,42,0.06)]">
        <div className="max-w-[1360px] mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">

          {/* Logo — matches landing page */}
          <Link href="/student/dashboard" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-9 h-9 bg-primary rounded-tr-[14px] rounded-bl-[14px] flex items-center justify-center shadow-md shadow-primary/20">
              <Play className="w-4 h-4 text-white fill-white ml-0.5" />
            </div>
            <span className="font-black font-display text-primary text-[30px] tracking-tight hidden sm:block">Propel</span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden lg:flex items-center gap-7 flex-1 justify-center">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative px-1 py-1.5 text-[17px] font-semibold transition-colors duration-150 ${
                    active
                      ? "text-gray-900 dark:text-gray-100"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                  }`}
                >
                  <span>{item.name}</span>
                  {active && (
                    <motion.div
                      layoutId="navActive"
                      className="absolute -bottom-[6px] left-0 right-0 h-0.5 bg-primary rounded-full"
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 flex-shrink-0">

            {/* Dark/Light toggle */}
            <ThemeToggle className="hidden sm:block shrink-0 h-9 w-9" />

            {/* Profile dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen((v) => !v)}
                className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-full border border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-primary/20 shadow-sm">
                  <Image src={photoUrl} alt="Profile" width={32} height={32} className="w-full h-full object-cover" />
                </div>
                <span className="hidden sm:block text-sm font-semibold text-gray-700 dark:text-gray-200 max-w-[100px] truncate">{name}</span>
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

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="lg:hidden p-2 text-gray-500 dark:text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="lg:hidden fixed left-0 top-0 h-full w-72 bg-white dark:bg-gray-900 z-50 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
                <Link href="/student/dashboard" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
                  <div className="w-9 h-9 bg-primary rounded-tr-[14px] rounded-bl-[14px] flex items-center justify-center shadow-lg shadow-primary/20">
                    <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                  </div>
                  <span className="font-black font-display text-primary text-xl">Propel</span>
                </Link>
                <button onClick={() => setMobileOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-lg">
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
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                        active ? "text-primary bg-primary/10" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
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
                  onClick={() => setMobileOpen(false)}
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

      {/* Backdrop for profile dropdown */}
      {profileOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
      )}
    </>
  );
}
