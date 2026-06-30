import Link from "next/link";

export default function NotFound() {
  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col items-center justify-center text-center px-6 technical-grid">
      <p className="font-display-lg text-display-lg-mobile md:text-display-lg text-secondary leading-none">404</p>
      <h1 className="font-headline-xl text-headline-xl text-white uppercase mt-2">Off Track</h1>
      <p className="text-on-surface-variant font-body-lg max-w-md mt-4">
        This corner doesn&apos;t exist. Let&apos;s get you back on the asphalt.
      </p>
      <div className="flex flex-wrap gap-4 justify-center mt-8">
        <Link href="/" className="bg-primary-container text-white px-8 py-4 rounded-lg font-label-bold uppercase tracking-widest hover:brightness-110 transition-all">
          Home
        </Link>
        <Link href="/shop" className="border border-white/20 text-white px-8 py-4 rounded-lg font-label-bold uppercase tracking-widest hover:bg-white/5 transition-all">
          Shop rigs
        </Link>
      </div>
      <div className="flex gap-6 mt-10 text-on-surface-variant font-label-bold text-xs uppercase tracking-widest">
        <Link href="/tech-lab" className="hover:text-secondary">Tech Lab</Link>
        <Link href="/support" className="hover:text-secondary">Support</Link>
        <Link href="/our-story" className="hover:text-secondary">Our Story</Link>
      </div>
    </div>
  );
}
