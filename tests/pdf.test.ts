import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PdfDocument, A4, toWinAnsi, probeImage } from "../lib/pdf";

/**
 * The PDF writer.
 *
 * These tests read the BYTES the writer produces rather than trusting its API,
 * because the failure mode that matters is a file a PDF reader rejects or
 * renders wrong — something no amount of exercising the builder would reveal.
 */

// ---------------------------------------------------------------------------
// Reading a generated PDF back
// ---------------------------------------------------------------------------

/** The PDF as a latin-1 string, which is how its syntax is actually encoded. */
function asText(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 8192)));
  }
  return s;
}

/**
 * Every string the document draws, in order. Content streams are written
 * uncompressed, so the drawing operators can be read straight out.
 */
function drawnText(bytes: Uint8Array): string[] {
  const out: string[] = [];
  const source = asText(bytes);
  const re = /\(((?:[^\\()]|\\.)*)\)\s*Tj/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    out.push(match[1].replace(/\\([\\()])/g, "$1"));
  }
  return out;
}

/** Where each drawn string was positioned, as [x, y] in PDF coordinates. */
function drawnAt(bytes: Uint8Array): number[][] {
  const out: number[][] = [];
  const re = /1 0 0 1 (-?[\d.]+) (-?[\d.]+) Tm/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(asText(bytes)))) {
    out.push([Number(match[1]), Number(match[2])]);
  }
  return out;
}

/**
 * Follow the cross-reference table the way a reader does, checking each offset
 * actually lands on the object it claims. A wrong offset is THE way a
 * hand-written PDF fails — and it fails silently until something opens it.
 */
function checkXref(bytes: Uint8Array): number {
  const source = asText(bytes);
  const startxref = /startxref\s+(\d+)/.exec(source);
  assert.ok(startxref, "no startxref");
  const table = source.slice(Number(startxref[1]));
  assert.ok(table.startsWith("xref"), "startxref does not point at the xref table");

  const header = /^xref\s+0\s+(\d+)\s/.exec(table);
  assert.ok(header, "malformed xref header");
  const count = Number(header[1]);

  const entries = [...table.matchAll(/^(\d{10}) (\d{5}) ([nf]) $/gm)];
  assert.equal(entries.length, count, "xref entry count does not match /Size");

  entries.forEach((entry, i) => {
    if (entry[3] === "f") return; // the free head
    const offset = Number(entry[1]);
    assert.ok(
      source.startsWith(`${i} 0 obj`, offset),
      `xref entry ${i} points at ${offset}, which is not "${i} 0 obj"`
    );
  });
  return count;
}

// ---------------------------------------------------------------------------

describe("toWinAnsi", () => {
  test("maps the punctuation people actually type", () => {
    // Each of these has a WinAnsi code point that differs from its Unicode one.
    assert.equal(toWinAnsi("–"), "\u0096"); // en dash
    assert.equal(toWinAnsi("—"), "\u0097"); // em dash
    assert.equal(toWinAnsi("’"), "\u0092"); // right single quote
    assert.equal(toWinAnsi("“”"), "\u0093\u0094");
    assert.equal(toWinAnsi("…"), "\u0085"); // ellipsis
    assert.equal(toWinAnsi("•"), "\u0095"); // bullet
  });

  test("IS IDEMPOTENT — the whole pipeline depends on it", () => {
    // wrap() encodes so it can measure, then drawText() encodes the result
    // again. A second pass that treated 0x80–0x9F as C1 control codes deleted
    // every en dash and curly quote the first pass had just produced.
    const source = "18–22 miles — “quoted” · 25°C · café";
    const once = toWinAnsi(source);
    assert.equal(toWinAnsi(once), once, "a second pass changed the text");
    assert.ok(once.includes("\u0096"), "the en dash did not survive the first pass");
    assert.ok(toWinAnsi(once).includes("\u0096"), "the en dash did not survive the second");
  });

  test("keeps latin-1 letters as themselves", () => {
    assert.equal(toWinAnsi("café £50 25°C"), "café £50 25°C");
  });

  test("strips accents off letters WinAnsi doesn't have, rather than dropping them", () => {
    assert.equal(toWinAnsi("Ā"), "A");
    assert.equal(toWinAnsi("Ǎǔ"), "Au");
    // The base letter can itself be a high WinAnsi one: "Ǽ" decomposes to "Æ"
    // plus an acute, and Æ is representable — dropping it would lose a letter
    // the font can perfectly well draw.
    assert.equal(toWinAnsi("Ǽ"), "Æ");
  });

  test("drops what it cannot represent at all", () => {
    // Standard-14 fonts are WinAnsi-only; a non-Latin script needs an embedded
    // font, which this writer deliberately doesn't do.
    assert.equal(toWinAnsi("你好"), "");
  });

  test("normalises whitespace so it can't break the content stream", () => {
    assert.equal(toWinAnsi("a\nb\tc"), "a b c");
    assert.equal(toWinAnsi("a\u00a0b"), "a b"); // non-breaking space
    assert.equal(toWinAnsi("a\u0000b"), "ab"); // control character
  });
});

