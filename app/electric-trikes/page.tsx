import Link from "next/link";
import SiteHeader from "@/components/storefront/SiteHeader";
import SiteFooter from "@/components/storefront/SiteFooter";
import ProductCard from "@/components/storefront/ProductCard";
import { getProducts } from "@/lib/db";

export const metadata = { title: "Electric Drift Trikes" };

export default async function ElectricTrikes() {
  const products = await getProducts({ power: "electric", sort: "newest" });

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col">
      <SiteHeader />

      <header className="relative h-[50vh] overflow-hidden flex items-end power-slant-divider bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/trike-voltage-blue.jpg" alt="Electric drift trike" className="absolute inset-0 w-full h-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-black/30" />
        <div className="relative max-w-max-width w-full mx-auto px-margin-mobile md:px-margin-desktop pb-14">
          <span className="font-label-bold text-label-bold text-secondary uppercase tracking-widest">Instant torque · Zero emissions</span>
          <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-white uppercase leading-none mt-2">Electric Drift Trikes</h1>
        </div>
      </header>

      <main className="flex-1 max-w-max-width w-full mx-auto px-margin-mobile md:px-margin-desktop py-16">
        <p className="text-on-surface-variant font-body-lg max-w-2xl border-l-4 border-secondary pl-6 mb-12">
          72V brushless power, tuned regen braking and silent break-loose. The cleanest way to dominate every corner.
        </p>
        {products.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-white/10 rounded-lg">
            <p className="text-on-surface-variant uppercase tracking-widest font-label-bold">No electric rigs published yet</p>
            <Link href="/shop" className="inline-block mt-4 text-secondary font-label-bold uppercase tracking-widest">Browse all rigs →</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
