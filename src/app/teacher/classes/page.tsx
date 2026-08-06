"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GraduationCap, Plus, Users } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/Motion";
import { subjectStyle } from "@/components/propel/subjects";
import { TeacherClass, listClasses } from "@/lib/teacherClasses";
import { syllabusLabel } from "@/lib/syllabus";
import CreateClassModal from "@/components/teacher/CreateClassModal";

type SortKey = "name" | "subject" | "recent";

export default function ClassesPage() {
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [sort, setSort] = useState<SortKey>("name");
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setClasses(await listClasses(true)); // fetch all; filter archived client-side
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load classes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(() => {
    const filtered = classes.filter((c) => (showArchived ? true : !c.archived));
    return [...filtered].sort((a, b) => {
      if (sort === "subject") return a.subject.localeCompare(b.subject);
      if (sort === "recent") return (b.updated_at || "").localeCompare(a.updated_at || "");
      return a.name.localeCompare(b.name);
    });
  }, [classes, showArchived, sort]);

  const archivedCount = classes.filter((c) => c.archived).length;

  return (
    <div className="px-4 md:px-8 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">
                Your <span className="italic text-crimson">Classes</span>
              </h1>
              <p className="text-ink-muted mt-1">
                {classes.filter((c) => !c.archived).length} active
                {archivedCount > 0 && ` · ${archivedCount} archived`}
              </p>
            </div>
            <button onClick={() => setShowCreate(true)} className="ed-btn-primary px-4 py-2.5">
              <Plus size={16} />
              New class
            </button>
          </div>
        </Reveal>

        {classes.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="ed-label">Sort</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="ed-input px-3 py-2 text-sm w-auto"
              >
                <option value="name">Name</option>
                <option value="subject">Subject</option>
                <option value="recent">Recent activity</option>
              </select>
            </div>
            {archivedCount > 0 && (
              <label className="flex items-center gap-2 text-sm text-ink-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                  className="accent-crimson"
                />
                Show archived
              </label>
            )}
          </div>
        )}

        {error && <p className="text-sm text-crimson">{error}</p>}

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-40 rounded-[1.25rem] bg-surface-soft animate-pulse" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState onCreate={() => setShowCreate(true)} />
        ) : (
          <Stagger className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map((c) => {
              const style = subjectStyle(c.subject);
              return (
                <StaggerItem key={c.id}>
                  <Link
                    href={`/teacher/classes/${c.id}`}
                    className="ed-card p-5 block h-full hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-paper"
                          style={{ backgroundColor: style.color }}
                        >
                          <GraduationCap size={18} />
                        </span>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-ink truncate">{c.name}</h3>
                          <p className="text-xs text-ink-faint truncate">{syllabusLabel(c.syllabus_code)}</p>
                        </div>
                      </div>
                      {c.archived && <span className="ed-pill-clay text-[0.65rem] shrink-0">Archived</span>}
                    </div>

                    <div className="mt-4 flex items-center gap-2 flex-wrap">
                      <span className="ed-pill-mint text-[0.65rem]">{c.level} Level</span>
                      {!c.is_owner && <span className="ed-pill-gold text-[0.65rem]">Co-teaching</span>}
                      {(c.pending_count ?? 0) > 0 && (
                        <span className="ed-pill-crimson text-[0.65rem]">{c.pending_count} pending</span>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                      <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
                        <Users size={14} />
                        {c.student_count ?? 0} student{(c.student_count ?? 0) === 1 ? "" : "s"}
                      </span>
                      <span className="text-sm text-ink-faint">Avg —</span>
                    </div>
                  </Link>
                </StaggerItem>
              );
            })}
          </Stagger>
        )}
      </div>

      {showCreate && (
        <CreateClassModal
          onClose={() => setShowCreate(false)}
          onCreated={(created) => {
            setClasses((prev) => [created, ...prev]);
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="ed-card p-10 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-crimson-soft text-crimson-ink">
        <GraduationCap size={26} />
      </div>
      <h3 className="mt-4 font-display text-xl font-semibold">Create your first class</h3>
      <p className="mt-1 text-ink-muted max-w-sm mx-auto">
        A class holds your students and one syllabus. Once created you can share a join code and start assigning past papers.
      </p>
      <button onClick={onCreate} className="ed-btn-primary mt-5 px-5 py-2.5 mx-auto">
        <Plus size={16} />
        New class
      </button>
    </div>
  );
}
