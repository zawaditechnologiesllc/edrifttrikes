export const dynamic = "force-dynamic";

import Link from "next/link";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { countryNames } from "@/lib/countries";
import { DEFAULT_SHIPPING_CENTS, DEFAULT_TAX_RATE_BPS } from "@/lib/totals";
import NewOrderForm, { type PickerProduct } from "../NewOrderForm";

export const metadata = { title: "New order" };

/**
 * Type in an order for money that arrived somewhere this shop could not see.
 *
 * The catalogue is loaded here, with the SERVICE ROLE, so the picker offers
 * every product — including drafts and anything in a switched-off category.
 * The storefront hides those from buyers; an admin recording a sale that
 * already happened needs to be able to name what was actually sold.
 */
export default async function NewOrderPage() {
  if (!adminConfigured()) {
    return (
      <p className="p-8 text-on-surface-variant">
        Connect Supabase (URL + service role key) to manage the store.
      </p>
    );
  }

  const admin = createAdminClient();
  const [{ data: products }, { data: settings }] = await Promise.all([
    admin
      .from("products")
      .select("id, name, slug, price_cents, hero_image, status")
      .order("name", { ascending: true }),
    admin.from("site_settings").select("*").eq("id", 1).maybeSingle(),
  ]);

  const row = (settings ?? {}) as {
    shipping_cents?: number;
    tax_rate_bps?: number;
    free_shipping?: boolean;
  };

  return (
    <div className="p-8 max-w-4xl">
      <Link
        href="/admin/orders"
        className="text-on-surface-variant hover:text-white text-sm font-label-bold uppercase tracking-widest"
      >
        ← Orders
      </Link>
      <h1 className="font-display-lg text-display-lg-mobile text-white uppercase mt-4 mb-2">
        New order
      </h1>
      <p className="text-on-surface-variant max-w-2xl mb-8">
        For a payment this storefront never saw — a Stripe payment link, an
        invoice, a bank transfer, a sale agreed over the phone. The order it
        creates is an ordinary one: it invoices, tracks, emails and appears in
        the list exactly like a sale that came through the checkout.
      </p>

      <NewOrderForm
        products={((products ?? []) as PickerProduct[]) ?? []}
        countries={countryNames()}
        defaultShippingCents={
          row.free_shipping ? 0 : (row.shipping_cents ?? DEFAULT_SHIPPING_CENTS)
        }
        taxRateBps={row.tax_rate_bps ?? DEFAULT_TAX_RATE_BPS}
      />
    </div>
  );
}
