"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import AnnouncementTicker from "@/components/storefront/AnnouncementTicker";
import {
  SearchIcon,
  HeartIcon,
  CartIcon,
  UserIcon,
  MenuIcon,
  CloseIcon,
  ChevronRightIcon,
} from "@/components/Icon";

const SHOP = [
  { label: "All Rigs", href: "/shop" },
  { label: "Trikes", href: "/shop?category=trikes" },
  { label: "Parts", href: "/shop?category=parts" },
  { label: "Gear", href: "/shop?category=gear" },
  { label: "Electric", href: "/electric-trikes" },
];
const EXPLORE = [
  { label: "The Tech Lab", href: "/tech-lab" },
  { label: "About Us", href: "/our-story" },
  { label: "Support", href: "/support" },
  { label: "Shipping & Warranty", href: "/shipping-warranty" },
];
const NAV = [
  { label: "Trikes", href: "/shop?category=trikes" },
  { label: "Parts", href: "/shop?category=parts" },
  { label: "Gear", href: "/shop?category=gear" },
  { label: "About Us", href: "/our-story" },
];

export default function SiteHeader({ light = false }: { light?: boolean }) {
  const { count, setOpen } = useCart();
  const [menu, setMenu] = useState(false);

  const controlColor = light ? "text-surface-container-lowest" : "text-on-surface";
  const bg = light ? "bg-off-white border-black/10" : "bg-surface-container-lowest border-white/10";
  const iconBtn = `h-11 w-11 flex items-center justify-center rounded-full hover:bg-black/5 hover:text-secondary transition-colors ${controlColor}`;

  const CartButton = (
    <button onClick={() => setOpen(true)} aria-label="Open cart" className={`relative ${iconBtn}`}>
      <CartIcon />
      {count > 0 && (
        <span className="absolute top-0.5 right-0.5 bg-secondary text-on-secondary-fixed text-[10px] font-label-bold min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full">
          {count}
        </span>
      )}
    </button>
  );

  return (
    <>
      {/* Above the nav rather than inside it: the stripe scrolls away with the
          page while the nav stays stuck, which is what an announcement should
          do — noticed once, then out of the way. Lives here rather than in the
          root layout so it follows the storefront header and never appears
          over the admin panel. */}
      <AnnouncementTicker />
      <nav className={`w-full top-0 sticky z-50 border-b ${bg}`}>
        <div className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop py-3 md:py-4 max-w-max-width mx-auto gap-4">
          <Link href="/" aria-label="E-Drift Trikes home" className="flex items-center gap-2.5 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/edrift-logo.svg" alt="E-Drift Trikes" className="h-9 w-9 md:h-10 md:w-10" />
            <span className="font-headline-md text-xl md:text-2xl tracking-tighter leading-none">
              <span className="text-secondary">E-DRIFT</span>
              <span className="hidden sm:inline text-white"> TRIKES</span>
            </span>
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

          {/* Desktop icons */}
          <div className="hidden md:flex items-center gap-1">
            <Link href="/search" aria-label="Search" className={iconBtn}><SearchIcon /></Link>
            <Link href="/wishlist" aria-label="Wishlist" className={iconBtn}><HeartIcon /></Link>
            {CartButton}
            <Link href="/account" aria-label="Account" className={iconBtn}><UserIcon /></Link>
          </div>

          {/* Mobile: cart + hamburger only */}
          <div className="flex md:hidden items-center gap-1">
            {CartButton}
            <button onClick={() => setMenu(true)} aria-label="Open menu" className={iconBtn}>
              <MenuIcon className="w-7 h-7" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      <div className={`fixed inset-0 z-[85] md:hidden ${menu ? "" : "pointer-events-none"}`} aria-hidden={!menu}>
        <div onClick={() => setMenu(false)} className={`absolute inset-0 bg-black/60 transition-opacity ${menu ? "opacity-100" : "opacity-0"}`} />
        <aside
          className={`absolute top-0 right-0 h-full w-[86%] max-w-sm bg-surface-container-lowest border-l border-white/10 flex flex-col transition-transform duration-300 ${
            menu ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between px-5 h-16 border-b border-white/10 shrink-0">
            <span className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/edrift-logo.svg" alt="E-Drift Trikes" className="h-8 w-8" />
              <span className="font-headline-md text-2xl text-secondary tracking-tighter">E-DRIFT</span>
            </span>
            <button onClick={() => setMenu(false)} aria-label="Close menu" className="h-11 w-11 flex items-center justify-center rounded-full text-on-surface hover:text-secondary">
              <CloseIcon className="w-7 h-7" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-6">
            <Link href="/search" onClick={() => setMenu(false)} className="flex items-center gap-3 bg-surface-container border border-white/10 rounded-lg px-4 h-12 text-on-surface-variant mb-8">
              <SearchIcon className="w-5 h-5" />
              <span className="font-label-bold uppercase tracking-widest text-sm">Search rigs, parts, gear</span>
            </Link>

            <p className="font-label-bold text-[11px] text-secondary uppercase tracking-widest mb-2">Shop</p>
            <nav className="flex flex-col mb-8">
              {SHOP.map((n) => (
                <Link key={n.label} href={n.href} onClick={() => setMenu(false)} className="flex items-center justify-between h-12 text-white font-headline-md text-xl uppercase border-b border-white/5">
                  {n.label}
                  <ChevronRightIcon className="w-5 h-5 text-on-surface-variant" />
                </Link>
              ))}
            </nav>

            <p className="font-label-bold text-[11px] text-secondary uppercase tracking-widest mb-2">Explore</p>
            <nav className="flex flex-col mb-8">
              {EXPLORE.map((n) => (
                <Link key={n.label} href={n.href} onClick={() => setMenu(false)} className="flex items-center h-11 text-on-surface-variant hover:text-white font-label-bold uppercase tracking-widest text-sm border-b border-white/5">
                  {n.label}
                </Link>
              ))}
            </nav>

            <p className="font-label-bold text-[11px] text-secondary uppercase tracking-widest mb-2">Account</p>
            <nav className="grid grid-cols-3 gap-3">
              <Link href="/account" onClick={() => setMenu(false)} className="flex flex-col items-center justify-center gap-1.5 bg-surface-container border border-white/10 rounded-lg py-4 text-on-surface-variant hover:text-secondary">
                <UserIcon className="w-6 h-6" /><span className="text-[10px] font-label-bold uppercase tracking-widest">Account</span>
              </Link>
              <Link href="/wishlist" onClick={() => setMenu(false)} className="flex flex-col items-center justify-center gap-1.5 bg-surface-container border border-white/10 rounded-lg py-4 text-on-surface-variant hover:text-secondary">
                <HeartIcon className="w-6 h-6" /><span className="text-[10px] font-label-bold uppercase tracking-widest">Parts Bin</span>
              </Link>
              <button onClick={() => { setMenu(false); setOpen(true); }} className="flex flex-col items-center justify-center gap-1.5 bg-surface-container border border-white/10 rounded-lg py-4 text-on-surface-variant hover:text-secondary">
                <CartIcon className="w-6 h-6" /><span className="text-[10px] font-label-bold uppercase tracking-widest">Cart</span>
              </button>
            </nav>
          </div>

          <div className="p-5 border-t border-white/10 shrink-0 space-y-3">
            <Link href="/shop" onClick={() => setMenu(false)} className="block text-center bg-primary-container text-white py-4 rounded-lg font-label-bold uppercase tracking-widest">
              Shop the fleet
            </Link>
            <Link href="/login" onClick={() => setMenu(false)} className="block text-center text-on-surface-variant py-1 font-label-bold uppercase tracking-widest text-xs hover:text-white">
              Sign in / Register
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
