/**
 * Downscale an image File to a bounded JPEG data URL (client-side, canvas).
 *
 * Phone photos are several MB at full resolution; sent raw they exceed the API
 * body limit and get rejected with 413 before the server can store or OCR them.
 * A bounded JPEG keeps uploads small (typically a few hundred KB) so the image
 * actually reaches the server, is retained for review, and transcribes faster.
 *
 * Falls back to the raw data URL if the browser can't decode the file (e.g. some
 * HEIC files) — the raised server body limit then still accepts it.
 */
export async function fileToDownscaledDataUrl(file: File, maxDim = 1800, quality = 0.85): Promise<string> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("read failed"));
    reader.readAsDataURL(file);
  });

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = rawDataUrl;
    });
    const longest = Math.max(img.width, img.height) || 1;
    const scale = Math.min(1, maxDim / longest);
    // Already small enough in both dimensions and bytes — keep as-is.
    if (scale >= 1 && rawDataUrl.length < 1_400_000) return rawDataUrl;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return rawDataUrl;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return rawDataUrl;
  }
}
