import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  RELOAD_GUARD_MS,
  isStaleBundleError,
  reloadOnceForStaleBundle,
} from "../lib/stale-bundle";

/**
 * Recovering from a deploy.
 *
 * A visitor holding HTML from the previous build asks for JavaScript files
 * that no longer exist. Nothing is broken — they are holding yesterday's page
 * — but React throws, and because the root layout's own client components are
 * what fail, the error lands on global-error.tsx, which used to offer a "Try
 * again" button that re-rendered the same missing bundle. That button could
 * not work, so a successful deploy left customers on a dead page.
 *
 * Two things have to hold at once, and they pull against each other:
 *   - a stale bundle must reload, or the visitor is stuck;
 *   - it must NEVER reload in a loop, which is worse than the error page.
 */

type Fake = { reloads: number; store: Map<string, string>; now: number };
let fake: Fake;
const g = globalThis as unknown as {
  window?: unknown;
  sessionStorage?: unknown;
};
const saved = { window: g.window, sessionStorage: g.sessionStorage };

/** `blocked` mimics private mode / cleared site data, where storage throws. */
function install(blocked = false) {
  fake = { reloads: 0, store: new Map(), now: 1_000_000 };
  const sessionStorage = {
    getItem: (k: string) => {
      if (blocked) throw new Error("storage disabled");
      return fake.store.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (blocked) throw new Error("storage disabled");
      fake.store.set(k, v);
    },
  };
  g.sessionStorage = sessionStorage;
  g.window = { location: { reload: () => fake.reloads++ }, sessionStorage };
}

beforeEach(() => install());
afterEach(() => {
  g.window = saved.window;
  g.sessionStorage = saved.sessionStorage;
});

describe("telling a missing bundle from a real fault", () => {
  test("the errors a bundler throws when the file is gone", () => {
    for (const e of [
      { name: "ChunkLoadError", message: "Loading chunk 4821 failed." },
      { name: "Error", message: "Loading CSS chunk 12 failed" },
      { name: "TypeError", message: "Failed to fetch dynamically imported module: /_next/static/chunks/a.js" },
      { name: "TypeError", message: "error loading dynamically imported module" },
      { name: "Error", message: "Importing a module script failed." },
      { name: "Error", message: "Unable to preload CSS for /_next/static/css/x.css" },
    ]) {
      assert.equal(isStaleBundleError(e), true, e.message);
    }
  });

  test("A REAL FAULT IS NOT RELOADED AWAY", () => {
    // Reloading a genuine bug just hides it, and an auto-reload on a crash
    // that recurs on render is an infinite loop pointed at the shop.
    for (const e of [
      { name: "TypeError", message: "Cannot read properties of undefined (reading 'id')" },
      { name: "Error", message: "No Stripe publishable key" },
      { name: "Error", message: "Invariant: incrementalCache missing" },
      { name: "Error", message: "fetch failed" },
    ]) {
      assert.equal(isStaleBundleError(e), false, e.message);
      assert.equal(reloadOnceForStaleBundle(e, fake.now), false, e.message);
    }
    assert.equal(fake.reloads, 0, "a real fault triggered a reload");
  });

  test("nothing at all is not a stale bundle", () => {
    for (const e of [null, undefined, "", 0, {}]) {
      assert.equal(isStaleBundleError(e), false, JSON.stringify(e));
    }
  });

  test("it does not depend on which field carries the text", () => {
    assert.equal(isStaleBundleError({ name: "ChunkLoadError" }), true);
    assert.equal(isStaleBundleError({ message: "Loading chunk 9 failed" }), true);
  });
});

describe("reloading once, and only once", () => {
  const STALE = { name: "ChunkLoadError", message: "Loading chunk 4821 failed." };

  test("a stale bundle reloads", () => {
    assert.equal(reloadOnceForStaleBundle(STALE, fake.now), true);
    assert.equal(fake.reloads, 1);
  });

  test("A SECOND FAILURE MOMENTS LATER DOES NOT LOOP", () => {
    // If the reload comes back with the same stale HTML — an edge cache, say —
    // reloading again, and again, is worse than the error page.
    assert.equal(reloadOnceForStaleBundle(STALE, fake.now), true);
    assert.equal(reloadOnceForStaleBundle(STALE, fake.now + 1), false);
    assert.equal(reloadOnceForStaleBundle(STALE, fake.now + RELOAD_GUARD_MS - 1), false);
    assert.equal(fake.reloads, 1, "it looped");
  });

  test("but a later navigation CAN recover", () => {
    // The bug this replaced: a once-per-session flag that was never cleared,
    // so one stale chunk early on meant the error page for the whole visit.
    assert.equal(reloadOnceForStaleBundle(STALE, fake.now), true);
    assert.equal(reloadOnceForStaleBundle(STALE, fake.now + RELOAD_GUARD_MS), true);
    assert.equal(fake.reloads, 2);
  });

  test("blocked storage shows the message rather than risking a loop", () => {
    install(true);
    assert.equal(reloadOnceForStaleBundle(STALE, fake.now), false);
    assert.equal(fake.reloads, 0);
  });
});
