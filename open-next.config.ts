import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext → Cloudflare adapter config.
 *
 * Default (no bindings required) gets you deployed immediately: static/ISR
 * pages are served from Cloudflare's asset layer (unlimited & free), and only
 * dynamic routes invoke the Worker.
 *
 * PRODUCTION UPGRADE (optional, recommended once traffic grows): enable a
 * persistent incremental cache so ISR revalidation and `revalidateTag` are
 * shared across the whole fleet (instant catalog updates after admin saves).
 * Create an R2 bucket + KV namespace, bind them in wrangler.jsonc, then:
 *
 *   import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
 *   import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
 *   export default defineCloudflareConfig({
 *     incrementalCache: withRegionalCache(r2IncrementalCache, { mode: "long-lived" }),
 *   });
 *
 * See docs/DEPLOYMENT.md for the full walkthrough.
 */
export default defineCloudflareConfig();
