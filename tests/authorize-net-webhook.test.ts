import { test, describe } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  verifyAuthorizeNetSignature,
  PAID_EVENTS,
  readPayload,
} from "../server/src/authorizenet.js";

/**
 * The Authorize.Net webhook signature.
 *
 * This is the only thing standing between "a POST arrived" and "an order is
 * marked paid", so the tests are about what must be REFUSED as much as what is
 * accepted.
 */

const KEY = "A1B2C3D4E5F60718293A4B5C6D7E8F90";
const BODY = Buffer.from(
  JSON.stringify({
    eventType: "net.authorize.payment.authcapture.created",
    payload: { id: "60115585081", invoiceNumber: "EDT-7A3F91C2", responseCode: 1 },
  })
);
const sign = (body: Buffer, key: string) =>
  crypto.createHmac("sha512", key).update(body).digest("hex").toUpperCase();

describe("a genuine notification is accepted", () => {
  test("with the sha512= prefix, as Authorize.Net sends it", () => {
    assert.equal(
      verifyAuthorizeNetSignature(`sha512=${sign(BODY, KEY)}`, BODY, KEY),
      true
    );
  });

  test("without the prefix, and in either case", () => {
    assert.equal(verifyAuthorizeNetSignature(sign(BODY, KEY), BODY, KEY), true);
    assert.equal(
      verifyAuthorizeNetSignature(`SHA512=${sign(BODY, KEY).toLowerCase()}`, BODY, KEY),
      true
    );
  });

  test("when the body arrives as a string rather than a Buffer", () => {
    assert.equal(
      verifyAuthorizeNetSignature(sign(BODY, KEY), BODY.toString("utf8"), KEY),
      true
    );
  });
});

describe("anything else is refused", () => {
  test("a tampered body", () => {
    const tampered = Buffer.from(JSON.stringify({ eventType: "x", payload: {} }));
    assert.equal(verifyAuthorizeNetSignature(sign(BODY, KEY), tampered, KEY), false);
  });

  test("the wrong key", () => {
    assert.equal(verifyAuthorizeNetSignature(sign(BODY, "OTHER"), BODY, KEY), false);
  });

  test("THE HEX-DECODED KEY — the classic mistake", () => {
    /**
     * The same account's transHashSHA2 requires the Signature Key decoded from
     * hex to binary. Webhooks do not: the key goes in as the plain string. One
     * key, two treatments, and using the wrong one here means every signature
     * mismatches — which looks like a broken webhook rather than a bug.
     */
    const wrong = crypto
      .createHmac("sha512", Buffer.from(KEY, "hex"))
      .update(BODY)
      .digest("hex")
      .toUpperCase();
    assert.equal(verifyAuthorizeNetSignature(`sha512=${wrong}`, BODY, KEY), false);
  });

  test("a missing or empty header", () => {
    for (const header of ["", null, undefined, "   "]) {
      assert.equal(verifyAuthorizeNetSignature(header, BODY, KEY), false);
    }
  });

  test("a header that is not a 128-character hex digest", () => {
    // Guards the length compare below it: timingSafeEqual throws on unequal
    // lengths, so the shape is checked before the comparison.
    for (const header of ["sha512=zzz", "sha512=" + "A".repeat(127), "sha256=" + "A".repeat(64)]) {
      assert.equal(verifyAuthorizeNetSignature(header, BODY, KEY), false);
    }
  });

  test("no signature key configured at all", () => {
    // Unconfigured must mean "refuse", never "accept anything".
    assert.equal(verifyAuthorizeNetSignature(sign(BODY, KEY), BODY, ""), false);
    assert.equal(verifyAuthorizeNetSignature(sign(BODY, KEY), BODY, undefined), false);
  });
});

describe("which events mean money moved", () => {
  test("a capture counts", () => {
    assert.ok(PAID_EVENTS.has("net.authorize.payment.authcapture.created"));
    assert.ok(PAID_EVENTS.has("net.authorize.payment.capture.created"));
    assert.ok(PAID_EVENTS.has("net.authorize.payment.priorAuthCapture.created"));
  });

  test("an authorisation alone does NOT", () => {
    // authOnly holds funds without taking them. Treating it as paid would ship
    // goods against money not yet captured.
    assert.ok(!PAID_EVENTS.has("net.authorize.payment.authorization.created"));
    assert.ok(!PAID_EVENTS.has("net.authorize.payment.void.created"));
    assert.ok(!PAID_EVENTS.has("net.authorize.payment.refund.created"));
  });

  test("the payload gives us our order number and their transaction id", () => {
    const read = readPayload(JSON.parse(BODY.toString()));
    assert.equal(read.orderNumber, "EDT-7A3F91C2");
    assert.equal(read.transId, "60115585081");
    assert.equal(read.eventType, "net.authorize.payment.authcapture.created");
  });

  test("an empty payload reads as empty rather than throwing", () => {
    assert.deepEqual(readPayload({}), {
      eventType: "",
      transId: "",
      orderNumber: "",
      responseCode: undefined,
    });
    assert.equal(readPayload(undefined).orderNumber, "");
  });
});
