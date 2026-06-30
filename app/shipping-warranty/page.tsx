import Link from "next/link";
import SiteHeader from "@/components/storefront/SiteHeader";
import SiteFooter from "@/components/storefront/SiteFooter";

export const metadata = { title: "Shipping & Warranty" };

const SHIPPING = [
  { title: "Free shipping over $1,500", body: "Orders of $1,500 or more ship free within the continental US. Below that, a flat $50 rate applies." },
  { title: "Dispatch times", body: "Trikes leave the garage in 5–7 business days. Parts and gear ship in 2–3. Custom builds: 2–4 weeks." },
  { title: "Tracking", body: "Every order gets a tracking link by email the moment it ships. Track status anytime from your dashboard." },
  { title: "International", body: "We ship to 30+ countries. Duties and taxes are calculated at checkout where supported." },
];

const WARRANTY = [
  { title: "2-year frame warranty", body: "Every E-Drift frame is covered against manufacturing defects for two years from delivery." },
  { title: "1-year drivetrain & electronics", body: "Motors, controllers and batteries are covered for one year under normal riding conditions." },
  { title: "30-day returns", body: "Unused rigs can be returned within 30 days for a full refund, minus return shipping. Custom builds are final sale." },
  { title: "Crash replacement", body: "Riders get discounted crash-replacement pricing on frames and sleeves. Contact support to claim." },
];

function Section({ title, items }: { title: string; items: { title: string; body: string }[] }) {
  return (
    <section>
      <h2 className="font-headline-xl text-headline-xl text-white uppercase mb-8">{title}</h2>
      <div className="space-y-4">
        {items.map((i) => (
          <div key={i.title} className="bg-surface-container border border-white/10 rounded-lg p-6 flex gap-4">
            <span className="w-2 h-2 bg-secondary mt-2 shrink-0" />
            <div>
              <h3 className="font-label-bold uppercase tracking-wide text-white">{i.title}</h3>
              <p className="text-on-surface-variant mt-1 leading-relaxed">{i.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ShippingWarranty() {
  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-max-width w-full mx-auto px-margin-mobile md:px-margin-desktop py-16">
        <header className="max-w-2xl mb-14">
          <span className="font-label-bold text-label-bold text-secondary uppercase tracking-widest">The fine print, simplified</span>
          <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-white uppercase leading-none mt-2">Shipping &amp; Warranty</h1>
        </header>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          <Section title="Shipping" items={SHIPPING} />
          <Section title="Warranty & Returns" items={WARRANTY} />
        </div>
        <div className="mt-16 text-center">
          <p className="text-on-surface-variant">Still have a question?</p>
          <Link href="/support" className="inline-block mt-3 bg-primary-container text-white px-8 py-4 rounded-lg font-label-bold uppercase tracking-widest hover:brightness-110 transition-all">
            Contact support
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
