import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  AI_CRAWLERS,
  companyStatement,
  isAiCrawler,
  isBotExemptPath,
  wrapText,
} from "../lib/bots";
import { GET as robots } from "../app/robots.txt/route";
import { COMPANY } from "../lib/company";

/**
 * Keeping AI crawlers off the store.
 *
 * Two failure modes, pulling in opposite directions. Letting a crawler through
 * means the shop's copy, prices and product range end up in a model. Blocking
 * the WRONG thing is worse and quieter: turn away Googlebot and the real store
 * vanishes from search while the clones stay; turn away the Render service's
 * HTTP client and orders stop being fulfilled, with no error anyone will see.
 * Most of what follows guards the second.
 */

/** The real strings these crawlers send, not the bare token. */
const CRAWLER_UAS: [string, string][] = [
  ["GPTBot", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)"],
  ["ChatGPT-User", "Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)"],
  ["OAI-SearchBot", "Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)"],
  ["ClaudeBot", "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)"],
  ["Google-Extended", "Mozilla/5.0 (compatible; Google-Extended/1.0)"],
  ["PerplexityBot", "Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)"],
  ["CCBot", "CCBot/2.0 (https://commoncrawl.org/faq/)"],
  ["Bytespider", "Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)"],
  ["meta-externalagent", "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)"],
  ["Applebot-Extended", "Mozilla/5.0 (compatible; Applebot-Extended/0.1)"],
  ["Amazonbot", "Mozilla/5.0 (compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot)"],
];

describe("who gets turned away", () => {
  test("every crawler on the list is recognised from its real user agent", () => {
    for (const [name, ua] of CRAWLER_UAS) {
      assert.equal(isAiCrawler(ua), true, `${name} slipped through`);
    }
  });

  test("matching is case-insensitive, because user agents are not consistent", () => {
    assert.equal(isAiCrawler("mozilla/5.0 (compatible; gptbot/1.2)"), true);
    assert.equal(isAiCrawler("CLAUDEBOT"), true);
  });

  test("every token on the list actually matches itself", () => {
    // Guards a typo in AI_CRAWLERS: an entry that cannot match anything would
    // sit in robots.txt looking like protection and provide none.
    for (const bot of AI_CRAWLERS) {
      assert.equal(isAiCrawler(`Mozilla/5.0 (compatible; ${bot}/1.0)`), true, bot);
    }
  });
});

describe("who must NOT be turned away", () => {
  test("search engines — blocking them would leave only the clones", () => {
    // The whole point of the exercise is that customers find the REAL shop.
    for (const ua of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      "Mozilla/5.0 (compatible; DuckDuckBot-Https/1.1; https://duckduckgo.com/duckduckgo-help-pages/results/duckduckbot/)",
      "Mozilla/5.0 (compatible; YandexBot/3.0)",
      "Mozilla/5.0 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)",
    ]) {
      assert.equal(isAiCrawler(ua), false, `blocked: ${ua.slice(0, 40)}`);
    }
  });

  test("Googlebot and Google-Extended are told apart", () => {
    // They are the same company and one substring away from each other. Getting
    // this wrong removes the store from Google Search.
    assert.equal(isAiCrawler("Googlebot/2.1"), false);
    assert.equal(isAiCrawler("Google-Extended/1.0"), true);
    assert.equal(isAiCrawler("Applebot/0.1"), false);
    assert.equal(isAiCrawler("Applebot-Extended/0.1"), true);
  });

  test("GENERIC HTTP CLIENTS — these are the store's own machinery", () => {
    // The Render service, the Stripe and PayPal webhooks, the cron sweep and
    // any uptime check arrive as one of these. Blocking them would break
    // fulfilment silently, which is far more expensive than a scraped page.
    for (const ua of [
      "node-fetch/1.0",
      "undici",
      "curl/8.4.0",
      "python-requests/2.31.0",
      "Go-http-client/2.0",
      "Stripe/1.0 (+https://stripe.com/docs/webhooks)",
      "PayPal/AUHD-214.0-54463135",
      "axios/1.7.2",
      "Better Uptime Bot",
    ]) {
      assert.equal(isAiCrawler(ua), false, `blocked: ${ua}`);
    }
  });

  test("real browsers", () => {
    for (const ua of [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
    ]) {
      assert.equal(isAiCrawler(ua), false);
    }
  });

  test("a request with NO user agent is served, not refused", () => {
    // Health checks and some webhooks send none. Refusing all of it to catch a
    // scraper that could simply set one would cost more than it saves.
    assert.equal(isAiCrawler(""), false);
    assert.equal(isAiCrawler(null), false);
    assert.equal(isAiCrawler(undefined), false);
  });
});

