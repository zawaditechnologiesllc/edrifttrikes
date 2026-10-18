import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  REGIONAL_SITES,
  REGIONS,
  canonicalFor,
  currencyNote,
  regionFromHost,
  regionHome,
} from "../lib/regions";
import { isDisplayCurrency } from "../lib/currency";
import {
  canPublishWithdrawalForm,
  contactIsSet,
  euComplianceGaps,
  outstandingGaps,
  withdrawalFormLines,
} from "../lib/compliance";

/**
 * The regional storefronts, and the compliance facts behind them.
 *
 * Two things here are worth more than the rest.
 *
 * THE HOST HEADER IS ATTACKER-CONTROLLED, and it selects which consumer-rights
 * statements a buyer is shown. It has to refuse anything it does not
 * recognise rather than pattern-match a prefix, or `europe.edrifttrikes.shop.
 * evil.test` becomes the Europe storefront.
 *
 * AN UNAPPOINTED REPRESENTATIVE MUST NEVER BE PUBLISHED. Claiming an EU
 * Article 27 representative or a GPSR responsible person that does not exist
 * is a false statement to a regulator in writing — strictly worse than saying
 * nothing, which is why the pages render nothing until the value is real.
 */

describe("which storefront a request is on", () => {
  test("each subdomain selects its own region", () => {
    for (const region of REGIONAL_SITES) {
      const host = `${region.subdomain}.edrifttrikes.shop`;
      assert.equal(regionFromHost(host).key, region.key, host);
    }
  });

  test("the apex and www are the worldwide storefront", () => {
    assert.equal(regionFromHost("edrifttrikes.shop").key, "global");
    assert.equal(regionFromHost("www.edrifttrikes.shop").key, "global");
  });

  test("case and a port and a trailing dot do not matter", () => {
    assert.equal(regionFromHost("EUROPE.EdriftTrikes.Shop").key, "europe");
    assert.equal(regionFromHost("europe.edrifttrikes.shop:443").key, "europe");
    assert.equal(regionFromHost("europe.edrifttrikes.shop.").key, "europe");
    assert.equal(regionFromHost("  europe.edrifttrikes.shop  ").key, "europe");
  });

  test("A LOOKALIKE HOST IS NOT A REGION", () => {
    // The whole reason the apex is checked rather than just the first label.
    for (const host of [
      "europe.edrifttrikes.shop.evil.test",
      "europe.edrifttrikes.shop.attacker.com",
      "europe.notedrifttrikes.shop",
      "europe.edrifttrikes.com",
      "usa.example.com",
    ]) {
      assert.equal(regionFromHost(host).key, "global", host);
    }
  });

  test("an unknown subdomain is the worldwide storefront, not an error", () => {
    assert.equal(regionFromHost("shop.edrifttrikes.shop").key, "global");
    assert.equal(regionFromHost("admin.edrifttrikes.shop").key, "global");
  });

  test("a missing or nonsense host falls back rather than throwing", () => {
    for (const host of [null, undefined, "", "   ", "localhost", "::1"]) {
      assert.equal(regionFromHost(host as string).key, "global", String(host));
    }
  });

  test("a proxy that appends hosts is read as the first one", () => {
    assert.equal(
      regionFromHost("europe.edrifttrikes.shop, edge.cloudflare.net").key,
      "europe"
    );
  });

  test("local development can still exercise a region", () => {
    assert.equal(regionFromHost("europe.localhost").key, "europe");
    assert.equal(regionFromHost("uae.localhost:3000").key, "uae");
  });
});

describe("four hostnames must not read as four sites", () => {
  test("EVERY SHARED PAGE CANONICALISES TO THE APEX", () => {
    // The catalogue and the policies are the same documents whichever
    // hostname served them. Not saying so is how a shop teaches a search
    // engine that most of its pages are duplicates.
    for (const region of REGIONAL_SITES) {
      assert.equal(
        canonicalFor(region, "/shop"),
        "https://edrifttrikes.shop/shop",
        region.key
      );
      assert.equal(
        canonicalFor(region, "/product/voltage-drift"),
        "https://edrifttrikes.shop/product/voltage-drift"
      );
      assert.equal(
        canonicalFor(region, "/eu-consumer-rights"),
        "https://edrifttrikes.shop/eu-consumer-rights"
      );
    }
  });

  test("but a region's own landing page is canonical to itself", () => {
    assert.equal(canonicalFor(REGIONS.europe, "/"), "https://europe.edrifttrikes.shop/");
    assert.equal(canonicalFor(REGIONS.uae, "/"), "https://uae.edrifttrikes.shop/");
  });

  test("the apex is always canonical to itself", () => {
    assert.equal(canonicalFor(REGIONS.global, "/"), "https://edrifttrikes.shop/");
    assert.equal(canonicalFor(REGIONS.global, "/shop"), "https://edrifttrikes.shop/shop");
  });

  test("a path without its leading slash still produces a valid URL", () => {
    assert.equal(canonicalFor(REGIONS.usa, "shop"), "https://edrifttrikes.shop/shop");
  });

  test("each region has a home", () => {
    assert.equal(regionHome(REGIONS.europe), "https://europe.edrifttrikes.shop");
    assert.equal(regionHome(REGIONS.global), "https://global.edrifttrikes.shop");
  });
});