describe("measuring and wrapping", () => {
  const doc = new PdfDocument();

  test("measures with real glyph widths, not a fixed average", () => {
    // Helvetica: "i" is 222/1000 em, "M" is 833/1000. An estimator that used
    // one average width would report these as equal.
    assert.ok(doc.measure("M", "regular", 100) > doc.measure("i", "regular", 100) * 3);
    assert.equal(doc.measure("MMMM", "regular", 10), 833 * 4 * 0.01);
  });

  test("bold is wider than regular for the same text", () => {
    assert.ok(doc.measure("Handling", "bold", 12) > doc.measure("Handling", "regular", 12));
  });

  test("every wrapped line fits the width it was given", () => {
    const text =
      "The Volt S1 Pro is a rear-wheel-drive electric drift trike built around a 3000W hub motor and a 60V lithium pack.";
    const lines = doc.wrap(text, 200, "regular", 10);
    assert.ok(lines.length > 1, "nothing wrapped");
    for (const line of lines) {
      assert.ok(doc.measure(line, "regular", 10) <= 200, `line overflows: ${line}`);
    }
    assert.equal(lines.join(" "), text, "wrapping lost or reordered words");
  });

  test("breaks a single word too long to fit rather than running off the page", () => {
    const lines = doc.wrap("x".repeat(400), 100, "regular", 10);
    assert.ok(lines.length > 1);
    for (const line of lines) {
      assert.ok(doc.measure(line, "regular", 10) <= 100);
    }
    assert.equal(lines.join(""), "x".repeat(400), "characters were lost");
  });

  test("always returns at least one line", () => {
    assert.deepEqual(doc.wrap("", 200), [""]);
    assert.deepEqual(doc.wrap("   ", 200), [""]);
  });
});

