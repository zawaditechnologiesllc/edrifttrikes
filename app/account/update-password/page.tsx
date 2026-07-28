export const dynamic = "force-dynamic";

import Link from "next/link";
import SiteHeader from "@/components/storefront/SiteHeader";
import SiteFooter from "@/components/storefront/SiteFooter";
import UpdatePasswordForm from "./UpdatePasswordForm";
import { supabaseConfigured } from "@/lib/supabase/admin";

export const metadata = { title: "Set a new password" };

export default function UpdatePasswordPage() {
  if (!supabaseConfigured()) {
    return (
      <div className="bg-background min-h-screen">
        <SiteHeader />
        <div className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-24 text-center">
          <h1 className="font-headline-xl text-headline-xl text-white uppercase">Connect Supabase</h1>
          <p className="text-on-surface-variant mt-3">Add your Supabase env vars to enable rider accounts.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-max-width w-full mx-auto px-margin-mobile md:px-margin-desktop py-16 flex flex-col items-center">
        <header className="mb-10 w-full max-w-md">
          <p className="font-label-bold text-label-bold text-secondary uppercase tracking-widest">Rider Security</p>
          <h1 className="font-headline-xl text-headline-xl text-white uppercase tracking-tight mt-1">
            Set a new access key
          </h1>
          <p className="text-on-surface-variant font-body-md mt-2">
            Choose a new password for your account. This link works once.
          </p>
        </header>
        <UpdatePasswordForm />
        <Link
          href="/login"
          className="mt-10 text-on-surface-variant hover:text-secondary font-label-bold text-xs uppercase tracking-widest"
        >
          Return to login
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
