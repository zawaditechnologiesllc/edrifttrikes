import { test, describe, afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  checkOptOutToken,
  normalizeEmail,
  optOutLink,
  optOutToken,
} from "../lib/email-optout";

/**
 * THE UNSUBSCRIBE LINK, AND WHO IS ALLOWED TO USE IT.
 *
 * The reminder sequence now runs three times a week for two months and carries
 * a product offer, which makes it commercial email rather than transactional.
 * Commercial email needs an opt-out that works — and one that only the
 * recipient can use.
 *
 * The failure that matters is not an unsubscribe that fails. It is one that
 * succeeds for the wrong person: a bare `?email=` link lets anybody unsubscribe
 * anybody by editing a URL, and the victim's only symptom is email that
 * quietly stops arriving. So the token is signed, and these tests are mostly
 * about forgery.
 */

const realEnv = { ...process.env };
const NOW = new Date("2026-10-14T12:00:00Z");

beforeEach(() => {
  process.env.INTERNAL_API_KEY = "a-long-enough-test-secret";
});
afterEach(() => {
  process.env = { ...realEnv };
});

describe("the address a token is for", () => {
  test("is normalised, so one person cannot opt out twice", () => {
    assert.equal(normalizeEmail("  Rider@Example.COM "), "rider@example.com");
    assert.equal(normalizeEmail(null), "");
    assert.equal(normalizeEmail(undefined), "");
  });

  test("a token issued for one casing works for the other", async () => {
    const token = await optOutToken("Rider@Example.com", NOW);
    assert.deepEqual(await checkOptOutToken("rider@example.com", token, NOW), { ok: true });
    assert.deepEqual(await checkOptOutToken("  RIDER@EXAMPLE.COM ", token, NOW), { ok: true });
  });
});

describe("a token we issued", () => {
  test("verifies for its own address", async () => {
    const token = await optOutToken("rider@example.com", NOW);
    assert.deepEqual(await checkOptOutToken("rider@example.com", token, NOW), { ok: true });
  });

  test("DOES NOT VERIFY FOR ANYBODY ELSE'S", async () => {
    // The whole reason the token exists: otherwise a competitor with a
    // customer list could unsubscribe all of them from a browser.
    const token = await optOutToken("rider@example.com", NOW);
    const result = await checkOptOutToken("victim@example.com", token, NOW);
    assert.equal(result.ok, false);
    assert.equal((result as { reason: string }).reason, "bad_signature");
  });

  test("two addresses never share a token", async () => {
    const a = await optOutToken("a@example.com", NOW);
    const b = await optOutToken("b@example.com", NOW);
    assert.notEqual(a, b);
  });

  test("expires, and the expiry cannot be edited off the end", async () => {
    const token = await optOutToken("rider@example.com", NOW);
    const later = new Date(NOW.getTime() + 401 * 86_400_000);
    assert.equal((await checkOptOutToken("rider@example.com", token, later)).ok, false);

    // The expiry is inside the signed payload, so moving it invalidates the
    // signature rather than extending the token.
    const [, signature] = token.split(".");
    const stretched = `${Math.floor(later.getTime() / 1000) + 86_400}.${signature}`;
    const result = await checkOptOutToken("rider@example.com", stretched, later);
    assert.equal(result.ok, false);
    assert.equal((result as { reason: string }).reason, "bad_signature");
  });

  test("a tampered signature is refused", async () => {
    const token = await optOutToken("rider@example.com", NOW);
    const [expires, signature] = token.split(".");
    const flipped = signature.slice(0, -1) + (signature.endsWith("A") ? "B" : "A");
    const result = await checkOptOutToken("rider@example.com", `${expires}.${flipped}`, NOW);
    assert.equal(result.ok, false);
  });

  test("rubbish is refused rather than throwing", async () => {
    for (const bad of ["", ".", "abc", "123", "123.", ".sig", "a.b.c"]) {
      const result = await checkOptOutToken("rider@example.com", bad, NOW);
      assert.equal(result.ok, false, bad);
    }
  });

  test("A TOKEN SIGNED WITH A DIFFERENT SECRET IS REFUSED", async () => {
    // Rotating INTERNAL_API_KEY invalidates outstanding links. That is the
    // right trade — the alternative is a signing key that can never change —
    // but it must FAIL, not pass.
    const token = await optOutToken("rider@example.com", NOW);
    process.env.INTERNAL_API_KEY = "a-completely-different-secret";
    assert.equal((await checkOptOutToken("rider@example.com", token, NOW)).ok, false);
  });

  test("with no secret configured, nothing verifies", async () => {
    // Fail closed: an unsigned scheme would be no scheme.
    delete process.env.INTERNAL_API_KEY;
    const result = await checkOptOutToken("rider@example.com", "1.2", NOW);
    assert.equal(result.ok, false);
    assert.equal((result as { reason: string }).reason, "not_configured");
  });
});

describe("the link in the email footer", () => {
  test("carries the address and a token, and survives a trailing slash", async () => {
    const link = await optOutLink("Rider@Example.com", "https://edrifttrikes.shop/");
    assert.ok(link.startsWith("https://edrifttrikes.shop/unsubscribe?"), link);
    assert.ok(link.includes("e=rider%40example.com"), link);
    assert.match(link, /[?&]t=\d+\./);
  });

  test("the token in it verifies", async () => {
    const link = await optOutLink("rider@example.com", "https://edrifttrikes.shop");
    const url = new URL(link);
    const result = await checkOptOutToken(
      url.searchParams.get("e") ?? "",
      url.searchParams.get("t") ?? ""
    );
    assert.deepEqual(result, { ok: true });
  });
});
