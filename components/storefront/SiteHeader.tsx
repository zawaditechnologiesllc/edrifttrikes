"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";

const NAV = [
  { label: "Trikes", href: "/shop?category=trikes" },
  { label: "Parts", href: "/shop?category=parts" },
  { label: "Gear", href: "/shop?category=gear" },
  { label: "The Garage", href: "/tech-lab" },
];

export default function SiteHeader({ light = false }: { light?: boolean }) {
  const { count, setOpen } = useCart();
  const text = light ? "text-surface-container-lowest" : "text-on-surface";
  const bg = light
    ? "bg-off-white border-black/10"
    : "bg-surface-container-lowest border-white/10";

  return (
    <nav className={`w-full top-0 sticky z-50 border-b ${bg}`}>
      <div className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop py-4 max-w-max-width mx-auto">
        <Link
          href="/"
          className="font-headline-md text-headline-md text-secondary tracking-tighter"
        >
          E-DRIFT
        </Link>

        <div className="hidden md:flex gap-10">
          {NAV.map((n) => (
            <Link
              key={n.label}
              href={n.href}
              className={`font-label-bold text-label-bold uppercase tracking-widest ${
                light ? "text-slate-gray hover:text-black" : "text-on-surface-variant hover:text-on-surface"
              } transition-colors`}
            >
              {n.label}
            </Link>
          ))}
        </div>

        <div className={`flex items-center gap-5 ${text}`}>
          <Link href="/search" aria-label="Search" className="hover:text-secondary transition-colors">
            <span className="material-symbols-outlined">search</span>
          </Link>
          <Link href="/wishlist" aria-label="Wishlist" className="hover:text-secondary transition-colors">
            <span className="material-symbols-outlined">favorite</span>
          </Link>
          <button
            onClick={() => setOpen(true)}
            aria-label="Cart"
            className="relative hover:text-secondary transition-colors"
          >
            <span className="material-symbols-outlined">shopping_cart</span>
            {count > 0 && (
              <span className="absolute -top-2 -right-2 bg-secondary text-on-secondary-fixed text-[10px] font-label-bold w-5 h-5 flex items-center justify-center rounded-full">
                {count}
              </span>
            )}
          </button>
          <Link href="/account" aria-label="Account" className="hover:text-secondary transition-colors">
            <span className="material-symbols-outlined">person</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
