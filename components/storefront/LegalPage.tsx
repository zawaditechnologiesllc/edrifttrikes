import SiteHeader from "@/components/storefront/SiteHeader";
import SiteFooter from "@/components/storefront/SiteFooter";
import { COMPANY } from "@/lib/company";

/**
 * Shared chrome for policy pages. Pass the document title, an "eyebrow" label,
 * and the body as children written in plain semantic HTML (h2/h3/p/ul) — the
 * `.legal-prose` styles in globals.css handle the formatting.
 */
export default function LegalPage({
  title,
  eyebrow = "Legal",
  children,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-max-width w-full mx-auto px-margin-mobile md:px-margin-desktop py-16">
        <header className="max-w-3xl mb-10">
          <span className="font-label-bold text-label-bold text-secondary uppercase tracking-widest">{eyebrow}</span>
          <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-white uppercase leading-none mt-2">{title}</h1>
          <p className="text-on-surface-variant font-label-bold text-xs uppercase tracking-widest mt-4">
            Last updated: {COMPANY.lastUpdated}
          </p>
        </header>
        <article className="legal-prose max-w-3xl">{children}</article>
      </main>
      <SiteFooter />
    </div>
  );
}
