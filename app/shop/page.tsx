import Link from "next/link";
import SiteHeader from "@/components/storefront/SiteHeader";
import SiteFooter from "@/components/storefront/SiteFooter";
import ProductCard from "@/components/storefront/ProductCard";
import { getProducts, getCategories } from "@/lib/db";
import {
  describeRange,
  isUnbounded,
  matchesRange,
  parsePriceRange,
  priceBands,
  rangeKey,
} from "@/lib/price-filter";

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
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{
    category?: string;
    power?: string;
    sort?: string;
    price?: string;
    min?: string;
    max?: string;
  }>;
}) {
  const searchParams = await searchParamsPromise;
  const sort = (searchParams.sort as "newest" | "price-asc" | "price-desc") || "newest";
  const [matching, categories] = await Promise.all([
    getProducts({
      categorySlug: searchParams.category,
      power: searchParams.power,
      sort,
    }),
    getCategories(),
  ]);

  // PRICE IS FILTERED HERE, not in the query, and that is deliberate: the bands
  // are built from the products that match the OTHER filters, so they stay put
  // while the buyer clicks between them. Filtering in the database would shrink
  // the set the bands are derived from, and the ladder would rearrange itself
  // under the cursor. The query already returns this whole set either way, so
  // it costs nothing extra.
  const range = parsePriceRange(searchParams);
  const bands = priceBands(matching.map((p) => p.price_cents));
  const activeKey = rangeKey(range);
  const products = isUnbounded(range)
    ? matching
    : matching.filter((p) => matchesRange(p.price_cents, range));

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
          <div>
            <h3 className="font-label-bold text-label-bold uppercase tracking-widest mb-4 border-b border-black/10 pb-2">
              Price
            </h3>
            <div className="flex flex-col gap-2">
              <Link
                href={qp({ price: undefined, min: undefined, max: undefined })}
                className={`text-sm font-label-bold uppercase tracking-wide ${isUnbounded(range) ? "text-primary-container" : "text-slate-gray hover:text-black"}`}
              >
                Any price
              </Link>
              {bands.map((b) => (
                <Link
                  key={b.key}
                  href={qp({ price: b.key, min: undefined, max: undefined })}
                  className={`text-sm font-label-bold uppercase tracking-wide flex items-baseline justify-between gap-2 ${activeKey === b.key ? "text-primary-container" : "text-slate-gray hover:text-black"}`}
                >
                  <span>{b.label}</span>
                  <span className="text-xs text-slate-gray/70 font-body-md normal-case">
                    {b.count}
                  </span>
                </Link>
              ))}
            </div>

            {/* A plain GET form: no JavaScript, and the result is a URL the
                buyer can bookmark or send to someone. The other filters ride
                along as hidden fields so setting a price doesn't quietly drop
                the category they already chose. */}
            <form action="/shop" method="get" className="mt-4 flex items-center gap-2">
              {searchParams.category && (
                <input type="hidden" name="category" value={searchParams.category} />
              )}
              {searchParams.power && (
                <input type="hidden" name="power" value={searchParams.power} />
              )}
              {searchParams.sort && (
                <input type="hidden" name="sort" value={searchParams.sort} />
              )}
              <input
                type="text"
                inputMode="decimal"
                name="min"
                // Echo back exactly what they typed, not a re-derived
                // number — but blank once a BAND is what's active, or clicking
                // a band would leave stale numbers sitting in the boxes.
                defaultValue={searchParams.price ? "" : (searchParams.min ?? "")}
                placeholder="Min $"
                aria-label="Minimum price in dollars"
                className="w-full min-w-0 border border-black/15 rounded px-2 py-1.5 text-sm bg-white text-black placeholder:text-slate-gray/60 focus:border-primary-container focus:ring-0"
              />
              <span className="text-slate-gray text-sm">–</span>
              <input
                type="text"
                inputMode="decimal"
                name="max"
                defaultValue={searchParams.price ? "" : (searchParams.max ?? "")}
                placeholder="Max $"
                aria-label="Maximum price in dollars"
                className="w-full min-w-0 border border-black/15 rounded px-2 py-1.5 text-sm bg-white text-black placeholder:text-slate-gray/60 focus:border-primary-container focus:ring-0"
              />
              <button
                type="submit"
                className="shrink-0 bg-surface-container-lowest text-white px-3 py-1.5 rounded text-xs font-label-bold uppercase tracking-widest hover:brightness-125 active:scale-95 transition-all"
              >
                Go
              </button>
            </form>
          </div>

          <Link href="/support" className="block cut-corner bg-surface-container-lowest text-white p-6">
            <h4 className="font-headline-md text-xl uppercase">Need a hand?</h4>
            <p className="text-on-surface-variant text-sm mt-1">Talk to the crew about the right rig for you.</p>
            <span className="inline-block mt-4 bg-secondary text-on-secondary-fixed px-4 py-2 text-xs font-label-bold uppercase tracking-widest rounded">Get in touch</span>
          </Link>
        </aside>

        {/* Grid */}
        <section className="flex-1">
          <div className="flex items-center justify-between border-b border-black/10 pb-4 mb-8">
            <p className="font-label-bold text-slate-gray uppercase tracking-widest text-sm">
              {products.length} {products.length === 1 ? "rig" : "rigs"}
              {describeRange(range) && (
                <span className="text-primary-container"> · {describeRange(range)}</span>
              )}
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
                {/* Two very different situations. Telling a shopper who just
                    picked a price band to "run the seed" would be nonsense. */}
                {matching.length > 0
                  ? `Nothing in the ${describeRange(range)} range with these filters.`
                  : "Connect Supabase and run the seed to populate the catalog."}
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
