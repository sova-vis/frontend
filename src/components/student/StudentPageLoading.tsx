"use client";

import { Loader2 } from "lucide-react";

export default function StudentPageLoading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="min-h-[420px] flex items-center justify-center p-8">
      <div className="text-center">
        <div className="mx-auto mb-4 h-14 w-14 rounded-2xl border border-gray-200 bg-white shadow-sm flex items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
        <p className="text-sm font-semibold text-gray-700">{label}</p>
      </div>
    </div>
  );
}
