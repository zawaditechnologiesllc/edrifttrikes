import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isAiCrawler, isBotExemptPath } from "@/lib/bots";
import { canonicalFor, regionFromHost } from "@/lib/regions";

export async function middleware(request: NextRequest) {
  // AI crawlers first: there is no point refreshing an auth session for a
  // request that is about to be refused, and robots.txt on its own is only a
  // request — this is what makes it a rule.
  if (
    !isBotExemptPath(request.nextUrl.pathname) &&
    isAiCrawler(request.headers.get("user-agent"))
  ) {
    // 403 with a bare line rather than a rendered page: a blocked crawler must
    // not come away with markup, copy, prices or product names. The pointer to
    // robots.txt is deliberate — that file is where the one thing it IS allowed
    // to know about this business lives.
    return new NextResponse(
      "Automated access is not permitted. See /robots.txt.\n",
      {
        status: 403,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          // Nothing about a refusal should be cached or indexed.
          "cache-control": "no-store",
          "x-robots-tag": "noindex, nofollow",
        },
      }
    );
  }

  const response = await updateSession(request);

  /*
   * ═══ FOUR HOSTNAMES, ONE SITE ════════════════════════════════════════════
   *
   * The regional subdomains serve the same catalogue, the same products and
   * the same policies as the apex. Left unsaid, that is three duplicate copies
   * of a shop — which splits its own ranking and, at worst, reads as a doorway
   * network, the sort of signal that gets a young domain filtered rather than
   * ranked. Saying it here costs one header.
   *
   * Sent as a Link header rather than a <link> tag because it then covers every
   * response — pages, PDFs, the feed — without touching each one's metadata,
   * and because this is the only place that knows both the host and the path.
   *
   * The region's OWN landing page is canonical to itself: it is the one page
   * whose content is genuinely regional.
   */
  const region = regionFromHost(request.headers.get("host"));
  if (region.subdomain) {
    // APPEND, never set: Link is a multi-value header and Next uses it for
    // preload hints. Replacing it would quietly drop them.
    response.headers.append(
      "Link",
      `<${canonicalFor(region, request.nextUrl.pathname)}>; rel="canonical"`
    );
  }

  return response;
}

export const config = {
  /*
   * TWO JOBS, ONE MATCHER.
   *
   * The auth-session refresh only needs the routes that read the logged-in
   * user; the crawler block needs every page, because a block that covered only
   * the account pages would not be a block. updateSession is a no-op on the
   * rest, so the extra paths cost one header read each.
   *
   * THE TRADE IS REAL: the Worker now runs on page requests Cloudflare would
   * otherwise have served as free static assets. At this store's traffic that
   * sits well inside the free tier, but if it ever shows up on the bill, turn
   * on Cloudflare's own AI-crawler block (Security → Bots) and narrow this back
   * to the four auth paths. That runs before the Worker, costs nothing, and
   * catches scrapers that lie about their user agent — which this cannot. See
   * docs/DEPLOYMENT.md.
   *
   * Static assets and the machine endpoints are excluded here as well as in
   * isBotExemptPath, so they never reach the Worker at all. robots.txt and
   * /.well-known are excluded too: they are prerendered, and they must stay
   * readable by the very crawlers being turned away — a security.txt that only
   * answers browsers is not reachable by the scanners it exists for.
   */
  matcher: [
    "/((?!_next/static|_next/image|assets|favicon.ico|icon.svg|robots.txt|sitemap.xml|\\.well-known|api/internal|api/cron|api/paypal|api/health).*)",
  ],
};
