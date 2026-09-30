"use client";

/**
 * Teacher notes & resources (spec §5.9) — attach files or links to a class, tag
 * them to a topic, publish/unpublish, with a per-school storage cap. On the `.pr`
 * design. Students see the published ones in their classroom.
 */
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/propel/Icon";
import { Segmented, Modal, EmptyState, useToast, Bar } from "@/components/propel/primitives";
import { TeacherClass, listClasses } from "@/lib/teacherClasses";
import {
  Resource, ResourceStorage, listResources, createResource, updateResource, deleteResource, openResource, humanSize,
} from "@/lib/resources";

const MAX_FILE = 1_500_000; // stay under the 2 MB request limit

export default function ResourcesPage() {
  const toast = useToast();
  const [classes, setClasses] = useState<TeacherClass[] | null>(null);
  const [classId, setClassId] = useState("");
  const [items, setItems] = useState<Resource[] | null>(null);
  const [storage, setStorage] = useState<ResourceStorage | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const cs = (await listClasses()).filter((c) => !c.archived && (c.can_grade ?? c.is_owner ?? true));
        setClasses(cs);
        if (cs.length) setClassId(cs[0].id);
      } catch { setClasses([]); }
    })();
  }, []);

  const load = () => {
    if (!classId) { setItems([]); setStorage(null); return; }
    setItems(null);
    listResources(classId).then((d) => { setItems(d.resources); setStorage(d.storage); }).catch((e) => { toast((e as Error).message, "alert"); setItems([]); });
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [classId]);

  const pct = useMemo(() => (storage && storage.cap_bytes > 0 ? Math.min(100, Math.round((storage.used_bytes / storage.cap_bytes) * 100)) : 0), [storage]);

  const togglePublish = async (r: Resource) => {
    try { const up = await updateResource(r.id, { published: !r.published }); setItems((xs) => xs?.map((x) => (x.id === r.id ? up : x)) ?? xs); }
    catch (e) { toast((e as Error).message, "alert"); }
  };
  const remove = async (id: string) => {
    try { await deleteResource(id); setConfirmDel(null); toast("Removed", "check_circle"); load(); }
    catch (e) { toast((e as Error).message, "alert"); }
  };

  return (
    <>
      <div className="row-between wrap gap-16" style={{ marginBottom: 22 }}>
        <div>
          <h1 className="big-num" style={{ fontSize: 28 }}>Resources</h1>
          <p className="faint" style={{ fontSize: 13.5, marginTop: 4 }}>Notes, worksheets and links you publish to a class.</p>
        </div>
        <div className="flex gap-8 wrap">
          {classes && classes.length > 0 && (
            <select className="input" style={{ width: "auto", minWidth: 180 }} value={classId} onChange={(e) => setClassId(e.target.value)}>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <button className="btn btn-primary" disabled={!classId} onClick={() => setAddOpen(true)}><Icon name="plus" size={16} /> Add resource</button>
        </div>
      </div>

      {storage && (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="row-between" style={{ marginBottom: 8 }}>
            <span className="eyebrow">Storage</span>
            <span className="faint mono" style={{ fontSize: 12.5 }}>{humanSize(storage.used_bytes)} / {humanSize(storage.cap_bytes)}</span>
          </div>
          <Bar value={pct} tone={pct >= 90 ? "coral" : pct >= 70 ? "amber" : "teal"} height={7} />
        </div>
      )}

      {classes === null || items === null ? (
        <div className="grid" style={{ gap: 10 }}>{[0, 1, 2].map((i) => <div key={i} className="sk" style={{ height: 68, borderRadius: 14 }} />)}</div>
      ) : classes.length === 0 ? (
        <EmptyState icon="users" title="No classes yet" body="Create a class first, then publish resources to it." />
      ) : items.length === 0 ? (
        <EmptyState icon="book" title="No resources yet" body="Add a worksheet, a note or a helpful link — published items show up in your students' classroom." cta="Add resource" onCta={() => setAddOpen(true)} />
      ) : (
        <div className="grid" style={{ gap: 10 }}>
          {items.map((r) => (
            <div key={r.id} className="card card-pad row-between wrap gap-12">
              <button className="flex items-center gap-12" style={{ minWidth: 0, textAlign: "left", flex: 1 }} onClick={() => void openResource(r).catch((e) => toast((e as Error).message, "alert"))}>
                <div style={{ width: 40, height: 40, borderRadius: 11, flex: "none", display: "grid", placeItems: "center", background: "var(--surface-2)", color: r.kind === "link" ? "var(--purple)" : "var(--crimson)" }}>
                  <Icon name={r.kind === "link" ? "globe" : "file_text"} size={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
                  <div className="flex items-center gap-8 wrap faint" style={{ fontSize: 12, marginTop: 2 }}>
                    {r.topic && <span className="chip-tag" style={{ background: "var(--surface-2)", color: "var(--ink-soft)", border: "1px solid var(--line)" }}>{r.topic}</span>}
                    <span>{r.kind === "link" ? "Link" : humanSize(r.size_bytes)}</span>
                  </div>
                </div>
              </button>
              <div className="flex items-center gap-8" style={{ flex: "none" }}>
                <button className="chip-tag" onClick={() => void togglePublish(r)} title={r.published ? "Published — click to unpublish" : "Hidden — click to publish"}
                  style={{ cursor: "pointer", background: r.published ? "var(--teal-soft)" : "var(--surface-2)", color: r.published ? "var(--teal)" : "var(--ink-faint)", border: "none" }}>
                  {r.published ? "Published" : "Hidden"}
                </button>
                {confirmDel === r.id ? (
                  <>
                    <button className="btn btn-sm" style={{ background: "var(--coral)", color: "#fff" }} onClick={() => void remove(r.id)}>Delete</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDel(null)}>Cancel</button>
                  </>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDel(r.id)} style={{ color: "var(--ink-soft)" }}><Icon name="trash" size={14} /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {addOpen && classId && (
        <AddResourceModal classId={classId} onClose={() => setAddOpen(false)} onAdded={(r) => { setItems((xs) => [r, ...(xs ?? [])]); setAddOpen(false); load(); }} />
      )}
    </>
  );
}

function AddResourceModal({ classId, onClose, onAdded }: { classId: string; onClose: () => void; onAdded: (r: Resource) => void }) {
  const [kind, setKind] = useState<"file" | "link">("file");
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<{ name: string; data: string; size: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const pickFile = (f: File) => {
    if (f.size > MAX_FILE) { setErr(`That file is ${(f.size / 1048576).toFixed(1)} MB — files must be under 1.5 MB. Add it as a link instead.`); return; }
    const reader = new FileReader();
    reader.onload = () => { setFile({ name: f.name, data: String(reader.result || ""), size: f.size }); setErr(""); if (!title) setTitle(f.name.replace(/\.[^.]+$/, "")); };
    reader.readAsDataURL(f);
  };

  const submit = async () => {
    if (!title.trim()) { setErr("A title is required."); return; }
    if (kind === "file" && !file) { setErr("Choose a file, or switch to a link."); return; }
    if (kind === "link" && !/^https?:\/\//i.test(url.trim())) { setErr("Enter a valid http(s) link."); return; }
    setBusy(true); setErr("");
    try {
      const r = await createResource({
        class_id: classId, title: title.trim(), topic: topic.trim() || undefined, kind,
        url: kind === "link" ? url.trim() : undefined, data: kind === "file" ? file?.data : undefined,
      });
      onAdded(r);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}>
      <div className="row-between" style={{ marginBottom: 16 }}>
        <h3 style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 20, fontWeight: 600 }}>Add resource</h3>
        <button onClick={onClose}><Icon name="x" size={18} /></button>
      </div>

      <div className="grid" style={{ gap: 14 }}>
        <Segmented<"file" | "link">
          options={[{ value: "file", label: "Upload file", icon: "upload" }, { value: "link", label: "External link", icon: "globe" }]}
          value={kind} onChange={setKind}
        />

        <label style={{ display: "block" }}>
          <span className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Title</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Electrolysis revision notes" />
        </label>

        <label style={{ display: "block" }}>
          <span className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Topic <span className="faint">(optional)</span></span>
          <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Electrochemistry" />
        </label>

        {kind === "file" ? (
          <label style={{ display: "block" }}>
            <span className="eyebrow" style={{ display: "block", marginBottom: 6 }}>File <span className="faint">(PDF, image or doc, under 1.5 MB)</span></span>
            <div style={{ border: "1px dashed var(--line-strong)", borderRadius: 12, padding: 16, textAlign: "center", background: "var(--surface-2)" }}>
              <input type="file" style={{ display: "none" }} id="rf" onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }} />
              <label htmlFor="rf" className="btn btn-secondary btn-sm" style={{ cursor: "pointer" }}><Icon name="upload" size={14} /> Choose file</label>
              {file && <p className="faint mono" style={{ fontSize: 12, marginTop: 8 }}>{file.name} · {humanSize(file.size)}</p>}
            </div>
          </label>
        ) : (
          <label style={{ display: "block" }}>
            <span className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Link</span>
            <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" inputMode="url" />
          </label>
        )}

        {err && <p style={{ color: "var(--coral)", fontSize: 13 }}>{err}</p>}
        <div className="flex gap-8" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={() => void submit()} disabled={busy}>{busy ? "Adding…" : "Publish resource"}</button>
        </div>
      </div>
    </Modal>
  );
}
