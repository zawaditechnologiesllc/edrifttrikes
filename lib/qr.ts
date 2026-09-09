/**
 * A QR encoder, written out rather than depended upon.
 *
 * lib/pdf.ts is deliberately dependency-free so the documents render unchanged
 * on the Cloudflare Workers runtime; a QR code drawn into one of those documents
 * has to hold to the same rule. The output is a boolean matrix — drawing it is
 * the caller's job and amounts to one filled square per dark module.
 *
 * SCOPE, on purpose: byte mode, versions 1–10, all four error-correction
 * levels. That covers any URL up to a few hundred characters, which is what
 * this is for. Anything longer throws rather than silently producing a code
 * that will not scan.
 *
 * ⚠️ AN ENCODER THAT IS SUBTLY WRONG STILL PRODUCES A PLAUSIBLE PICTURE. A
 * mis-set format bit or a mask scored wrong yields a tidy square of noise that
 * looks completely normal and scans on nothing. So tests/qr.test.ts round-trips
 * the output through a real decoder rather than asserting on module counts.
 *
 * Reference: ISO/IEC 18004. The tables below are from that spec and are the
 * part worth double-checking if anything ever looks off.
 */

export type EccLevel = "L" | "M" | "Q" | "H";

/** Total codewords (data + error correction) per version, index 1–10. */
const TOTAL_CODEWORDS = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346];

/**
 * Block structure per version and ECC level:
 * [ec codewords per block, group-1 blocks, group-1 data, group-2 blocks, group-2 data]
 */
const BLOCKS: Record<EccLevel, number[][]> = {
  L: [
    [], [7, 1, 19, 0, 0], [10, 1, 34, 0, 0], [15, 1, 55, 0, 0], [20, 1, 80, 0, 0],
    [26, 1, 108, 0, 0], [18, 2, 68, 0, 0], [20, 2, 78, 0, 0], [24, 2, 97, 0, 0],
    [30, 2, 116, 0, 0], [18, 2, 68, 2, 69],
  ],
  M: [
    [], [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0],
    [24, 2, 43, 0, 0], [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39],
    [22, 3, 36, 2, 37], [26, 4, 43, 1, 44],
  ],
  Q: [
    [], [13, 1, 13, 0, 0], [22, 1, 22, 0, 0], [18, 2, 17, 0, 0], [26, 2, 24, 0, 0],
    [18, 2, 15, 2, 16], [24, 4, 19, 0, 0], [18, 2, 14, 4, 15], [22, 4, 18, 2, 19],
    [20, 4, 16, 4, 17], [24, 6, 19, 2, 20],
  ],
  H: [
    [], [17, 1, 9, 0, 0], [28, 1, 16, 0, 0], [22, 2, 13, 0, 0], [16, 4, 9, 0, 0],
    [22, 2, 11, 2, 12], [28, 4, 15, 0, 0], [26, 4, 13, 1, 14], [26, 4, 14, 2, 15],
    [24, 4, 12, 4, 13], [28, 6, 15, 2, 16],
  ],
};

/** Centres of the alignment patterns, per version. */
const ALIGNMENT = [
  [], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
  [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
];

/** ECC level as the two bits that go into the format information. */
const ECC_BITS: Record<EccLevel, number> = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 };

const MAX_VERSION = 10;

/* -------------------------------------------------------------------------- */
/* GF(256)                                                                     */
/* -------------------------------------------------------------------------- */

// Reed-Solomon works over GF(256) with the primitive polynomial x^8+x^4+x^3+x^2+1
// (0x11D). Log/antilog tables turn field multiplication into an addition.
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const gfMul = (a: number, b: number): number =>
  a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];

/** The generator polynomial for `degree` error-correction codewords. */
function generatorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

/** The error-correction codewords for one block. */
function eccFor(data: number[], count: number): number[] {
  const gen = generatorPoly(count);
  const remainder = new Array<number>(count).fill(0);
  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    for (let i = 0; i < count; i++) {
      remainder[i] ^= gfMul(gen[i + 1], factor);
    }
  }
  return remainder;
}

/* -------------------------------------------------------------------------- */
/* Encoding                                                                    */
/* -------------------------------------------------------------------------- */

