import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  BLOCKED_MESSAGE,
  countryFromHeaders,
  isApiPath,
  isBlockedCountry,
  isExemptPath,
  parseBlockedCountries,
} from "@/lib/geo";

export async function middleware(request: NextRequest) {
  // Country block first: there is no point refreshing an auth session for a
  // visitor who is about to be turned away.
  const blocked = parseBlockedCountries(process.env.BLOCKED_COUNTRIES);
  if (blocked.length > 0 && !isExemptPath(request.nextUrl.pathname)) {
    const country = countryFromHeaders(request.headers);
    // An UNKNOWN country is served. Refusing everyone the edge cannot place
    // would turn a geo-lookup gap into lost sales.
    if (isBlockedCountry(country, blocked)) {
      // An API caller gets JSON. Rewriting a POST to a page would answer with
      // 405 and an HTML body, which reads as a broken store rather than a
      // refusal.
      if (isApiPath(request.nextUrl.pathname)) {
        return NextResponse.json({ error: BLOCKED_MESSAGE }, { status: 403 });
      }
      const url = request.nextUrl.clone();
      url.pathname = "/unavailable";
      url.search = "";
      // Rewrite, not redirect: the visitor gets the explanation at the URL they
      // asked for, and nothing advertises which path the block lives at.
      return NextResponse.rewrite(url, { status: 403 });
    }
  }

  return await updateSession(request);
}

export const config = {
  /*
   * TWO JOBS, ONE MATCHER.
   *
   * The auth-session refresh only needs the routes that read the logged-in
   * user. The country block needs every page, which is why this list is wider
   * than it was — a block that only covered the account pages would not be a
   * block. updateSession is a no-op for the rest, so the extra paths cost a
   * cheap header read.
   *
   * The trade is real: the Worker now runs on page requests that Cloudflare
   * previously served as static assets for free. If that ever matters at scale,
   * move the country block to a Cloudflare WAF rule (free, runs before the
   * Worker) and narrow this back — see docs/DEPLOYMENT.md.
   *
   * Static assets, images and the payment/cron endpoints are excluded here as
   * well as in isExemptPath, so they never reach the Worker at all.
   */
  matcher: [
    "/((?!_next/static|_next/image|assets|favicon.ico|icon.svg|robots.txt|sitemap.xml|api/internal|api/cron|api/paypal|api/health).*)",
  ],
};
