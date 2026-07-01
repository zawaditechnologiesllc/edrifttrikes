export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import AuthForm from "./AuthForm";
import { getCurrentProfile } from "@/lib/db";
import { Icon } from "@/components/Icon";

export const metadata = { title: "Rider Authentication" };

export default async function LoginPage() {
  const profile = await getCurrentProfile();
  if (profile) redirect("/account");

  return (
    <div className="bg-surface-container-lowest text-on-surface min-h-screen">
      <main className="min-h-screen flex flex-col md:flex-row">
        {/* Left: action canvas */}
        <section className="relative w-full md:w-1/2 lg:w-3/5 h-[35vh] md:h-screen overflow-hidden">
          <div className="absolute inset-0 bg-black/40 z-10" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/action-mid-slide.jpg"
            alt="E-Drift action"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute bottom-10 left-8 md:left-margin-desktop z-20">
            <Link href="/" className="font-display-lg text-display-lg-mobile md:text-display-lg text-white tracking-tighter leading-none block">
              E-DRIFT<br />MOTORS
            </Link>
            <div className="flex items-center gap-4 mt-3">
              <span className="w-12 h-[2px] bg-secondary" />
              <p className="font-label-bold text-label-bold text-white uppercase tracking-widest">Precision Performance</p>
            </div>
          </div>
          <div className="absolute inset-0 z-15 pointer-events-none opacity-30 technical-grid" />
        </section>

        {/* Right: auth */}
        <section className="w-full md:w-1/2 lg:w-2/5 min-h-[65vh] md:min-h-screen bg-surface flex flex-col items-center justify-center p-margin-mobile md:p-margin-desktop relative technical-grid">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-container to-transparent opacity-50" />
          <AuthForm />
          <Link href="/" className="mt-10 text-on-surface-variant hover:text-secondary font-label-bold text-xs uppercase tracking-widest flex items-center gap-2">
            Continue as guest
            <Icon name="arrow_forward" className="w-4 h-4" />
          </Link>
        </section>
      </main>
    </div>
  );
}