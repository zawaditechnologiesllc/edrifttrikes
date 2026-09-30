import Link from "next/link";
import SiteHeader from "@/components/storefront/SiteHeader";
import SiteFooter from "@/components/storefront/SiteFooter";
import ProductCard from "@/components/storefront/ProductCard";
import { getProducts, getCategories } from "@/lib/db";
import { Icon } from "@/components/Icon";

// ISR: serve cached HTML, refresh in the background.
export const revalidate = 120;

const FEATURES = [
  { icon: "bolt", title: "High-Torque Motor", body: "72V custom-wound brushless motors delivering instant 150Nm torque for immediate break-loose capability." },
  { icon: "rebase", title: "Slide-Sleeves", body: "UHMWPE rear sleeves designed for buttery-smooth transitions and extreme durability." },
  { icon: "architecture", title: "Pro Frame", body: "Aircraft-grade 6061 aluminium frame with a 15° aggressive rake for superior counter-steer feedback." },
];

/**
 * How many products the homepage will show.
 *
 * The point of the grid is that a visitor sees the whole range without
 * navigating, so this is a safety valve rather than a curation limit: a
 * catalogue under this size is shown in full. It exists because an uncapped
 * homepage would grow without bound as products are added, and at some size a
 * single page stops being the fastest way to see the range.
 */
const HOMEPAGE_PRODUCT_LIMIT = 60;

