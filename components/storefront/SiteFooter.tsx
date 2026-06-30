import Link from "next/link";
import NewsletterForm from "./NewsletterForm";

export default function SiteFooter() {
  return (
    <footer className="w-full bg-surface-container-lowest border-t border-secondary/20">
      <div className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-16 grid grid-cols-1 md:grid-cols-4 gap-12">
        <div className="space-y-5 md:col-span-2 max-w-sm">
          <h2 className="font-headline-md text-headline-md text-secondary tracking-tighter">
            E-DRIFT MOTORS
          </h2>
          <p className="text-on-surface-variant font-body-md">
            The frontier of electric street motorsport. Engineered in the garage,
            proven on the asphalt.
          </p>
          <NewsletterForm />
        </div>
        <div className="space-y-4">
          <h4 className="font-label-bold text-label-bold text-white uppercase tracking-widest">
            Shop
          </h4>
          <nav className="flex flex-col gap-2">
            <Link href="/shop?category=trikes" className="text-on-surface-variant hover:text-primary transition-colors">Trikes</Link>
            <Link href="/shop?category=parts" className="text-on-surface-variant hover:text-primary transition-colors">Parts</Link>
            <Link href="/shop?category=gear" className="text-on-surface-variant hover:text-primary transition-colors">Gear</Link>
            <Link href="/wishlist" className="text-on-surface-variant hover:text-primary transition-colors">Parts Bin</Link>
          </nav>
        </div>
        <div className="space-y-4">
          <h4 className="font-label-bold text-label-bold text-white uppercase tracking-widest">
            Resources
          </h4>
          <nav className="flex flex-col gap-2">
            <Link href="/tech-lab" className="text-on-surface-variant hover:text-primary transition-colors">The Tech Lab</Link>
            <Link href="/support" className="text-on-surface-variant hover:text-primary transition-colors">Support</Link>
            <Link href="/shipping-warranty" className="text-on-surface-variant hover:text-primary transition-colors">Shipping &amp; Warranty</Link>
            <Link href="/our-story" className="text-on-surface-variant hover:text-primary transition-colors">Our Story</Link>
          </nav>
        </div>
      </div>
      <div className="border-t border-white/5">
        <div className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-6 flex flex-col md:flex-row justify-between items-center gap-3 text-on-surface-variant font-label-bold text-[10px] tracking-widest uppercase">
          <span>© {new Date().getFullYear()} E-Drift Motors. Engineered for adrenaline.</span>
          <span>Made in the garage</span>
        </div>
      </div>
    </footer>
  );
}