/** UTF-8 bytes, which is what byte mode carries. */
function utf8(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

/** Data capacity in bytes for a version and ECC level. */
function dataCapacity(version: number, ecc: EccLevel): number {
  const [, g1, d1, g2, d2] = BLOCKS[ecc][version];
  return g1 * d1 + g2 * d2;
}

/** The smallest version that will hold `byteCount` at this ECC level. */
function smallestVersion(byteCount: number, ecc: EccLevel): number {
  for (let v = 1; v <= MAX_VERSION; v++) {
    // Byte mode: 4 mode bits + the character count indicator (8 bits below
    // version 10, 16 from version 10 up).
    const countBits = v < 10 ? 8 : 16;
    const needed = 4 + countBits + byteCount * 8;
    if (needed <= dataCapacity(v, ecc) * 8) return v;
  }
  throw new Error(
    `QR: ${byteCount} bytes will not fit in version ${MAX_VERSION} at level ${ecc}.`
  );
}

/** Data codewords: mode, length, payload, terminator, padding. */
function dataCodewords(bytes: number[], version: number, ecc: EccLevel): number[] {
  const bits: number[] = [];
  const push = (value: number, width: number) => {
    for (let i = width - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };

  push(0b0100, 4); // byte mode
  push(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) push(b, 8);

  const capacityBits = dataCapacity(version, ecc) * 8;
  // Terminator: up to four zero bits, fewer if there is not room.
  for (let i = 0; i < 4 && bits.length < capacityBits; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    codewords.push(bits.slice(i, i + 8).reduce((n, bit) => (n << 1) | bit, 0));
  }
  // Pad bytes, alternating, as the spec prescribes.
  const pad = [0xec, 0x11];
  for (let i = 0; codewords.length < capacityBits / 8; i++) {
    codewords.push(pad[i % 2]);
  }
  return codewords;
}

/**
 * Split into blocks, add error correction, and interleave.
 *
 * Interleaving is what makes a QR survive a coffee ring: consecutive codewords
 * end up physically far apart, so damage in one place is spread thinly across
 * every block rather than destroying one of them.
 */
function interleave(codewords: number[], version: number, ecc: EccLevel): number[] {
  const [ecPerBlock, g1, d1, g2, d2] = BLOCKS[ecc][version];
  const blocks: number[][] = [];
  const eccBlocks: number[][] = [];

  let at = 0;
  for (let i = 0; i < g1; i++) {
    const block = codewords.slice(at, at + d1);
    at += d1;
    blocks.push(block);
    eccBlocks.push(eccFor(block, ecPerBlock));
  }
  for (let i = 0; i < g2; i++) {
    const block = codewords.slice(at, at + d2);
    at += d2;
    blocks.push(block);
    eccBlocks.push(eccFor(block, ecPerBlock));
  }

  const out: number[] = [];
  const longest = Math.max(d1, d2);
  for (let i = 0; i < longest; i++) {
    for (const block of blocks) if (i < block.length) out.push(block[i]);
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const block of eccBlocks) out.push(block[i]);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Module placement                                                            */
/* -------------------------------------------------------------------------- */

type Grid = {
  size: number;
  /** null = still free for data. */
  modules: (boolean | null)[][];
  /** True where a function pattern sits, which masking must not touch. */
  reserved: boolean[][];
};

function blankGrid(version: number): Grid {
  const size = version * 4 + 17;
  return {
    size,
    modules: Array.from({ length: size }, () => new Array(size).fill(null)),
    reserved: Array.from({ length: size }, () => new Array(size).fill(false)),
  };
}

function setModule(grid: Grid, row: number, col: number, dark: boolean): void {
  grid.modules[row][col] = dark;
  grid.reserved[row][col] = true;
}

/** Finder patterns, their separators, timing, the dark module, format areas. */
function drawFunctionPatterns(grid: Grid, version: number): void {
  const { size } = grid;

  const finder = (top: number, left: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = top + r;
        const col = left + c;
        if (row < 0 || row >= size || col < 0 || col >= size) continue;
        const inRing = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const outer = inRing && (r === 0 || r === 6 || c === 0 || c === 6);
        const core = inRing && r >= 2 && r <= 4 && c >= 2 && c <= 4;
        setModule(grid, row, col, outer || core);
      }
    }
  };
  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);

  // Timing patterns: the alternating row and column that let a scanner work out
  // the module pitch.
  for (let i = 8; i < size - 8; i++) {
    setModule(grid, 6, i, i % 2 === 0);
    setModule(grid, i, 6, i % 2 === 0);
  }

  // Alignment patterns, skipping the three corners the finders already occupy.
  const centres = ALIGNMENT[version];
  for (const r of centres) {
    for (const c of centres) {
      const nearFinder =
        (r === 6 && c === 6) ||
        (r === 6 && c === size - 7) ||
        (r === size - 7 && c === 6);
      if (nearFinder) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const ring = Math.max(Math.abs(dr), Math.abs(dc));
          setModule(grid, r + dr, c + dc, ring !== 1);
        }
      }
    }
  }

  // The one module that is always dark.
  setModule(grid, size - 8, 8, true);

  // Reserve the format-information areas; the bits go in once the mask is known.
  for (let i = 0; i < 9; i++) {
    if (grid.modules[8][i] === null) setModule(grid, 8, i, false);
    if (grid.modules[i][8] === null) setModule(grid, i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    if (grid.modules[8][size - 1 - i] === null) setModule(grid, 8, size - 1 - i, false);
    if (grid.modules[size - 1 - i][8] === null) setModule(grid, size - 1 - i, 8, false);
  }

  // Version information, for version 7 and up only.
  if (version >= 7) {
    const bits = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >> i) & 1) === 1;
      const a = Math.floor(i / 3);
      const b = (i % 3) + size - 11;
      setModule(grid, a, b, bit);
      setModule(grid, b, a, bit);
    }
  }
}

