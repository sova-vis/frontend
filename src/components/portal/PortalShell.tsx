"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ToastProvider } from "@/components/propel/primitives";
import { Icon } from "@/components/propel/Icon";
import { useUser, useClerk } from "@/lib/auth";

export interface NavItem { name: string; href: string; icon?: string }

function isActive(pathname: string | null, href: string, rootHref: string) {
  if (!pathname) return false;
  if (href === rootHref) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Shared shell for the owner + school-admin consoles. Mirrors the student side:
 * a translucent sticky top bar (editorial tokens) over `.pr`-scoped page content,
 * so the two consoles read as the same product. Content is wrapped in ToastProvider
 * so pages can useToast(), and the `.pr` root gets `anim-settled` after mount so the
 * staggered entrance can never get stuck if the tab was backgrounded.
 */
export default function PortalShell({
  nav,
  kicker,
  children,
}: {
  nav: NavItem[];
  kicker: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const prRef = useRef<HTMLDivElement>(null);
  const { user } = useUser();
  const { signOut } = useClerk();
  const [menuOpen, setMenuOpen] = useState(false);
  const rootHref = nav[0]?.href ?? "/";

  useEffect(() => {
    const el = prRef.current;
    if (!el) return;
    el.classList.remove("anim-settled");
    const t = setTimeout(() => el.classList.add("anim-settled"), 1300);
    return () => clearTimeout(t);
  }, [pathname]);

  const name = user?.fullName || user?.firstName || user?.email?.split("@")[0] || "You";
  const initial = (name[0] || "U").toUpperCase();

  return (
    <div className="min-h-screen bg-paper">
      <nav className="sticky top-0 z-50 border-b border-line bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-4 py-3 md:px-6">
          {/* Brand + role kicker */}
          <Link href={rootHref} className="flex items-center gap-3">
            <BrandLogo size={30} labelClassName="text-xl" />
            <span className="hidden items-center rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint sm:inline-flex">
              {kicker}
            </span>
          </Link>

          {/* Center nav pills */}
          <div className="hidden min-w-0 items-center lg:flex">
            <div className="inline-flex shrink-0 gap-1 rounded-full border border-line bg-surface/70 p-1 shadow-sm backdrop-blur">
              {nav.map((item) => {
                const active = isActive(pathname, item.href, rootHref);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? "bg-gradient-to-br from-crimson to-crimson-deep text-white shadow-crimson"
                        : "text-ink-muted hover:bg-surface hover:text-ink"
                    }`}
                  >
                    {item.icon && <Icon name={item.icon} size={15} />}
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right cluster */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 transition-shadow hover:shadow-sm"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-crimson to-crimson-deep text-[13px] font-semibold text-white">
                  {initial}
                </span>
                <span className="hidden max-w-[120px] truncate text-sm font-medium text-ink sm:block">{name}</span>
                <Icon name="chevron_down" size={15} className="text-ink-faint" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-2xl border border-line bg-surface shadow-lg">
                    <div className="border-b border-line px-4 py-3">
                      <p className="truncate text-sm font-semibold text-ink">{name}</p>
                      <p className="truncate text-xs text-ink-faint">{user?.email}</p>
                    </div>
                    <button
                      onClick={() => signOut({ redirectUrl: "/" })}
                      className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-medium text-ink-muted transition-colors hover:bg-surface-soft hover:text-crimson"
                    >
                      <Icon name="logout" size={16} /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Mobile nav pills */}
        <div className="border-t border-line px-3 py-2 lg:hidden">
          <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {nav.map((item) => {
              const active = isActive(pathname, item.href, rootHref);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                    active ? "bg-gradient-to-br from-crimson to-crimson-deep text-white" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {item.icon && <Icon name={item.icon} size={14} />}
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <div className="pr" ref={prRef}>
        <ToastProvider>
          <main className="main">{children}</main>
        </ToastProvider>
      </div>
    </div>
  );
}
