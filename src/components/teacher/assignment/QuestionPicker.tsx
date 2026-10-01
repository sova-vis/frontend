"use client";

/**
 * QuestionPicker — the assignment builder's question browser, on the shared
 * `.pr` design system (matches the student side). It is a pure restyle of the
 * legacy `QuestionBrowser`: every data path is reused verbatim from
 * lib/questionBank + lib/customQuestions, and full-question previews use the
 * same shared `QuestionSolveCard` as Practice. Three sources (§5.2):
 *   Full paper · By topic · My questions (custom).
 */
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/propel/Icon";
import { Segmented } from "@/components/propel/primitives";
import {
  BankLevel, BankQuestion, PaperOption, PickedQuestion, SubjectMeta,
  bankToPicked, getPapers, getSubjectMeta, getTopicQuestions, getWholePaper,
} from "@/lib/questionBank";
import { CustomQuestion, customToPicked, listCustomQuestions } from "@/lib/customQuestions";
import QuestionSolveCard, { fromBankQuestion } from "@/components/practice/QuestionSolveCard";

type BrowseMode = "paper" | "topic" | "custom";
type QType = "mcq" | "structured";

interface Props {
  subject: string;
  level: BankLevel;
  cartKeys: Set<string>;
  onAdd: (q: PickedQuestion) => void;
  onAddMany: (qs: PickedQuestion[]) => void;
  onRemove: (key: string) => void;
  onModeChange?: (mode: BrowseMode, meta: Record<string, unknown>) => void;
}

export default function QuestionPicker({ subject, level, cartKeys, onAdd, onAddMany, onRemove, onModeChange }: Props) {
  const [meta, setMeta] = useState<SubjectMeta | null>(null);
  const [mode, setMode] = useState<BrowseMode>("paper");
  const [type, setType] = useState<QType>("structured");
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        setLoadingMeta(true);
        setError("");
        const m = await getSubjectMeta(subject, level);
        setMeta(m);
        // Default to whichever type actually has questions.
        if (m && m.types.structured.total === 0 && m.types.mcq.total > 0) setType("mcq");
        else setType("structured");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load question bank");
      } finally {
        setLoadingMeta(false);
      }
    })();
  }, [subject, level]);

  const typeMeta = meta?.types[type];
  const bankEmpty = !meta || (meta.types.mcq.total === 0 && meta.types.structured.total === 0);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="flex items-center gap-10 wrap">
        <Segmented
          options={[
            { value: "paper", label: "Full paper", icon: "file_text" },
            { value: "topic", label: "By topic", icon: "layers" },
            { value: "custom", label: "My questions", icon: "edit" },
          ]}
          value={mode}
          onChange={(m) => setMode(m as BrowseMode)}
        />
        {mode !== "custom" && meta && !bankEmpty && (
          <Segmented
            options={[
              { value: "structured", label: `Structured (${meta.types.structured.total})` },
              { value: "mcq", label: `MCQ (${meta.types.mcq.total})` },
            ]}
            value={type}
            onChange={(t) => setType(t as QType)}
          />
        )}
      </div>

      {error && <p style={{ color: "var(--coral)", fontSize: 13 }}>{error}</p>}

      {mode === "custom" ? (
        <CustomBrowse subject={subject} cartKeys={cartKeys} onAdd={onAdd} onRemove={onRemove} />
      ) : loadingMeta ? (
        <div className="sk" style={{ height: 160, borderRadius: 16 }} />
      ) : bankEmpty ? (
        <div style={{ padding: "28px 20px", textAlign: "center", background: "var(--surface-2)", borderRadius: 16 }}>
          <p className="muted" style={{ fontSize: 14 }}>
            No bank questions for <b style={{ color: "var(--ink)" }}>{subject}</b> yet — try the <b style={{ color: "var(--ink)" }}>My questions</b> tab.
          </p>
        </div>
      ) : mode === "paper" ? (
        <PaperBrowse
          subject={subject} level={level} type={type} typeMeta={typeMeta}
          cartKeys={cartKeys} onAdd={onAdd} onAddMany={onAddMany} onRemove={onRemove} onModeChange={onModeChange}
        />
      ) : (
        <TopicBrowse
          subject={subject} level={level} type={type} typeMeta={typeMeta}
          cartKeys={cartKeys} onAdd={onAdd} onRemove={onRemove} onModeChange={onModeChange}
        />
      )}
    </div>
  );
}

