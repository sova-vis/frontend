/* ============================================================
   PROPEL — Exam countdown (single source of truth)
   Both the greeting line and the calendar chip on the dashboard
   read from here, so the number can never disagree between spots.
   Date-only math keeps it stable across timezones/hours.
   ============================================================ */

/** Next O-Level session target. One place to change it. */
export const EXAM_DATE = new Date("2026-10-06T00:00:00");
export const EXAM_SESSION_LABEL = "Oct 2026 session";

/** Whole days from local "today" to the exam date; never negative. */
export function daysUntilExam(now: Date = new Date()): number {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const examDay = new Date(EXAM_DATE.getFullYear(), EXAM_DATE.getMonth(), EXAM_DATE.getDate());
  return Math.max(0, Math.round((examDay.getTime() - startOfToday.getTime()) / 86_400_000));
}
