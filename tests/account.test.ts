import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  filterSafeEmail,
  maskEmail,
  orderOwnershipFilter,
  verifiedUserEmail,
} from "../lib/account";

/**
 * Guest orders following a buyer into their account.
 *
 * The failure that matters is not "orders don't show" — it is showing one
 * person another person's orders. A guest order is linked to a human only by
 * the email they typed, so email confirmation is the entire security boundary.
 */

const CONFIRMED = {
  email: "rider@example.com",
  email_confirmed_at: "2026-01-01T00:00:00Z",
};

describe("verifiedUserEmail", () => {
  test("returns the address once it has been confirmed", () => {
    assert.equal(verifiedUserEmail(CONFIRMED), "rider@example.com");
  });

  test("REFUSES an unconfirmed address — the whole security gate", () => {
    // Without this, registering with a stranger's email would hand you their
    // name, shipping address, phone number and order history.
    assert.equal(
      verifiedUserEmail({ email: "victim@example.com", email_confirmed_at: null }),
      null
    );
    assert.equal(verifiedUserEmail({ email: "victim@example.com" }), null);
  });

  test("accepts the older confirmed_at field", () => {
    assert.equal(
      verifiedUserEmail({ email: "rider@example.com", confirmed_at: "2026-01-01T00:00:00Z" }),
      "rider@example.com"
    );
  });

  test("normalises case and whitespace so matching is consistent", () => {
    assert.equal(
      verifiedUserEmail({ ...CONFIRMED, email: "  RIDER@Example.COM  " }),
      "rider@example.com"
    );
  });

  test("handles a missing or empty address without returning something matchable", () => {
    assert.equal(verifiedUserEmail(null), null);
    assert.equal(verifiedUserEmail(undefined), null);
    assert.equal(verifiedUserEmail({ ...CONFIRMED, email: "" }), null);
    assert.equal(verifiedUserEmail({ ...CONFIRMED, email: "   " }), null);
    assert.equal(verifiedUserEmail({ ...CONFIRMED, email: null }), null);
  });
});

describe("filterSafeEmail", () => {
  test("leaves an ordinary address untouched", () => {
    assert.equal(filterSafeEmail("first.last+tag@sub.domain.co.uk"), "first.last+tag@sub.domain.co.uk");
  });

  test("strips the characters PostgREST reads as filter structure", () => {
    assert.equal(filterSafeEmail("a,b(c)d*e\\f@x.com"), "abcdef@x.com");
  });
});

describe("orderOwnershipFilter", () => {
  const USER = "11111111-2222-3333-4444-555555555555";

  test("matches owned rows plus unclaimed rows with the confirmed email", () => {
    const f = orderOwnershipFilter(USER, "rider@example.com");
    assert.ok(f.includes(`user_id.eq.${USER}`));
    assert.ok(f.includes("user_id.is.null"));
    assert.ok(f.includes("email.eq.rider@example.com"));
  });

  test("without a verified email it narrows to owned rows ONLY", () => {
    // The failure mode that would matter is widening to every unclaimed order.
    const f = orderOwnershipFilter(USER, null);
    assert.equal(f, `user_id.eq.${USER}`);
    assert.ok(!f.includes("is.null"));
  });

  test("an email that sanitises away cannot widen the filter", () => {
    const f = orderOwnershipFilter(USER, ",,,");
    assert.equal(f, `user_id.eq.${USER}`);
  });

  test("a crafted address cannot inject extra filter STRUCTURE", () => {
    // An address trying to close the and() group and append its own condition.
    // What matters is that no structural characters survive — the leftover text
    // is harmless, because it ends up as the literal value of `email.eq.`, which
    // simply matches no row.
    const f = orderOwnershipFilter(USER, "x@y.com),(user_id.not.is.null");

    assert.equal((f.match(/\(/g) ?? []).length, 1, "extra ( injected");
    assert.equal((f.match(/\)/g) ?? []).length, 1, "extra ) injected");
    assert.equal((f.match(/,/g) ?? []).length, 2, "extra , injected");
    assert.equal(
      f,
      `user_id.eq.${USER},and(user_id.is.null,email.eq.x@y.comuser_id.not.is.null)`
    );
  });
});

describe("maskEmail", () => {
  test("keeps enough for the buyer to recognise their own address", () => {
    assert.equal(maskEmail("rider@example.com"), "r•••r@example.com");
    assert.equal(maskEmail("michael@edrifttrikes.shop"), "m•••l@edrifttrikes.shop");
  });

  test("never reveals the middle of the local part", () => {
    // The receipt page is reachable with only an order number, so the address
    // must not be harvestable from it.
    const masked = maskEmail("verylongaddress@example.com");
    assert.ok(!masked.includes("verylongaddress"));
    assert.ok(masked.includes("•••"));
  });

  test("handles short local parts without exposing them whole", () => {
    assert.equal(maskEmail("ab@example.com"), "a•••@example.com");
    assert.equal(maskEmail("a@example.com"), "a•••@example.com");
  });

  test("degrades safely on junk rather than echoing it back", () => {
    assert.equal(maskEmail(""), "your email");
    assert.equal(maskEmail(null), "your email");
    assert.equal(maskEmail(undefined), "your email");
    assert.equal(maskEmail("not-an-email"), "your email");
    assert.equal(maskEmail("@example.com"), "your email");
  });
});
