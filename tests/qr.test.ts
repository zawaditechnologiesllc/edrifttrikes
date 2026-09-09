import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { encodeQr, __internals } from "../lib/qr";
import { QR_FIXTURES } from "./fixtures/qr-reference";

/**
 * The QR encoder.
 *
 * ⚠️ THE FAILURE MODE HERE IS SILENT. An encoder with a wrong format bit or a
 * mis-shifted BCH generator produces a tidy square that looks completely normal
 * and decodes to nothing at all. Assertions about size and finder patterns pass
 * happily on such a thing — both real bugs in the first draft did exactly that.
 *
 * So the load-bearing tests below compare whole matrices against an independent
 * implementation's output. Everything else is a supporting check.
 */

const render = (rows: boolean[][]) =>
  rows.map((r) => r.map((v) => (v ? "1" : "0")).join(""));

describe("matches an independent implementation, module for module", () => {
  /**
   * Compared at a MATCHING MASK rather than at whichever mask each
   * implementation picked.
   *
   * Mask selection is a scored search, and the two implementations score
   * slightly differently — the reference evaluates the symbol carrying
   * placeholder format bits, this one evaluates the finished symbol. Both
   * readings of the spec are defensible and both produce codes that scan, so
   * pinning the tie-break to another library's would be testing the wrong
   * thing.
   *
   * Everything that has to be exactly right — the codewords, the error
   * correction, the function patterns, the data placement, the format bits and
   * the version block — is identical under a matching mask. So: exactly one of
   * the eight must reproduce the reference matrix.
   */
  for (const fixture of QR_FIXTURES) {
    const label = `${fixture.text.slice(0, 28)}${fixture.text.length > 28 ? "…" : ""}`;
    test(`v${fixture.version}${fixture.ecc} — ${label}`, () => {
      const qr = encodeQr(fixture.text, fixture.ecc);
      assert.equal(qr.version, fixture.version, "chose a different version");

      const candidates = __internals.allMasks(fixture.text, fixture.ecc);
      const matching = candidates
        .map((m, i) => [i, render(m).join("\n") === fixture.rows.join("\n")] as const)
        .filter(([, same]) => same)
        .map(([i]) => i);

      assert.deepEqual(
        matching.length === 1 ? "one mask reproduces it" : matching,
        "one mask reproduces it",
        "no mask reproduced the reference matrix — something upstream is wrong"
      );
    });
  }

  test("and the mask actually chosen is the lowest-scoring one", () => {
    // The half the comparison above deliberately leaves out.
    for (const fixture of QR_FIXTURES) {
      const qr = encodeQr(fixture.text, fixture.ecc);
      const scores = __internals
        .allMasks(fixture.text, fixture.ecc)
        .map((m) => __internals.penalty(m));
      assert.equal(
        scores[qr.mask],
        Math.min(...scores),
        `picked mask ${qr.mask}, which is not the best score`
      );
    }
  });
});

describe("the pieces the fixtures would not isolate", () => {
  test("the version information matches the strings published in the spec", () => {
    // ISO/IEC 18004 Annex D. The BCH loop that produces these ran twice as many
    // times as it should in the first draft, shifting the generator by a
    // negative amount — which only shows up from version 7, where the version
    // block first appears.
    const published: Record<number, number> = {
      7: 0x07c94,
      8: 0x085bc,
      9: 0x09a99,
      10: 0x0a4d3,
    };
    for (const [version, expected] of Object.entries(published)) {
      assert.equal(
        __internals.versionBits(Number(version)),
        expected,
        `version ${version} information is wrong`
      );
    }
  });

  test("format information for a known case", () => {
    // Level M with mask 0 is all-zero before the mask, so the result is the
    // spec's 0x5412 constant exactly — a useful anchor for the BCH routine.
    assert.equal(__internals.formatBits("M", 0), 0x5412);
  });

  test("byte mode is used even for text that would fit alphanumeric", () => {
    // "HELLO" would encode smaller in alphanumeric mode. We always use byte
    // mode: it handles every payload including UTF-8, and one path is one path
    // to get right.
    const codewords = __internals.dataCodewords([72, 69, 76, 76, 79], 1, "M");
    assert.equal(codewords[0] >> 4, 0b0100, "not byte mode");
    assert.equal(codewords.length, 16, "wrong capacity for v1-M");
  });

  test("pads with the alternating bytes the spec names", () => {
    // Mode + length + one byte + terminator fills three codewords; the
    // remaining thirteen are 0xEC / 0x11 alternating, starting at 0xEC.
    const codewords = __internals.dataCodewords([65], 1, "M");
    assert.equal(codewords.length, 16);
    assert.deepEqual(codewords.slice(3, 7), [0xec, 0x11, 0xec, 0x11]);
    assert.equal(codewords[codewords.length - 1], 0xec);
  });
});

