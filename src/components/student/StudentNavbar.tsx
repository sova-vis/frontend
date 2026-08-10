"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, School, Settings } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import LevelToggle from "@/components/student/LevelToggle";
import StudentSettingsModal from "@/components/student/StudentSettingsModal";

// Classroom is its own workspace — a reduced nav (no Practice / Papers).
const CLASSROOM_NAV = [
  { name: "Dashboard", href: "/student/classroom" },
  { name: "Notebook", href: "/student/notebook" },
  { name: "Planner", href: "/student/planner" },
  { name: "Ask AI", href: "/student/ask" },
];

const PERSONAL_NAV = [
  { name: "Dashboard", href: "/student/dashboard" },
  { name: "Practice", href: "/student/paper-practice" },
  { name: "Papers", href: "/student/past-papers" },
  { name: "Notebook", href: "/student/notebook" },
  { name: "Planner", href: "/student/planner" },
  { name: "Ask AI", href: "/student/ask" },
];

const MODE_KEY = "propel_mode";
type Mode = "personal" | "classroom";

function isActivePath(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/student/dashboard") return pathname === href;
  return pathname.startsWith(href);
}

export default function StudentNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("personal");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [transition, setTransition] = useState<Mode | null>(null);

  // Mode is sticky: the two dashboards set it; shared tools (Notebook/Planner/
  // Ask AI) keep whatever was last active, so classroom tabs stay in classroom.
  useEffect(() => {
    const stored = (window.localStorage.getItem(MODE_KEY) as Mode) || "personal";
    let m: Mode = stored;
    if (pathname === "/student/classroom") m = "classroom";
    else if (pathname === "/student/dashboard") m = "personal";
    if (m !== stored) window.localStorage.setItem(MODE_KEY, m);
    setMode(m);
  }, [pathname]);

  const navItems = mode === "classroom" ? CLASSROOM_NAV : PERSONAL_NAV;
  const showLevelToggle = mode === "personal" && isActivePath(pathname, "/student/past-papers");

  const switchMode = (target: Mode) => {
    if (target === mode) return;
    window.localStorage.setItem(MODE_KEY, target);
    setTransition(target);
    // Navigate under the overlay, then fade it out.
    window.setTimeout(() => {
      router.push(target === "classroom" ? "/student/classroom" : "/student/dashboard");
      window.setTimeout(() => setTransition(null), 450);
    }, 650);
  };

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-line bg-paper/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-3 px-4 py-3.5 md:px-7 lg:flex-row lg:items-center lg:justify-between">
          {/* Brand + (mobile) right cluster */}
          <div className="flex items-center justify-between gap-4">
            <Link href={mode === "classroom" ? "/student/classroom" : "/student/dashboard"} className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-crimson to-crimson-deep font-display text-lg font-bold text-white shadow-[0_6px_16px_rgba(168,18,60,.28)]">P</div>
              <span className="font-display text-2xl font-semibold tracking-tight text-crimson">Propel</span>
            </Link>
            <div className="flex items-center gap-2 lg:hidden">
              <ModeToggle mode={mode} onSwitch={switchMode} />
              <SettingsButton onClick={() => setSettingsOpen(true)} />
            </div>
          </div>

          {/* Center nav */}
          <div className="flex min-w-0 items-center justify-start gap-2 overflow-x-auto lg:justify-center">
            <div className="inline-flex shrink-0 gap-1 rounded-full border border-line bg-surface/70 p-1 shadow-sm backdrop-blur">
              {navItems.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${active ? "bg-gradient-to-br from-crimson to-crimson-deep text-white shadow-crimson" : "text-ink-muted hover:bg-surface hover:text-ink"}`}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </div>
            {showLevelToggle && <LevelToggle className="lg:hidden" />}
          </div>

          {/* Right: Personal/Classroom + single settings icon */}
          <div className="hidden items-center gap-2 lg:flex">
            {showLevelToggle && <LevelToggle />}
            <ModeToggle mode={mode} onSwitch={switchMode} />
            <SettingsButton onClick={() => setSettingsOpen(true)} />
          </div>
        </div>
      </nav>

      {settingsOpen && <StudentSettingsModal onClose={() => setSettingsOpen(false)} />}

      <AnimatePresence>
        {transition && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 z-[70] grid place-items-center bg-paper"
          >
            <motion.div initial={{ scale: 0.8, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 220, damping: 18 }} className="text-center">
              <div className={`mx-auto grid h-20 w-20 place-items-center rounded-3xl ${transition === "classroom" ? "bg-crimson-soft text-crimson-ink" : "bg-mint-soft text-mint-ink"}`}>
                {transition === "classroom" ? <School size={34} /> : <LayoutGrid size={34} />}
              </div>
              <p className="font-display text-2xl font-semibold mt-4">
                {transition === "classroom" ? "Entering your Classroom" : "Back to your space"}
              </p>
              <motion.div className="h-1 rounded-full bg-crimson mt-4 mx-auto" initial={{ width: 0 }} animate={{ width: 120 }} transition={{ duration: 0.9, ease: "easeInOut" }} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Settings" className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-ink hover:bg-surface-soft transition-colors">
      <Settings size={17} />
    </button>
  );
}

// Personal / Classroom mode switch with a smooth cross-fade transition.
function ModeToggle({ mode, onSwitch }: { mode: Mode; onSwitch: (m: Mode) => void }) {
  return (
    <div className="inline-flex gap-1 rounded-full border border-line bg-surface/70 p-1 shadow-sm">
      <button
        onClick={() => onSwitch("personal")}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${mode === "personal" ? "bg-gradient-to-br from-crimson to-crimson-deep text-white" : "text-ink-muted hover:text-ink"}`}
      >
        <LayoutGrid size={13} /> Personal
      </button>
      <button
        onClick={() => onSwitch("classroom")}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${mode === "classroom" ? "bg-gradient-to-br from-crimson to-crimson-deep text-white" : "text-ink-muted hover:text-ink"}`}
      >
        <School size={13} /> Classroom
      </button>
    </div>
  );
}
