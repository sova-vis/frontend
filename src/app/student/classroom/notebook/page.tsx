"use client";

import { useEffect, useMemo, useState } from "react";
import { BookMarked, Target } from "lucide-react";
import { Classroom, WeakTopic, getMyClassrooms, getWeakSpots } from "@/lib/submissions";

// Classroom notebook: pick a class to see the mistakes from that teacher's
// marked work, grouped by topic.
export default function ClassroomNotebookPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [topics, setTopics] = useState<WeakTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTopics, setLoadingTopics] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const c = await getMyClassrooms();
        setClassrooms(c.filter((x) => x.enrollment_status === "active"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    setLoadingTopics(true);
    void getWeakSpots(selected || undefined)
      .then((r) => setTopics(r.topics))
      .catch(() => setTopics([]))
      .finally(() => setLoadingTopics(false));
  }, [selected]);

  const totalMistakes = useMemo(() => topics.reduce((s, t) => s + t.missed, 0), [topics]);
  const selectedName = classrooms.find((c) => c.class_id === selected);

  return (
    <div className="min-h-screen bg-paper text-ink px-4 md:px-8 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <BookMarked size={20} className="text-crimson" />
          <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">Notebook</h1>
        </div>
        <p className="text-ink-muted -mt-3">The mistakes from your marked classroom work, so you know exactly what to revise.</p>

        {/* Class selector */}
        {!loading && classrooms.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setSelected("")} className={`rounded-full px-4 py-2 text-sm font-semibold border ${!selected ? "border-crimson bg-crimson-soft text-crimson-ink" : "border-line text-ink-muted hover:bg-surface-soft"}`}>
              All classes
            </button>
            {classrooms.map((c) => (
              <button key={c.class_id} onClick={() => setSelected(c.class_id)} className={`rounded-full px-4 py-2 text-sm font-semibold border ${selected === c.class_id ? "border-crimson bg-crimson-soft text-crimson-ink" : "border-line text-ink-muted hover:bg-surface-soft"}`}>
                {c.subject} <span className="text-ink-faint font-normal">· {c.teacher_name}</span>
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="h-40 rounded-[1.25rem] bg-surface-soft animate-pulse" />
        ) : classrooms.length === 0 ? (
          <div className="ed-card p-10 text-center text-ink-muted">Join a class to build your notebook from marked work.</div>
        ) : (
          <section className="ed-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target size={17} className="text-crimson" />
                <h2 className="font-display text-lg font-semibold">Mistakes{selectedName ? ` · ${selectedName.subject}` : ""}</h2>
              </div>
              {topics.length > 0 && <span className="ed-pill-crimson text-[0.65rem]">{totalMistakes} to revise</span>}
            </div>

            {loadingTopics ? (
              <div className="h-24 rounded-xl bg-surface-soft animate-pulse" />
            ) : topics.length === 0 ? (
              <p className="text-sm text-ink-faint">No mistakes recorded yet{selectedName ? " for this class" : ""} — they appear here once your teacher marks and releases your work.</p>
            ) : (
              <div className="space-y-3">
                {topics.map((t) => (
                  <div key={t.topic} className="ed-card-soft p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-ink">{t.topic}</p>
                      <span className="ed-pill-crimson text-[0.6rem]">{t.missed} mistake{t.missed === 1 ? "" : "s"} · {t.accuracy}% accuracy</span>
                    </div>
                    {t.mistakes.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {t.mistakes.map((m, i) => (
                          <li key={i} className="text-sm text-ink-muted flex gap-2"><span className="text-crimson mt-0.5">✗</span><span>{m}</span></li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
