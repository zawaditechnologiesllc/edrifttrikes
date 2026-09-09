import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin-auth";
import { getSiteSettings } from "@/lib/db";
import { fetchLogoBytes } from "@/lib/logo";
import { publicSiteUrl } from "@/lib/env";
import { COMPANY } from "@/lib/company";
import { loadOrder } from "@/lib/orders";
import { buildInvoice, invoiceFilename, isPayable, type InvoiceVariant } from "@/lib/invoice";

/**
 * GET /admin/orders/<id>/invoice?variant=proforma|paid — the order invoice as a
 * PDF.
 *
 * Generated on request rather than stored, so it always reflects the order as
 * it stands: a tracking number added this morning is on the invoice downloaded
 * this afternoon. Nothing about the document is random, so downloading it twice
 * produces the same document twice.
 *
 * ⚠️ GATED HERE, NOT BY THE LAYOUT. app/admin/layout.tsx protects the admin
 * PAGES; route handlers do not run layouts, so without this check the invoice —
 * customer name, email, full address, payment reference — would be served to
 * anyone who guessed the URL.
 */
export const dynamic = "force-dynamic";

function parseVariant(url: string): InvoiceVariant {
  const value = new URL(url).searchParams.get("variant");
  return value === "paid" ? "paid" : "proforma";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!adminConfigured()) {
    return new Response("Admin is not configured.", { status: 503 });
  }
  if (!(await isAdmin())) {
    return new Response("Not authorised.", { status: 403 });
  }

  const { id } = await params;
  const admin = createAdminClient();
  const order = await loadOrder(admin, { id });
  if (!order) return new Response("Order not found.", { status: 404 });

  const variant = parseVariant(request.url);

  // Refused rather than rendered. A document headed "PAID IN FULL" for an order
  // nobody has paid for is a fabricated record — buildInvoice would throw on it
  // anyway, but a 409 with a sentence the admin can act on beats a stack trace.
  if (variant === "paid" && !isPayable(order)) {
    return new Response(
      `Order ${order.order_number} has not been paid, so no paid invoice can be issued. ` +
        "Mark it paid first, or download the proforma instead.",
      { status: 409, headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  }

  const settings = await getSiteSettings();
  const pdf = await buildInvoice({
    order,
    settings,
    variant,
    logo: await fetchLogoBytes(settings.logo_url),
    siteUrl: publicSiteUrl() ?? COMPANY.siteUrl,
  });

  return new Response(pdf, {
    headers: {
      "content-type": "application/pdf",
      // invoiceFilename() strips to [A-Za-z0-9-], so it needs no RFC 5987
      // encoding and cannot break out of the quoted string.
      "content-disposition": `attachment; filename="${invoiceFilename(order.order_number, variant)}"`,
      // Never cached. An invoice carries a customer's name, address and payment
      // reference, and it changes as the order does — a shared cache holding
      // either is wrong twice over.
      "cache-control": "private, no-store",
    },
  });
}
