"use client";

import PropelLoader from "@/components/ui/PropelLoader";

export default function StudentPageLoading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="min-h-[420px] flex items-center justify-center p-8">
      <PropelLoader label={label} />
    </div>
  );
}
