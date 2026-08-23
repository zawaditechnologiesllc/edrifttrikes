import { getProductBySlug, getSiteSettings } from "@/lib/db";
import { buildProductSheet, productSheetFilename } from "@/lib/product-sheet";
import { publicSiteUrl } from "@/lib/env";
import { COMPANY } from "@/lib/company";
import { fetchLogoBytes } from "@/lib/logo";

/**
 * GET /product/<slug>/information — the product information sheet as a PDF.
 *
 * Generated on request rather than stored, so it can never go stale: whatever
 * the admin last saved (price, stock, colours, specs, logo) is what the buyer
 * downloads. Generation is pure CPU on data already cached by getProductBySlug,
 * and the only network call is fetching the logo.
 *
 * Cached for an hour at the edge; an admin save calls revalidateTag on the
 * catalog and settings tags, which drops this route's cached copy with them.
 */
export const revalidate = 3600;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) {
    return new Response("Product not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const settings = await getSiteSettings();
  const pdf = await buildProductSheet({
    product,
    settings,
    logo: await fetchLogoBytes(settings.logo_url),
    siteUrl: publicSiteUrl() ?? COMPANY.siteUrl,
  });

  return new Response(pdf, {
    headers: {
      "content-type": "application/pdf",
      // The filename is stripped to [A-Za-z0-9-] upstream, so it needs no
      // RFC 5987 encoding and can't break out of the quoted string.
      "content-disposition": `attachment; filename="${productSheetFilename(product)}"`,
      "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
