/**
 * A small PDF writer — no dependencies, no Node built-ins.
 *
 * WHY HAND-ROLLED: the storefront runs on Cloudflare Workers (OpenNext), where
 * every byte of the bundle and every millisecond of CPU is budgeted, and the
 * app deliberately carries almost no runtime dependencies. A product spec sheet
 * needs text, rules, a table, colour swatches and a watermarked logo — a
 * fraction of what a general PDF library ships. So this module writes the PDF
 * bytes directly, using only web-standard APIs (TextEncoder is deliberately
 * NOT used — see `raw()` below) plus CompressionStream/DecompressionStream,
 * which Workers, Node 18+ and browsers all provide.
 *
 * COORDINATES ARE TOP-LEFT. PDF's own origin is the bottom-left corner, which
 * is a reliable source of off-by-a-page-height bugs. Every public method here
 * takes `y` as the distance DOWN from the top of the page and converts
 * internally, so callers can lay out a document the way they read it.
 *
 * FONTS are the PDF standard 14 (Helvetica / Helvetica-Bold), which every
 * viewer has built in. That means no font file to embed — and also that text is
 * limited to the WinAnsi character set. `toWinAnsi()` maps the punctuation
 * people actually type (curly quotes, en/em dashes, ellipses, degree signs) and
 * strips accents off anything outside the set rather than dropping the letter.
 * Text in a non-Latin script cannot be rendered without embedding a font.
 */

export type FontName = "regular" | "bold";

/** A4, in PDF points (1/72"). Prints correctly on US Letter too. */
export const A4 = { width: 595.28, height: 841.89 } as const;

// ---------------------------------------------------------------------------
// Bytes
// ---------------------------------------------------------------------------

/**
 * One byte per character.
 *
 * TextEncoder would emit UTF-8, which turns every WinAnsi byte above 127 into
 * two bytes and corrupts the text. PDF syntax is ASCII and PDF strings are
 * byte strings, so the whole file is built from strings whose char codes are
 * already ≤ 255.
 */
function raw(s: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

/**
 * Join byte runs into one array.
 *
 * The return type is pinned to an ArrayBuffer-backed view (never a
 * SharedArrayBuffer one) so the finished document can be handed straight to a
 * Response body without a cast.
 */
function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("deflate");
  // The DOM types require an ArrayBuffer-backed view; every array here is one
  // (nothing in this module ever touches a SharedArrayBuffer).
  const writer = cs.writable.getWriter() as WritableStreamDefaultWriter<Uint8Array>;
  void writer.write(data);
  void writer.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate");
  const writer = ds.writable.getWriter() as WritableStreamDefaultWriter<Uint8Array>;
  void writer.write(data);
  void writer.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}

// ---------------------------------------------------------------------------
// Text encoding
// ---------------------------------------------------------------------------

/** Characters people type that WinAnsi has, but at a different code point. */
const WINANSI_HIGH: Record<string, number> = {
  "€": 0x80, // €
  "‚": 0x82,
  "ƒ": 0x83,
  "„": 0x84,
  "…": 0x85, // …
  "†": 0x86,
  "‡": 0x87,
  "ˆ": 0x88,
  "‰": 0x89, // ‰
  "Š": 0x8a,
  "‹": 0x8b,
  "Œ": 0x8c,
  "Ž": 0x8e,
  "‘": 0x91, // ‘
  "’": 0x92, // ’
  "“": 0x93, // “
  "”": 0x94, // ”
  "•": 0x95, // •
  "–": 0x96, // –
  "—": 0x97, // —
  "˜": 0x98,
  "™": 0x99, // ™
  "š": 0x9a,
  "›": 0x9b,
  "œ": 0x9c,
  "ž": 0x9e,
  "Ÿ": 0x9f,
};

