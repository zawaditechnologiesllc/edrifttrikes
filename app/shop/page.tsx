import Link from "next/link";
import SiteHeader from "@/components/storefront/SiteHeader";
import SiteFooter from "@/components/storefront/SiteFooter";
import ProductCard from "@/components/storefront/ProductCard";
import { getProducts, getCategories } from "@/lib/db";

export const metadata = { title: "Shop All Rigs" };

const POWER = [
  { key: "", label: "All Power" },
  { key: "electric", label: "Electric" },
  { key: "gas", label: "Gas" },
  { key: "gravity", label: "Gravity" },
];
const SORTS = [
  { key: "newest", label: "Latest Drop" },
  { key: "price-asc", label: "Price ↑" },
  { key: "price-desc", label: "Price ↓" },
];

export default async function ShopPage({
  searchParams,
}: {
  searchParams: { category?: string; power?: string; sort?: string };
}) {
  const sort = (searchParams.sort as "newest" | "price-asc" | "price-desc") || "newest";
  const [products, categories] = await Promise.all([
    getProducts({
      categorySlug: searchParams.category,
      power: searchParams.power,
      sort,
    }),
    getCategories(),
  ]);

  const qp = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { ...searchParams, ...over };
    Object.entries(merged).forEach(([k, v]) => v && p.set(k, v));
    const s = p.toString();
    return s ? `/shop?${s}` : "/shop";
  };

  return (
    <div className="bg-off-white text-surface-container-lowest min-h-screen">
      <SiteHeader light />

      <header className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop pt-12 pb-8">
        <span className="font-label-bold text-label-bold text-primary-container uppercase tracking-widest">
          Precision Engineering
        </span>
        <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg uppercase leading-none mt-2">
          {searchParams.category ? searchParams.category : "All"} Rigs
        </h1>
        <div className="w-32 h-2 bg-secondary mt-4" />
      </header>

      <main className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop pb-24 flex flex-col lg:flex-row gap-10">
        {/* Filters */}
        <aside className="lg:w-64 shrink-0 space-y-8">
          <div>
            <h3 className="font-label-bold text-label-bold uppercase tracking-widest mb-4 border-b border-black/10 pb-2">
              Category
            </h3>
            <div className="flex flex-col gap-2">
              <Link href={qp({ category: undefined })} className={`text-sm font-label-bold uppercase tracking-wide ${!searchParams.category ? "text-primary-container" : "text-slate-gray hover:text-black"}`}>All</Link>
              {categories.map((c) => (
                <Link key={c.id} href={qp({ category: c.slug })} className={`text-sm font-label-bold uppercase tracking-wide ${searchParams.category === c.slug ? "text-primary-container" : "text-slate-gray hover:text-black"}`}>
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-label-bold text-label-bold uppercase tracking-widest mb-4 border-b border-black/10 pb-2">
              Power Source
            </h3>
            <div className="flex flex-col gap-2">
              {POWER.map((p) => (
                <Link key={p.key} href={qp({ power: p.key || undefined })} className={`text-sm font-label-bold uppercase tracking-wide ${(searchParams.power || "") === p.key ? "text-primary-container" : "text-slate-gray hover:text-black"}`}>
                  {p.label}
                </Link>
              ))}
            </div>
          </div>
          <Link href="/product/volt-s1-pro" className="block cut-corner bg-surface-container-lowest text-white p-6">
            <h4 className="font-headline-md text-xl uppercase">Custom Build?</h4>
            <p className="text-on-surface-variant text-sm mt-1">Engineered to your drift dynamics.</p>
            <span className="inline-block mt-4 bg-secondary text-on-secondary-fixed px-4 py-2 text-xs font-label-bold uppercase tracking-widest rounded">Start Build</span>
          </Link>
        </aside>

        {/* Grid */}
        <section className="flex-1">
          <div className="flex items-center justify-between border-b border-black/10 pb-4 mb-8">
            <p className="font-label-bold text-slate-gray uppercase tracking-widest text-sm">
              {products.length} {products.length === 1 ? "rig" : "rigs"}
            </p>
            <div className="flex gap-4">
              {SORTS.map((s) => (
                <Link key={s.key} href={qp({ sort: s.key })} className={`text-xs font-label-bold uppercase tracking-widest ${sort === s.key ? "text-primary-container" : "text-slate-gray hover:text-black"}`}>
                  {s.label}
                </Link>
              ))}
            </div>
          </div>

          {products.length === 0 ? (
            <div className="text-center py-24 border border-dashed border-black/15 rounded-lg">
              <p className="font-headline-md text-2xl uppercase text-slate-gray">No rigs found</p>
              <p className="text-slate-gray mt-2">
                Connect Supabase and run the seed to populate the catalog.
              </p>
              <Link href="/shop" className="inline-block mt-4 text-primary-container font-label-bold uppercase tracking-widest">Reset filters</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-gutter">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