/**
 * BCH(18,6) version information, for version 7 and up.
 *
 * SIX iterations, not twelve: there are six data bits to clear (17 down to 12),
 * and the generator shift is 5-i, which goes negative the moment the loop runs
 * past that. A version-8 code with this wrong is a code that scans on nothing —
 * and versions 1-6 carry no version block at all, so the whole class of bug
 * hides until a payload happens to be long enough.
 */
function versionBits(version: number): number {
  let rest = version << 12;
  for (let i = 0; i < 6; i++) {
    if ((rest >> (17 - i)) & 1) rest ^= 0x1f25 << (5 - i);
  }
  return (version << 12) | rest;
}

/** BCH(15,5) format information, masked with 0x5412 as the spec requires. */
function formatBits(ecc: EccLevel, mask: number): number {
  const data = (ECC_BITS[ecc] << 3) | mask;
  let rest = data << 10;
  for (let i = 0; i < 5; i++) {
    if ((rest >> (14 - i)) & 1) rest ^= 0x537 << (4 - i);
  }
  return ((data << 10) | rest) ^ 0x5412;
}

/**
 * Lay the codeword bits into the free modules.
 *
 * Two columns at a time, right to left, zigzagging up then down — and skipping
 * column 6 entirely, because that is the vertical timing pattern.
 */
function placeData(grid: Grid, codewords: number[]): void {
  const { size } = grid;
  const bits: number[] = [];
  for (const word of codewords) {
    for (let i = 7; i >= 0; i--) bits.push((word >> i) & 1);
  }

  let bit = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (const col of [right, right - 1]) {
        if (grid.modules[row][col] !== null) continue;
        // Remaining modules past the end of the data are left light, which is
        // what the spec's "remainder bits" amount to.
        grid.modules[row][col] = bit < bits.length ? bits[bit] === 1 : false;
        bit++;
      }
    }
    upward = !upward;
  }
}

const MASKS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/**
 * How bad a masked grid is, by the spec's four penalty rules.
 *
 * The point of masking is to avoid long runs and large blocks of one colour,
 * which confuse a scanner — and above all to avoid anything resembling a finder
 * pattern out in the data.
 */
function penalty(matrix: boolean[][]): number {
  const size = matrix.length;
  let score = 0;

  // Rule 1: runs of five or more.
  const runs = (get: (i: number, j: number) => boolean) => {
    for (let i = 0; i < size; i++) {
      let run = 1;
      for (let j = 1; j < size; j++) {
        if (get(i, j) === get(i, j - 1)) {
          run++;
        } else {
          if (run >= 5) score += 3 + (run - 5);
          run = 1;
        }
      }
      if (run >= 5) score += 3 + (run - 5);
    }
  };
  runs((i, j) => matrix[i][j]);
  runs((i, j) => matrix[j][i]);

  // Rule 2: 2×2 blocks of one colour.
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = matrix[r][c];
      if (v === matrix[r][c + 1] && v === matrix[r + 1][c] && v === matrix[r + 1][c + 1]) {
        score += 3;
      }
    }
  }

  // Rule 3: anything that looks like a finder pattern.
  const A = [true, false, true, true, true, false, true, false, false, false, false];
  const B = [false, false, false, false, true, false, true, true, true, false, true];
  const matches = (line: boolean[], pattern: boolean[], at: number) =>
    pattern.every((p, i) => line[at + i] === p);
  for (let i = 0; i < size; i++) {
    const row = matrix[i];
    const col = matrix.map((r) => r[i]);
    for (let j = 0; j + 11 <= size; j++) {
      if (matches(row, A, j) || matches(row, B, j)) score += 40;
      if (matches(col, A, j) || matches(col, B, j)) score += 40;
    }
  }

  // Rule 4: how far the dark proportion strays from half.
  let dark = 0;
  for (const row of matrix) for (const v of row) if (v) dark++;
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

