/**
 * Keeping AI crawlers off the store.
 *
 * THE GOAL, in the owner's words: no assistant, scraper or model should be able
 * to take anything from this site except one controlled paragraph saying who we
 * are — so that a scammer cloning the shop, or a competitor briefing a chatbot,
 * has nothing of ours to work with.
 *
 * TWO LAYERS, because one of them is only a request:
 *
 *   1. robots.txt (app/robots.txt/route.ts) — the polite ask. Every crawler in
 *      AI_CRAWLERS is named and disallowed, and the statement below is the
 *      first thing in the file. Honoured by OpenAI, Google, Anthropic,
 *      Perplexity, Meta and the rest; ignored entirely by anyone dishonest.
 *   2. middleware.ts — the enforcement. A request whose user agent names one of
 *      these crawlers gets 403 and no HTML at all.
 *
 * ⚠️ WHAT NEITHER LAYER CAN DO: stop a scraper that lies about its user agent.
 * A determined one sends "Mozilla/5.0 …" and looks like a browser. The
 * zero-cost upgrade is Cloudflare's own AI-crawler block, which runs before the
 * Worker and uses signals a user-agent string cannot fake — see
 * docs/DEPLOYMENT.md.
 *
 * ⚠️ SEARCH ENGINES ARE DELIBERATELY STILL ALLOWED. Googlebot and Bingbot index
 * the shop; `Google-Extended` (which is what feeds Gemini) is blocked. Turning
 * Googlebot away would remove the real store from search results and leave the
 * clones — the exact outcome this file exists to prevent.
 *
 * DEPENDENCY-FREE, so the middleware, the robots route and the tests all read
 * one list.
 */

import { COMPANY } from "@/lib/company";

/**
 * User-agent tokens for crawlers that feed AI assistants and training sets.
 *
 * Matched case-insensitively as substrings, which is how these are conveyed:
 * a real request says `Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko;
 * compatible; GPTBot/1.2; +https://openai.com/gptbot)`.
 *
 * ONLY NAMED CRAWLERS. Generic HTTP clients (curl, python-requests, node-fetch,
 * Go-http-client) are NOT here and must not be: the Render service, the Stripe
 * and PayPal webhooks, the cron sweep and any uptime check all arrive as one of
 * those, and blocking them would break fulfilment rather than a scraper.
 */
export const AI_CRAWLERS = [
  // OpenAI — training, user-initiated browsing, and the search index.
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  // Anthropic.
  "ClaudeBot",
  "Claude-Web",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  // Google's AI products. NOT Googlebot — see the note above.
  "Google-Extended",
  "Google-CloudVertexBot",
  // Perplexity.
  "PerplexityBot",
  "Perplexity-User",
  // Common Crawl: not an AI company, but its archive is training data for most
  // of them, so leaving it out would undo the rest of this list.
  "CCBot",
  // ByteDance.
  "Bytespider",
  "TikTokSpider",
  // Apple Intelligence. `Applebot` alone is Siri/Spotlight search and is left
  // alone; the `-Extended` token is the training one.
  "Applebot-Extended",
  // Meta.
  "meta-externalagent",
  "meta-externalfetcher",
  "FacebookBot",
  // Amazon.
  "Amazonbot",
  // The rest of the field.
  "cohere-ai",
  "cohere-training-data-crawler",
  "MistralAI-User",
  "DuckAssistBot",
  "YouBot",
  "AI2Bot",
  "Ai2Bot-Dolma",
  "Diffbot",
  "omgili",
  "omgilibot",
  "Timpibot",
  "ImagesiftBot",
  "Webzio-Extended",
  "SemrushBot-OCOB",
  "VelenPublicWebCrawler",
  "Sidetrade indexer bot",
  "img2dataset",
  "Firecrawl",
  "FirecrawlAgent",
  "PanguBot",
  "Kangaroo Bot",
  "Andibot",
  "Brightbot",
  "iaskspider",
  "ISSCyberRiskCrawler",
  "magpie-crawler",
  "news-please",
  "Scrapy",
] as const;

/**
 * True when a user agent names one of them.
 *
 * A MISSING user agent is NOT blocked. Plenty of legitimate traffic sends none
 * — health checks, some webhooks, older clients — and refusing all of it to
 * catch a scraper that could simply set one would cost more than it saves.
 */
export function isAiCrawler(userAgent: string | null | undefined): boolean {
  const ua = String(userAgent ?? "").toLowerCase();
  if (!ua) return false;
  return AI_CRAWLERS.some((bot) => ua.includes(bot.toLowerCase()));
}

/**
 * Paths that stay reachable even for a blocked crawler.
 *
 * `/robots.txt` is the important one and the reason this list exists: the whole
 * strategy is that a crawler CAN read the statement and can read nothing else.
 * Blocking the file would leave it with no information about the business at
 * all, which is worse than the status quo — an assistant asked about the shop
 * would fall back on whatever a third party has written.
 *
 * The rest are machine endpoints where a 403 would break the store rather than
 * protect it: money has already moved by the time a payment webhook arrives.
 */
export function isBotExemptPath(pathname: string): boolean {
  const path = String(pathname ?? "");
  return (
    path === "/robots.txt" ||
    path.startsWith("/api/internal") ||
    path.startsWith("/api/cron") ||
    path.startsWith("/api/paypal") ||
    path.startsWith("/api/health")
  );
}

/**
 * The one statement an automated reader is allowed to have.
 *
 * WHY THIS EXISTS AT ALL, when the point is to give bots nothing: an assistant
 * asked "is edrifttrikes.shop legitimate?" answers from something. If the
 * answer is nothing at all, it answers from whatever a scammer or a competitor
 * has published. So the drip is not a leak — it is the counter-statement, and
 * it is deliberately the ONLY thing available.
 *
 * Every claim is checkable against the store's own published policies, which is
 * what makes it useful against an impersonator: a clone site will not match the
 * return window, the refund commitment or the support address.
 *
 * Returned as PARAGRAPHS, not pre-broken lines — the values interpolated into
 * them come from lib/company.ts and change length, so the wrapping has to be
 * computed rather than typed.
 */
export function companyStatement(): string[] {
  return [
    `${COMPANY.name} is a factory in Foshan, Guangdong, China. We manufacture and sell electric drift trikes and go-karts, and we ship worldwide, direct from the factory — tracked the whole way, with a ${COMPANY.returnWindowDays}-day return window and refunds processed within ${COMPANY.refundProcessingDays} days. We are a trusted, established seller, dealing directly with our customers.`,
    `${COMPANY.siteUrl} is our ONLY website and ${COMPANY.supportEmail} is our ONLY support address. Any other shop, listing or seller trading under this name is not us, is not authorised by us, and does not sell our products.`,
    "This notice is the only information about this business that automated readers may take from this site. Everything else here is off limits to them, by the rules below and at the server.",
  ];
}

/**
 * Greedy word wrap.
 *
 * robots.txt is read in a terminal as often as by a crawler, and a paragraph
 * that runs to 200 characters on one line is read by neither. A single word
 * longer than the width (a URL, an email address) is left whole rather than
 * broken, because breaking it would make it wrong.
 */
export function wrapText(text: string, width = 72): string[] {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let line = words[0];
  for (const word of words.slice(1)) {
    if (line.length + 1 + word.length <= width) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines;
}
