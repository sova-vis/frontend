"use client";

/**
 * PaperDrawStudio — full-paper "draw on the real paper" surface.
 *
 * Resolves the chosen past paper's actual QP PDF (same lookup as "View in
 * paper"), rasterises every page with pdf.js, and lays a transparent ink layer
 * over each page so the student writes their answers directly on the paper —
 * pen/eraser/text, colours and thickness, just like a printed script. On submit
 * each inked page is composited (paper + ink) into a PNG and handed to the
 * existing handwritten-answer pipeline, so the vision marker reads the question
 * and the answer together. No backend change — a drawn page is just an image.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/propel/Icon";
import { apiCall, getApiUrl } from "@/lib/api";
import DrawLayer, { type DrawLayerHandle, type DrawTool } from "./drawing/DrawLayer";
import DrawToolbar from "./drawing/DrawToolbar";
import { DEFAULT_DRAW_COLOR, DEFAULT_DRAW_SIZE } from "./drawing/constants";

type Page = { src: string; w: number; h: number };
type LoadState = "loading" | "ready" | "error";

const MAX_PAGES = 30;
const RENDER_WIDTH = 1400; // rasterised page width (px) — crisp for display + vision

export default function PaperDrawStudio({
  subject, paper, level, busy, graded, onSubmit,
}: {
  subject: string;
  paper: { year: string; session: string; paper: string; variant: string };
  level: "olevel" | "alevel";
  busy?: boolean;
  graded?: boolean;
  onSubmit: (files: File[]) => void | Promise<void>;
}) {
  const [state, setState] = useState<LoadState>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [pages, setPages] = useState<Page[]>([]);
  const [tool, setTool] = useState<DrawTool>("pen");
  const [color, setColor] = useState<string>(DEFAULT_DRAW_COLOR);
  const [size, setSize] = useState<number>(DEFAULT_DRAW_SIZE);
  const [statuses, setStatuses] = useState<Record<number, { dirty: boolean; canUndo: boolean }>>({});
  const [activePage, setActivePage] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const layerRefs = useRef<(DrawLayerHandle | null)[]>([]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setState("loading");
      setErrorMsg("");
      try {
        // 1) resolve the QP PDF for this paper (scoped to the active level)
        const qs = new URLSearchParams();
        qs.set("level", level);
        qs.set("subject", subject);
        qs.set("year", paper.year);
        qs.set("session", paper.session);
        qs.set("paper", paper.paper);
        if (paper.variant) qs.set("variant", paper.variant);
        const res = await apiCall(`/papers/find-qp?${qs.toString()}`);
        if (!res.ok) throw new Error("not_found");
        const data = (await res.json()) as { viewUrl?: string };
        if (!data.viewUrl) throw new Error("not_found");

        // 2) fetch the PDF bytes (allowed cross-origin by the API's CORS)
        const pdfRes = await fetch(`${getApiUrl()}${data.viewUrl}`);
        if (!pdfRes.ok) throw new Error("fetch_failed");
        const buf = await pdfRes.arrayBuffer();
        if (cancelled) return;

        // 3) rasterise every page with pdf.js. Load the worker from the CDN, pinned
        // to the exact installed version — reliable across dev / prod / Vercel with
        // no bundler asset quirks (the app sets no CSP that would block it).
        const pdfjs = await import("pdfjs-dist");
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
        }
        const pdf = await pdfjs.getDocument({ data: buf }).promise;
        const count = Math.min(pdf.numPages, MAX_PAGES);
        const out: Page[] = [];
        for (let i = 1; i <= count; i++) {
          if (cancelled) return;
          const page = await pdf.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const scale = RENDER_WIDTH / base.width;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport }).promise;
          out.push({ src: canvas.toDataURL("image/jpeg", 0.85), w: canvas.width, h: canvas.height });
        }
        if (cancelled) return;
        if (out.length === 0) throw new Error("no_pages");
        layerRefs.current = new Array(out.length).fill(null);
        setPages(out);
        setState("ready");
      } catch (e) {
        if (cancelled) return;
        const code = e instanceof Error ? e.message : "";
        setErrorMsg(
          code === "not_found"
            ? "We couldn't find this paper's PDF to draw on."
            : "Couldn't open the paper to draw on. You can switch to Upload instead.",
        );
        setState("error");
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [subject, paper.year, paper.session, paper.paper, paper.variant, level]);

  const onStatus = useCallback((i: number, s: { dirty: boolean; canUndo: boolean }) => {
    setStatuses((prev) => ({ ...prev, [i]: s }));
    setActivePage(i);
  }, []);

  const anyDirty = Object.values(statuses).some((s) => s.dirty);
  const activeStatus = statuses[activePage] ?? { dirty: false, canUndo: false };

  const submit = async () => {
    if (submitting || busy) return;
    setSubmitting(true);
    try {
      const files: File[] = [];
      for (let i = 0; i < pages.length; i++) {
        if (!statuses[i]?.dirty) continue; // only pages the student wrote on
        const blob = await layerRefs.current[i]?.toBlob();
        if (blob) files.push(new File([blob], `page-${i + 1}.png`, { type: "image/png" }));
      }
      if (files.length === 0) return;
      await onSubmit(files);
    } finally {
      setSubmitting(false);
    }
  };

  if (state === "loading") {
    return (
      <div className="card flex items-center justify-center gap-8" style={{ minHeight: 260, color: "var(--ink-faint)", display: "flex" }}>
        <Icon name="refresh" size={16} className="spin" /> Opening the paper to draw on…
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="card card-pad flex-col gap-10" style={{ display: "flex", alignItems: "center", textAlign: "center" }}>
        <Icon name="alert" size={20} style={{ color: "var(--coral-bright)" }} />
        <p style={{ fontSize: 13.5, maxWidth: 420 }}>{errorMsg}</p>
      </div>
    );
  }

  const working = submitting || busy;
  return (
    <div className="flex-col gap-12" style={{ display: "flex" }}>
      {/* sticky tool bar */}
      <div className="card" style={{ position: "sticky", top: 0, zIndex: 5, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 14 }}>
        <DrawToolbar tool={tool} setTool={setTool} color={color} setColor={setColor} size={size} setSize={setSize}
          onUndo={() => layerRefs.current[activePage]?.undo()} onClear={() => layerRefs.current[activePage]?.clear()}
          canUndo={activeStatus.canUndo} dirty={activeStatus.dirty} compact />
        <button type="button" className="btn btn-primary btn-sm" onClick={submit} disabled={!anyDirty || working}
          title={anyDirty ? "Mark the pages you've written on" : "Write your answers on the paper first"}>
          {working ? <><Icon name="refresh" size={14} className="spin" /> Marking…</> : <><Icon name="award" size={14} /> {graded ? "Re-mark" : "Submit for marking"}</>}
        </button>
      </div>

      <p className="faint" style={{ fontSize: 12, lineHeight: 1.5, margin: 0 }}>
        Write your answers on the paper below with the pen. Use the eraser or text box as you like —
        only the pages you write on are sent for marking.
      </p>

      {/* the paper, page by page, with an ink layer over each */}
      <div className="flex-col gap-16" style={{ display: "flex" }}>
        {pages.map((pg, i) => (
          <div key={i} className="flex-col gap-4" style={{ display: "flex" }}>
            <div className="flex items-center gap-8">
              <span className="eyebrow">Page {i + 1}</span>
              {statuses[i]?.dirty && <span className="badge teal" style={{ fontSize: 10.5 }}>written</span>}
            </div>
            <DrawLayer
              ref={(h) => { layerRefs.current[i] = h; }}
              tool={tool} color={color} size={size}
              backgroundSrc={pg.src}
              onStatusChange={(s) => onStatus(i, s)}
              className="card"
              minHeight={0}
              style={{ width: "100%", aspectRatio: `${pg.w} / ${pg.h}`, padding: 0, overflow: "hidden", borderColor: "var(--line-strong)", borderRadius: 12 }}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={!anyDirty || working}>
          {working ? <><Icon name="refresh" size={15} className="spin" /> Marking…</> : <><Icon name="award" size={15} /> {graded ? "Re-mark my paper" : "Submit for marking"}</>}
        </button>
      </div>
    </div>
  );
}
