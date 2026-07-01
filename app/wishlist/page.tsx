export const dynamic = "force-dynamic";

import Link from "next/link";
import SiteHeader from "@/components/storefront/SiteHeader";
import SiteFooter from "@/components/storefront/SiteFooter";
import ProductCard from "@/components/storefront/ProductCard";
import { getCurrentProfile, getWishlist } from "@/lib/db";
import { supabaseConfigured } from "@/lib/supabase/admin";
import { Icon } from "@/components/Icon";

export const metadata = { title: "Your Parts Bin" };

export default async function WishlistPage() {
  const profile = supabaseConfigured() ? await getCurrentProfile() : null;
  const items = profile ? await getWishlist() : [];

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-max-width w-full mx-auto px-margin-mobile md:px-margin-desktop py-16">
        <header className="mb-12">
          <span className="font-label-bold text-label-bold text-secondary uppercase tracking-widest">Saved builds</span>
          <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-white uppercase leading-none mt-2">Your Parts Bin</h1>
        </header>

        {!profile ? (
          <div className="text-center py-24 border border-dashed border-white/10 rounded-lg">
            <Icon name="favorite" className="w-16 h-16 text-outline" />
            <p className="font-headline-md text-2xl uppercase text-white mt-4">Sign in to save builds</p>
            <p className="text-on-surface-variant mt-2">Your parts bin syncs across devices once you&apos;re signed in.</p>
            <Link href="/login" className="inline-block mt-6 bg-primary-container text-white px-8 py-4 rounded-lg font-label-bold uppercase tracking-widest hover:brightness-110 transition-all">Sign in</Link>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-white/10 rounded-lg">
            <Icon name="favorite" className="w-16 h-16 text-outline" />
            <p className="font-headline-md text-2xl uppercase text-white mt-4">Your parts bin is empty</p>
            <Link href="/shop" className="inline-block mt-6 bg-primary-container text-white px-8 py-4 rounded-lg font-label-bold uppercase tracking-widest hover:brightness-110 transition-all">Find rigs to save</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter">
            {items.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
