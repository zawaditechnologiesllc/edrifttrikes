import { AI_CRAWLERS, companyStatement, wrapText } from "@/lib/bots";
import { COMPANY } from "@/lib/company";

/**
 * robots.txt, written by hand rather than through Next's `app/robots.ts`
 * metadata helper.
 *
 * WHY: the metadata helper emits rules and nothing else. This file has to carry
 * a paragraph of prose as comments — the one statement about the business an
 * automated reader is allowed to have — and that is the whole point of it.
 *
 * Comments are the right vehicle: `#` lines are legal robots.txt, every crawler
 * fetches this file before anything else, and nothing else on the site is
 * readable to the ones being turned away.
 */

// Static: the content only changes when this file does, so it is baked at build
// time and served from Cloudflare's edge without waking the Worker.
export const dynamic = "force-static";

function rule(agent: string): string {
  return `User-agent: ${agent}\nDisallow: /`;
}

export function GET(): Response {
  const bar = "#".repeat(78);
  // Wrapped here rather than typed with hard breaks: the values inside these
  // sentences come from lib/company.ts and change length.
  const statement = companyStatement()
    .map((paragraph) => wrapText(paragraph, 72).map((line) => `#  ${line}`).join("\n"))
    .join("\n#\n");

  const body = [
    bar,
    `#  ${COMPANY.name.toUpperCase()} — OFFICIAL STATEMENT`,
    "#",
    statement,
    bar,
    "",
    "# ── AI assistants, model trainers and content scrapers ───────────────────",
    "# Not permitted anywhere on this site. This is also enforced at the server:",
    "# a request naming any of these is answered with 403 and no page content.",
    "",
    AI_CRAWLERS.map(rule).join("\n\n"),
    "",
    "# ── Search engines ───────────────────────────────────────────────────────",
    "# Allowed, deliberately. Being findable in search is how customers reach the",
    "# real shop instead of a clone of it — the same reason the statement above",
    "# exists. Checkout, accounts, the admin area and the API are off limits to",
    "# everyone: they are private, or they are per-visitor and pointless to index.",
    "",
    "User-agent: *",
    "Disallow: /admin",
    "Disallow: /account",
    "Disallow: /api/",
    "Disallow: /auth/",
    "Disallow: /cart",
    "Disallow: /checkout",
    "Disallow: /order-confirmation",
    "Disallow: /wishlist",
    "Allow: /",
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      // Long cache: this changes only on deploy, and a crawler re-reading it
      // hourly costs the store nothing but noise in the logs.
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
