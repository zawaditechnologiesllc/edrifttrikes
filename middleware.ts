import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  /*
   * Only run the auth-session refresh on routes that actually read the logged-in
   * user. Public catalog/marketing pages are left untouched so Cloudflare serves
   * them as static assets (unlimited & free) without invoking the Worker — this
   * is what keeps an Instagram-scale traffic spike inside the free tier.
   */
  matcher: [
    "/account/:path*",
    "/admin/:path*",
    "/wishlist/:path*",
    "/api/wishlist/:path*",
  ],
};
