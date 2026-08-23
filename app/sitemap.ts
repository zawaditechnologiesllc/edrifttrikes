import type { MetadataRoute } from "next";
import { getProducts, getCategories, getArticles } from "@/lib/db";
import { publicSiteUrl } from "@/lib/env";
import { siteUrl } from "@/lib/seo";

/**
 * The sitemap.
 *
 * WHY IT MATTERS TO A NEW SHOP: a search engine finds a brand-new domain by
 * crawling links to it, and a brand-new domain has almost none. A sitemap is
 * the one way to say "here is everything, all at once" without waiting for
 * someone else to link to you — which is exactly the position a store is in
 * before it has any reputation.
 *
 * Only public, indexable pages. Checkout, the cart, accounts, the admin area
 * and the API are absent here and disallowed in robots.txt: they are private,
 * or they are per-visitor and pointless to index.
 */

// Rebuilt hourly rather than baked at build time, so a product added this
// afternoon is in the sitemap this afternoon.
export const revalidate = 3600;

/** Pages that exist regardless of what is in the database. */
const STATIC_PATHS: [path: string, priority: number, freq: "daily" | "weekly" | "monthly"][] = [
  ["", 1.0, "daily"],
  ["/shop", 0.9, "daily"],
  ["/electric-trikes", 0.8, "weekly"],
  ["/our-story", 0.7, "monthly"],
  ["/tech-lab", 0.6, "weekly"],
  ["/support", 0.6, "monthly"],
  ["/shipping-warranty", 0.5, "monthly"],
  ["/returns", 0.5, "monthly"],
  ["/terms", 0.3, "monthly"],
  ["/privacy", 0.3, "monthly"],
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl(publicSiteUrl());
  const now = new Date();

  // A database that is unreachable must not take the whole sitemap down with
  // it — the static pages are still worth serving.
  const [products, categories, articles] = await Promise.all([
    getProducts().catch(() => []),
    getCategories().catch(() => []),
    getArticles().catch(() => []),
  ]);

  return [
    ...STATIC_PATHS.map(([path, priority, changeFrequency]) => ({
      url: `${base}${path}`,
      lastModified: now,
      changeFrequency,
      priority,
    })),
    ...categories.map((c) => ({
      url: `${base}/shop?category=${encodeURIComponent(c.slug)}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...products.map((p) => ({
      url: `${base}/product/${encodeURIComponent(p.slug)}`,
      // The real row timestamp: a search engine uses it to decide what to
      // re-crawl, and a made-up "now" on every page teaches it to ignore the
      // field entirely.
      lastModified: p.updated_at ? new Date(p.updated_at) : now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...articles.map((a) => ({
      url: `${base}/tech-lab/${encodeURIComponent(a.slug)}`,
      lastModified: a.published_at ? new Date(a.published_at) : now,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
