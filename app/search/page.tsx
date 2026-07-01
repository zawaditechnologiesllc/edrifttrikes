import Link from "next/link";
import SiteHeader from "@/components/storefront/SiteHeader";
import SiteFooter from "@/components/storefront/SiteFooter";
import ProductCard from "@/components/storefront/ProductCard";
import { searchProducts } from "@/lib/db";
import { Icon } from "@/components/Icon";

export const metadata = { title: "Search" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = (searchParams.q || "").trim();
  const results = q ? await searchProducts(q) : [];

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-max-width w-full mx-auto px-margin-mobile md:px-margin-desktop py-16">
        <form action="/search" method="get" className="max-w-2xl mx-auto mb-16">
          <div className="relative">
            <Icon name="search" className="w-6 h-6 absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              name="q"
              defaultValue={q}
              autoFocus
              placeholder="SEARCH RIGS, PARTS, GEAR…"
              className="w-full bg-surface-container border border-white/10 rounded-lg pl-12 pr-4 py-5 text-white text-lg placeholder:text-outline focus:border-secondary focus:ring-0"
            />
          </div>
        </form>

        {q && (
          <h1 className="font-headline-md text-headline-md text-white uppercase mb-8">
            {results.length} result{results.length === 1 ? "" : "s"} for “{q}”
          </h1>
        )}

        {q && results.length === 0 ? (
          <div className="text-center py-24">
            <Icon name="search_off" className="w-16 h-16 text-outline" />
            <p className="font-headline-md text-2xl uppercase text-white mt-4">Off track</p>
            <p className="text-on-surface-variant mt-2">No rigs match “{q}”. Try another term.</p>
            <Link href="/shop" className="inline-block mt-6 bg-primary-container text-white px-8 py-4 rounded-lg font-label-bold uppercase tracking-widest hover:brightness-110 transition-all">
              Browse all rigs
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter">
            {results.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