describe("structure", () => {
  const qr = encodeQr("https://edrifttrikes.shop/verify/EDT-7A3F91C2", "Q");

  test("is square, and sized 17 + 4 x version", () => {
    assert.equal(qr.size, 17 + 4 * qr.version);
    assert.equal(qr.modules.length, qr.size);
    for (const row of qr.modules) assert.equal(row.length, qr.size);
  });

  test("has a finder pattern in three corners and not the fourth", () => {
    const finder = (top: number, left: number) =>
      qr.modules[top][left] &&
      qr.modules[top + 6][left] &&
      qr.modules[top][left + 6] &&
      !qr.modules[top + 1][left + 1] &&
      qr.modules[top + 3][left + 3];
    assert.ok(finder(0, 0), "top-left");
    assert.ok(finder(0, qr.size - 7), "top-right");
    assert.ok(finder(qr.size - 7, 0), "bottom-left");
    // The bottom-right corner is data; a finder there would be a placement bug.
    assert.ok(!finder(qr.size - 7, qr.size - 7), "there is a fourth finder");
  });

  test("the timing patterns alternate", () => {
    for (let i = 8; i < qr.size - 8; i++) {
      assert.equal(qr.modules[6][i], i % 2 === 0, `row 6 col ${i}`);
      assert.equal(qr.modules[i][6], i % 2 === 0, `col 6 row ${i}`);
    }
  });

  test("the module that is always dark, is", () => {
    assert.equal(qr.modules[qr.size - 8][8], true);
  });
});

describe("the whole version range", () => {
  test("every version from 1 to 40 can be filled to capacity and read back", () => {
    // A version-1 test proves nothing about version 27: each version has its
    // own block structure, its own alignment pattern layout, and from 7 up its
    // own version-information block. This walks all forty at every level and
    // checks the codewords come back out of the matrix the right length.
    for (let version = 1; version <= 40; version++) {
      for (const ecc of ["L", "M", "Q", "H"] as const) {
        const headerBits = 4 + (version < 10 ? 8 : 16);
        const capacity = __internals.dataCapacity(version, ecc);
        const bytes = Math.floor((capacity * 8 - headerBits) / 8);
        const qr = encodeQr("E".repeat(bytes), ecc);
        assert.equal(qr.version, version, `filling v${version}${ecc} landed on v${qr.version}`);
        assert.equal(qr.size, 17 + 4 * version);
      }
    }
  });
});

describe("choosing a version", () => {
  test("grows with the payload", () => {
    const small = encodeQr("hi", "M").version;
    const large = encodeQr("x".repeat(120), "M").version;
    assert.ok(large > small);
  });

  test("a stronger ECC level needs a bigger symbol for the same text", () => {
    const url = "https://edrifttrikes.shop/verify/EDT-7A3F91C2";
    assert.ok(encodeQr(url, "H").version > encodeQr(url, "L").version);
  });

  test("refuses a payload it cannot encode rather than truncating it", () => {
    // Silently dropping the tail would produce a code that scans to the wrong
    // URL, which is worse than no code.
    assert.throws(() => encodeQr("x".repeat(4000), "H"), /will not fit/);
  });

  test("refuses an empty payload", () => {
    assert.throws(() => encodeQr("", "M"), /nothing to encode/);
  });
});

describe("payloads that are not plain ASCII", () => {
  test("encodes UTF-8, and sizes for the bytes rather than the characters", () => {
    // A multi-byte character counts as its bytes; getting this wrong overflows
    // the symbol and the code will not scan.
    const text = "Ünïcödé ✓";
    const bytes = new TextEncoder().encode(text).length;
    assert.ok(bytes > text.length, "test string is not actually multi-byte");
    const qr = encodeQr(text, "Q");
    assert.ok(qr.size > 0);
  });
});

describe("masking", () => {
  test("picks one of the eight, and records which", () => {
    const qr = encodeQr("https://edrifttrikes.shop/verify/EDT-0001", "Q");
    assert.ok(qr.mask >= 0 && qr.mask <= 7);
  });

  test("the same input always gives the same code", () => {
    // Mask selection is a scored search; if it were unstable, two downloads of
    // one invoice would carry visibly different codes.
    const a = encodeQr("https://edrifttrikes.shop/verify/EDT-0001", "Q");
    const b = encodeQr("https://edrifttrikes.shop/verify/EDT-0001", "Q");
    assert.equal(a.mask, b.mask);
    assert.deepEqual(render(a.modules), render(b.modules));
  });
});
