import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { summarizeAccount } from "../lib/stripe-account";

/**
 * Reading what is switched on in a Stripe account — safely.
 *
 * Two jobs, and the second one is the dangerous one.
 *
 *   1. SURFACE FEATURES THIS CODE HAS NEVER HEARD OF. Managed Payments is not
 *      in the SDK this repo pins, so no typed field could have revealed it.
 *      Stripe models its toggles as `{ enabled: boolean }` and returns the
 *      account as plain JSON, so walking for that shape finds next year's
 *      features too.
 *
 *   2. LEAK NOTHING. A Stripe account object carries the owner's legal name,
 *      email, home address, date of birth and bank account. This summary is
 *      rendered in an admin page, so the redaction is not a nicety — the test
 *      below feeds in an account stuffed with exactly that data and asserts
 *      none of it survives.
 */

/** Shaped like a real account response, including the parts we must not emit. */
const ACCOUNT = {
  id: "acct_1U1leF8FsoQ83VZf",
  object: "account",
  country: "US",
  default_currency: "usd",
  charges_enabled: true,
  payouts_enabled: true,
  details_submitted: true,
  email: "john.michael@example.com",
  type: "standard",
  capabilities: {
    card_payments: "active",
    transfers: "active",
    link_payments: "pending",
    affirm_payments: "inactive",
  },
  // The feature that started all this. Our SDK has no such field.
  managed_payments: { enabled: true },
  settings: {
    branding: { icon: "file_123", logo: "file_456", primary_color: "#131316" },
    card_payments: {
      statement_descriptor_prefix: "EKARTS",
      decline_on: { avs_failure: false, cvc_failure: true },
    },
    dashboard: { display_name: "Ekarts shop", timezone: "America/Los_Angeles" },
    payments: { statement_descriptor: "EKARTS SHOP" },
    // A nested toggle, the shape Stripe uses everywhere.
    invoices: { enabled: false },
  },
  // ⚠️ None of this may ever appear in the summary.
  individual: {
    first_name: "John",
    last_name: "Michael",
    email: "john.michael@example.com",
    dob: { day: 14, month: 3, year: 1988 },
    id_number_provided: true,
    address: { line1: "77 Private Road", city: "Foshan", postal_code: "528000" },
    phone: "+15550100123",
    ssn_last_4_provided: true,
  },
  company: {
    name: "Zawadi Technologies LLC",
    tax_id_provided: true,
    address: { line1: "77 Private Road", city: "Foshan" },
  },
  business_profile: {
    name: "Ekarts shop",
    support_email: "support@edrifttrikes.shop",
    support_phone: "+15550100123",
    url: "https://edrifttrikes.shop",
  },
  external_accounts: {
    object: "list",
    data: [
      {
        id: "ba_1234",
        object: "bank_account",
        account_holder_name: "John Michael",
        bank_name: "Chase",
        last4: "6789",
        routing_number: "021000021",
      },
    ],
  },
  tos_acceptance: { date: 1700000000, ip: "203.0.113.7", user_agent: "Mozilla/5.0" },
  requirements: { currently_due: ["individual.verification.document"], errors: [] },
};

/** Everything that must not escape, as literal strings. */
const SECRETS = [
  "john.michael@example.com",
  "John",
  "Michael",
  "77 Private Road",
  "528000",
  "+15550100123",
  "Zawadi Technologies LLC",
  "6789",
  "021000021",
  "Chase",
  "203.0.113.7",
  "Mozilla/5.0",
  "1988",
  "file_123",
  "EKARTS",
  "individual.verification.document",
];

describe("surfacing what the account has switched on", () => {
  const summary = summarizeAccount(ACCOUNT);

  test("the safe scalars come through", () => {
    assert.equal(summary.ok, true);
    assert.equal(summary.country, "US");
    assert.equal(summary.defaultCurrency, "USD");
    assert.equal(summary.chargesEnabled, true);
    assert.equal(summary.payoutsEnabled, true);
    assert.equal(summary.detailsSubmitted, true);
  });

  test("A FEATURE THE SDK HAS NEVER HEARD OF IS FOUND", () => {
    // The whole point: `managed_payments` is absent from the pinned typings,
    // and this is what would have shown it was on before it caused a 400.
    assert.equal(summary.featureFlags?.["managed_payments"], true);
  });

  test("including nested toggles, with their path", () => {
    assert.equal(summary.featureFlags?.["settings.invoices"], false);
  });

  test("payment capabilities are reported with their status", () => {
    assert.equal(summary.capabilities?.card_payments, "active");
    assert.equal(summary.capabilities?.link_payments, "pending");
  });

  test("top-level field NAMES are listed, so a new one is visible", () => {
    assert.ok(summary.fields?.includes("managed_payments"));
    assert.ok(summary.fields?.includes("capabilities"));
  });

  test("a missing or malformed account is reported, not thrown", () => {
    assert.equal(summarizeAccount(null).ok, false);
    assert.equal(summarizeAccount("nope").ok, false);
    assert.equal(summarizeAccount(undefined).ok, false);
  });

  test("an empty account object still summarises", () => {
    const s = summarizeAccount({});
    assert.equal(s.ok, true);
    assert.deepEqual(s.fields, []);
  });
});

describe("and leaking none of it", () => {
  test("NO PERSONAL OR BANKING DETAIL SURVIVES THE SUMMARY", () => {
    const serialized = JSON.stringify(summarizeAccount(ACCOUNT));
    for (const secret of SECRETS) {
      assert.equal(
        serialized.includes(secret),
        false,
        `"${secret}" leaked into the account summary: ${serialized}`
      );
    }
  });

  test("the identity branches are not walked for flags at all", () => {
    // A toggle hidden inside `individual` must not pull its path — or
    // anything near it — into the output.
    const summary = summarizeAccount({
      ...ACCOUNT,
      individual: { ...ACCOUNT.individual, verification: { enabled: true } },
    });
    const paths = Object.keys(summary.featureFlags ?? {});
    for (const path of paths) {
      assert.equal(
        /^(individual|company|external_accounts|tos_acceptance|business_profile|requirements|future_requirements)\b/.test(
          path
        ),
        false,
        `walked into ${path}`
      );
    }
  });

  test("only booleans and statuses are ever values", () => {
    const summary = summarizeAccount(ACCOUNT);
    for (const v of Object.values(summary.featureFlags ?? {})) {
      assert.equal(typeof v, "boolean");
    }
    for (const v of Object.values(summary.capabilities ?? {})) {
      assert.equal(typeof v, "string");
      // Stripe's capability statuses, not free text.
      assert.match(v, /^[a-z_]+$/);
    }
  });

  test("a capability whose status is not a string is dropped", () => {
    const s = summarizeAccount({ capabilities: { card_payments: { secret: "x" } } });
    assert.equal(s.capabilities, undefined);
  });

  test("a deep or circular response cannot run away", () => {
    // Depth-bounded walk: build something deeper than the limit and a cycle.
    type Deep = { enabled: boolean; next?: Deep };
    let deep: Deep = { enabled: true };
    for (let i = 0; i < 50; i++) deep = { enabled: true, next: deep };
    const circular: Record<string, unknown> = { enabled: true };
    circular.self = circular;
    assert.equal(summarizeAccount({ a: deep, b: circular }).ok, true);
  });
});