export default async function HomePage() {
  const [catalogue, categories] = await Promise.all([
    // Every ACTIVE product, not just the flagged ones — the old call filtered
    // to `featured = true` and capped at four.
    getProducts({ sort: "newest", limit: HOMEPAGE_PRODUCT_LIMIT }),
    getCategories(),
  ]);

  /**
   * Featured products first, everything else after, newest-first within each
   * group. A stable partition, so the admin's "featured" checkbox still decides
   * what a visitor sees FIRST even though the grid now shows everything — the
   * flag keeps its meaning instead of quietly becoming decorative.
   */
  const products = [
    ...catalogue.filter((p) => p.featured),
    ...catalogue.filter((p) => !p.featured),
  ];

  return (
    <div className="bg-surface text-on-surface overflow-x-hidden">
      <SiteHeader />

      {/* Hero */}
      {/*
        SIZED SO THE PRODUCTS PEEK ABOVE THE FOLD. A hero that fills the window
        is a hero that hides the shop: the visitor has to take it on faith that
        there is anything below. At ~62% of the viewport the "The Full Range"
        heading and the tops of the cards are visible without scrolling, which
        is the whole reason they were moved up here.

        min-h keeps the headline from being crushed on a short laptop or a phone
        in landscape; max-h stops it stretching absurdly tall on a large
        monitor, where 62% of the screen is already a very big picture.
      */}
      <header className="relative w-full h-[62vh] min-h-[440px] max-h-[720px] flex items-center overflow-hidden bg-black power-slant-divider">
        <div className="absolute inset-0 z-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/action-mid-slide.jpg" alt="E-Drift trike mid-slide" className="w-full h-full object-cover opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-black/40" />
        </div>
        <div className="relative z-10 w-full max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop">
          <div className="max-w-4xl space-y-5 md:space-y-6">
            <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-white leading-none tracking-tight uppercase">
              ENGINEERED FOR <span className="text-secondary">CHAOS</span>
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl border-l-4 border-secondary pl-6">
              Precision torque meets lateral freedom. Dominate every corner with the world&apos;s most advanced electric drift trikes.
            </p>
            {/*
              Two doors, one per product line. The second used to jump to the
              spec section further down the page; it now goes to the dirt bikes,
              so the hero names both things the store actually sells instead of
              spending half its call-to-action on a scroll.

              The spec section is still on the page for anyone who wants
              convincing — it is just no longer what the hero points at.
            */}
            <div className="flex flex-wrap gap-4 pt-2">
              <Link href="/shop?category=trikes" className="bg-primary-container text-white px-8 py-4 font-label-bold text-label-bold uppercase tracking-widest rounded-lg hover:brightness-110 active:scale-95 transition-all">
                Shop Trikes
              </Link>
              <Link href="/shop?category=dirt-bikes" className="border-2 border-white/30 text-white px-8 py-4 font-label-bold text-label-bold uppercase tracking-widest rounded-lg hover:border-secondary hover:text-secondary active:scale-95 transition-all">
                Shop Dirt Bikes
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/*
        Featured products sit directly under the hero on purpose: the thing
        being sold is the first thing below the fold. The spec section that
        used to be here is still on the page, one scroll further down, for
        the visitor who wants convincing before they look at prices.

        Padding is tighter above than below for the same reason: every pixel of
        top padding is a pixel further the product cards sit below the fold,
        which is the one thing this section's position was chosen to avoid.
      */}
      {products.length > 0 && (
        <section className="pt-14 pb-24 bg-off-white text-surface-container-lowest">
          <div className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop">
            <div className="flex items-end justify-between mb-8">
              <div>
                <span className="font-label-bold text-label-bold text-primary-container uppercase tracking-widest">Shop everything</span>
                {/* Named for what it now is. The section used to show four
                    flagged products, so "Featured Rigs" was accurate; it
                    shows the whole catalogue, so it no longer would be. */}
                <h2 className="font-headline-xl text-headline-xl uppercase mt-2">The Full Range</h2>
              </div>
              {/* Everything is already on this page, so the link is no longer
                  "see the rest" — it is for narrowing down, which is what
                  /shop has that this grid does not. */}
              <Link href="/shop" className="font-label-bold text-label-bold uppercase tracking-widest text-primary-container hover:underline hidden md:block">Filter &amp; compare →</Link>
            </div>
            {/*
              TWO COLUMNS ON A PHONE, UP TO SIX ON A DESKTOP.

              The whole range visible without navigating is the goal, so the
              grid gets dense rather than tall: at two-up a phone shows four
              products in the first screenful instead of one, and six-up fills
              a 1440px window without the cards becoming postage stamps.

              The gap tightens with the columns — 24px between 200px cards
              spends a tenth of the row on empty space. ProductCard sizes its
              own contents to the column it lands in (container queries), which
              is what stops a six-up card from overflowing.
            */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-gutter">
              {products.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
            {/* Only when the cap actually bit. */}
            {products.length >= HOMEPAGE_PRODUCT_LIMIT && (
              <p className="mt-8 text-center">
                <Link href="/shop" className="font-label-bold text-label-bold uppercase tracking-widest text-primary-container hover:underline">
                  See the rest in the shop →
                </Link>
              </p>
            )}
          </div>
        </section>
      )}

      {/* Drift spec */}
      <section id="the-drift-spec" className="scroll-mt-20 py-24 md:py-32 bg-surface-container-lowest technical-grid">
        <div className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-gutter">
            <div>
              <h2 className="font-headline-xl text-headline-xl text-white uppercase mb-2">The Drift Spec</h2>
              <div className="w-32 h-2 bg-secondary" />
            </div>
            <p className="text-on-surface-variant font-body-md max-w-md">
              Every component is stress-tested for maximum lateral G-force and sustained drift control.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-surface-container p-10 border border-white/10 hover:border-secondary/50 transition-all">
                <Icon name={f.icon} className="w-12 h-12 text-secondary mb-8" />
                <h3 className="font-headline-md text-headline-md text-white uppercase mb-4">{f.title}</h3>
                <p className="text-on-surface-variant leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Category grid */}
      <section className="py-24 bg-white text-black power-slant-divider-reverse">
        <div className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop">
          <div className="mb-16 text-center">
            <span className="font-label-bold text-label-bold text-primary-container uppercase tracking-widest">The Ecosystem</span>
            <h2 className="font-headline-xl text-headline-xl text-black uppercase mt-2">Choose Your Weapon</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
            {(categories.length ? categories : [
              { id: "t", slug: "trikes", name: "Trikes", description: "The ultimate drifting machines.", image_url: "/assets/trike-voltage-blue.jpg" },
              { id: "p", slug: "parts", name: "Parts", description: "Tune for performance.", image_url: "/assets/parts-performance.jpg" },
              { id: "g", slug: "dirt-bikes", name: "Dirt Bikes", description: "Electric dirt bikes built for dirt, jumps and trails.", image_url: "/assets/action-360-slide.jpg" },
            ]).map((c) => (
              <Link key={c.id} href={`/shop?category=${c.slug}`} className="group relative aspect-[3/4] overflow-hidden rounded-lg hover-lift border-b-2 border-transparent hover:border-primary-container">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img loading="lazy" decoding="async" src={c.image_url || "/assets/trike-voltage-blue.jpg"} alt={c.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 w-full p-8">
                  <h4 className="font-headline-md text-headline-md text-white uppercase">{c.name}</h4>
                  <p className="text-white/70 font-body-md mb-4">{c.description}</p>
                  <span className="inline-block bg-secondary text-on-secondary-fixed px-4 py-2 font-label-bold text-label-bold uppercase tracking-widest rounded">View all</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Community CTA */}
      <section className="py-24 bg-surface text-on-surface">
        <div className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <span className="inline-block bg-secondary px-3 py-1 font-label-bold text-label-bold text-on-secondary-fixed uppercase">Live community feed</span>
            <h2 className="font-headline-xl text-headline-xl text-white uppercase leading-none">The Garage Protocol</h2>
            <p className="text-on-surface-variant font-body-lg">
              A global network of engineers and adrenaline junkies pushing the limits of electric drifting.
            </p>
            <Link href="/tech-lab" className="inline-block bg-secondary text-on-secondary-fixed px-10 py-5 font-label-bold text-label-bold uppercase tracking-widest rounded shadow-2xl hover:translate-x-2 transition-transform">
              Enter the Tech Lab
            </Link>
          </div>
          <div className="rounded-lg overflow-hidden border border-white/10 aspect-video">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src="/assets/garage-workshop-night.jpg" alt="The garage" className="w-full h-full object-cover" />
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
