"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, ClipboardList, Home, LogOut, Settings, Users } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import NotificationsBell from "@/components/teacher/NotificationsBell";
import { useClerkAuth } from "@/lib/useClerkAuth";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
}

// Information architecture — five top-level destinations (spec §5). Grading
// review lives inside Assignments as a lifecycle stage, not its own nav item.
const NAV: NavItem[] = [
  { href: "/teacher/dashboard", label: "Home", icon: Home },
  { href: "/teacher/classes", label: "Classes", icon: Users },
  { href: "/teacher/assignments", label: "Assignments", icon: ClipboardList },
  { href: "/teacher/insights", label: "Insights", icon: BarChart3 },
  { href: "/teacher/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/teacher/dashboard") return pathname === href || pathname === "/teacher";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function TeacherShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const { profile, user, signOut } = useClerkAuth();

  const displayName = profile?.full_name || user?.primaryEmailAddress?.emailAddress || "Teacher";

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* ---- Desktop sidebar ---- */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-60 border-r border-line bg-paper-soft">
        <div className="px-6 py-6">
          <Link href="/teacher/dashboard" className="font-display text-xl font-semibold tracking-tight text-ink">
            Propel<span className="text-crimson">.</span>
          </Link>
          <p className="ed-label mt-1">Teacher Portal</p>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                  active ? "bg-crimson-soft text-crimson-ink" : "text-ink-muted hover:bg-surface-soft hover:text-ink"
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-line">
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-ink-muted truncate">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-paper text-xs font-bold">
              {displayName.slice(0, 2).toUpperCase()}
            </div>
            <span className="truncate">{displayName}</span>
          </div>
          <div className="mt-2 flex items-center gap-2 px-1">
            <ThemeToggle />
            <NotificationsBell />
            <button
              onClick={() => void signOut()}
              className="ed-btn-ghost flex-1 justify-center px-3 py-2 text-xs"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* ---- Mobile top bar ---- */}
      <header className="md:hidden sticky top-0 z-20 flex items-center justify-between border-b border-line bg-paper/90 backdrop-blur px-4 py-3">
        <Link href="/teacher/dashboard" className="font-display text-lg font-semibold tracking-tight">
          Propel<span className="text-crimson">.</span>
        </Link>
        <div className="flex items-center gap-2">
          <NotificationsBell />
          <ThemeToggle />
          <button onClick={() => void signOut()} className="ed-btn-ghost px-3 py-2 text-xs">
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* ---- Main content ---- */}
      <main className="md:pl-60 pb-24 md:pb-0">{children}</main>

      {/* ---- Mobile bottom nav (action queue usable at 375px — §2.7) ---- */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 grid grid-cols-5 border-t border-line bg-paper/95 backdrop-blur">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <button
              key={href}
              onClick={() => router.push(href)}
              className={`flex flex-col items-center gap-1 py-2.5 text-[0.65rem] font-semibold ${
                active ? "text-crimson" : "text-ink-faint"
              }`}
            >
              <Icon size={20} />
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