/** Apply a mask and write the matching format bits. */
function applyMask(grid: Grid, mask: number, ecc: EccLevel): boolean[][] {
  const { size } = grid;
  const out = grid.modules.map((row, r) =>
    row.map((value, c) => {
      const dark = value === true;
      // Function patterns are never masked.
      return grid.reserved[r][c] ? dark : dark !== MASKS[mask](r, c);
    })
  );

  /**
   * The format information, written twice so that losing one corner does not
   * cost the scanner the ECC level and mask.
   *
   * The cells are listed out rather than computed. Both copies run MSB FIRST —
   * position 0 carries bit 14 — and copy 2's vertical arm is seven cells, not
   * eight: (size-8, 8) is the always-dark module and is not part of the format
   * information. Getting either of those wrong produces a tidy square that
   * decodes to nothing at all, which is exactly how this was first written.
   */
  const bits = formatBits(ecc, mask);
  const copy1: [number, number][] = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  const copy2: [number, number][] = [
    [size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8],
    [size - 5, 8], [size - 6, 8], [size - 7, 8],
    [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5],
    [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1],
  ];
  for (let n = 0; n < 15; n++) {
    const bit = ((bits >> (14 - n)) & 1) === 1;
    out[copy1[n][0]][copy1[n][1]] = bit;
    out[copy2[n][0]][copy2[n][1]] = bit;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Public                                                                      */
/* -------------------------------------------------------------------------- */

export type QrMatrix = {
  /** Modules per side, excluding the quiet zone. */
  size: number;
  /** `true` is a dark module. Indexed [row][col]. */
  modules: boolean[][];
  version: number;
  ecc: EccLevel;
  /** Which of the eight mask patterns scored best. */
  mask: number;
};

/**
 * Encode `text` as a QR matrix.
 *
 * Level Q by default: it tolerates about a quarter of the code being lost,
 * which is the right trade for something printed on a document that will be
 * photocopied, scanned, faxed and photographed off a screen.
 */
export function encodeQr(text: string, ecc: EccLevel = "Q"): QrMatrix {
  const bytes = utf8(text);
  if (bytes.length === 0) throw new Error("QR: nothing to encode.");

  const version = smallestVersion(bytes.length, ecc);
  const codewords = interleave(dataCodewords(bytes, version, ecc), version, ecc);
  if (codewords.length !== TOTAL_CODEWORDS[version]) {
    // A mismatch means the block table and the capacity table disagree, which
    // would produce a tidy square that scans on nothing.
    throw new Error(
      `QR: built ${codewords.length} codewords, expected ${TOTAL_CODEWORDS[version]} ` +
        `for version ${version}${ecc}.`
    );
  }

  const grid = blankGrid(version);
  drawFunctionPatterns(grid, version);
  placeData(grid, codewords);

  let best: boolean[][] | null = null;
  let bestMask = 0;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = applyMask(grid, mask, ecc);
    const score = penalty(candidate);
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
      bestMask = mask;
    }
  }

  return { size: grid.size, modules: best!, version, ecc, mask: bestMask };
}


/** Internals, exposed for the layer-by-layer tests in tests/qr.test.ts. */
export const __internals = {
  dataCodewords,
  interleave,
  formatBits,
  versionBits,
  /** Every mask applied to the same grid — used to isolate placement bugs. */
  penalty,
  allMasks(text: string, ecc: EccLevel) {
    const bytes = utf8(text);
    const version = smallestVersion(bytes.length, ecc);
    const codewords = interleave(dataCodewords(bytes, version, ecc), version, ecc);
    const grid = blankGrid(version);
    drawFunctionPatterns(grid, version);
    placeData(grid, codewords);
    return Array.from({ length: 8 }, (_, m) => applyMask(grid, m, ecc));
  },
};