describe("the file a reader opens", () => {
  test("has a header, a valid xref, a trailer and an EOF marker", () => {
    const doc = new PdfDocument({ title: "Spec", author: "E-Drift" });
    doc.addPage();
    doc.drawText("Hello", { x: 40, y: 60 });
    const bytes = doc.toBytes();
    const source = asText(bytes);

    assert.ok(source.startsWith("%PDF-1."), "missing header");
    assert.ok(source.trimEnd().endsWith("%%EOF"), "missing EOF marker");
    assert.match(source, /\/Type \/Catalog/);
    assert.match(source, /\/Type \/Pages/);
    assert.match(source, /\/Type \/Page[^s]/);
    checkXref(bytes);
  });

  test("declares a /Length that matches the bytes actually written", () => {
    // A wrong /Length is the classic hand-rolled-PDF bug: readers stop reading
    // the content stream early and the page comes out blank or half-drawn. It
    // bites hardest with high-byte text, where a UTF-8 length would disagree.
    const doc = new PdfDocument();
    doc.addPage();
    doc.drawText("Curly ’quotes’, an em—dash and a (paren)", { x: 40, y: 60 });
    const source = asText(doc.toBytes());
    const re = /<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g;
    let match: RegExpExecArray | null;
    let checked = 0;
    while ((match = re.exec(source))) {
      assert.equal(match[2].length, Number(match[1]), "stream /Length disagrees with the stream");
      checked++;
    }
    assert.ok(checked > 0, "no content stream found");
  });

  test("escapes parentheses and backslashes so a name can't break the syntax", () => {
    const doc = new PdfDocument();
    doc.addPage();
    doc.drawText("Trike (Pro) \\ Edition", { x: 40, y: 60 });
    const bytes = doc.toBytes();
    assert.match(asText(bytes), /\\\(Pro\\\)/);
    assert.deepEqual(drawnText(bytes), ["Trike (Pro) \\ Edition"]);
    checkXref(bytes);
  });

  test("counts pages and keeps their order", () => {
    const doc = new PdfDocument();
    doc.addPage();
    doc.drawText("one", { x: 40, y: 60 });
    doc.addPage();
    doc.drawText("two", { x: 40, y: 60 });
    assert.equal(doc.pageCount, 2);
    const bytes = doc.toBytes();
    assert.match(asText(bytes), /\/Type \/Pages \/Count 2/);
    assert.deepEqual(drawnText(bytes), ["one", "two"]);
    checkXref(bytes);
  });

  test("eachPage draws on every page, with the total known", () => {
    // Footers can't be written until the page count is final.
    const doc = new PdfDocument();
    doc.addPage();
    doc.addPage();
    doc.addPage();
    doc.eachPage((page, total) => {
      doc.drawText(`Page ${page} of ${total}`, { x: 40, y: 800 });
    });
    assert.deepEqual(drawnText(doc.toBytes()), [
      "Page 1 of 3",
      "Page 2 of 3",
      "Page 3 of 3",
    ]);
  });

  test("carries its metadata", () => {
    const doc = new PdfDocument({ title: "Volt S1", author: "E-Drift", subject: "Sheet" });
    doc.addPage();
    const source = asText(doc.toBytes());
    assert.match(source, /\/Title \(Volt S1\)/);
    assert.match(source, /\/Author \(E-Drift\)/);
    assert.match(source, /\/Subject \(Sheet\)/);
  });

  test("an empty document is still a valid one-page PDF", () => {
    const bytes = new PdfDocument().toBytes();
    checkXref(bytes);
    assert.match(asText(bytes), /\/Type \/Pages \/Count 1/);
  });
});

describe("graphics state", () => {
  test("allocates one ExtGState per distinct opacity, and reuses it", () => {
    const doc = new PdfDocument();
    doc.addPage();
    doc.drawRect(0, 0, 10, 10, { color: "#ff0000", opacity: 0.5 });
    doc.drawRect(0, 0, 10, 10, { color: "#00ff00", opacity: 0.5 });
    doc.drawRect(0, 0, 10, 10, { color: "#0000ff", opacity: 0.1 });
    const source = asText(doc.toBytes());
    assert.equal((source.match(/\/Type \/ExtGState/g) ?? []).length, 2);
    assert.match(source, /\/ca 0\.5/);
    assert.match(source, /\/ca 0\.1/);
  });

  test("fully opaque drawing needs no graphics state at all", () => {
    const doc = new PdfDocument();
    doc.addPage();
    doc.drawText("solid", { x: 10, y: 10 });
    assert.doesNotMatch(asText(doc.toBytes()), /ExtGState/);
  });
});

describe("coordinates", () => {
  test("converts top-left coordinates to PDF's bottom-left origin", () => {
    const doc = new PdfDocument();
    doc.addPage();
    doc.drawText("baseline", { x: 40, y: 100 });
    // 100 down from the top is 841.89 - 100 up from the bottom.
    assert.deepEqual(drawnAt(doc.toBytes()), [[40, A4.height - 100]]);
  });

  test("a rectangle's y is its TOP edge", () => {
    const doc = new PdfDocument();
    doc.addPage();
    doc.drawRect(10, 100, 50, 20);
    // The PDF rect is anchored at its bottom-left: height - y - h.
    assert.match(asText(doc.toBytes()), /10 721\.89 50 20 re f/);
  });

  test("aligns text left, centred and right about x", () => {
    const doc = new PdfDocument();
    doc.addPage();
    doc.drawText("Aligned", { x: 300, y: 50, size: 10 });
    doc.drawText("Aligned", { x: 300, y: 60, size: 10, align: "center" });
    doc.drawText("Aligned", { x: 300, y: 70, size: 10, align: "right" });
    const width = doc.measure("Aligned", "regular", 10);
    const [left, center, right] = drawnAt(doc.toBytes()).map(([x]) => x);
    assert.equal(left, 300);
    assert.ok(Math.abs(center - (300 - width / 2)) < 0.01, "centred text is off-centre");
    assert.ok(Math.abs(right - (300 - width)) < 0.01, "right-aligned text does not end at x");
  });
});

