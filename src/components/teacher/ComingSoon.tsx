"use client";

import { LucideIcon } from "lucide-react";

/**
 * Styled placeholder for portal destinations whose feature phase is not yet
 * built, so top-level nav never dead-ends on a blank page.
 */
export default function ComingSoon({
  title,
  icon: Icon,
  blurb,
}: {
  title: string;
  icon: LucideIcon;
  blurb: string;
}) {
  return (
    <div className="px-4 md:px-8 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">{title}</h1>
        <div className="ed-card p-10 mt-6 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-crimson-soft text-crimson-ink">
            <Icon size={26} />
          </div>
          <p className="mt-4 text-ink-muted max-w-md mx-auto">{blurb}</p>
        </div>
      </div>
    </div>
  );
}