describe("which region carries EU consumer law", () => {
  test("europe does, and only europe", () => {
    assert.equal(REGIONS.europe.euConsumerLaw, true);
    for (const key of ["global", "usa", "canada", "uae"] as const) {
      assert.equal(REGIONS[key].euConsumerLaw, false, key);
    }
  });

  test("every regional site names a distributor and a currency", () => {
    for (const region of REGIONAL_SITES) {
      assert.ok(region.label.length > 2, region.key);
      assert.ok(region.blurb.length > 10, region.key);
      assert.ok(isDisplayCurrency(region.currency), region.key);
    }
  });

  test("EVERY STOREFRONT SAYS IT CHARGES IN US DOLLARS", () => {
    // Whatever currency a region QUOTES in, the card is debited in dollars.
    // A storefront that shows euros without saying so is a dispute waiting to
    // be filed — see lib/currency.ts.
    for (const region of [...REGIONAL_SITES, REGIONS.global]) {
      assert.match(currencyNote(region), /US dollars/, region.key);
    }
  });

  test("each region quotes the currency its buyers think in", () => {
    assert.equal(REGIONS.usa.currency, "USD");
    assert.equal(REGIONS.canada.currency, "CAD");
    assert.equal(REGIONS.uae.currency, "AED");
    assert.equal(REGIONS.europe.currency, "EUR");
    assert.equal(REGIONS.global.currency, "USD");
  });

  test("global is reachable at its own subdomain", () => {
    assert.equal(REGIONS.global.subdomain, "global");
    assert.equal(regionFromHost("global.edrifttrikes.shop").key, "global");
  });

  test("BUT GLOBAL IS AN ALIAS, SO IT CANONICALISES TO THE APEX", () => {
    // Same catalogue, same prices, same policies. Letting it self-canonicalise
    // would tell a search engine the worldwide storefront exists twice, which
    // is the duplicate signal the regional design exists to avoid.
    assert.equal(canonicalFor(REGIONS.global, "/"), "https://edrifttrikes.shop/");
    assert.equal(canonicalFor(REGIONS.global, "/shop"), "https://edrifttrikes.shop/shop");
  });
});

describe("EU compliance facts", () => {
  test("an unfilled contact block is NOT treated as set", () => {
    assert.equal(contactIsSet({ name: "", address: "", email: "" }), false);
    assert.equal(contactIsSet(undefined), false);
    assert.equal(
      contactIsSet({ name: "Acme EU", address: "", email: "eu@acme.example" }),
      false,
      "a half-filled block is not an appointment"
    );
  });

  test("a shipped PLACEHOLDER is not treated as set either", () => {
    assert.equal(
      contactIsSet({
        name: "Acme EU",
        address: "[Registered business address — update in lib/company.ts]",
        email: "eu@acme.example",
      }),
      false
    );
  });

  test("a fully real block is set", () => {
    assert.equal(
      contactIsSet({
        name: "Acme Compliance BV",
        address: "Keizersgracht 1, 1015 Amsterdam, Netherlands",
        email: "gdpr@acme-compliance.example",
      }),
      true
    );
  });

  test("the gaps list names the two that stop EU trade", () => {
    const blocking = euComplianceGaps().filter((g) => g.blocking).map((g) => g.key);
    assert.ok(blocking.includes("representative"), "GDPR Art. 27");
    assert.ok(blocking.includes("responsiblePerson"), "GPSR");
  });

  test("every gap explains the consequence, not just the rule", () => {
    for (const gap of euComplianceGaps()) {
      assert.ok(gap.why.length > 40, `${gap.key} has no real explanation`);
      assert.ok(gap.label.length > 3, gap.key);
    }
  });

  test("the outstanding list is a subset of all gaps", () => {
    const all = euComplianceGaps();
    for (const gap of outstandingGaps()) {
      assert.equal(gap.done, false, gap.key);
      assert.ok(all.some((g) => g.key === gap.key));
    }
  });

  test("THE WITHDRAWAL FORM IS WITHHELD UNTIL THE TRADER CAN BE NAMED", () => {
    // A model form is addressed TO somebody. Printing one with a bracketed
    // placeholder where the company should be is not compliance, it is a
    // template nobody finished.
    assert.equal(
      canPublishWithdrawalForm(),
      false,
      "lib/company.ts still has placeholder details — the page must say so instead"
    );
  });

  test("and when it is published it carries the Directive's wording", () => {
    const text = withdrawalFormLines().join("\n");
    assert.match(text, /I\/We hereby give notice that I\/We withdraw/);
    assert.match(text, /Ordered on \/ received on/);
    assert.match(text, /only if this form is notified on paper/);
  });
});

