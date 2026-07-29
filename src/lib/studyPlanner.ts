/* ============================================================
   PROPEL — Study Planner (Phase 6)
   Builds a calendar-based study timetable from the exam date and
   the student's available days, distributing weak topics, due
   revisions and occasional mixed papers across sessions.
   ============================================================ */

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface TopicRef { topic: string; subject: string }

export interface StudySession {
  date: string;
  label: string;
  weekIndex: number;
  focus: string;
  detail: string;
  minutes: number;
  href: string;
  icon: string;
  tone: string;
}

export function buildStudyPlan(opts: {
  weekdays: number[];              // 0=Sun … 6=Sat
  minutesPerSession: number;
  examDate: Date;
  weakTopics: TopicRef[];
  revisions: TopicRef[];
  now?: number;
  maxSessions?: number;
}): StudySession[] {
  const { weekdays, minutesPerSession, examDate, weakTopics, revisions } = opts;
  const now = opts.now ?? Date.now();
  const maxSessions = opts.maxSessions ?? 24;
  if (weekdays.length === 0) return [];

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const startWeek = Math.floor(start.getTime() / (7 * 86_400_000));

  const link = (t: TopicRef) => `/student/paper-practice?subject=${encodeURIComponent(t.subject)}&topic=${encodeURIComponent(t.topic)}`;
  const sessions: StudySession[] = [];
  let weakIdx = 0;
  let revIdx = 0;

  for (let d = 1; d <= 160 && sessions.length < maxSessions; d++) {
    const day = new Date(start.getTime() + d * 86_400_000);
    if (day.getTime() > examDate.getTime()) break;
    if (!weekdays.includes(day.getDay())) continue;

    const i = sessions.length;
    let session: Omit<StudySession, "date" | "label" | "weekIndex">;
    if (i % 5 === 4) {
      session = { focus: "Mixed paper", detail: `${minutesPerSession}-min timed set`, minutes: minutesPerSession, href: "/student/generate", icon: "bolt", tone: "crimson" };
    } else if (revisions.length > 0 && i % 3 === 2) {
      const r = revisions[revIdx++ % revisions.length];
      session = { focus: `Revise ${r.topic}`, detail: r.subject, minutes: minutesPerSession, href: link(r), icon: "rotate", tone: "purple" };
    } else if (weakTopics.length > 0) {
      const w = weakTopics[weakIdx++ % weakTopics.length];
      session = { focus: `Practise ${w.topic}`, detail: w.subject, minutes: minutesPerSession, href: link(w), icon: "sparkles", tone: "crimson" };
    } else {
      session = { focus: "Practice session", detail: "Pick a topic to drill", minutes: minutesPerSession, href: "/student/paper-practice", icon: "book", tone: "crimson" };
    }
    sessions.push({
      ...session,
      date: day.toISOString(),
      weekIndex: Math.floor(day.getTime() / (7 * 86_400_000)) - startWeek,
      label: day.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }),
    });
  }
  return sessions;
}

export const weekdayName = (d: number) => WEEKDAY_NAMES[d];
export const DEFAULT_WEEKDAYS = [1, 2, 3, 4, 5]; // Mon–Fri
