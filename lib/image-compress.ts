"use client";

/**
 * Client-side image compression — runs in the admin's browser BEFORE an image
 * is uploaded to Supabase Storage.
 *
 * This is the single biggest lever on Supabase Storage EGRESS. A raw phone
 * photo is a 3–8 MB JPEG; resized to ~1600px and re-encoded as WebP it becomes
 * ~150–400 KB. Because egress is bytes-served × views, shrinking the stored
 * object cuts the bytes transferred on EVERY future page view (product cards,
 * product pages, homepage), cached or not.
 *
 * Why in the browser: the app runs on Cloudflare Workers (OpenNext), which has
 * no native image toolkit (`sharp`) and no server-side canvas, so resizing on
 * the server isn't available. The admin uploads from a browser anyway, so we
 * use the browser's own <canvas>/WebP encoder — no new dependencies, and the
 * bytes are shrunk before they ever leave the machine (which also sidesteps the
 * server action's body-size limit).
 *
 * Safety: this NEVER throws and never blocks a save. For anything it can't or
 * shouldn't touch — an unsupported/animated type, a decode failure, or a result
 * that isn't actually smaller — it returns the ORIGINAL File unchanged, so
 * uploads degrade gracefully to the previous behaviour.
 */

export type CompressOptions = {
  /** Longest edge in px; the image is only ever scaled DOWN to fit. */
  maxDimension?: number;
  /** WebP/JPEG quality, 0..1. */
  quality?: number;
};

const DEFAULTS: Required<CompressOptions> = { maxDimension: 1600, quality: 0.82 };

// Only re-encode still raster photos. Others pass through untouched:
// gif (re-encoding would drop animation), svg (vector), avif (already small),
// heic (browsers can't decode it in a canvas).
const COMPRESSIBLE = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  try {
    if (typeof document === "undefined") return file; // not running in a browser
    if (!file || file.size === 0 || !COMPRESSIBLE.has(file.type)) return file;

    const { maxDimension, quality } = { ...DEFAULTS, ...opts };
    const { img, revoke } = await loadImage(file);
    try {
      // Drawing an <img> (rather than createImageBitmap) to a canvas applies the
      // photo's EXIF orientation in modern browsers, so portrait phone shots
      // don't come out sideways.
      const sw = img.naturalWidth || img.width;
      const sh = img.naturalHeight || img.height;
      if (!sw || !sh) return file;

      const scale = Math.min(1, maxDimension / Math.max(sw, sh));
      const dw = Math.max(1, Math.round(sw * scale));
      const dh = Math.max(1, Math.round(sh * scale));

      const canvas = document.createElement("canvas");
      canvas.width = dw;
      canvas.height = dh;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(img, 0, 0, dw, dh);

      // Prefer WebP; fall back to JPEG if the browser can't emit WebP (older
      // Safari returns a PNG when asked for an unsupported type).
      let out = await toBlob(canvas, "image/webp", quality);
      let type = "image/webp";
      let ext = "webp";
      if (!out || out.type !== "image/webp") {
        const jpg = await toBlob(canvas, "image/jpeg", quality);
        if (jpg) {
          out = jpg;
          type = "image/jpeg";
          ext = "jpg";
        }
      }
      // Keep the original if the re-encode didn't actually save bytes (e.g. an
      // already-tiny image, or a small PNG that grows as WebP).
      if (!out || out.size >= file.size) return file;

      const base = file.name.replace(/\.[^.]+$/, "") || "image";
      return new File([out], `${base}.${ext}`, { type, lastModified: Date.now() });
    } finally {
      revoke();
    }
  } catch {
    return file; // optimization must never break an upload
  }
}

function loadImage(file: File): Promise<{ img: HTMLImageElement; revoke: () => void }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const revoke = () => URL.revokeObjectURL(url);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve({ img, revoke });
    img.onerror = () => {
      revoke();
      reject(new Error("Image decode failed"));
    };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof canvas.toBlob === "function") canvas.toBlob((b) => resolve(b), type, quality);
    else resolve(null);
  });
}

/**
 * Normalise a logo to a PNG the PDF product sheets can embed.
 *
 * compressImage() above re-encodes to WebP, which is right for photographs and
 * wrong for this: PDF cannot embed WebP at all, and flattening a logo to JPEG
 * would fill its transparent background with white — which then shows as a
 * white box wherever the logo sits on the sheet. PNG keeps the alpha channel,
 * and lib/pdf.ts turns that channel into the PDF soft mask.
 *
 * A logo is also small by nature, so this only ever scales DOWN to `maxDimension`
 * and never re-encodes lossily.
 *
 * Like compressImage, this NEVER throws: anything it can't handle comes back as
 * the original File, and the server rejects it with a message the admin can act
 * on rather than the upload failing silently.
 */
export async function logoToPng(file: File, maxDimension = 600): Promise<File> {
  try {
    if (typeof document === "undefined") return file;
    if (!file || file.size === 0 || !file.type.startsWith("image/")) return file;
    // SVG has no intrinsic raster size and can carry script; never re-encode it,
    // and let the server refuse it.
    if (file.type === "image/svg+xml") return file;

    const { img, revoke } = await loadImage(file);
    try {
      const sw = img.naturalWidth || img.width;
      const sh = img.naturalHeight || img.height;
      if (!sw || !sh) return file;

      const scale = Math.min(1, maxDimension / Math.max(sw, sh));
      const dw = Math.max(1, Math.round(sw * scale));
      const dh = Math.max(1, Math.round(sh * scale));

      const canvas = document.createElement("canvas");
      canvas.width = dw;
      canvas.height = dh;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(img, 0, 0, dw, dh);

      const out = await toBlob(canvas, "image/png", 1);
      if (!out || out.type !== "image/png") return file;

      const base = file.name.replace(/\.[^.]+$/, "") || "logo";
      return new File([out], `${base}.png`, { type: "image/png", lastModified: Date.now() });
    } finally {
      revoke();
    }
  } catch {
    return file;
  }
}