/**
 * Fold arbitrary text down to WinAnsi.
 *
 * Anything the encoding can't represent has its accents stripped (via NFD) and
 * is retried, so "Ā" becomes "A" instead of vanishing. Characters that survive
 * neither step are dropped — better a clean sheet than one peppered with "?".
 *
 * IDEMPOTENT, and it has to be: wrap() folds text so it can measure it, and
 * drawText() folds again on the way out. WinAnsi puts its punctuation in
 * 0x80–0x9F, where Unicode has only C1 control codes — so a second pass that
 * treated those as controls would silently delete every en dash and curly quote
 * the first pass had just produced. Anything already in the byte range is
 * therefore passed straight through.
 */
export function toWinAnsi(input: string): string {
  let out = "";
  for (const ch of String(input ?? "").replace(/\r\n?/g, "\n")) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === "\n" || ch === "\t") {
      out += " ";
      continue;
    }
    if (code < 32 || code === 0x7f) continue; // other control characters
    if (code === 0xa0) {
      out += " "; // non-breaking space — wrapping handles the breaks
      continue;
    }
    if (code <= 0xff) {
      out += ch;
      continue;
    }
    const mapped = WINANSI_HIGH[ch];
    if (mapped !== undefined) {
      out += String.fromCharCode(mapped);
      continue;
    }
    // Last resort: strip diacritics and keep whatever base letters remain.
    // The base may itself be a high WinAnsi letter — "Ǽ" decomposes to "Æ"
    // plus an acute, and Æ is perfectly representable. Combining marks all sit
    // above U+00FF, so the same range check drops them.
    for (const base of ch.normalize("NFD")) {
      const c = base.charCodeAt(0);
      if (c >= 32 && c <= 0xff && c !== 0x7f) out += base;
    }
  }
  return out;
}

/** Escape a WinAnsi string for a PDF literal string `( … )`. */
function pdfString(s: string): string {
  return s.replace(/([\\()])/g, "\\$1");
}

// ---------------------------------------------------------------------------
// Glyph widths
// ---------------------------------------------------------------------------

// Adobe AFM advance widths (per 1000 units) for codes 32–126. Accurate widths
// are what make wrapping, centring and right-alignment land where they should.
const W_REGULAR: number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278,
  278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584,
  584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556,
  833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278,
  278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222,
  500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500,
  500, 334, 260, 334, 584,
];

const W_BOLD: number[] = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278,
  278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584,
  584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611,
  833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333,
  278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278,
  556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556,
  500, 389, 280, 389, 584,
];

// Punctuation above 127 that appears in real copy. Everything else in the high
// range is an accented Latin letter, whose advance matches its base letter —
// see LATIN1_BASE.
const W_HIGH_REGULAR: Record<number, number> = {
  0x80: 556, 0x85: 1000, 0x89: 1000, 0x91: 191, 0x92: 191, 0x93: 333,
  0x94: 333, 0x95: 350, 0x96: 556, 0x97: 1000, 0x99: 1000, 0xa0: 278,
  0xa3: 556, 0xa9: 737, 0xae: 737, 0xb0: 400, 0xb1: 584, 0xb7: 278,
  0xbc: 834, 0xbd: 834, 0xbe: 834, 0xd7: 584, 0xf7: 584,
};
const W_HIGH_BOLD: Record<number, number> = {
  0x80: 556, 0x85: 1000, 0x89: 1000, 0x91: 238, 0x92: 238, 0x93: 500,
  0x94: 500, 0x95: 350, 0x96: 556, 0x97: 1000, 0x99: 1000, 0xa0: 278,
  0xa3: 556, 0xa9: 737, 0xae: 737, 0xb0: 400, 0xb1: 584, 0xb7: 278,
  0xbc: 834, 0xbd: 834, 0xbe: 834, 0xd7: 584, 0xf7: 584,
};

/** Base letter for WinAnsi 0xC0–0xFF; an accent never changes the advance. */
const LATIN1_BASE =
  "AAAAAAECEEEEIIIIDNOOOOO.OUUUUYPsaaaaaaeceeeeiiiidnooooo.ouuuuypy";

