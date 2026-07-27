import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Enables Cloudflare bindings (env vars, caches) during `next dev`. No-op in
// production builds.
initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Gzip HTML/JSON responses at the edge/server. On by default, set explicitly
  // so it can't be lost to a config change.
  compress: true,

  experimental: {
    serverActions: {
      // Default is 1 MB, which any phone photo exceeds — the admin product
      // save would then die before the action ran, leaving the form stuck on
      // "Saving…". Sized for a hero image + a few gallery shots; the form also
      // guards per-file size client-side so oversized picks fail with a
      // message instead of a dead request.
      bodySizeLimit: "50mb",
    },
  },

  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      // Force HTTPS for 2 years (safe: the site is always served over HTTPS via
      // Cloudflare). Belt-and-suspenders with Cloudflare's edge HSTS setting.
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      // Conservative CSP: only the directives that harden without risking the
      // app's inline env script, Turnstile, Supabase, Stripe/PayPal, or images.
      // - object-src 'none'  → no Flash/plugins (a classic XSS/exfil vector)
      // - base-uri 'self'    → a <base> tag can't be injected to hijack URLs
      // - frame-ancestors    → clickjacking protection (pairs with X-Frame-Options)
      // - form-action 'self' → forms can only post back to us
      {
        key: "Content-Security-Policy",
        value:
          "object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'",
      },
    ];
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
