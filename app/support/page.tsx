import Link from "next/link";
import SiteHeader from "@/components/storefront/SiteHeader";
import SiteFooter from "@/components/storefront/SiteFooter";
import ContactForm from "./ContactForm";
import { Icon } from "@/components/Icon";

export const metadata = { title: "Support Hub" };

const FAQS = [
  { q: "How long does shipping take?", a: "Trikes ship in 5–7 business days; parts and gear in 2–3. You'll get tracking by email the moment your order leaves the garage." },
  { q: "What's covered under warranty?", a: "Every trike includes a 2-year frame warranty and 1-year coverage on the drivetrain and electronics. See Shipping & Warranty for full details." },
  { q: "Can I return a trike?", a: "Unused rigs can be returned within 30 days for a full refund minus return shipping. Custom builds are final sale." },
  { q: "Do you ship internationally?", a: "Yes — we ship worldwide. Duties and taxes are calculated at checkout for supported regions." },
  { q: "How do I become an admin / dealer?", a: "Reach out via the form below with 'Dealer' in the subject and our team will set you up." },
];

const CHANNELS = [
  { icon: "mail", title: "Email", value: "support@edrifttrikes.com", href: "mailto:support@edrifttrikes.com" },
  { icon: "local_shipping", title: "Shipping & Warranty", value: "Policies & coverage", href: "/shipping-warranty" },
  { icon: "menu_book", title: "The Tech Lab", value: "Guides & how-tos", href: "/tech-lab" },
];

export default function SupportPage() {
  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-max-width w-full mx-auto px-margin-mobile md:px-margin-desktop py-16">
        <header className="max-w-2xl mb-14">
          <span className="font-label-bold text-label-bold text-secondary uppercase tracking-widest">We&apos;ve got you</span>
          <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-white uppercase leading-none mt-2">Support Hub</h1>
          <p className="text-on-surface-variant font-body-lg mt-4 border-l-4 border-secondary pl-6">
            Answers, policies and a direct line to the garage crew.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter mb-16">
          {CHANNELS.map((c) => (
            <Link key={c.title} href={c.href} className="bg-surface-container border border-white/10 rounded-lg p-6 hover:border-secondary/50 transition-all">
              <Icon name={c.icon} className="w-8 h-8 text-secondary" />
              <h3 className="font-headline-md text-xl text-white uppercase mt-3">{c.title}</h3>
              <p className="text-on-surface-variant mt-1">{c.value}</p>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          <section>
            <h2 className="font-headline-xl text-headline-xl text-white uppercase mb-8">FAQ</h2>
            <div className="space-y-3">
              {FAQS.map((f, i) => (
                <details key={i} className="accordion-item bg-surface-container border border-white/10 rounded-lg group">
                  <summary className="flex items-center justify-between p-5 cursor-pointer list-none">
                    <span className="font-label-bold uppercase tracking-wide text-white">{f.q}</span>
                    <Icon name="expand_more" className="w-6 h-6 text-secondary transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="px-5 pb-5 text-on-surface-variant leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-headline-xl text-headline-xl text-white uppercase mb-8">Contact the Garage</h2>
            <ContactForm />
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
