import Link from "next/link";
import SiteHeader from "@/components/storefront/SiteHeader";
import SiteFooter from "@/components/storefront/SiteFooter";
import ProductCard from "@/components/storefront/ProductCard";
import { getFeaturedProducts, getCategories } from "@/lib/db";

const FEATURES = [
  { icon: "bolt", title: "High-Torque Motor", body: "72V custom-wound brushless motors delivering instant 150Nm torque for immediate break-loose capability." },
  { icon: "rebase", title: "Slide-Sleeves", body: "UHMWPE rear sleeves designed for buttery-smooth transitions and extreme durability." },
  { icon: "architecture", title: "Pro Frame", body: "Aircraft-grade 6061 aluminium frame with a 15° aggressive rake for superior counter-steer feedback." },
];

export default async function HomePage() {
  const [featured, categories] = await Promise.all([
    getFeaturedProducts(4),
    getCategories(),
  ]);

  return (
    <div className="bg-surface text-on-surface overflow-x-hidden">
      <SiteHeader />

      {/* Hero */}
      <header className="relative w-full h-[90vh] flex items-center overflow-hidden bg-black power-slant-divider">
        <div className="absolute inset-0 z-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/action-mid-slide.jpg" alt="E-Drift trike mid-slide" className="w-full h-full object-cover opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-black/40" />
        </div>
        <div className="relative z-10 w-full max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop">
          <div className="max-w-4xl space-y-8">
            <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-white leading-none tracking-tight uppercase">
              ENGINEERED FOR <span className="text-secondary">CHAOS</span>
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl border-l-4 border-secondary pl-6">
              Precision torque meets lateral freedom. Dominate every corner with the world&apos;s most advanced electric drift trikes.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Link href="/shop?category=trikes" className="bg-primary-container text-white px-8 py-4 font-label-bold text-label-bold uppercase tracking-widest rounded-lg hover:brightness-110 active:scale-95 transition-all">
                Build Your Slide
              </Link>
              <Link href="/shop" className="border border-white text-white px-8 py-4 font-label-bold text-label-bold uppercase tracking-widest rounded-lg hover:bg-white/10 active:scale-95 transition-all">
                Shop Trikes
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Drift spec */}
      <section className="py-24 md:py-32 bg-surface-container-lowest technical-grid">
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
                <span className="material-symbols-outlined !text-5xl text-secondary mb-8">{f.icon}</span>
                <h3 className="font-headline-md text-headline-md text-white uppercase mb-4">{f.title}</h3>
                <p className="text-on-surface-variant leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured products */}
      {featured.length > 0 && (
        <section className="py-24 bg-off-white text-surface-container-lowest">
          <div className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop">
            <div className="flex items-end justify-between mb-12">
              <div>
                <span className="font-label-bold text-label-bold text-primary-container uppercase tracking-widest">Latest Drop</span>
                <h2 className="font-headline-xl text-headline-xl uppercase mt-2">Featured Rigs</h2>
              </div>
              <Link href="/shop" className="font-label-bold text-label-bold uppercase tracking-widest text-primary-container hover:underline hidden md:block">View all →</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
              {featured.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </section>
      )}

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
              { id: "g", slug: "gear", name: "Gear", description: "Protection meets style.", image_url: "/assets/action-mid-slide.jpg" },
            ]).map((c) => (
              <Link key={c.id} href={`/shop?category=${c.slug}`} className="group relative aspect-[3/4] overflow-hidden rounded-lg hover-lift border-b-2 border-transparent hover:border-primary-container">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.image_url || "/assets/trike-voltage-blue.jpg"} alt={c.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
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
            <img src="/assets/garage-workshop-night.jpg" alt="The garage" className="w-full h-full object-cover" />
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
