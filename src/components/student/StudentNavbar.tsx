"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { useClerk, useUser } from "@clerk/nextjs";
import { useClerkAuth } from "@/lib/useClerkAuth";

const navItems = [
  { name: "Dashboard", href: "/student/dashboard" },
  { name: "Paper Practice", href: "/student/paper-practice" },
  { name: "Papers", href: "/student/past-papers" },
  { name: "Ask AI", href: "/student/ask" },
];

function isActivePath(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/student/dashboard") return pathname === href;
  return pathname.startsWith(href);
}

export default function StudentNavbar() {
  const pathname = usePathname();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { profile } = useClerkAuth();
  const [profileOpen, setProfileOpen] = useState(false);

  const name = profile?.full_name || user?.firstName || "Student";
  const initial = name.trim().charAt(0).toUpperCase() || "S";
  const photoUrl = user?.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;

  const handleLogout = async () => {
    await signOut({ redirectUrl: "/" });
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-[#1C1714]/[.08] bg-[#FAF6F0]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-3 px-4 py-4 md:px-7 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center justify-between gap-4">
          <Link href="/student/dashboard" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#A8123C] to-[#760B28] font-display text-lg font-bold text-white shadow-[0_6px_16px_rgba(168,18,60,.28)]">
              P
            </div>
            <span className="font-display text-2xl font-semibold tracking-tight text-[#A8123C]">Propel</span>
          </Link>

          <div className="relative lg:hidden">
            <button
              onClick={() => setProfileOpen((value) => !value)}
              className="flex items-center gap-2 rounded-full border border-[#1C1714]/[.09] bg-white/75 py-1 pl-1 pr-2 shadow-sm"
            >
              <div className="h-8 w-8 overflow-hidden rounded-full bg-[#A8123C]">
                {user?.imageUrl ? (
                  <Image src={photoUrl} alt={name} width={32} height={32} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-sm font-bold text-white">{initial}</span>
                )}
              </div>
              <ChevronDown size={14} className={`text-[#6B5F57] transition-transform ${profileOpen ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>

        <div className="flex min-w-0 justify-start overflow-x-auto lg:justify-center">
          <div className="inline-flex shrink-0 gap-1 rounded-full border border-[#1C1714]/[.09] bg-white/70 p-1 shadow-sm backdrop-blur">
            {navItems.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    active ? "bg-[#1C1714] text-[#FAF6F0]" : "text-[#6B5F57] hover:bg-white hover:text-[#1C1714]"
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="relative hidden lg:block">
          <button
            onClick={() => setProfileOpen((value) => !value)}
            className="flex items-center gap-2 rounded-full border border-[#1C1714]/[.09] bg-white/75 py-1 pl-1 pr-3 shadow-sm transition hover:border-[#1C1714]/[.16]"
          >
            <div className="h-8 w-8 overflow-hidden rounded-full bg-[#A8123C]">
              {user?.imageUrl ? (
                <Image src={photoUrl} alt={name} width={32} height={32} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-sm font-bold text-white">{initial}</span>
              )}
            </div>
            <span className="max-w-[120px] truncate text-sm font-semibold text-[#1C1714]">{name}</span>
            <ChevronDown size={14} className={`text-[#6B5F57] transition-transform ${profileOpen ? "rotate-180" : ""}`} />
          </button>
        </div>

        {profileOpen && (
          <>
            <button className="fixed inset-0 z-40 cursor-default" aria-label="Close profile menu" onClick={() => setProfileOpen(false)} />
            <div className="absolute right-4 top-[72px] z-50 w-60 overflow-hidden rounded-lg border border-[#1C1714]/[.09] bg-white shadow-xl md:right-7 lg:top-[58px]">
              <div className="border-b border-[#1C1714]/[.08] bg-[#FAF6F0] px-4 py-3">
                <p className="truncate text-sm font-bold text-[#1C1714]">{name}</p>
                <p className="mt-0.5 truncate text-xs text-[#6B5F57]">{user?.primaryEmailAddress?.emailAddress}</p>
              </div>
              <div className="py-1">
                <Link
                  href="/student/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-[#6B5F57] transition hover:bg-[#FAF6F0] hover:text-[#1C1714]"
                >
                  <Settings size={15} />
                  Settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-[#A8123C] transition hover:bg-[#F6E1E7]"
                >
                  <LogOut size={15} />
                  Log Out
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </nav>
  );
}