describe("images", () => {
  /**
   * Build a PNG by hand. The decoder ignores chunk CRCs, so this writes zeros
   * for them — everything else (signature, IHDR, IDAT, IEND) is real, and the
   * IDAT is a genuine zlib stream, so the decoder's real paths are exercised.
   */
  async function makePng(
    width: number,
    height: number,
    colorType: 0 | 2 | 6,
    pixel: number[]
  ): Promise<Uint8Array> {
    const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
    const stride = width * channels;
    const raw = new Uint8Array(height * (stride + 1));
    for (let y = 0; y < height; y++) {
      raw[y * (stride + 1)] = 0; // filter type: none
      for (let x = 0; x < width; x++) {
        for (let c = 0; c < channels; c++) {
          raw[y * (stride + 1) + 1 + x * channels + c] = pixel[c];
        }
      }
    }
    const cs = new CompressionStream("deflate");
    const writer = cs.writable.getWriter() as WritableStreamDefaultWriter<Uint8Array>;
    void writer.write(raw);
    void writer.close();
    const idat = new Uint8Array(await new Response(cs.readable).arrayBuffer());

    const chunk = (type: string, data: Uint8Array) => {
      const out = new Uint8Array(12 + data.length);
      new DataView(out.buffer).setUint32(0, data.length);
      for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
      out.set(data, 8);
      return out;
    };
    const ihdr = new Uint8Array(13);
    const view = new DataView(ihdr.buffer);
    view.setUint32(0, width);
    view.setUint32(4, height);
    ihdr[8] = 8; // bit depth
    ihdr[9] = colorType;

    const parts = [
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", idat),
      chunk("IEND", new Uint8Array(0)),
    ];
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) {
      out.set(p, at);
      at += p.length;
    }
    return out;
  }

  test("an opaque PNG is embedded WITHOUT being decompressed", async () => {
    // PDF's /Predictor 15 is exactly PNG's row filtering, so the file's own
    // deflate stream is already a valid PDF image stream. That path is both
    // the cheapest and the lossless one.
    const doc = new PdfDocument();
    const image = await doc.addImage(await makePng(4, 3, 2, [255, 0, 0]));
    assert.ok(image, "RGB PNG was rejected");
    assert.equal(image.width, 4);
    assert.equal(image.height, 3);
    doc.addPage();
    doc.drawImage(image, { x: 0, y: 0, width: 40, height: 30 });
    const source = asText(doc.toBytes());
    assert.match(source, /\/Subtype \/Image/);
    assert.match(source, /\/ColorSpace \/DeviceRGB/);
    assert.match(source, /\/Predictor 15 \/Colors 3 \/BitsPerComponent 8 \/Columns 4/);
    assert.doesNotMatch(source, /\/SMask/, "an opaque image should have no soft mask");
  });

  test("a transparent PNG becomes an image plus a soft mask", async () => {
    // A logo is normally an RGBA PNG. Without the mask its transparent
    // background would print as a black or white box.
    const doc = new PdfDocument();
    const image = await doc.addImage(await makePng(2, 2, 6, [0, 128, 255, 64]));
    assert.ok(image, "RGBA PNG was rejected");
    doc.addPage();
    doc.drawImage(image, { x: 0, y: 0, width: 20, height: 20, opacity: 0.07 });
    const source = asText(doc.toBytes());
    assert.match(source, /\/SMask \d+ 0 R/, "the alpha channel was lost");
    assert.match(source, /\/ColorSpace \/DeviceGray \/BitsPerComponent 8/);
    // The watermark's own opacity is separate from the image's alpha channel.
    assert.match(source, /\/ca 0\.07/);
  });

  test("a greyscale PNG keeps one channel", async () => {
    const doc = new PdfDocument();
    const image = await doc.addImage(await makePng(2, 2, 0, [90]));
    assert.ok(image);
    doc.addPage();
    doc.drawImage(image, { x: 0, y: 0, width: 10, height: 10 });
    assert.match(asText(doc.toBytes()), /\/ColorSpace \/DeviceGray/);
  });

  test("a JPEG is passed through as /DCTDecode", async () => {
    // Minimal baseline frame header: SOI, APP0, SOF0 (8-bit, 6 high, 8 wide,
    // 3 components), EOI. The scan is never decoded by us — PDF speaks JPEG.
    const jpeg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0,
      0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x06, 0x00, 0x08, 0x03,
      1, 0x11, 0, 2, 0x11, 1, 3, 0x11, 1,
      0xff, 0xd9,
    ]);
    const doc = new PdfDocument();
    const image = await doc.addImage(jpeg);
    assert.ok(image, "JPEG was rejected");
    assert.equal(image.width, 8);
    assert.equal(image.height, 6);
    doc.addPage();
    doc.drawImage(image, { x: 0, y: 0, width: 8, height: 6 });
    assert.match(asText(doc.toBytes()), /\/Filter \/DCTDecode/);
  });

  test("anything that isn't an embeddable image is refused, not thrown", async () => {
    // The sheet then falls back to a text watermark rather than 500-ing on a
    // buyer who only wanted a spec sheet.
    const doc = new PdfDocument();
    assert.equal(await doc.addImage(new Uint8Array([1, 2, 3, 4])), null);
    assert.equal(await doc.addImage(new Uint8Array(0)), null);
    // A WebP header — a real possibility from an image upload, and one PDF
    // cannot embed at all.
    const webp = new Uint8Array(16);
    webp.set([0x52, 0x49, 0x46, 0x46], 0);
    webp.set([0x57, 0x45, 0x42, 0x50], 8);
    assert.equal(await doc.addImage(webp), null);
  });

  test("a truncated PNG is refused rather than taking the document down", async () => {
    const png = await makePng(4, 4, 2, [1, 2, 3]);
    const doc = new PdfDocument();
    assert.equal(await doc.addImage(png.subarray(0, 20)), null);
  });
});

