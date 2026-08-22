import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isAiCrawler, isBotExemptPath } from "@/lib/bots";

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

  return await updateSession(request);
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
   * isBotExemptPath, so they never reach the Worker at all. robots.txt is
   * excluded too: it is prerendered, and it must stay readable by the very
   * crawlers being turned away.
   */
  matcher: [
    "/((?!_next/static|_next/image|assets|favicon.ico|icon.svg|robots.txt|sitemap.xml|api/internal|api/cron|api/paypal|api/health).*)",
  ],
};
