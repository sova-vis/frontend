"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import {
  BankLevel,
  BankQuestion,
  PaperOption,
  PickedQuestion,
  SubjectMeta,
  bankToPicked,
  getPapers,
  getSubjectMeta,
  getTopicQuestions,
  getWholePaper,
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

export default function QuestionBrowser({ subject, level, cartKeys, onAdd, onAddMany, onRemove, onModeChange }: Props) {
  const [meta, setMeta] = useState<SubjectMeta | null>(null);
  const [mode, setMode] = useState<BrowseMode>("paper");
  const [type, setType] = useState<QType>("structured");
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        setLoadingMeta(true);
        setMeta(await getSubjectMeta(subject, level));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load question bank");
      } finally {
        setLoadingMeta(false);
      }
    })();
  }, [subject, level]);

  const typeMeta = meta?.types[type];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="flex rounded-xl border border-line overflow-hidden">
          {(["paper", "topic", "custom"] as BrowseMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-2 text-sm font-semibold ${mode === m ? "bg-crimson-soft text-crimson-ink" : "text-ink-muted"}`}
            >
              {m === "paper" ? "Full paper" : m === "topic" ? "By topic" : "My questions"}
            </button>
          ))}
        </div>
        {mode !== "custom" && meta && (
          <div className="flex rounded-xl border border-line overflow-hidden">
            {(["structured", "mcq"] as QType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                disabled={meta.types[t].total === 0}
                className={`px-4 py-2 text-sm font-semibold disabled:opacity-40 ${type === t ? "bg-ink text-paper" : "text-ink-muted"}`}
              >
                {t === "mcq" ? "MCQ" : "Structured"} ({meta.types[t].total})
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-crimson">{error}</p>}

      {mode === "custom" ? (
        <CustomBrowse subject={subject} cartKeys={cartKeys} onAdd={onAdd} onRemove={onRemove} />
      ) : loadingMeta ? (
        <div className="h-40 rounded-[1.25rem] bg-surface-soft animate-pulse" />
      ) : !meta || (meta.types.mcq.total === 0 && meta.types.structured.total === 0) ? (
        <div className="ed-card p-6 text-center text-ink-muted">
          No bank questions for <span className="font-semibold">{subject}</span> yet — try the <span className="font-semibold">My questions</span> tab.
        </div>
      ) : mode === "paper" ? (
        <PaperBrowse
          subject={subject}
          level={level}
          type={type}
          typeMeta={typeMeta}
          cartKeys={cartKeys}
          onAdd={onAdd}
          onAddMany={onAddMany}
          onRemove={onRemove}
          onModeChange={onModeChange}
        />
      ) : (
        <TopicBrowse
          subject={subject}
          level={level}
          type={type}
          typeMeta={typeMeta}
          cartKeys={cartKeys}
          onAdd={onAdd}
          onRemove={onRemove}
          onModeChange={onModeChange}
        />
      )}
    </div>
  );
}

function Row({
  number,
  topic,
  marks,
  text,
  inCart,
  onAdd,
  onRemove,
}: {
  number: string;
  topic: string;
  marks: number | null;
  text: string;
  inCart: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <div className={`ed-card-soft p-3 flex items-start gap-3 ${inCart ? "ring-1 ring-crimson/30" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap text-xs text-ink-faint">
          <span className="font-mono">{number}</span>
          {topic && <span className="ed-pill-mint text-[0.6rem]">{topic}</span>}
          <span>{marks ?? "?"} marks</span>
        </div>
        <p className="text-sm text-ink mt-1 line-clamp-2">{text || "(no text)"}</p>
      </div>
      <button
        onClick={inCart ? onRemove : onAdd}
        className={`shrink-0 rounded-full p-2 ${inCart ? "bg-crimson-soft text-crimson-ink" : "ed-btn-ghost"}`}
        aria-label={inCart ? "Remove" : "Add"}
      >
        {inCart ? <Check size={15} /> : <Plus size={15} />}
      </button>
    </div>
  );
}

// Bank question with an expandable full view (text, figures, options + correct
// answer, structured parts, mark scheme) — the exact same question as Practice.
function BankRow({ q, inCart, onAdd, onRemove }: { q: BankQuestion; inCart: boolean; onAdd: () => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`ed-card-soft p-3 ${inCart ? "ring-1 ring-crimson/30" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap text-xs text-ink-faint">
            <span className="font-mono">Q{q.questionNumber}</span>
            {q.topic && <span className="ed-pill-mint text-[0.6rem]">{q.topic}</span>}
            <span>{q.marks ?? "?"} marks</span>
            {q.year && <span>· {q.year} {q.session} {q.paper}{q.variant}</span>}
          </div>
          <p className={`text-sm text-ink mt-1 ${open ? "whitespace-pre-wrap" : "line-clamp-2"}`}>
            {q.questionText || q.parts?.find((p) => p.body?.trim())?.body || (q.topic ? `${q.topic} — multi-part question` : "Multi-part question")}
          </p>
          <button onClick={() => setOpen((o) => !o)} className="text-xs text-crimson font-semibold mt-1 inline-flex items-center gap-1">
            {open ? "Hide" : "View full question"} <ChevronDown size={12} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
          </button>
        </div>
        <button onClick={inCart ? onRemove : onAdd} className={`shrink-0 rounded-full p-2 ${inCart ? "bg-crimson-soft text-crimson-ink" : "ed-btn-ghost"}`} aria-label={inCart ? "Remove" : "Add"}>
          {inCart ? <Check size={15} /> : <Plus size={15} />}
        </button>
      </div>
      {open && <div className="mt-3 pt-3 border-t border-line"><QuestionSolveCard question={fromBankQuestion(q)} reveal readOnly /></div>}
    </div>
  );
}

function PaperBrowse({
  subject,
  level,
  type,
  typeMeta,
  cartKeys,
  onAdd,
  onAddMany,
  onRemove,
  onModeChange,
}: {
  subject: string;
  level: BankLevel;
  type: QType;
  typeMeta: SubjectMeta["types"][QType] | undefined;
  cartKeys: Set<string>;
  onAdd: (q: PickedQuestion) => void;
  onAddMany: (qs: PickedQuestion[]) => void;
  onRemove: (key: string) => void;
  onModeChange?: (mode: "paper", meta: Record<string, unknown>) => void;
}) {
  const [year, setYear] = useState("");
  const [papers, setPapers] = useState<PaperOption[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const years = typeMeta?.years ?? [];

  useEffect(() => {
    setSelectedKey("");
    setQuestions([]);
    if (!year) {
      setPapers([]);
      return;
    }
    void (async () => setPapers(await getPapers(subject, type, year, level)))();
  }, [subject, level, type, year]);

  const loadPaper = async (p: PaperOption) => {
    setSelectedKey(p.key);
    setLoading(true);
    try {
      const qs = await getWholePaper(subject, p.year, p.session, p.paper, p.variant, level);
      setQuestions(qs);
      onModeChange?.("paper", { subject, year: p.year, session: p.session, paper: p.paper, variant: p.variant });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <select value={year} onChange={(e) => setYear(e.target.value)} className="ed-input px-3 py-2 text-sm w-auto">
          <option value="">Select year…</option>
          {years.map((y) => (
            <option key={y.year} value={y.year}>
              {y.year} ({y.count})
            </option>
          ))}
        </select>
        {papers.length > 0 && (
          <select
            value={selectedKey}
            onChange={(e) => {
              const p = papers.find((x) => x.key === e.target.value);
              if (p) void loadPaper(p);
            }}
            className="ed-input px-3 py-2 text-sm flex-1 min-w-[200px]"
          >
            <option value="">Select a paper…</option>
            {papers.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label} — {p.count} Q
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="h-24 rounded-xl bg-surface-soft animate-pulse" />
      ) : questions.length > 0 ? (
        <>
          <div className="flex justify-between items-center">
            <p className="text-sm text-ink-muted">{questions.length} questions</p>
            <button
              onClick={() => onAddMany(questions.filter((q) => !cartKeys.has(q.uid)).map(bankToPicked))}
              className="ed-btn-ghost px-3 py-1.5 text-xs"
            >
              Add all
            </button>
          </div>
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {questions.map((q) => (
              <BankRow
                key={q.uid}
                q={q}
                inCart={cartKeys.has(q.uid)}
                onAdd={() => onAdd(bankToPicked(q))}
                onRemove={() => onRemove(q.uid)}
              />
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-ink-faint">Pick a year and paper to see its questions.</p>
      )}
    </div>
  );
}

function TopicBrowse({
  subject,
  level,
  type,
  typeMeta,
  cartKeys,
  onAdd,
  onRemove,
  onModeChange,
}: {
  subject: string;
  level: BankLevel;
  type: QType;
  typeMeta: SubjectMeta["types"][QType] | undefined;
  cartKeys: Set<string>;
  onAdd: (q: PickedQuestion) => void;
  onRemove: (key: string) => void;
  onModeChange?: (mode: "topic", meta: Record<string, unknown>) => void;
}) {
  const [topic, setTopic] = useState("");
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const topics = useMemo(() => typeMeta?.topics ?? [], [typeMeta]);

  useEffect(() => {
    setQuestions([]);
    setTotal(0);
    if (!topic) return;
    void (async () => {
      setLoading(true);
      try {
        const { questions: qs, total: t } = await getTopicQuestions(subject, type, topic, 40, 0, level);
        setQuestions(qs);
        setTotal(t);
        onModeChange?.("topic", { subject, topics: [topic], types: [type] });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, level, type, topic]);

  return (
    <div className="space-y-3">
      <select value={topic} onChange={(e) => setTopic(e.target.value)} className="ed-input px-3 py-2 text-sm">
        <option value="">Select a topic…</option>
        {topics.map((t) => (
          <option key={t.name} value={t.name}>
            {t.name} ({t.count})
          </option>
        ))}
      </select>

      {loading ? (
        <div className="h-24 rounded-xl bg-surface-soft animate-pulse" />
      ) : questions.length > 0 ? (
        <>
          <p className="text-sm text-ink-muted">
            Showing {questions.length} of {total} unique questions
          </p>
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {questions.map((q) => (
              <BankRow
                key={q.uid}
                q={q}
                inCart={cartKeys.has(q.uid)}
                onAdd={() => onAdd(bankToPicked(q))}
                onRemove={() => onRemove(q.uid)}
              />
            ))}
          </div>
        </>
      ) : topic ? (
        <p className="text-sm text-ink-faint">No questions for this topic.</p>
      ) : (
        <p className="text-sm text-ink-faint">Pick a topic to browse its questions.</p>
      )}
    </div>
  );
}

function CustomBrowse({
  subject,
  cartKeys,
  onAdd,
  onRemove,
}: {
  subject: string;
  cartKeys: Set<string>;
  onAdd: (q: PickedQuestion) => void;
  onRemove: (key: string) => void;
}) {
  const [questions, setQuestions] = useState<CustomQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        setQuestions(await listCustomQuestions(subject));
      } finally {
        setLoading(false);
      }
    })();
  }, [subject]);

  if (loading) return <div className="h-24 rounded-xl bg-surface-soft animate-pulse" />;

  if (questions.length === 0) {
    return (
      <div className="ed-card-soft p-5 text-center text-ink-muted text-sm">
        No custom questions for {subject}.{" "}
        <a href="/teacher/questions" className="text-crimson font-semibold hover:underline">
          Create one
        </a>
        .
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
      {questions.map((q) => (
        <Row
          key={q.id}
          number="Custom"
          topic={q.topic || ""}
          marks={q.marks}
          text={q.question_text}
          inCart={cartKeys.has(q.id)}
          onAdd={() => onAdd(customToPicked(q))}
          onRemove={() => onRemove(q.id)}
        />
      ))}
    </div>
  );
}