/* ---- one selectable bank question, with an expandable full preview ---- */
function BankRow({ q, inCart, onAdd, onRemove }: { q: BankQuestion; inCart: boolean; onAdd: () => void; onRemove: () => void }) {
  // Default OPEN so the FULL question (every part + all images) is visible while
  // assigning — the same card the student Practice page shows. Collapsible to scan.
  const [open, setOpen] = useState(true);
  const preview = q.questionText || q.parts?.find((p) => p.body?.trim())?.body || (q.topic ? `${q.topic} — multi-part question` : "Multi-part question");
  return (
    <div style={{ background: "var(--surface-2)", borderRadius: 14, padding: 12, border: inCart ? "1px solid var(--crimson)" : "1px solid transparent" }}>
      <div className="flex items-start gap-12">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="flex items-center gap-8 wrap" style={{ fontSize: 12, color: "var(--ink-faint)" }}>
            <span className="mono" style={{ fontWeight: 600 }}>Q{q.questionNumber}</span>
            {q.topic && <span className="chip-tag" style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink-soft)" }}>{q.topic}</span>}
            <span>{q.marks ?? "?"} marks</span>
            {q.year && <span>· {q.year} {q.session} {q.paper}{q.variant}</span>}
          </div>
          {!open && <p style={{ fontSize: 13.5, color: "var(--ink)", marginTop: 5, ...clamp2 }}>{preview}</p>}
          <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-4" style={{ fontSize: 12, color: "var(--crimson)", fontWeight: 600, marginTop: 6 }}>
            {open ? "Hide full question" : "View full question"}
            <Icon name="chevron_down" size={13} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
          </button>
        </div>
        <AddBtn inCart={inCart} onAdd={onAdd} onRemove={onRemove} />
      </div>
      {open && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
          <QuestionSolveCard question={fromBankQuestion(q)} reveal readOnly />
        </div>
      )}
    </div>
  );
}

function AddBtn({ inCart, onAdd, onRemove }: { inCart: boolean; onAdd: () => void; onRemove: () => void }) {
  return (
    <button
      onClick={inCart ? onRemove : onAdd}
      aria-label={inCart ? "Remove from assignment" : "Add to assignment"}
      title={inCart ? "Remove" : "Add"}
      style={{
        flex: "none", width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center",
        transition: "all .15s",
        ...(inCart
          ? { background: "var(--crimson)", color: "#fff", border: "1px solid var(--crimson)" }
          : { background: "var(--surface)", color: "var(--ink-soft)", border: "1px solid var(--line-strong)" }),
      }}
    >
      <Icon name={inCart ? "check_circle" : "plus"} size={16} />
    </button>
  );
}

