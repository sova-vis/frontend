import { apiCall } from "./api";

/** Teacher notes & resources client (backend /resources routes, §5.9). */

export interface Resource {
  id: string;
  class_id: string;
  title: string;
  topic: string | null;
  kind: "file" | "link";
  url: string | null;
  mime: string | null;
  size_bytes: number;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResourceStorage {
  used_bytes: number;
  cap_bytes: number;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export async function listResources(classId: string): Promise<{ resources: Resource[]; storage: ResourceStorage }> {
  return json(await apiCall(`/resources?class_id=${classId}`));
}

export async function listPublishedResources(classId: string): Promise<Resource[]> {
  const d = await json<{ resources: Resource[] }>(await apiCall(`/resources/published?class_id=${classId}`));
  return d.resources;
}

export async function createResource(input: {
  class_id: string; title: string; topic?: string; kind: "file" | "link"; url?: string; data?: string; published?: boolean;
}): Promise<Resource> {
  const d = await json<{ resource: Resource }>(await apiCall("/resources", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  }));
  return d.resource;
}

export async function updateResource(id: string, patch: { title?: string; topic?: string; published?: boolean }): Promise<Resource> {
  const d = await json<{ resource: Resource }>(await apiCall(`/resources/${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
  }));
  return d.resource;
}

export async function deleteResource(id: string): Promise<void> {
  await json(await apiCall(`/resources/${id}`, { method: "DELETE" }));
}

/** Fetch a stored file with auth and open it in a new tab (files need the token). */
export async function openResourceFile(id: string): Promise<void> {
  const res = await apiCall(`/resources/${id}/file`);
  if (!res.ok) throw new Error("Could not open the file");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Open a resource — external link directly, stored file via the authed stream. */
export async function openResource(r: Resource): Promise<void> {
  if (r.kind === "link" && r.url) { window.open(r.url, "_blank", "noopener"); return; }
  await openResourceFile(r.id);
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