describe("fit", () => {
  test("scales to fit without distorting", () => {
    assert.deepEqual(PdfDocument.fit(200, 100, 100, 100), { width: 100, height: 50 });
    assert.deepEqual(PdfDocument.fit(100, 200, 100, 100), { width: 50, height: 100 });
  });

  test("scales up as well as down, keeping the ratio", () => {
    assert.deepEqual(PdfDocument.fit(50, 25, 100, 100), { width: 100, height: 50 });
  });
});

describe("the text watermark", () => {
  test("is scaled down to fit the page rather than running off it", () => {
    const doc = new PdfDocument();
    doc.addPage();
    doc.drawWatermarkText("A VERY LONG COMPANY NAME INDEED & SONS LIMITED", { size: 120 });
    const size = /\/F2 ([\d.]+) Tf/.exec(asText(doc.toBytes()));
    assert.ok(size, "no watermark was drawn");
    assert.ok(Number(size[1]) < 120, "the watermark was not scaled down to fit");
    assert.ok(Number(size[1]) > 5, "the watermark was scaled into invisibility");
  });

  test("leaves a short name at the size it was asked for", () => {
    const doc = new PdfDocument();
    doc.addPage();
    doc.drawWatermarkText("VOLT", { size: 52 });
    assert.match(asText(doc.toBytes()), /\/F2 52 Tf/);
  });

  test("is rotated and faint", () => {
    const doc = new PdfDocument();
    doc.addPage();
    doc.drawWatermarkText("E-DRIFT", { opacity: 0.05 });
    const source = asText(doc.toBytes());
    assert.match(source, /\/ca 0\.05/);
    // A rotation matrix, not a plain translation.
    assert.match(source, /0\.848 0\.53 -0\.53 0\.848 [\d.]+ [\d.]+ cm/);
  });
});

