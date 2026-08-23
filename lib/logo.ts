import { probeImage } from "@/lib/pdf";

/**
 * The store logo, on its way into a PDF.
 *
 * SERVER ONLY. Fetching and checking live together because they fail for
 * different reasons that need different fixes: a logo the Worker cannot reach
 * is a storage-permissions problem, while a logo it reaches and cannot decode
 * is an export-settings problem. Reporting "no logo" for both — which is what
 * the product sheet used to do, silently — sends the owner looking in the
 * wrong place.
 */

/** Never let a slow or oversized logo hold up (or blow out) a response. */
export const LOGO_TIMEOUT_MS = 4000;
export const MAX_LOGO_BYTES = 4 * 1024 * 1024;

/**
 * Fetch the logo bytes, or null.
 *
 * Any failure returns null and the caller falls back to a text watermark — a
 * missing logo must never cost a buyer their download.
 */
export async function fetchLogoBytes(
  url: string | null | undefined
): Promise<Uint8Array | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(LOGO_TIMEOUT_MS),
      // Long-lived: the stored object is an immutable UUID filename, so a new
      // logo is always a new URL.
      cache: "force-cache",
    });
    if (!response.ok) return null;
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_LOGO_BYTES) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.length > MAX_LOGO_BYTES ? null : bytes;
  } catch {
    return null;
  }
}

export type LogoCheck = {
  state: "none" | "ok" | "unreachable" | "unusable";
  /** One sentence, written for the shop owner rather than for a log. */
  detail: string;
  width?: number;
  height?: number;
};

/**
 * What is actually wrong with the stored logo, in words.
 *
 * Answers the question an owner is really asking when a logo does not appear
 * on a product sheet: did the upload fail, did the save fail, or is the file
 * itself the problem? Each has a completely different fix, and the sheet's
 * quiet fallback made all three look identical.
 */
export async function checkStoredLogo(url: string | null | undefined): Promise<LogoCheck> {
  if (!url) {
    return {
      state: "none",
      detail:
        "No logo saved. Product sheets print the company name instead. If you uploaded one and it is not here, the save did not store it — check that migration 0013_store_logo.sql has been run.",
    };
  }

  const bytes = await fetchLogoBytes(url);
  if (!bytes) {
    return {
      state: "unreachable",
      detail:
        "The logo is saved but the server cannot download it. That is almost always the storage bucket being private — make the product-images bucket public in Supabase → Storage.",
    };
  }

  const probe = await probeImage(bytes);
  if (!probe.ok) {
    return { state: "unusable", detail: probe.reason };
  }

  return {
    state: "ok",
    detail: `Printing on every product sheet — ${probe.kind.toUpperCase()}, ${probe.width}×${probe.height}.`,
    width: probe.width,
    height: probe.height,
  };
}
