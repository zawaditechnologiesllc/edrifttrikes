import { serverEnv } from "@/lib/env";
import AnalyticsBeacon from "@/components/AnalyticsBeacon";

/**
 * Cloudflare Web Analytics.
 *
 * WHY THIS ONE: the store already runs on Cloudflare, so it costs nothing, adds
 * one deferred request, sets no cookies and stores no personal data — which
 * means no consent banner and no privacy-policy change. Google Analytics would
 * have meant a cookie banner, and a cookie banner on a landing page costs more
 * conversions than the analytics recover.
 *
 * Absent token = no script at all, so this is safe to leave unconfigured.
 * The loading itself is in AnalyticsBeacon, which explains why it has to
 * happen in the browser rather than in this markup.
 */
export default function Analytics() {
  return <AnalyticsBeacon token={serverEnv("CLOUDFLARE_ANALYTICS_TOKEN") ?? ""} />;
}
