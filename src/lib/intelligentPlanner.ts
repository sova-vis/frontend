// Intelligent study-plan builder. Given the student's availability (which
// weekdays, minutes/day), which subjects they feel weak in, each subject's exam
// date and topic list, it lays out day-by-day sessions — front-loading weaker
// subjects and subjects whose exams are sooner, and stopping a subject once its
// exam has passed.

const DAY = 86_400_000;

export interface PlanSession {
  date: string;          // yyyy-mm-dd
  weekIndex: number;     // 0 = this week
  subject: string;
  topic: string | null;
  minutes: number;
  weak: boolean;
  daysToExam: number | null;
}

export interface PlanInput {
  weekdays: number[];                              // 0 (Sun) – 6 (Sat)
  minutes: number;
  weakSubjects: string[];                          // subjects the student flagged weak
  subjects: string[];                              // all selected subjects
  examDateBySubject: Record<string, string | null>;
  topicsBySubject: Record<string, string[]>;
  weakTopicsBySubject?: Record<string, string[]>;  // from marked work, prioritised first
  maxWeeks?: number;
}

export function buildIntelligentPlan(input: PlanInput): PlanSession[] {
  const { weekdays, minutes, subjects } = input;
  if (!subjects.length || !weekdays.length) return [];

  const today = new Date(new Date().toDateString());
  const t0 = today.getTime();
  const weakSet = new Set(input.weakSubjects.map((s) => s.toLowerCase()));
  const examMs = (s: string) => { const d = input.examDateBySubject[s]; const ms = d ? new Date(d).getTime() : NaN; return Number.isNaN(ms) ? null : ms; };

  // Horizon: up to the last exam, capped; fall back to 8 weeks if no dates.
  const maxDays = (input.maxWeeks ?? 12) * 7;
  const examDays = subjects.map(examMs).filter((x): x is number => x != null);
  const horizon = examDays.length ? Math.min(t0 + maxDays * DAY, Math.max(...examDays)) : t0 + Math.min(maxDays, 56) * DAY;

  // Weight: weaker subjects and sooner exams get more sessions.
  const weights: Record<string, number> = {};
  for (const s of subjects) {
    let w = weakSet.has(s.toLowerCase()) ? 2.2 : 1;
    const e = examMs(s);
    if (e != null) { const d = Math.max(1, Math.round((e - t0) / DAY)); w *= 1 + Math.min(2, 45 / d); }
    weights[s] = w;
  }

  const topicsFor = (s: string): string[] => {
    const weak = input.weakTopicsBySubject?.[s] ?? [];
    const rest = (input.topicsBySubject[s] ?? []).filter((t) => !weak.includes(t));
    return [...weak, ...rest];
  };

  const assigned: Record<string, number> = {};
  const topicIdx: Record<string, number> = {};
  subjects.forEach((s) => { assigned[s] = 0; topicIdx[s] = 0; });

  const sessions: PlanSession[] = [];
  for (let t = t0; t <= horizon; t += DAY) {
    const date = new Date(t);
    if (!weekdays.includes(date.getDay())) continue;

    // Only subjects whose exam hasn't passed (unknown dates always eligible).
    const eligible = subjects.filter((s) => { const e = examMs(s); return e == null || e >= t; });
    if (!eligible.length) break;

    // Weighted round-robin: the subject furthest behind its share goes next.
    const pick = eligible.reduce((a, b) => (assigned[a] / weights[a] <= assigned[b] / weights[b] ? a : b));
    assigned[pick] += 1;

    const topics = topicsFor(pick);
    const topic = topics.length ? topics[topicIdx[pick] % topics.length] : null;
    topicIdx[pick] += 1;

    const e = examMs(pick);
    sessions.push({
      date: date.toISOString().slice(0, 10),
      weekIndex: Math.floor((t - t0) / (7 * DAY)),
      subject: pick,
      topic,
      minutes,
      weak: weakSet.has(pick.toLowerCase()),
      daysToExam: e != null ? Math.max(0, Math.round((e - t) / DAY)) : null,
    });
  }
  return sessions;
}
