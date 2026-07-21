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

  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
    ];
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
