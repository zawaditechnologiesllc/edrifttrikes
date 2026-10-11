import { COMPANY } from "@/lib/company";
import { wrapText } from "@/lib/bots";
import { publicSiteUrl } from "@/lib/env";
import { siteUrl } from "@/lib/seo";

/**
 * /.well-known/security.txt — RFC 9116.
 *
 * ═══ WHY A SHOP THIS SIZE PUBLISHES ONE ════════════════════════════════════
 *
 * Two reasons, and the second is the one that pays for it.
 *
 * 1. If somebody finds a flaw here, they need somewhere to send it. Without a
 *    published address the usual outcome is that they tell nobody, or they
 *    tell the internet.
 *
 * 2. It is one of the few machine-readable signals that a domain is run by
 *    someone contactable. Reputation feeds, ISP filters and corporate web
 *    gateways score a young domain on the absence of ordinary signals as much
 *    as on anything it does wrong, and a file at a standard path with a
 *    working address in it is cheap evidence of a real operator. It is not a
 *    way out of a blocklist — see docs/BLOCKLIST-APPEALS.md for that — but
 *    it is on the list of things a reviewer checks.
 *
 * ⚠️ EVERY ADDRESS IN HERE MUST BE REAL. A security.txt pointing at a mailbox
 * nobody reads is worse than none: it is a published promise to answer. So it
 * uses COMPANY.supportEmail, which is a constant in this repository and not an
 * admin setting that might still be unfilled.
 */

// Static: the content changes only when this file or lib/company.ts does.
export const dynamic = "force-static";

/** One year out, per RFC 9116 §2.5.5 — regenerated on every deploy. */
function expiry(now: Date): string {
  const d = new Date(now);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function GET(): Response {
  const base = siteUrl(publicSiteUrl());
  const notes = [
    `${COMPANY.name} is a manufacturer selling electric drift trikes and go-karts direct to customers. ${base} is our only website and ${COMPANY.supportEmail} is our only support address.`,
    "We have no bug bounty and no budget for one. We will read, answer and act on anything you send, and we will credit you if you want it.",
    "If you operate a blocklist, a reputation feed or a web filter and have classified this domain, that address reaches a human. Tell us what you are seeing and we will fix it or show you why it is a false positive.",
  ]
    .map((p) => wrapText(p, 72).map((line) => `# ${line}`).join("\n"))
    .join("\n#\n");

  const body = [
    notes,
    "",
    `Contact: mailto:${COMPANY.supportEmail}`,
    `Expires: ${expiry(new Date())}`,
    "Preferred-Languages: en",
    `Canonical: ${base}/.well-known/security.txt`,
    `Policy: ${base}/terms`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