describe("what a blocked crawler can still reach", () => {
  test("robots.txt — the entire strategy depends on it", () => {
    // If the statement is unreadable, an assistant asked about this business
    // falls back on whatever a scammer published instead.
    assert.equal(isBotExemptPath("/robots.txt"), true);
  });

  test("payment, cron and health endpoints", () => {
    // Money has already moved by the time a webhook arrives; refusing it loses
    // the order rather than preventing anything.
    for (const path of [
      "/api/paypal/capture",
      "/api/internal/order-paid",
      "/api/cron/orders",
      "/api/health",
      "/api/health/address",
    ]) {
      assert.equal(isBotExemptPath(path), true, `${path} was not exempt`);
    }
  });

  test("nothing else — otherwise it is not a block", () => {
    for (const path of ["/", "/shop", "/product/voltage-drift", "/our-story", "/api/settings"]) {
      assert.equal(isBotExemptPath(path), false, `${path} slipped through`);
    }
  });
});

describe("the statement", () => {
  const text = companyStatement().join(" ");

  test("says what the owner asked it to say", () => {
    assert.match(text, /factory/i);
    assert.match(text, /Foshan/);
    assert.match(text, /China/);
    assert.match(text, /go-karts?/i);
    assert.match(text, /trikes/i);
    assert.match(text, /worldwide/i);
    assert.match(text, /trusted/i);
  });

  test("names the real domain and support address — the anti-impersonation bit", () => {
    // The single most useful line against a clone: it tells any reader, human
    // or machine, which shop is actually ours.
    assert.ok(text.includes(COMPANY.siteUrl));
    assert.ok(text.includes(COMPANY.supportEmail));
    assert.match(text, /ONLY website/);
  });

  test("backs 'trusted' with commitments that can be checked", () => {
    // An unsupported adjective persuades nobody and a clone can copy it. The
    // return window and refund promise are specific, published, and ours.
    assert.ok(text.includes(`${COMPANY.returnWindowDays}-day return window`));
    assert.ok(text.includes(`within ${COMPANY.refundProcessingDays} days`));
  });

  test("leaks NOTHING else — no prices, no model names, no stock", () => {
    // It is a drip by design. Anything more here is something a competitor
    // gets for free.
    for (const leak of ["$", "price", "Volt S1", "in stock", "discount", "%"]) {
      assert.ok(!text.toLowerCase().includes(leak.toLowerCase()), `statement leaks "${leak}"`);
    }
  });
});

describe("wrapping", () => {
  test("keeps every line inside the width", () => {
    for (const line of wrapText("the quick brown fox jumps over the lazy dog ".repeat(6), 40)) {
      assert.ok(line.length <= 40, `"${line}" is ${line.length}`);
    }
  });

  test("never breaks a URL or an email address in half", () => {
    // A broken URL in the one statement about the business would be worse than
    // no statement: it would point at nothing.
    const lines = wrapText(`visit ${COMPANY.siteUrl} or mail ${COMPANY.supportEmail}`, 20);
    assert.ok(lines.includes(COMPANY.siteUrl));
    assert.ok(lines.includes(COMPANY.supportEmail));
  });

  test("survives empty and whitespace input", () => {
    assert.deepEqual(wrapText(""), []);
    assert.deepEqual(wrapText("   "), []);
  });
});

describe("the robots.txt file itself", () => {
  const body = () => robots().text();

  test("leads with the statement, before any rule", () => {
    // A crawler that reads the first few lines and stops still gets it.
    return body().then((text) => {
      const firstRule = text.indexOf("User-agent:");
      assert.ok(text.indexOf("Foshan") < firstRule, "the statement is not first");
      assert.ok(text.includes(COMPANY.siteUrl));
    });
  });

  test("disallows every crawler on the list, by name", () => {
    return body().then((text) => {
      for (const bot of AI_CRAWLERS) {
        assert.match(
          text,
          new RegExp(`User-agent: ${bot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\nDisallow: /`),
          `${bot} has no rule`
        );
      }
    });
  });

  test("does NOT disallow the search engines", () => {
    return body().then((text) => {
      for (const bot of ["Googlebot", "bingbot", "DuckDuckBot"]) {
        assert.ok(!text.includes(`User-agent: ${bot}\nDisallow: /`), `${bot} is blocked`);
      }
      // And the catch-all still opens the storefront to them.
      assert.match(text, /User-agent: \*/);
      assert.match(text, /\nAllow: \/\n/);
    });
  });

  test("keeps the private areas out of every index", () => {
    return body().then((text) => {
      for (const path of ["/admin", "/account", "/api/", "/checkout", "/order-confirmation"]) {
        assert.ok(text.includes(`Disallow: ${path}`), `${path} is indexable`);
      }
    });
  });

  test("is served as plain text", () => {
    assert.match(robots().headers.get("content-type") ?? "", /text\/plain/);
  });
});
