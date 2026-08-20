import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SiteHeader from "@/components/storefront/SiteHeader";
import SiteFooter from "@/components/storefront/SiteFooter";
import ProductCard from "@/components/storefront/ProductCard";
import ProductGallery from "@/components/storefront/ProductGallery";
import RichText from "@/components/storefront/RichText";
import ProductBuyPanel from "@/components/storefront/ProductBuyPanel";
import { productColors } from "@/lib/colors";
import WishlistButton from "@/components/storefront/WishlistButton";
import { getProductBySlug, getProducts, getSiteSettings } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { productShippingCents, DEFAULT_SHIPPING_CENTS } from "@/lib/totals";

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
              <span className="normal-case font-body-md tracking-normal">· delivery in 12–20 days</span>
            </p>

            {lowStock && (
              <div className="hazard-stripes text-black font-label-bold text-label-bold uppercase tracking-widest px-4 py-2 rounded inline-block">
                <span className="bg-surface px-2 py-1 text-signal-orange">Low stock — only {product.stock} left</span>
              </div>
            )}

            <div className="pt-2">
              <ProductBuyPanel
                productId={product.id}
                colors={productColors(product.colors)}
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

            {product.description && (
              <RichText
                text={product.description}
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