/* -------------------------------------------------------------------------- */
/* The hostnames the Worker is actually deployed on                            */
/* -------------------------------------------------------------------------- */

import { readFileSync } from "node:fs";

/**
 * wrangler.jsonc and lib/regions.ts have to agree.
 *
 * A region declared in the code but not in the Worker config is a storefront
 * nobody can reach — and nobody finds out, because every test passes and the
 * apex keeps working. A hostname in the config but not in the code is the
 * reverse: it resolves, it serves, and it shows the worldwide storefront with
 * no regional identity at all.
 *
 * Neither failure announces itself, which is why this reads the real file.
 */
describe("the deployed hostnames", () => {
  const config = (() => {
    const raw = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
    // Strip comments the way wrangler does before parsing.
    const noBlock = raw.replace(/\/\*[\s\S]*?\*\//g, "");
    const noLine = noBlock.replace(/^\s*\/\/.*$/gm, "");
    return JSON.parse(noLine) as { routes?: { pattern: string; custom_domain?: boolean }[] };
  })();

  const patterns = (config.routes ?? []).map((r) => r.pattern);

  test("EVERY REGION WITH A SUBDOMAIN IS DEPLOYED", () => {
    for (const region of REGIONAL_SITES) {
      const host = `${region.subdomain}.edrifttrikes.shop`;
      assert.ok(
        patterns.includes(host),
        `${host} is a region in the code but not a hostname in wrangler.jsonc — nobody can reach it`
      );
    }
  });

  test("and every deployed subdomain is a region", () => {
    for (const pattern of patterns) {
      const labels = pattern.split(".");
      if (labels.length < 3) continue; // the apex
      if (labels[0] === "www") continue; // an alias of the apex, not a region
      // It has to resolve to the region whose subdomain it IS. An unrecognised
      // host falls back to the worldwide region, whose subdomain is "global" —
      // so comparing against the label catches that without special-casing it.
      assert.equal(
        regionFromHost(pattern).subdomain,
        labels[0],
        `${pattern} is deployed but is not a region — it would serve the worldwide storefront`
      );
    }
  });

  test("the apex and www are served too", () => {
    assert.ok(patterns.includes("edrifttrikes.shop"));
    assert.ok(patterns.includes("www.edrifttrikes.shop"));
  });

  test("ALL OF THEM ARE CUSTOM DOMAINS, NOT ROUTES", () => {
    // A plain route needs a DNS record pointing at an origin first. These
    // hostnames have no origin — the Worker is the origin — so a route would
    // resolve to nothing and the subdomain would simply not work.
    for (const route of config.routes ?? []) {
      assert.equal(route.custom_domain, true, route.pattern);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* The links a visitor — or an Instagram bio — uses to reach a storefront      */
/* -------------------------------------------------------------------------- */

/**
 * These are the URLs the shop hands out publicly, so they have to be the kind
 * of thing that survives being pasted somewhere with no context: absolute,
 * https, and the same from any starting point.
 */
describe("the public address of each storefront", () => {
  test("EVERY ONE IS AN ABSOLUTE https URL", () => {
    // A relative link cannot cross hostnames. On europe., a "/" link labelled
    // "United States" reloads the storefront you are already on — which looks
    // exactly like a broken link and is impossible to diagnose by looking.
    for (const region of REGIONAL_SITES) {
      const url = regionHome(region);
      assert.match(url, /^https:\/\//, region.key);
      assert.doesNotMatch(url, /\s/, region.key);
      assert.equal(new URL(url).pathname, "/", region.key);
    }
  });

  test("each one is its own subdomain of the apex", () => {
    assert.equal(regionHome(REGIONS.usa), "https://usa.edrifttrikes.shop");
    assert.equal(regionHome(REGIONS.canada), "https://canada.edrifttrikes.shop");
    assert.equal(regionHome(REGIONS.uae), "https://uae.edrifttrikes.shop");
    assert.equal(regionHome(REGIONS.europe), "https://europe.edrifttrikes.shop");
    assert.equal(regionHome(REGIONS.global), "https://global.edrifttrikes.shop");
  });

  test("no two storefronts share an address", () => {
    const urls = REGIONAL_SITES.map((r) => regionHome(r));
    assert.equal(new Set(urls).size, urls.length);
  });

  test("AND EVERY ADDRESS LEADS BACK TO ITS OWN STOREFRONT", () => {
    // The round trip: the URL the footer hands out has to be one that
    // regionFromHost recognises. If these ever disagree, a link published on
    // Instagram opens the worldwide shop instead of the regional one, with no
    // error anywhere to say so.
    for (const region of REGIONAL_SITES) {
      const host = new URL(regionHome(region)).hostname;
      assert.equal(regionFromHost(host).key, region.key, host);
    }
  });

  test("a link published once keeps working as the catalogue changes", () => {
    // It points at the storefront, not at a product or a category that could
    // be renamed or switched off later.
    for (const region of REGIONAL_SITES) {
      assert.equal(new URL(regionHome(region)).search, "", region.key);
    }
  });
});
