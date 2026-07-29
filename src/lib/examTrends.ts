/* ============================================================
   PROPEL — Exam Paper Trend Analyzer (Phase 6)
   Ranks topics by how frequently they appear across the past-paper
   bank. Framed as historical trend analysis (what's examined most),
   NOT a prediction of what will appear.
   ============================================================ */

export interface TopicTrend {
  subject: string;
  topic: string;
  count: number;
  share: number; // % of that subject's questions on this topic
}

interface MetaTopic { name: string; count: number }
interface MetaSubject { name: string; types: { structured: { topics: MetaTopic[] }; mcq: { topics: MetaTopic[] } } }

/** Topic frequency across the bank, per subject, most-examined first. */
export async function loadTopicTrends(): Promise<TopicTrend[]> {
  try {
    const res = await fetch("/api/paper-practice");
    if (!res.ok) return [];
    const data = (await res.json()) as { subjects?: MetaSubject[] };
    const trends: TopicTrend[] = [];
    for (const s of data.subjects ?? []) {
      const counts = new Map<string, number>();
      for (const type of ["structured", "mcq"] as const) {
        for (const t of s.types[type].topics ?? []) counts.set(t.name, (counts.get(t.name) ?? 0) + t.count);
      }
      const subjectTotal = Array.from(counts.values()).reduce((a, b) => a + b, 0) || 1;
      for (const [topic, count] of Array.from(counts.entries())) {
        if (!topic || topic === "Uncategorised") continue;
        trends.push({ subject: s.name, topic, count, share: Math.round((count / subjectTotal) * 100) });
      }
    }
    return trends.sort((a, b) => b.count - a.count);
  } catch { return []; }
}
