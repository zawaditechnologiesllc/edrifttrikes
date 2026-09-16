import crypto from "node:crypto";

/**
 * Authorize.Net webhook signature verification.
 *
 * ⚠️ THE KEY IS USED AS UTF-8, NOT HEX-DECODED.
 *
 * The same Authorize.Net account issues a `transHashSHA2` for receipts, and
 * THAT one requires the Signature Key decoded from hex to binary
 * (`Buffer.from(key, "hex")`). Webhooks do not: the key goes into the HMAC as
 * the plain string the Merchant Interface shows. One key, two treatments —
 * using the hex form here is the single commonest reason these checks fail,
 * and it fails silently in the sense that every signature simply mismatches.
 *
 * The header is `X-ANET-Signature: sha512=<UPPERCASE HEX>` over the RAW body,
 * which is why the route registers express.raw() before express.json().
 */
export function verifyAuthorizeNetSignature(header, rawBody, signatureKey) {
  if (!signatureKey) return false;
  const provided = String(header || "").trim();
  if (!provided) return false;

  // Tolerate the prefix being present or absent, and either case.
  const sent = provided.replace(/^sha512=/i, "").toUpperCase();
  if (!/^[A-F0-9]{128}$/.test(sent)) return false;

  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), "utf8");
  const expected = crypto
    .createHmac("sha512", signatureKey)
    .update(body)
    .digest("hex")
    .toUpperCase();

  // Constant-time: a length-safe compare, since timingSafeEqual throws on a
  // length mismatch and the regex above has already fixed the length.
  return crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(expected));
}

/**
 * The event types that mean "money moved".
 *
 * authCapture is the flow this store uses. authOnly is listed because an
 * account configured for authorise-then-capture would send it, and treating it
 * as paid would be wrong — so it is deliberately NOT here.
 */
export const PAID_EVENTS = new Set([
  "net.authorize.payment.authcapture.created",
  "net.authorize.payment.capture.created",
  "net.authorize.payment.priorAuthCapture.created",
]);

/** Our order number and the gateway's transaction id, out of a webhook body. */
export function readPayload(body) {
  const payload = body?.payload ?? {};
  return {
    eventType: String(body?.eventType || ""),
    transId: String(payload.id || ""),
    // Authorize.Net echoes the invoice number we set at page-create time.
    orderNumber: String(payload.invoiceNumber || payload.invoice_number || ""),
    responseCode: payload.responseCode,
  };
}
