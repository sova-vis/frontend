"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Sparkles, Target } from "lucide-react";
import { cacheGet, cacheSet } from "@/lib/sessionCache";
import { loadSelectedSubjects } from "@/lib/studentPersonalization";

export interface WeakItem { subject?: string | null; topic: string; accuracy: number; }
interface TopicMeta { name: string; count: number }
interface SubjMeta { name: string; types: { mcq?: { topics?: TopicMeta[] }; structured?: { topics?: TopicMeta[] } } }

const normSubj = (s: string) => s.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/\d+/g, " ").replace(/[^a-z]+/g, " ").trim();

// Weak points organised by the student's chosen subjects: each subject is a
// dropdown that reveals its topics, with accuracy shown for topics they've been
// marked on. Works for brand-new students (topics come from the paper library).
export default function WeakPointsBySubject({ weak }: { weak: WeakItem[] }) {
  const [meta, setMeta] = useState<SubjMeta[] | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const read = () => setSubjects(loadSelectedSubjects().map((s) => s.name));
    read();
    window.addEventListener("propel:selected-subjects-change", read);
    return () => window.removeEventListener("propel:selected-subjects-change", read);
  }, []);

  useEffect(() => {
    const cached = cacheGet<SubjMeta[]>("pp:practice:subjects", 30 * 60 * 1000);
    if (cached && cached.length) { setMeta(cached); return; }
    fetch("/api/paper-practice")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.subjects) { setMeta(d.subjects); cacheSet("pp:practice:subjects", d.subjects); } })
      .catch(() => {});
  }, []);

  const topicsFor = useMemo(() => (subject: string): string[] => {
    if (!meta) return [];
    const n = normSubj(subject);
    const m = meta.find((x) => { const f = normSubj(x.name); return f === n || f.startsWith(`${n} `) || n.startsWith(`${f} `); });
    if (!m) return [];
    const set = new Set<string>();
    [...(m.types.mcq?.topics ?? []), ...(m.types.structured?.topics ?? [])].forEach((t) => {
      if (t.name && !t.name.trim().toLowerCase().startsWith("uncategor")) set.add(t.name);
    });
    return Array.from(set).sort();
  }, [meta]);

  const accFor = (subject: string, topic: string): number | null => {
    const w = weak.find((x) => (x.subject ? normSubj(x.subject) === normSubj(subject) : true) && x.topic.toLowerCase() === topic.toLowerCase());
    return w ? w.accuracy : null;
  };

  if (subjects.length === 0) {
    return <p className="faint" style={{ fontSize: 13 }}>Add your subjects in settings to see topic-by-topic weak points.</p>;
  }

  const noData = weak.length === 0;

  return (
    <div className="flex-col" style={{ display: "flex", gap: 8 }}>
      {/* New students have no marked work yet — nudge them to start practising. */}
      {noData && (
        <Link
          href="/student/paper-practice"
          className="row-between"
          style={{ textDecoration: "none", padding: "12px 14px", borderRadius: 12, background: "var(--crimson-soft, #fbe9ee)", color: "var(--crimson-ink, #8a123c)", marginBottom: 4 }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 13.5 }}>
            <Sparkles size={15} /> Start practising these topics
          </span>
          <span style={{ fontWeight: 700, fontSize: 13 }}>→</span>
        </Link>
      )}
      {subjects.map((s) => {
        const topics = topicsFor(s);
        const weakCount = topics.filter((t) => { const a = accFor(s, t); return a !== null && a < 75; }).length;
        const isOpen = open === s;
        return (
          <div key={s} style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
            <button
              onClick={() => setOpen(isOpen ? null : s)}
              className="row-between"
              style={{ width: "100%", padding: "11px 14px", background: isOpen ? "var(--surface-2)" : "transparent", border: "none", cursor: "pointer" }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Target size={15} style={{ color: "var(--coral)" }} />
                <span style={{ fontWeight: 600, fontSize: 14 }}>{s}</span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {weakCount > 0 && <span className="badge crimson" style={{ fontSize: 11 }}>{weakCount} weak</span>}
                <span className="faint" style={{ fontSize: 12 }}>{topics.length} topics</span>
                <ChevronDown size={15} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .2s", color: "var(--ink-faint)" }} />
              </span>
            </button>
            {isOpen && (
              <div style={{ padding: "2px 14px 12px" }}>
                {topics.length === 0 ? (
                  <p className="faint" style={{ fontSize: 12.5 }}>Topics for this subject will appear once the library loads.</p>
                ) : (
                  <div className="flex-col" style={{ display: "flex", gap: 10 }}>
                    {topics.map((t) => {
                      const a = accFor(s, t);
                      const col = a === null ? "var(--ink-faint)" : a >= 75 ? "var(--teal-deep)" : a >= 50 ? "var(--amber-deep)" : "var(--coral-bright)";
                      return (
                        <div key={t} style={{ fontSize: 12.5 }}>
                          <div className="row-between" style={{ gap: 10, marginBottom: 3 }}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t}</span>
                            <span className="tnum" style={{ color: col, fontWeight: 700, flex: "none" }}>{a === null ? "—" : `${a}%`}</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 4, background: "var(--surface-2)", overflow: "hidden" }}>
                            <div style={{ width: `${a === null ? 0 : Math.max(3, a)}%`, height: "100%", background: col, borderRadius: 4 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