function glyphWidth(code: number, font: FontName): number {
  const table = font === "bold" ? W_BOLD : W_REGULAR;
  if (code >= 32 && code <= 126) return table[code - 32];
  const high = font === "bold" ? W_HIGH_BOLD : W_HIGH_REGULAR;
  if (high[code] !== undefined) return high[code];
  if (code >= 0xc0 && code <= 0xff) {
    const base = LATIN1_BASE.charCodeAt(code - 0xc0);
    if (base >= 32 && base <= 126) return table[base - 32];
  }
  return table[fallbackIndex]; // an average lowercase advance
}
const fallbackIndex = "n".charCodeAt(0) - 32;

/** Width of already-WinAnsi text, in points, at the given size. */
function measureEncoded(text: string, font: FontName, size: number): number {
  let units = 0;
  for (let i = 0; i < text.length; i++) units += glyphWidth(text.charCodeAt(i), font);
  return (units * size) / 1000;
}

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

/** `#rrggbb` or `#rgb` → PDF's 0–1 components. Unparseable input reads black. */
function rgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return [0, 0, 0];
  const body =
    m[1].length === 3
      ? m[1].split("").map((c) => c + c).join("")
      : m[1];
  return [
    parseInt(body.slice(0, 2), 16) / 255,
    parseInt(body.slice(2, 4), 16) / 255,
    parseInt(body.slice(4, 6), 16) / 255,
  ];
}