function PaperBrowse({
  subject, level, type, typeMeta, cartKeys, onAdd, onAddMany, onRemove, onModeChange,
}: {
  subject: string; level: BankLevel; type: QType; typeMeta: SubjectMeta["types"][QType] | undefined;
  cartKeys: Set<string>; onAdd: (q: PickedQuestion) => void; onAddMany: (qs: PickedQuestion[]) => void;
  onRemove: (key: string) => void; onModeChange?: (mode: "paper", meta: Record<string, unknown>) => void;
}) {
  const [year, setYear] = useState("");
  const [papers, setPapers] = useState<PaperOption[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const years = typeMeta?.years ?? [];

  useEffect(() => {
    setSelectedKey(""); setQuestions([]);
    if (!year) { setPapers([]); return; }
    void (async () => setPapers(await getPapers(subject, type, year, level)))();
  }, [subject, level, type, year]);

  const loadPaper = async (p: PaperOption) => {
    setSelectedKey(p.key); setLoading(true);
    try {
      const qs = await getWholePaper(subject, p.year, p.session, p.paper, p.variant, level);
      setQuestions(qs);
      onModeChange?.("paper", { subject, year: p.year, session: p.session, paper: p.paper, variant: p.variant });
    } finally { setLoading(false); }
  };

  const addable = questions.filter((q) => !cartKeys.has(q.uid));

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="flex items-center gap-8 wrap">
        <select className="input" style={{ width: "auto", minWidth: 150 }} value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">Select year…</option>
          {years.map((y) => <option key={y.year} value={y.year}>{y.year} ({y.count})</option>)}
        </select>
        {papers.length > 0 && (
          <select
            className="input"
            style={{ width: "auto", flex: 1, minWidth: 200 }}
            value={selectedKey}
            onChange={(e) => { const p = papers.find((x) => x.key === e.target.value); if (p) void loadPaper(p); }}
          >
            <option value="">Select a paper…</option>
            {papers.map((p) => <option key={p.key} value={p.key}>{p.label} — {p.count} Q</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="sk" style={{ height: 120, borderRadius: 14 }} />
      ) : questions.length > 0 ? (
        <>
          <div className="row-between">
            <p className="faint" style={{ fontSize: 13 }}>{questions.length} questions{addable.length < questions.length ? ` · ${questions.length - addable.length} added` : ""}</p>
            <button className="btn btn-secondary btn-sm" disabled={addable.length === 0} onClick={() => onAddMany(addable.map(bankToPicked))}>
              <Icon name="plus" size={14} /> Add all
            </button>
          </div>
          <div className="grid" style={{ gap: 8, maxHeight: 460, overflowY: "auto", paddingRight: 2 }}>
            {questions.map((q) => (
              <BankRow key={q.uid} q={q} inCart={cartKeys.has(q.uid)} onAdd={() => onAdd(bankToPicked(q))} onRemove={() => onRemove(q.uid)} />
            ))}
          </div>
        </>
      ) : (
        <p className="faint" style={{ fontSize: 13 }}>Pick a year and paper to see its questions.</p>
      )}
    </div>
  );
}

function TopicBrowse({
  subject, level, type, typeMeta, cartKeys, onAdd, onRemove, onModeChange,
}: {
  subject: string; level: BankLevel; type: QType; typeMeta: SubjectMeta["types"][QType] | undefined;
  cartKeys: Set<string>; onAdd: (q: PickedQuestion) => void; onRemove: (key: string) => void;
  onModeChange?: (mode: "topic", meta: Record<string, unknown>) => void;
}) {
  const [topic, setTopic] = useState("");
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const topics = useMemo(() => typeMeta?.topics ?? [], [typeMeta]);

  useEffect(() => {
    setQuestions([]); setTotal(0);
    if (!topic) return;
    void (async () => {
      setLoading(true);
      try {
        const { questions: qs, total: t } = await getTopicQuestions(subject, type, topic, 40, 0, level);
        setQuestions(qs); setTotal(t);
        onModeChange?.("topic", { subject, topics: [topic], types: [type] });
      } finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, level, type, topic]);

  return (
    <div className="grid" style={{ gap: 12 }}>
      <select className="input" value={topic} onChange={(e) => setTopic(e.target.value)}>
        <option value="">Select a topic…</option>
        {topics.map((t) => <option key={t.name} value={t.name}>{t.name} ({t.count})</option>)}
      </select>

      {loading ? (
        <div className="sk" style={{ height: 120, borderRadius: 14 }} />
      ) : questions.length > 0 ? (
        <>
          <p className="faint" style={{ fontSize: 13 }}>Showing {questions.length} of {total} unique questions</p>
          <div className="grid" style={{ gap: 8, maxHeight: 460, overflowY: "auto", paddingRight: 2 }}>
            {questions.map((q) => (
              <BankRow key={q.uid} q={q} inCart={cartKeys.has(q.uid)} onAdd={() => onAdd(bankToPicked(q))} onRemove={() => onRemove(q.uid)} />
            ))}
          </div>
        </>
      ) : topic ? (
        <p className="faint" style={{ fontSize: 13 }}>No questions for this topic.</p>
      ) : (
        <p className="faint" style={{ fontSize: 13 }}>Pick a topic to browse its questions.</p>
      )}
    </div>
  );
}

function CustomBrowse({
  subject, cartKeys, onAdd, onRemove,
}: {
  subject: string; cartKeys: Set<string>; onAdd: (q: PickedQuestion) => void; onRemove: (key: string) => void;
}) {
  const [questions, setQuestions] = useState<CustomQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try { setLoading(true); setQuestions(await listCustomQuestions(subject)); }
      finally { setLoading(false); }
    })();
  }, [subject]);

  if (loading) return <div className="sk" style={{ height: 120, borderRadius: 14 }} />;

  if (questions.length === 0) {
    return (
      <div style={{ padding: "24px 20px", textAlign: "center", background: "var(--surface-2)", borderRadius: 16 }}>
        <p className="muted" style={{ fontSize: 14 }}>
          No custom questions for {subject}.{" "}
          <a href="/teacher/questions" style={{ color: "var(--crimson)", fontWeight: 600 }}>Create one</a>.
        </p>
      </div>
    );
  }

  return (
    <div className="grid" style={{ gap: 8, maxHeight: 460, overflowY: "auto", paddingRight: 2 }}>
      {questions.map((q) => {
        const inCart = cartKeys.has(q.id);
        return (
          <div key={q.id} style={{ background: "var(--surface-2)", borderRadius: 14, padding: 12, border: inCart ? "1px solid var(--crimson)" : "1px solid transparent" }}>
            <div className="flex items-start gap-12">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="flex items-center gap-8 wrap" style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                  <span className="chip-tag" style={{ background: "var(--crimson-soft)", color: "var(--crimson)" }}>Custom</span>
                  {q.topic && <span className="chip-tag" style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink-soft)" }}>{q.topic}</span>}
                  <span>{q.marks} marks</span>
                </div>
                <p style={{ fontSize: 13.5, color: "var(--ink)", marginTop: 5, ...clamp2 }}>{q.question_text || "(no text)"}</p>
              </div>
              <AddBtn inCart={inCart} onAdd={() => onAdd(customToPicked(q))} onRemove={() => onRemove(q.id)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const clamp2: React.CSSProperties = {
  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
};
