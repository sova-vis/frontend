"use client";

/**
 * Route-level Pro gate for the student workspace. Mounted once in the student
 * layout around {children}: if the current path is a Pro feature and the user
 * isn't entitled (and billing is enforced), it shows the ProGate lock panel
 * instead of the page — so the page never mounts / fetches while locked.
 *
 * FREE routes (never listed here): dashboard, past-papers, past-papers-drive,
 * datesheet, subjects, settings, classroom, teachers, assignments, goals,
 * bookmarks. Past Papers stays free forever.
 */
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import ProGate from './ProGate';

const PRO_PREFIXES: { prefix: string; feature: string }[] = [
  { prefix: '/student/ask', feature: 'Ask AI' },
  { prefix: '/student/notebook', feature: 'Your Mistake Notebook' },
  { prefix: '/student/progress', feature: 'Analytics' },
  { prefix: '/student/planner', feature: 'Study Planner' },
  { prefix: '/student/practise', feature: 'Practice' },
  { prefix: '/student/paper-practice', feature: 'Practice' },
  { prefix: '/student/topicals', feature: 'Topical Practice' },
  { prefix: '/student/generate', feature: 'AI Paper Generator' },
  { prefix: '/student/upload-check', feature: 'Upload & Check' },
  { prefix: '/student/qa-grading', feature: 'AI Marking' },
  { prefix: '/student/paper-parser', feature: 'Paper Parser' },
];

export default function ProRouteGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '';
  const match = PRO_PREFIXES.find((p) => pathname.startsWith(p.prefix));
  if (!match) return <>{children}</>;
  return <ProGate feature={match.feature}>{children}</ProGate>;
}
