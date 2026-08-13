"use client";

// Renders a bank question in full — exactly what the student sees plus, for the
// teacher, the correct answer / mark scheme. Mirrors the Practice layout.
interface QImage { role?: string; src?: string; alt?: string; caption?: string | null }
export interface FullQuestion {
  type?: string;
  questionText?: string;
  options?: { label: string; text: string }[];
  correctOption?: string | null;
  images?: QImage[];
  parts?: { label: string; body: string; marks?: number | null; answer?: string | null }[];
  markingScheme?: string;
}

export default function QuestionFull({ q, showAnswers = true }: { q: FullQuestion; showAnswers?: boolean }) {
  const imgs = q.images ?? [];
  const figures = imgs.filter((i) => (i.role ?? "") !== "answer" && i.src);
  const answerFigs = imgs.filter((i) => i.role === "answer" && i.src);

  return (
    <div className="space-y-3 text-sm">
      {q.questionText && <p className="text-ink whitespace-pre-wrap">{q.questionText}</p>}

      {figures.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {figures.map((im, i) => (
            <figure key={i} className="m-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={im.src} alt={im.alt || "Figure"} className="max-h-60 rounded-lg border border-line object-contain bg-white" />
              {im.caption && <figcaption className="text-[0.7rem] text-ink-faint mt-0.5">{im.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}

      {q.options && q.options.length > 0 && (
        <div className="space-y-1.5">
          {q.options.map((o) => {
            const correct = showAnswers && !!q.correctOption && o.label.toUpperCase() === q.correctOption.toUpperCase();
            return (
              <div key={o.label} className={`flex items-start gap-2 rounded-lg border px-2.5 py-1.5 ${correct ? "border-mint bg-mint-soft/50" : "border-line"}`}>
                <span className="font-mono text-xs font-bold">{o.label}</span>
                <span className="text-ink">{o.text}</span>
                {correct && <span className="ml-auto text-mint-ink text-xs font-semibold shrink-0">✓ correct</span>}
              </div>
            );
          })}
        </div>
      )}

      {q.parts && q.parts.length > 0 && (
        <div className="space-y-2">
          {q.parts.map((p, i) => (
            <div key={i} className="rounded-lg border border-line p-2.5">
              <div className="flex items-baseline gap-2">
                {p.label && <span className="font-bold text-ink">{p.label}</span>}
                {p.marks != null && <span className="text-xs text-ink-faint">[{p.marks}]</span>}
              </div>
              {p.body && <p className="text-ink whitespace-pre-wrap mt-0.5">{p.body}</p>}
              {showAnswers && p.answer && <p className="text-xs text-mint-ink mt-1 whitespace-pre-wrap"><b>Answer:</b> {p.answer}</p>}
            </div>
          ))}
        </div>
      )}

      {showAnswers && q.markingScheme && (
        <div className="ed-card-soft p-2.5 border-l-2 border-gold">
          <p className="ed-label text-gold-ink">Mark scheme</p>
          <p className="text-xs text-ink-muted whitespace-pre-wrap mt-1">{q.markingScheme}</p>
        </div>
      )}

      {showAnswers && answerFigs.length > 0 && (
        <div>
          <p className="ed-label text-gold-ink mb-1">Mark scheme figures</p>
          <div className="flex flex-wrap gap-2">
            {answerFigs.map((im, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={im.src} alt={im.alt || "Answer figure"} className="max-h-52 rounded-lg border border-line object-contain bg-white" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
