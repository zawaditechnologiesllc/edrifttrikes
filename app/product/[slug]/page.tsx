import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SiteHeader from "@/components/storefront/SiteHeader";
import SiteFooter from "@/components/storefront/SiteFooter";
import ProductCard from "@/components/storefront/ProductCard";
import ProductGallery from "@/components/storefront/ProductGallery";
import RichText from "@/components/storefront/RichText";
import ProductBuyPanel from "@/components/storefront/ProductBuyPanel";
import { descriptionBody, productColorOptions } from "@/lib/colors";
import WishlistButton from "@/components/storefront/WishlistButton";
import { getProductBySlug, getProducts, getSiteSettings } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { productShippingCents, DEFAULT_SHIPPING_CENTS } from "@/lib/totals";
import { formatDeliveryWindow, MAX_ROUTE_EXTRA_DAYS } from "@/lib/delivery";

// Product pages are ISR-cached; per-user wishlist state loads client-side.
export const revalidate = 120;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  return { title: product ? product.name : "Product" };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  // Hero first, then the gallery images (deduped) — one scrollable set.
  const gallery = [
    ...(product.hero_image ? [product.hero_image] : []),
    ...(product.images ?? []).map((i) => i.url),
  ].filter((src, i, arr) => arr.indexOf(src) === i);
  if (gallery.length === 0) gallery.push("/assets/placeholder.svg");

  const [relatedAll, settings] = await Promise.all([
    getProducts({ limit: 3 }),
    getSiteSettings(),
  ]);
  const related = relatedAll.filter((p) => p.id !== product.id).slice(0, 3);
  const lowStock = product.stock > 0 && product.stock <= 5;

  const shipFee = productShippingCents(product, settings);
  const shipsFree = shipFee === 0;
  // The fee that WOULD apply — crossed out next to FREE.
  const struckFee =
    product.shipping_cents ?? settings.shipping_cents ?? DEFAULT_SHIPPING_CENTS;

  return (
    <div className="bg-surface text-on-surface min-h-screen">
      <SiteHeader />

      <main className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-12">
        <nav className="text-xs font-label-bold uppercase tracking-widest text-on-surface-variant mb-8 flex gap-2">
          <Link href="/shop" className="hover:text-secondary">Shop</Link>
          <span>/</span>
          <span className="text-secondary">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Gallery */}
          <ProductGallery images={gallery} name={product.name} />

          {/* Buy box */}
          <div className="space-y-6">
            {product.badge && (
              <span className="inline-block bg-secondary text-on-secondary-fixed px-3 py-1 font-label-bold text-[10px] uppercase tracking-widest cut-corner-badge">
                {product.badge}
              </span>
            )}
            <h1 className="font-display-lg text-display-lg-mobile md:text-headline-xl text-white uppercase leading-none">
              {product.name}
            </h1>
            <p className="text-on-surface-variant font-body-lg border-l-4 border-secondary pl-6">
              {product.tagline}
            </p>
            <div className="flex items-baseline gap-3">
              <span className="font-headline-xl text-headline-xl text-secondary">
                {formatMoney(product.price_cents)}
              </span>
              {product.compare_at_cents && (
                <span className="text-on-surface-variant line-through text-xl">
                  {formatMoney(product.compare_at_cents)}
                </span>
              )}
            </div>

            <p className="text-on-surface-variant font-label-bold uppercase tracking-widest text-sm">
              Shipping:{" "}
              {shipsFree ? (
                <>
                  <span className="line-through">{formatMoney(struckFee)}</span>{" "}
                  <span className="text-secondary">FREE</span>
                </>
              ) : (
                <span className="text-white">{formatMoney(shipFee)}</span>
              )}{" "}
              <span className="normal-case font-body-md tracking-normal">
                · delivery in {formatDeliveryWindow()}
              </span>
            </p>
            {/* The base window is the fastest route. Saying so here means the
                narrower number at checkout reads as a refinement rather than a
                change of story. */}
            <p className="text-outline text-xs -mt-4">
              Distant destinations add up to {MAX_ROUTE_EXTRA_DAYS} days — checkout shows the
              exact window for your address before you pay.
            </p>

            {lowStock && (
              <div className="hazard-stripes text-black font-label-bold text-label-bold uppercase tracking-widest px-4 py-2 rounded inline-block">
                <span className="bg-surface px-2 py-1 text-signal-orange">Low stock — only {product.stock} left</span>
              </div>
            )}

            <div className="pt-2">
              <ProductBuyPanel
                productId={product.id}
                colors={productColorOptions(product)}
                item={{
                  productId: product.id,
                  slug: product.slug,
                  name: product.name,
                  priceCents: product.price_cents,
                  imageUrl: product.hero_image,
                  stock: product.stock,
                  shippingCents: product.shipping_cents ?? null,
                  freeShipping: Boolean(product.free_shipping),
                }}
              />
            </div>

            {/* Generated on request from the live product record, so what a
                buyer downloads always matches what the page shows. */}
            <a
              href={`/product/${product.slug}/information`}
              className="inline-flex items-center gap-3 border border-white/15 rounded-lg px-4 py-3 text-on-surface-variant hover:border-secondary hover:text-white transition-colors group"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                className="w-5 h-5 text-secondary shrink-0"
              >
                <path d="M12 3v12m0 0-4-4m4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
              </svg>
              <span>
                <span className="block font-label-bold text-label-bold uppercase tracking-widest text-xs text-white">
                  Download product information
                </span>
                <span className="block text-xs mt-0.5">
                  Full specification, colours and delivery details (PDF)
                </span>
              </span>
            </a>

            {descriptionBody(product.description) && (
              <RichText
                text={descriptionBody(product.description)}
                className="text-on-surface-variant pt-2"
              />
            )}

            {/* Specs */}
            {product.specs && product.specs.length > 0 && (
              <div className="border-t border-white/10 pt-6">
                <h2 className="font-headline-md text-headline-md text-white uppercase mb-4">Technical Spec</h2>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                  {product.specs.map((s) => (
                    <div key={s.id} className="flex justify-between border-b border-white/5 py-3">
                      <dt className="text-on-surface-variant flex items-center gap-2">
                        <span className="w-2 h-2 bg-secondary inline-block" />
                        {s.label}
                      </dt>
                      <dd className="text-white font-label-bold">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-24">
            <h2 className="font-headline-xl text-headline-xl text-white uppercase mb-8">More Builds</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