/** Trim a float to 3dp without exponent notation, keeping the file small. */
function n(v: number): string {
  if (!Number.isFinite(v)) return "0";
  const s = v.toFixed(3);
  return s.replace(/\.?0+$/, "") || "0";
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/**
 * A decoded image, ready to become a PDF XObject.
 *
 * `data` is ALREADY in the compression the PDF dictionary declares — for most
 * PNGs that is the file's own IDAT stream passed through untouched (see
 * decodePng), which is both the fastest path and the lossless one.
 */
type DecodedImage = {
  width: number;
  height: number;
  bitsPerComponent: number;
  colorSpace: string;
  filter: string;
  decodeParms?: string;
  data: Uint8Array;
  /** 8-bit alpha channel, when the source had one. */
  smask?: { width: number; height: number; data: Uint8Array };
};

export type PdfImage = { readonly width: number; readonly height: number; readonly id: number };

function u32(b: Uint8Array, at: number): number {
  return ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isPng(b: Uint8Array): boolean {
  return PNG_MAGIC.every((v, i) => b[i] === v);
}

function isJpeg(b: Uint8Array): boolean {
  return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
}

/**
 * JPEG: the compressed scan is embedded verbatim as a /DCTDecode stream — PDF
 * speaks JPEG natively, so there is nothing to decode. We only read the frame
 * header for the dimensions and component count.
 *
 * Baseline and extended-sequential only. Progressive JPEG (SOF2) is rejected
 * because several viewers, Acrobat included, will not render it inside a PDF —
 * a missing logo is a better outcome than a broken page.
 */
function decodeJpeg(b: Uint8Array): DecodedImage | null {
  let at = 2;
  while (at < b.length - 9) {
    if (b[at] !== 0xff) {
      at++;
      continue;
    }
    const marker = b[at + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2;
      continue;
    }
    const len = (b[at + 2] << 8) | b[at + 3];
    if (marker === 0xc0 || marker === 0xc1) {
      const precision = b[at + 4];
      const height = (b[at + 5] << 8) | b[at + 6];
      const width = (b[at + 7] << 8) | b[at + 8];
      const components = b[at + 9];
      if (precision !== 8 || !width || !height) return null;
      const colorSpace =
        components === 1 ? "/DeviceGray" : components === 3 ? "/DeviceRGB" : "";
      if (!colorSpace) return null; // CMYK needs an Adobe transform we don't read
      return { width, height, bitsPerComponent: 8, colorSpace, filter: "/DCTDecode", data: b };
    }
    if (marker === 0xda) break; // start of scan — no frame header found
    at += 2 + len;
  }
  return null;
}

/**
 * PNG, two ways.
 *
 * WITHOUT an alpha channel (colour types 0, 2 and 3) the IDAT stream goes in
 * UNTOUCHED: PDF's `/Predictor 15` is precisely PNG's per-row filtering, so the
 * file's own deflate stream is already a valid PDF image stream. No inflate, no
 * re-compress, no quality loss, and almost no CPU.
 *
 * WITH an alpha channel (types 4 and 6) PDF needs the colour and the alpha as
 * two separate streams, so there the data is inflated, un-filtered, split and
 * re-deflated.
 *
 * Interlaced (Adam7) PNGs are rejected — laying out the seven passes is a lot
 * of code for a case a logo is never saved in.
 */
async function decodePng(b: Uint8Array): Promise<DecodedImage | null> {
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let palette: Uint8Array | null = null;
  const idat: Uint8Array[] = [];

  let at = 8;
  while (at + 8 <= b.length) {
    const len = u32(b, at);
    const type = String.fromCharCode(b[at + 4], b[at + 5], b[at + 6], b[at + 7]);
    const start = at + 8;
    if (start + len > b.length) break;
    if (type === "IHDR") {
      width = u32(b, start);
      height = u32(b, start + 4);
      bitDepth = b[start + 8];
      colorType = b[start + 9];
      if (b[start + 12] !== 0) return null; // interlaced
    } else if (type === "PLTE") {
      palette = b.subarray(start, start + len);
    } else if (type === "IDAT") {
      idat.push(b.subarray(start, start + len));
    } else if (type === "IEND") {
      break;
    }
    at = start + len + 4; // + CRC
  }

  if (!width || !height || idat.length === 0) return null;
  const compressed = concat(idat);

  // --- Pass-through: no alpha channel to separate out. -----------------------
  if (colorType === 0 || colorType === 2 || colorType === 3) {
    const channels = colorType === 2 ? 3 : 1;
    let colorSpace: string;
    if (colorType === 3) {
      if (!palette) return null;
      const entries = Math.floor(palette.length / 3);
      if (entries < 1) return null;
      colorSpace = `[/Indexed /DeviceRGB ${entries - 1} <${hex(palette)}>]`;
    } else {
      colorSpace = colorType === 2 ? "/DeviceRGB" : "/DeviceGray";
    }
    if (![1, 2, 4, 8, 16].includes(bitDepth)) return null;
    if (colorType !== 3 && bitDepth !== 8 && bitDepth !== 16) return null;
    return {
      width,
      height,
      bitsPerComponent: bitDepth,
      colorSpace,
      filter: "/FlateDecode",
      decodeParms: `<< /Predictor 15 /Colors ${channels} /BitsPerComponent ${bitDepth} /Columns ${width} >>`,
      data: compressed,
    };
  }

  // --- Split: colour and alpha become separate streams. ----------------------
  if ((colorType === 4 || colorType === 6) && bitDepth === 8) {
    const colorChannels = colorType === 6 ? 3 : 1;
    const channels = colorChannels + 1;
    const rows = unfilter(await inflate(compressed), width, height, channels);
    if (!rows) return null;

    const color = new Uint8Array(width * height * colorChannels);
    const alpha = new Uint8Array(width * height);
    for (let i = 0, c = 0, a = 0; i < rows.length; i += channels) {
      for (let k = 0; k < colorChannels; k++) color[c++] = rows[i + k];
      alpha[a++] = rows[i + colorChannels];
    }
    return {
      width,
      height,
      bitsPerComponent: 8,
      colorSpace: colorChannels === 3 ? "/DeviceRGB" : "/DeviceGray",
      filter: "/FlateDecode",
      data: await deflate(color),
      smask: { width, height, data: await deflate(alpha) },
    };
  }

  return null;
}

/**
 * Can this image go in a PDF, and if not, WHY not?
 *
 * WHY THIS EXISTS: addImage() returns null for anything it cannot decode, and
 * the product sheet then quietly falls back to a text watermark. An admin who
 * uploads a logo, sees it appear in the admin preview, and then finds it
 * missing from the PDF has no way to tell whether the upload failed, the save
 * failed, or the format is wrong — the three have completely different fixes.
 * This turns that silence into a sentence.
 *
 * Uses the SAME code path the writer does, so a "yes" here means the writer
 * will accept it, not that it probably will.
 */
export async function probeImage(
  bytes: Uint8Array | null | undefined
): Promise<
  | { ok: true; kind: "png" | "jpeg"; width: number; height: number }
  | { ok: false; reason: string }
> {
  const b = bytes ?? new Uint8Array();
  if (b.length === 0) return { ok: false, reason: "The file is empty." };

  if (isPng(b)) {
    // Read the header ourselves so the failure can be named rather than just
    // reported as "could not decode".
    if (b.length > 33) {
      const bitDepth = b[24];
      const colorType = b[25];
      if (b[28] !== 0) {
        return {
          ok: false,
          reason:
            "This PNG is interlaced (saved as 'progressive'). Re-export it without interlacing — in most tools that is an 'Interlaced' checkbox in the PNG export options.",
        };
      }
      if ((colorType === 4 || colorType === 6) && bitDepth !== 8) {
        return {
          ok: false,
          reason: `This PNG is ${bitDepth}-bit with transparency. Re-export it as an 8-bit PNG.`,
        };
      }
    }
    const decoded = await decodePng(b);
    return decoded
      ? { ok: true, kind: "png", width: decoded.width, height: decoded.height }
      : { ok: false, reason: "This PNG uses a variant a PDF cannot embed. Re-export it as a standard 8-bit PNG." };
  }

  if (isJpeg(b)) {
    const decoded = decodeJpeg(b);
    return decoded
      ? { ok: true, kind: "jpeg", width: decoded.width, height: decoded.height }
      : { ok: false, reason: "This JPEG could not be read — it may be CMYK or progressive. Re-save it as a standard RGB JPEG, or export a PNG." };
  }

  return {
    ok: false,
    reason:
      "This is not a PNG or a JPEG. Those are the only image formats a PDF can embed — an SVG, WebP, AVIF or HEIC logo has to be exported as a PNG first.",
  };
}

function hex(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, "0");
  return s;
}

/**
 * Undo PNG's per-row filters, returning the raw samples with the filter bytes
 * removed. The five filter types are defined in the PNG spec; each row's filter
 * is relative to the pixel to the left (a) and the row above (b, c).
 */
function unfilter(
  data: Uint8Array,
  width: number,
  height: number,
  bpp: number
): Uint8Array | null {
  const stride = width * bpp;
  if (data.length < height * (stride + 1)) return null;
  const out = new Uint8Array(stride * height);
  let src = 0;
  for (let y = 0; y < height; y++) {
    const filter = data[src++];
    const row = y * stride;
    const prev = row - stride;
    for (let x = 0; x < stride; x++) {
      const rawByte = data[src++];
      const a = x >= bpp ? out[row + x - bpp] : 0;
      const bb = y > 0 ? out[prev + x] : 0;
      const c = y > 0 && x >= bpp ? out[prev + x - bpp] : 0;
      let value: number;
      switch (filter) {
        case 0: value = rawByte; break;
        case 1: value = rawByte + a; break;
        case 2: value = rawByte + bb; break;
        case 3: value = rawByte + ((a + bb) >> 1); break;
        case 4: value = rawByte + paeth(a, bb, c); break;
        default: return null;
      }
      out[row + x] = value & 0xff;
    }
  }
  return out;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export type TextOptions = {
  x: number;
  /** Distance from the TOP of the page down to the text baseline. */
  y: number;
  size?: number;
  font?: FontName;
  /** `#rrggbb`. */
  color?: string;
  /** Where `x` sits relative to the text. */
  align?: "left" | "right" | "center";
  /** Extra space between characters, in points. */
  tracking?: number;
  opacity?: number;
};

export class PdfDocument {
  readonly width: number;
  readonly height: number;

  private readonly meta: { title: string; author: string; subject: string };
  /** Drawing operators per page, in order. */
  private pages: string[][] = [];
  private current = -1;
  private images: DecodedImage[] = [];
  /** Distinct alpha values used, each of which needs its own ExtGState. */
  private alphas: number[] = [];

  constructor(opts?: {
    width?: number;
    height?: number;
    title?: string;
    author?: string;
    subject?: string;
  }) {
    this.width = opts?.width ?? A4.width;
    this.height = opts?.height ?? A4.height;
    this.meta = {
      title: toWinAnsi(opts?.title ?? ""),
      author: toWinAnsi(opts?.author ?? ""),
      subject: toWinAnsi(opts?.subject ?? ""),
    };
  }

  get pageCount(): number {
    return this.pages.length;
  }

  addPage(): void {
    this.pages.push([]);
    this.current = this.pages.length - 1;
  }

  /**
   * Draw on every page after the fact — for footers, which can't be written
   * until the total page count is known.
   */
  eachPage(fn: (pageNumber: number, total: number) => void): void {
    const restore = this.current;
    const total = this.pages.length;
    for (let i = 0; i < total; i++) {
      this.current = i;
      fn(i + 1, total);
    }
    this.current = restore;
  }

  /**
   * Decode an image so it can be drawn. Returns null for anything that isn't a
   * PDF-embeddable PNG or JPEG, so a caller can carry on without it rather than
   * failing the whole document.
   */
  async addImage(bytes: Uint8Array): Promise<PdfImage | null> {
    try {
      const decoded = isPng(bytes)
        ? await decodePng(bytes)
        : isJpeg(bytes)
        ? decodeJpeg(bytes)
        : null;
      if (!decoded) return null;
      this.images.push(decoded);
      return { width: decoded.width, height: decoded.height, id: this.images.length - 1 };
    } catch {
      return null; // a corrupt file must not take the document down
    }
  }

  /** Width of `text` in points, after WinAnsi folding. */
  measure(text: string, font: FontName = "regular", size = 10): number {
    return measureEncoded(toWinAnsi(text), font, size);
  }

  /**
   * Break text into lines that fit `maxWidth`.
   *
   * Splits on spaces; a single word longer than the line (a URL, a part number)
   * is broken mid-word rather than allowed to run off the page.
   */
  wrap(text: string, maxWidth: number, font: FontName = "regular", size = 10): string[] {
    const words = toWinAnsi(text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (measureEncoded(candidate, font, size) <= maxWidth || !line) {
        if (measureEncoded(candidate, font, size) > maxWidth && !line) {
          // A single oversized word: emit as many whole chunks as fit.
          let chunk = "";
          for (const ch of word) {
            if (measureEncoded(chunk + ch, font, size) > maxWidth && chunk) {
              lines.push(chunk);
              chunk = ch;
            } else {
              chunk += ch;
            }
          }
          line = chunk;
          continue;
        }
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }

  drawText(text: string, opts: TextOptions): void {
    const encoded = toWinAnsi(text);
    if (!encoded) return;
    const size = opts.size ?? 10;
    const font = opts.font ?? "regular";
    const tracking = opts.tracking ?? 0;
    let width = measureEncoded(encoded, font, size);
    if (tracking) width += tracking * Math.max(0, encoded.length - 1);
    const x =
      opts.align === "right"
        ? opts.x - width
        : opts.align === "center"
        ? opts.x - width / 2
        : opts.x;
    const [r, g, b] = rgb(opts.color ?? "#000000");
    const ops = [
      "q",
      this.alphaOp(opts.opacity),
      `${n(r)} ${n(g)} ${n(b)} rg`,
      "BT",
      `/${font === "bold" ? "F2" : "F1"} ${n(size)} Tf`,
      tracking ? `${n(tracking)} Tc` : "",
      `1 0 0 1 ${n(x)} ${n(this.height - opts.y)} Tm`,
      `(${pdfString(encoded)}) Tj`,
      "ET",
      "Q",
    ];
    this.push(ops);
  }

  /**
   * Big, faint, diagonal text — the fallback watermark when there is no logo to
   * use, so a sheet still reads as branded.
   *
   * `size` is a MAXIMUM. A long company name is scaled down to fit the
   * diagonal rather than running off both edges of the page.
   */
  drawWatermarkText(text: string, opts?: { size?: number; color?: string; opacity?: number }): void {
    const encoded = toWinAnsi(text);
    if (!encoded) return;
    const angle = (Math.PI / 180) * 32;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // Longest line that fits inside the page at this angle, kept off the edges.
    const limit = Math.min(this.width / cos, this.height / sin) * 0.86;
    let size = opts?.size ?? 64;
    const naturalWidth = measureEncoded(encoded, "bold", size);
    if (naturalWidth > limit) size = (size * limit) / naturalWidth;
    const textWidth = measureEncoded(encoded, "bold", size);
    const cx = this.width / 2;
    const cy = this.height / 2;
    const capHeight = size * 0.72;
    const tx = cx - (textWidth / 2) * cos + (capHeight / 2) * sin;
    const ty = cy - (textWidth / 2) * sin - (capHeight / 2) * cos;
    const [r, g, b] = rgb(opts?.color ?? "#000000");
    this.push([
      "q",
      this.alphaOp(opts?.opacity ?? 0.06),
      `${n(r)} ${n(g)} ${n(b)} rg`,
      `${n(cos)} ${n(sin)} ${n(-sin)} ${n(cos)} ${n(tx)} ${n(ty)} cm`,
      "BT",
      `/F2 ${n(size)} Tf`,
      "1 0 0 1 0 0 Tm",
      `(${pdfString(encoded)}) Tj`,
      "ET",
      "Q",
    ]);
  }

  /** `y` is the TOP edge of the rectangle. */
  drawRect(
    x: number,
    y: number,
    w: number,
    h: number,
    opts?: { color?: string; opacity?: number }
  ): void {
    const [r, g, b] = rgb(opts?.color ?? "#000000");
    this.push([
      "q",
      this.alphaOp(opts?.opacity),
      `${n(r)} ${n(g)} ${n(b)} rg`,
      `${n(x)} ${n(this.height - y - h)} ${n(w)} ${n(h)} re f`,
      "Q",
    ]);
  }

  drawLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    opts?: { color?: string; width?: number; opacity?: number }
  ): void {
    const [r, g, b] = rgb(opts?.color ?? "#000000");
    this.push([
      "q",
      this.alphaOp(opts?.opacity),
      `${n(r)} ${n(g)} ${n(b)} RG`,
      `${n(opts?.width ?? 0.75)} w`,
      `${n(x1)} ${n(this.height - y1)} m ${n(x2)} ${n(this.height - y2)} l S`,
      "Q",
    ]);
  }

  /** `y` is the TOP edge of the image box. */
  drawImage(
    image: PdfImage,
    opts: { x: number; y: number; width: number; height: number; opacity?: number }
  ): void {
    this.push([
      "q",
      this.alphaOp(opts.opacity),
      `${n(opts.width)} 0 0 ${n(opts.height)} ${n(opts.x)} ${n(this.height - opts.y - opts.height)} cm`,
      `/Im${image.id} Do`,
      "Q",
    ]);
  }

  /** Fit a box of `w`×`h` inside `maxW`×`maxH` without distorting it. */
  static fit(
    w: number,
    h: number,
    maxW: number,
    maxH: number
  ): { width: number; height: number } {
    const scale = Math.min(maxW / w, maxH / h);
    return { width: w * scale, height: h * scale };
  }

  /** Serialize the whole document. */
  toBytes(): Uint8Array<ArrayBuffer> {
    if (this.pages.length === 0) this.addPage();

    const objects: Uint8Array[] = [];
    /** Reserve an object number; bodies are filled in below. */
    const alloc = (): number => {
      objects.push(new Uint8Array(0));
      return objects.length;
    };
    const put = (id: number, body: string | Uint8Array) => {
      objects[id - 1] = typeof body === "string" ? raw(body) : body;
    };

    const catalogId = alloc();
    const pagesId = alloc();
    const fontRegularId = alloc();
    const fontBoldId = alloc();
    const infoId = alloc();

    put(
      fontRegularId,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
    );
    put(
      fontBoldId,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
    );

    // Images (and their soft masks) are shared across every page.
    const imageIds: number[] = [];
    this.images.forEach((img, i) => {
      let smaskRef = "";
      if (img.smask) {
        const smaskId = alloc();
        put(
          smaskId,
          concat([
            raw(
              `<< /Type /XObject /Subtype /Image /Width ${img.smask.width} /Height ${img.smask.height} ` +
                `/ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${img.smask.data.length} >>\nstream\n`
            ),
            img.smask.data,
            raw("\nendstream"),
          ])
        );
        smaskRef = ` /SMask ${smaskId} 0 R`;
      }
      const id = alloc();
      imageIds[i] = id;
      put(
        id,
        concat([
          raw(
            `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} ` +
              `/ColorSpace ${img.colorSpace} /BitsPerComponent ${img.bitsPerComponent} ` +
              `/Filter ${img.filter}${img.decodeParms ? ` /DecodeParms ${img.decodeParms}` : ""}` +
              `${smaskRef} /Length ${img.data.length} >>\nstream\n`
          ),
          img.data,
          raw("\nendstream"),
        ])
      );
    });

    // One ExtGState per distinct opacity. `/ca` covers fills, which is what
    // both text and images are painted with; `/CA` covers strokes.
    const gsIds = this.alphas.map((a) => {
      const id = alloc();
      put(id, `<< /Type /ExtGState /ca ${n(a)} /CA ${n(a)} >>`);
      return id;
    });

    const xobjects = imageIds.map((id, i) => `/Im${i} ${id} 0 R`).join(" ");
    const extgstates = gsIds.map((id, i) => `/GS${i} ${id} 0 R`).join(" ");
    const resources =
      `<< /ProcSet [/PDF /Text /ImageB /ImageC /ImageI] ` +
      `/Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >>` +
      (xobjects ? ` /XObject << ${xobjects} >>` : "") +
      (extgstates ? ` /ExtGState << ${extgstates} >>` : "") +
      " >>";

    const pageIds: number[] = [];
    for (const ops of this.pages) {
      const contentId = alloc();
      const body = ops.join("\n");
      put(contentId, `<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
      const pageId = alloc();
      pageIds.push(pageId);
      put(
        pageId,
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${n(this.width)} ${n(this.height)}] ` +
          `/Resources ${resources} /Contents ${contentId} 0 R >>`
      );
    }

    put(
      pagesId,
      `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds
        .map((id) => `${id} 0 R`)
        .join(" ")}] >>`
    );
    put(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    put(
      infoId,
      `<< /Title (${pdfString(this.meta.title)}) /Author (${pdfString(this.meta.author)}) ` +
        `/Subject (${pdfString(this.meta.subject)}) /Producer (E-Drift Trikes storefront) ` +
        `/CreationDate (${pdfDate(new Date())}) >>`
    );

    // --- Assemble, tracking byte offsets for the cross-reference table. ------
    const chunks: Uint8Array[] = [];
    let offset = 0;
    const write = (part: Uint8Array) => {
      chunks.push(part);
      offset += part.length;
    };

    write(raw("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")); // binary comment marks it non-ASCII
    const offsets: number[] = [];
    objects.forEach((body, i) => {
      offsets[i] = offset;
      write(raw(`${i + 1} 0 obj\n`));
      write(body);
      write(raw("\nendobj\n"));
    });

    const xrefAt = offset;
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const o of offsets) xref += `${String(o).padStart(10, "0")} 00000 n \n`;
    write(raw(xref));
    write(
      raw(
        `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\n` +
          `startxref\n${xrefAt}\n%%EOF\n`
      )
    );

    return concat(chunks);
  }

  // --- internals -----------------------------------------------------------

  private push(ops: (string | null | undefined)[]): void {
    if (this.current < 0) this.addPage();
    this.pages[this.current].push(...(ops.filter(Boolean) as string[]));
  }

  /** `/GSn gs`, allocating a graphics state for this alpha the first time. */
  private alphaOp(alpha?: number): string {
    if (alpha === undefined || alpha >= 1) return "";
    const value = Math.max(0, Math.min(1, alpha));
    let index = this.alphas.indexOf(value);
    if (index === -1) {
      this.alphas.push(value);
      index = this.alphas.length - 1;
    }
    return `/GS${index} gs`;
  }
}

function pdfDate(d: Date): string {
  const p = (v: number) => String(v).padStart(2, "0");
  return (
    `D:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}
