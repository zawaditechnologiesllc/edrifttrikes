import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { EXAMPLE_CONTACT, isReal, realOrNull } from "../lib/placeholders";
import { COMPANY, DEFAULT_SITE_SETTINGS } from "../lib/company";
import { GET as securityTxt } from "../app/.well-known/security.txt/route";

/**
 * NOTHING FICTIONAL GETS PUBLISHED.
 *
 * This shop was reported as blocked by an ISP filter. Terms and server
 * location had nothing to do with it; what the site was actually broadcasting
 * on every page was a +1 (555) telephone number — 555-0100 to 555-0199 is the
 * range reserved for FICTION — a street address in a city the business has
 * never traded from, and a generic mailbox.
 *
 * On a young domain on a cheap TLD, unverifiable contact details are most of
 * the fingerprint that automated reputation feeds score, and those feeds are
 * what ISP and corporate filters subscribe to. The schema generator and the
 * invoices had always dropped unfilled values for exactly that reason. The
 * footer, which is on every page, and the product sheet, which customers
 * forward to purchasing departments, had not.
 *
 * So the rule has one home, and these tests are the guarantee that the rule
 * cannot be bypassed by the defaults the project ships with.
 */

describe("telling a real detail from a placeholder", () => {
  test("EVERY EXAMPLE THE PROJECT SHIPS IS REJECTED", () => {
    // If this ever fails, something fictional has a clear path to a customer.
    for (const [field, value] of Object.entries(EXAMPLE_CONTACT)) {
      assert.equal(isReal(value), false, `${field} = "${value}" passed as real`);
      assert.equal(realOrNull(value), null, field);
    }
  });

  test("so are the placeholders in lib/company.ts", () => {
    assert.equal(isReal(COMPANY.address), false, "the registered address");
    assert.equal(isReal(COMPANY.governingLaw), false, "the governing law");
  });

  test("the support address is real, because it is a constant", () => {
    // The one contact detail that is never unfilled, which is why the footer
    // and the sheet fall back to it rather than showing nothing at all.
    assert.equal(isReal(COMPANY.supportEmail), true);
    assert.equal(realOrNull(COMPANY.supportEmail), COMPANY.supportEmail);
  });

  test("a real detail survives, trimmed", () => {
    assert.equal(realOrNull("  +86 757 8100 2233  "), "+86 757 8100 2233");
    assert.equal(isReal("Building 6, Lecong Industrial Park"), true);
    assert.equal(isReal("orders@edrifttrikes.shop"), true);
  });

  test("empty, blank and missing are not real", () => {
    for (const v of [null, undefined, "", "   ", "-", "x"]) {
      assert.equal(isReal(v as string), false, JSON.stringify(v));
      assert.equal(realOrNull(v as string), null, JSON.stringify(v));
    }
  });

  test("case and surrounding text do not get a placeholder through", () => {
    assert.equal(isReal("100 DRIFT LANE"), false);
    assert.equal(isReal("Suite 4, 100 Drift Lane, Los Angeles"), false);
    assert.equal(isReal("Tel +1 (555) 010-0000"), false);
    assert.equal(isReal("contact us at hello@edrifttrikes.shop"), false);
  });
});

describe("what the shop runs on before anyone fills the form in", () => {
  test("THE SHIPPED DEFAULTS CARRY NO CONTACT DETAILS AT ALL", () => {
    // These used to be live values, and this object is also the fallback used
    // whenever site_settings cannot be read — so every page got them.
    assert.equal(DEFAULT_SITE_SETTINGS.company_email, null);
    assert.equal(DEFAULT_SITE_SETTINGS.company_phone, null);
    assert.equal(DEFAULT_SITE_SETTINGS.address_line1, null);
    assert.equal(DEFAULT_SITE_SETTINGS.address_line2, null);
  });

  test("but the commercial defaults are still there", () => {
    // Nulling the contact fields must not have taken shipping or tax with it.
    assert.equal(typeof DEFAULT_SITE_SETTINGS.shipping_cents, "number");
    assert.equal(typeof DEFAULT_SITE_SETTINGS.tax_rate_bps, "number");
  });
});

describe("security.txt", () => {
  const read = async () => {
    const res = securityTxt();
    return { res, body: await res.text() };
  };

  test("is served as plain text", async () => {
    const { res } = await read();
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/plain/);
  });

  test("carries the fields RFC 9116 requires", async () => {
    const { body } = await read();
    assert.match(body, /^Contact: mailto:/m);
    assert.match(body, /^Expires: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/m);
    assert.match(body, /^Canonical: https:\/\/[^\s]+\/\.well-known\/security\.txt$/m);
  });

  test("its expiry is in the future", async () => {
    const { body } = await read();
    const expires = /^Expires: (.+)$/m.exec(body)?.[1] ?? "";
    assert.ok(Date.parse(expires) > Date.now(), `Expires has gone stale: ${expires}`);
  });

  test("THE ADDRESS IN IT IS ONE SOMEBODY ACTUALLY READS", async () => {
    // A security.txt is a published promise to answer. Pointing it at an
    // admin setting that may never have been filled in would make it a lie,
    // so it uses the constant.
    const { body } = await read();
    assert.ok(body.includes(`mailto:${COMPANY.supportEmail}`));
    assert.equal(isReal(COMPANY.supportEmail), true);
    for (const junk of Object.values(EXAMPLE_CONTACT)) {
      assert.ok(!body.includes(junk), `security.txt published the placeholder "${junk}"`);
    }
  });

  test("it tells a blocklist operator how to reach a human", async () => {
    // The reason this file is worth having at this shop's size: the people who
    // classify domains check it, and one of them has already blocked this one.
    const { body } = await read();
    assert.match(body, /blocklist|reputation feed|web filter/i);
  });
});
