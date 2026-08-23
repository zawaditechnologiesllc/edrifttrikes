import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  isReal,
  organizationSchema,
  productSchema,
  siteUrl,
  trustGaps,
  websiteSchema,
} from "../lib/seo";
import { COMPANY } from "../lib/company";
import type { Product, SiteSettings } from "../lib/types";

/**
 * Structured data.
 *
 * The failure that matters here is not a missing field — it is a FALSE one.
 * Ratings markup with no reviews behind it is the commonest cause of a Google
 * manual action for structured-data spam, and a placeholder address published
 * as fact scores a site LOWER than no address at all, because a legitimacy
 * checker follows it and finds nothing. So most of this pins down what must
 * never appear.
 */

const REAL: SiteSettings = {
  id: 1,
  company_email: "support@edrifttrikes.shop",
  company_phone: "+86 757 1234 5678",
  address_line1: "12 Industrial Road",
  address_line2: "Foshan, Guangdong, China",
  shipping_cents: 5000,
  free_shipping: false,
  tax_rate_bps: 800,
  logo_url: null,
};

/** What ships in the box before anyone has filled anything in. */
const PLACEHOLDER: SiteSettings = {
  ...REAL,
  company_email: "hello@edrifttrikes.shop",
  company_phone: "+1 (555) 010-0000",
  address_line1: "100 Drift Lane",
  address_line2: "Los Angeles, CA 90001, USA",
};

const PRODUCT = {
  id: "p1",
  slug: "volt-s1-pro",
  name: "Volt S1 Pro",
  tagline: "72V of instant torque.",
  description: "A drift trike.\n\nColors: Black, Red",
  price_cents: 189900,
  stock: 3,
  hero_image: "https://cdn.example.com/volt.jpg",
} as unknown as Product;

describe("nothing invented", () => {
  test("NO rating or review markup anywhere", () => {
    // The one that would cost the whole domain its rich results.
    const json = JSON.stringify([
      organizationSchema(REAL),
      websiteSchema(),
      productSchema(PRODUCT),
    ]);
    for (const banned of ["aggregateRating", "ratingValue", "reviewCount", "Review"]) {
      assert.ok(!json.includes(banned), `structured data contains ${banned}`);
    }
  });

  test("a placeholder address is NOT published", () => {
    // Worse than blank: a checker follows it, finds nothing, and marks down.
    const org = organizationSchema(PLACEHOLDER);
    assert.equal(org.address, undefined, "a fictional address was published");
    assert.equal(org.telephone, undefined, "a 555 number was published");
    const json = JSON.stringify(org);
    assert.ok(!json.includes("Drift Lane"));
    assert.ok(!json.includes("555"));
  });

  test("a real address IS published", () => {
    const org = organizationSchema(REAL);
    const address = org.address as Record<string, unknown>;
    assert.equal(address["@type"], "PostalAddress");
    assert.equal(address.streetAddress, "12 Industrial Road");
    assert.equal(address.addressLocality, "Foshan, Guangdong, China");
    assert.equal(org.telephone, "+86 757 1234 5678");
  });

  test("recognises every placeholder the repo ships with", () => {
    for (const junk of [
      "[Registered business address — update in lib/company.ts]",
      "[governing-law jurisdiction — update in lib/company.ts]",
      "100 Drift Lane",
      "+1 (555) 010-0000",
      "hello@edrifttrikes.shop",
      "",
      "  ",
      null,
      undefined,
    ]) {
      assert.equal(isReal(junk), false, `${JSON.stringify(junk)} passed as real`);
    }
  });

  test("does not reject a real value that merely looks unusual", () => {
    for (const value of [
      "12 Industrial Road",
      "+86 757 1234 5678",
      "support@edrifttrikes.shop",
      "Foshan, Guangdong, China",
    ]) {
      assert.equal(isReal(value), true, `${value} was treated as a placeholder`);
    }
  });

  test("empty keys are dropped, never emitted as null", () => {
    // schema.org would rather have no key than a null one, and a validator
    // flags the null.
    const json = JSON.stringify(organizationSchema(null));
    assert.ok(!json.includes(":null"));
    assert.ok(!json.includes('""'));
  });
});

describe("the business entity", () => {
  test("is an OnlineStore with a stable id the other blocks point at", () => {
    const org = organizationSchema(REAL, "https://shop.example");
    assert.equal(org["@type"], "OnlineStore");
    assert.equal(org["@id"], "https://shop.example/#organization");
    const site = websiteSchema("https://shop.example");
    assert.deepEqual(site.publisher, { "@id": "https://shop.example/#organization" });
  });

  test("falls back to the support address when settings have none", () => {
    assert.equal(organizationSchema(null).email, COMPANY.supportEmail);
  });

  test("normalises the site URL so ids never double a slash", () => {
    assert.equal(siteUrl("https://shop.example/"), "https://shop.example");
    assert.equal(siteUrl("https://shop.example///"), "https://shop.example");
    assert.equal(siteUrl(null), COMPANY.siteUrl);
  });
});

describe("a product", () => {
  const schema = productSchema(PRODUCT, { base: "https://shop.example", colors: ["Black"] });
  const offer = schema.offers as Record<string, unknown>;

  test("carries the real price, as a string with two decimals", () => {
    // Google rejects a number here often enough that the string form is the
    // safe one, and 1899 vs 1899.00 is the difference between valid and not.
    assert.equal(offer.price, "1899.00");
    assert.equal(offer.priceCurrency, "USD");
  });

  test("reports availability off the ACTUAL stock", () => {
    assert.equal(offer.availability, "https://schema.org/InStock");
    const sold = productSchema({ ...PRODUCT, stock: 0 } as Product);
    assert.equal(
      (sold.offers as Record<string, unknown>).availability,
      "https://schema.org/OutOfStock"
    );
  });

  test("uses the tagline, and a bounded snippet when there isn't one", () => {
    assert.equal(schema.description, "72V of instant torque.");
    const long = productSchema({
      ...PRODUCT,
      tagline: null,
      description: `${"word ".repeat(200)}\n\nsecond paragraph`,
    } as Product);
    assert.ok(String(long.description).length <= 300);
    assert.ok(!String(long.description).includes("second paragraph"));
  });

  test("omits description entirely rather than sending an empty one", () => {
    const bare = productSchema({ ...PRODUCT, tagline: null, description: null } as Product);
    assert.equal(bare.description, undefined);
  });

  test("points its offer at the canonical product URL", () => {
    assert.equal(offer.url, "https://shop.example/product/volt-s1-pro");
  });
});

describe("the trust checklist", () => {
  test("passes nothing on a store still shipping placeholders", () => {
    const gaps = trustGaps(PLACEHOLDER);
    assert.equal(gaps.filter((g) => g.done).length, 0);
  });

  test("ticks the contact details once they are real", () => {
    const done = new Set(trustGaps(REAL).filter((g) => g.done).map((g) => g.key));
    assert.ok(done.has("address"));
    assert.ok(done.has("phone"));
    assert.ok(done.has("email"));
  });

  test("every item says WHY, so it reads as advice and not a nag", () => {
    for (const gap of trustGaps(null)) {
      assert.ok(gap.label.length > 0, `${gap.key} has no label`);
      assert.ok(gap.why.length > 30, `${gap.key} does not explain itself`);
    }
  });
});
