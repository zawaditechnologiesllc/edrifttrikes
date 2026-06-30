import Link from "next/link";
import SiteHeader from "@/components/storefront/SiteHeader";
import SiteFooter from "@/components/storefront/SiteFooter";

export const metadata = { title: "Our Story" };

const STATS = [
  { value: "42k", label: "Active pilots" },
  { value: "150Nm", label: "Peak torque" },
  { value: "2019", label: "Founded in the garage" },
  { value: "30+", label: "Countries shipped" },
];

const VALUES = [
  { icon: "engineering", title: "Engineered, not assembled", body: "Every rig is designed in-house, stress-tested for lateral G-force, and built to survive the street." },
  { icon: "groups", title: "Built with the community", body: "Our riders shape every release. The garage is a feedback loop between lead designers and pilots." },
  { icon: "electric_bolt", title: "Electric-first", body: "Instant torque, near-silent drifts, zero emissions. The future of street motorsport is electric." },
];

export default function OurStory() {
  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <SiteHeader />

      <header className="relative h-[55vh] overflow-hidden flex items-end">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/garage-workshop-night.jpg" alt="The garage" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        <div className="relative max-w-max-width w-full mx-auto px-margin-mobile md:px-margin-desktop pb-12">
          <span className="font-label-bold text-label-bold text-secondary uppercase tracking-widest">Our Story</span>
          <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-white uppercase leading-none mt-2">Born in the Garage</h1>
        </div>
      </header>

      <main className="flex-1 max-w-max-width w-full mx-auto px-margin-mobile md:px-margin-desktop py-16">
        <div className="max-w-3xl space-y-6 text-on-surface-variant font-body-lg leading-relaxed">
          <p className="text-white text-2xl font-body-lg border-l-4 border-secondary pl-6">
            E-Drift Motors started with a single idea: take the raw chaos of drift triking and electrify it.
          </p>
          <p>
            What began as a workbench obsession — a 72V hub motor bolted to a hand-welded frame under fluorescent lights — became a movement. We chased the perfect slide: instant torque, predictable break-loose, and a frame that talks back to you through the bars.
          </p>
          <p>
            Today we ship to riders in over 30 countries, but nothing has changed about how we build. Every rig is engineered, tested, and proven on the asphalt before it earns the E-Drift mark.
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
              <span className="material-symbols-outlined text-secondary !text-4xl">{v.icon}</span>
              <h3 className="font-headline-md text-xl text-white uppercase mt-4">{v.title}</h3>
              <p className="text-on-surface-variant mt-2 leading-relaxed">{v.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 bg-secondary text-on-secondary-fixed rounded-lg p-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="font-headline-xl text-headline-xl uppercase">Ready to ride?</h2>
            <p className="font-body-md mt-1">Build your slide and join the drift revolution.</p>
          </div>
          <Link href="/shop" className="bg-surface-container-lowest text-white px-10 py-4 font-label-bold uppercase tracking-widest rounded-lg hover:brightness-125 transition-all whitespace-nowrap">
            Shop the fleet
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
