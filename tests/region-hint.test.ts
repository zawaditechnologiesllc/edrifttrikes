import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  AUTO_COLLAPSE_MS,
  COLLAPSE_ANIMATION_MS,
  DISMISSED_KEY,
  HUSHED_KEY,
  hushForSession,
  hushForever,
  isHushed,
  type MiniStorage,
} from "../lib/region-hint";

/**
 * REMEMBERING THAT SOMEBODY HAS ALREADY BEEN ASKED.
 *
 * Two answers, and collapsing them into one is the mistake this guards:
 *
 *   "Stay here"          a decision. Asking again on the next page ignores it.
 *   fifteen seconds      not a decision. Treating it as one quietly deletes an
 *                        offer the visitor may never have looked at.
 *
 * So one is kept for good and the other only for the session, and the tests
 * below are mostly about the difference surviving.
 */

function fakeStorage(): MiniStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

/** A browser with storage switched off, which is a real browser. */
const blocked: MiniStorage = {
  getItem() {
    throw new Error("The operation is insecure.");
  },
  setItem() {
    throw new Error("The operation is insecure.");
  },
};

let local: ReturnType<typeof fakeStorage>;
let session: ReturnType<typeof fakeStorage>;
const stores = () => ({ local, session });

beforeEach(() => {
  local = fakeStorage();
  session = fakeStorage();
});

describe("a visitor who has not been asked", () => {
  test("gets asked", () => {
    assert.equal(isHushed("usa.edrifttrikes.shop", stores()), false);
  });

  test("an empty or missing host is never hushed", () => {
    assert.equal(isHushed("", stores()), false);
    assert.equal(isHushed(undefined as unknown as string, stores()), false);
  });
});

describe('"Stay here" — a decision', () => {
  test("is remembered across visits", () => {
    hushForever("usa.edrifttrikes.shop", local);
    assert.equal(isHushed("usa.edrifttrikes.shop", stores()), true);
  });

  test("SURVIVES THE SESSION ENDING", () => {
    // The whole point of using localStorage for this one.
    hushForever("usa.edrifttrikes.shop", local);
    session = fakeStorage(); // new tab, new session
    assert.equal(isHushed("usa.edrifttrikes.shop", stores()), true);
  });

  test("and is per storefront", () => {
    hushForever("usa.edrifttrikes.shop", local);
    assert.equal(isHushed("europe.edrifttrikes.shop", stores()), false);
  });

  test("case does not matter", () => {
    hushForever("USA.EdriftTrikes.Shop", local);
    assert.equal(isHushed("usa.edrifttrikes.shop", stores()), true);
  });
});

describe("fifteen seconds of silence — not a decision", () => {
  test("goes quiet for the rest of the session", () => {
    hushForSession("usa.edrifttrikes.shop", session);
    assert.equal(isHushed("usa.edrifttrikes.shop", stores()), true);
  });

  test("BUT A LATER VISIT IS ASKED AGAIN", () => {
    // Treating silence as a refusal would delete an offer nobody declined.
    hushForSession("usa.edrifttrikes.shop", session);
    session = fakeStorage(); // they come back tomorrow
    assert.equal(isHushed("usa.edrifttrikes.shop", stores()), false);
  });

  test("and it does not write the permanent record", () => {
    hushForSession("usa.edrifttrikes.shop", session);
    assert.equal(local.data.get(DISMISSED_KEY), undefined);
    assert.ok(session.data.get(HUSHED_KEY));
  });
});

describe("storage that does not cooperate", () => {
  test("A BROWSER WITH STORAGE BLOCKED STILL GETS ASKED", () => {
    // Private mode, or an origin with site data switched off. Failing the
    // other way would mean the feature silently never runs for those people.
    assert.equal(isHushed("usa.edrifttrikes.shop", { local: blocked, session: blocked }), false);
  });

  test("and recording a dismissal there throws nothing", () => {
    assert.doesNotThrow(() => hushForever("usa.edrifttrikes.shop", blocked));
    assert.doesNotThrow(() => hushForSession("usa.edrifttrikes.shop", blocked));
  });

  test("no storage at all is handled too", () => {
    assert.equal(isHushed("usa.edrifttrikes.shop", { local: null, session: null }), false);
    assert.doesNotThrow(() => hushForever("usa.edrifttrikes.shop", null));
  });

  test("junk under our key is ignored rather than crashing the header", () => {
    local.data.set(DISMISSED_KEY, "not json at all");
    assert.equal(isHushed("usa.edrifttrikes.shop", stores()), false);
    local.data.set(DISMISSED_KEY, '{"not":"an array"}');
    assert.equal(isHushed("usa.edrifttrikes.shop", stores()), false);
  });

  test("the list cannot grow without bound", () => {
    for (let i = 0; i < 50; i++) hushForever(`host-${i}.example`, local);
    const stored = JSON.parse(local.data.get(DISMISSED_KEY) as string);
    assert.ok(stored.length <= 10, `${stored.length} hosts kept`);
    // The most recent answers are the ones worth keeping.
    assert.ok(stored.includes("host-49.example"));
  });

  test("the same host twice is stored once", () => {
    hushForever("usa.edrifttrikes.shop", local);
    hushForever("usa.edrifttrikes.shop", local);
    assert.deepEqual(JSON.parse(local.data.get(DISMISSED_KEY) as string), [
      "usa.edrifttrikes.shop",
    ]);
  });
});

describe("the timings", () => {
  test("fifteen seconds, as asked", () => {
    assert.equal(AUTO_COLLAPSE_MS, 15_000);
  });

  test("THE FOLD FINISHES WELL INSIDE THE WAIT", () => {
    // The component removes the banner from the page COLLAPSE_ANIMATION_MS
    // after starting the fold. If that ever exceeded the wait, the two timers
    // would overlap and the banner would be pulled mid-animation.
    assert.ok(COLLAPSE_ANIMATION_MS < AUTO_COLLAPSE_MS);
    assert.ok(COLLAPSE_ANIMATION_MS >= 150, "too fast to read as a fold");
    assert.ok(COLLAPSE_ANIMATION_MS <= 600, "slow enough to feel broken");
  });
});