describe("page geometry", () => {
  test("defaults to A4 and says so in the MediaBox", () => {
    const doc = new PdfDocument();
    assert.equal(doc.width, A4.width);
    assert.equal(doc.height, A4.height);
    doc.addPage();
    assert.match(asText(doc.toBytes()), /\/MediaBox \[0 0 595\.28 841\.89\]/);
  });
});

describe("telling an admin why a logo will not print", () => {
  /**
   * The bug behind this: a logo uploaded in the admin appeared in the preview
   * (a browser reads anything) and then silently vanished from every product
   * sheet, because addImage returned null and the sheet fell back to a text
   * watermark. Three completely different causes — wrong format, a variant the
   * writer cannot embed, a file it never received — all looked identical.
   */

  test("rejects a file that is not an image at all", async () => {
    const result = await probeImage(new TextEncoder().encode("<svg xmlns=\"x\"></svg>"));
    assert.equal(result.ok, false);
    assert.match((result as { reason: string }).reason, /not a PNG or a JPEG/i);
    // The message has to name the fix, not just the fault.
    assert.match((result as { reason: string }).reason, /SVG|export/i);
  });

  test("rejects an empty file rather than reporting a format problem", async () => {
    const result = await probeImage(new Uint8Array());
    assert.equal(result.ok, false);
    assert.match((result as { reason: string }).reason, /empty/i);
    assert.equal((await probeImage(null)).ok, false);
  });

  test("says INTERLACED when that is what is wrong", async () => {
    // The commonest real cause: a logo exported with "interlaced"/"progressive"
    // ticked. Without naming it, the owner re-uploads the same file forever.
    const result = await probeImage(await makeInterlacedPng());
    assert.equal(result.ok, false);
    assert.match((result as { reason: string }).reason, /interlaced/i);
  });

  test("a plain 8-bit PNG passes, with its real dimensions", async () => {
    const result = await probeImage(await makePlainPng());
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.kind, "png");
      assert.equal(result.width, 4);
      assert.equal(result.height, 3);
    }
  });

  test("the probe agrees with the writer — no false yes", async () => {
    // A probe that said yes where addImage says no would be worse than none:
    // the upload would be accepted and the sheet would still print nothing.
    const doc = new PdfDocument();
    for (const bytes of [await makePlainPng(), await makeInterlacedPng()]) {
      const probe = await probeImage(bytes);
      const embedded = await doc.addImage(bytes);
      assert.equal(probe.ok, embedded !== null, "probe and writer disagree");
    }
  });

  /** Builders that mirror what a design tool exports. */
  async function makePlainPng(): Promise<Uint8Array> {
    return buildPng(4, 3, 2, [255, 0, 0], 0);
  }
  async function makeInterlacedPng(): Promise<Uint8Array> {
    return buildPng(4, 3, 2, [255, 0, 0], 1);
  }

  async function buildPng(
    width: number,
    height: number,
    colorType: number,
    pixel: number[],
    interlace: 0 | 1
  ): Promise<Uint8Array> {
    const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
    const stride = width * channels;
    const raw = new Uint8Array(height * (stride + 1));
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        for (let c = 0; c < channels; c++) {
          raw[y * (stride + 1) + 1 + x * channels + c] = pixel[c];
        }
      }
    }
    const cs = new CompressionStream("deflate");
    const writer = cs.writable.getWriter() as WritableStreamDefaultWriter<Uint8Array>;
    void writer.write(raw);
    void writer.close();
    const idat = new Uint8Array(await new Response(cs.readable).arrayBuffer());

    const chunk = (type: string, data: Uint8Array) => {
      const out = new Uint8Array(12 + data.length);
      new DataView(out.buffer).setUint32(0, data.length);
      for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
      out.set(data, 8);
      return out;
    };
    const ihdr = new Uint8Array(13);
    const view = new DataView(ihdr.buffer);
    view.setUint32(0, width);
    view.setUint32(4, height);
    ihdr[8] = 8;
    ihdr[9] = colorType;
    ihdr[12] = interlace;

    const parts = [
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", idat),
      chunk("IEND", new Uint8Array(0)),
    ];
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) {
      out.set(p, at);
      at += p.length;
    }
    return out;
  }
});
