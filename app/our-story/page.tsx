import Link from "next/link";
import SiteHeader from "@/components/storefront/SiteHeader";
import SiteFooter from "@/components/storefront/SiteFooter";
import { Icon } from "@/components/Icon";

export const metadata = { title: "About Us" };

const STATS = [
  { value: "Direct", label: "To your door" },
  { value: "0", label: "Middlemen" },
  { value: "Global", label: "We ship worldwide" },
  { value: "In-house", label: "Designed & manufactured" },
];

const VALUES = [
  { icon: "engineering", title: "We manufacture, not resell", body: "Every trike and go-cart is engineered and built in-house, stress-tested for lateral G-force, and proven before it earns the E-Drift mark." },
  { icon: "local_shipping", title: "Sold direct, worldwide", body: "We sell straight to riders in every country — no dealers, no middlemen, no markups between our garage and your driveway." },
  { icon: "electric_bolt", title: "Electric-first performance", body: "Instant torque, near-silent drifts, zero emissions. From electric drift trikes to go-carts, we build the future of street motorsport." },
];

export default function AboutUs() {
  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <SiteHeader />

      <header className="relative h-[55vh] overflow-hidden flex items-end">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/garage-workshop-night.jpg" alt="The E-Drift Trikes workshop" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        <div className="relative max-w-max-width w-full mx-auto px-margin-mobile md:px-margin-desktop pb-12">
          <span className="font-label-bold text-label-bold text-secondary uppercase tracking-widest">About Us</span>
          <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-white uppercase leading-none mt-2">The Makers of the Slide</h1>
        </div>
      </header>

      <main className="flex-1 max-w-max-width w-full mx-auto px-margin-mobile md:px-margin-desktop py-16">
        <div className="max-w-3xl space-y-6 text-on-surface-variant font-body-lg leading-relaxed">
          <p className="text-white text-2xl font-body-lg border-l-4 border-secondary pl-6">
            E-Drift Trikes &amp; Go Carts is a manufacturing company that sells its
            products globally, direct to consumers — with no middlemen in between.
          </p>
          <p>
            We design and build electric drift trikes, go-carts, performance parts
            and gear in-house, then ship them straight to riders around the world.
            Because we sell direct, there are no dealers or distributors marking up
            the price — you get factory-direct pricing and deal with the people who
            actually built your rig.
          </p>
          <p>
            We sell in all countries. Wherever you ride, we can get an E-Drift
            machine to you, backed by our own support crew and warranty. From the
            first hand-welded frame under fluorescent lights to a global direct-to-consumer
            brand, one thing hasn&apos;t changed: every rig is engineered, tested, and
            proven before it earns the E-Drift mark.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-gutter my-16">
          {STATS.map((s) => (
            <div key={s.label} className="bg-surface-container border border-white/10 rounded-lg p-6 text-center">
              <p className="font-headline-xl text-headline-xl text-secondary">{s.value}</p>
              <p className="text-on-surface-variant text-xs uppercase tracking-widest font-label-bold mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          {VALUES.map((v) => (
            <div key={v.title} className="bg-surface-container-low border border-white/10 rounded-lg p-8">
              <Icon name={v.icon} className="w-10 h-10 text-secondary" />
              <h3 className="font-headline-md text-xl text-white uppercase mt-4">{v.title}</h3>
              <p className="text-on-surface-variant mt-2 leading-relaxed">{v.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 bg-secondary text-on-secondary-fixed rounded-lg p-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="font-headline-xl text-headline-xl uppercase">Ready to ride?</h2>
            <p className="font-body-md mt-1">Factory-direct trikes and go-carts, shipped to your door.</p>
          </div>
          <Link href="/shop?category=trikes" className="bg-surface-container-lowest text-white px-10 py-4 font-label-bold uppercase tracking-widest rounded-lg hover:brightness-125 transition-all whitespace-nowrap">
            Shop Trikes
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
