"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { PortalNotification, getNotifications } from "@/lib/portalAdmin";

// In-app notifications (§16.1) — batched by class/assignment, never per submission.
export default function NotificationsBell() {
  const router = useRouter();
  const [items, setItems] = useState<PortalNotification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void getNotifications().then(setItems).catch(() => {});
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (n: PortalNotification) => {
    setOpen(false);
    if (n.assignment_id) router.push(`/teacher/assignments/${n.assignment_id}`);
    else if (n.class_id) router.push(`/teacher/classes/${n.class_id}`);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} className="ed-btn-ghost p-2 relative" aria-label="Notifications">
        <Bell size={16} />
        {items.length > 0 && <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 grid place-items-center rounded-full bg-crimson text-paper text-[0.6rem] font-bold">{items.length}</span>}
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-2 md:bottom-auto md:top-full md:mb-0 md:mt-2 w-72 ed-card p-2 z-30 max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-xs text-ink-faint px-2 py-3 text-center">You&apos;re all caught up.</p>
          ) : (
            items.map((n, i) => (
              <button key={i} onClick={() => go(n)} className="w-full rounded-lg px-2.5 py-2 text-xs text-ink hover:bg-surface-soft text-left">
                {n.body}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
