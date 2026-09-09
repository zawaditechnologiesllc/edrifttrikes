import Link from "next/link";
import SiteHeader from "@/components/storefront/SiteHeader";
import SiteFooter from "@/components/storefront/SiteFooter";
import { getReceiptByNumber, getSiteSettings } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { STAGE_COPY, formatDeliveryDate, type FulfillmentStage } from "@/lib/fulfillment";
import { sellerFor } from "@/lib/invoice";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verify a document" };

/**
 * Where the QR code on an invoice lands.
 *
 * ═══ WHAT THIS PAGE IS, AND IS NOT ══════════════════════════════════════════
 *
 * It states CHECKABLE FACTS about one order — the number, the date it was
 * placed, the total, whether it was paid and when, and where it has got to. A
 * reader holding a printed invoice can compare those against the paper.
 *
 * It does NOT certify anything. There is no badge, no score, no "verified
 * merchant" mark, because a shop awarding itself one is worth precisely nothing
 * and reads as though the shop knows it. The only thing of value here is that
 * the numbers on the page and the numbers on the document agree — which is a
 * fact the reader establishes, not a claim we make.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * PRIVACY. getReceiptByNumber hands back a redacted order to anyone who has not
 * proved it is theirs: the email is masked and the delivery address is stripped
 * entirely. So an order number is enough to confirm a document, and not enough
 * to learn who bought what or where it went. The signed-in owner sees their own
 * order in full.
 */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-white/5 py-3 last:border-0">
      <span className="font-label-bold uppercase tracking-widest text-[10px] text-on-surface-variant">
        {label}
      </span>
      <span className="text-white text-sm text-right">{children}</span>
    </div>
  );
}

export default async function VerifyDocument({
  params,
}: {
  params: Promise<{ order: string }>;
}) {
  const { order: raw } = await params;
  const orderNumber = decodeURIComponent(raw ?? "").trim().slice(0, 64);
  const [receipt, settings] = await Promise.all([
    orderNumber ? getReceiptByNumber(orderNumber) : Promise.resolve(null),
    getSiteSettings(),
  ]);
  const order = receipt?.order ?? null;

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-2xl w-full mx-auto px-margin-mobile md:px-margin-desktop py-14">
        <p className="font-label-bold uppercase tracking-widest text-xs text-secondary">
          Document check
        </p>
        <h1 className="font-display-lg text-display-lg-mobile text-white uppercase mt-2">
          {order ? "This order exists" : "No such order"}
        </h1>

        {!order && (
          <>
            <p className="text-on-surface-variant font-body-lg mt-4">
              We have no order numbered{" "}
              <strong className="text-white break-all">{orderNumber || "—"}</strong>. Check
              the number against the document, or{" "}
              <Link href="/support" className="text-secondary hover:underline">
                contact us
              </Link>{" "}
              and quote it.
            </p>
            <p className="text-on-surface-variant text-sm mt-6">
              If you were given a document quoting this number, treat it as
              unverified — it did not come from us.
            </p>
          </>
        )}

        {order && (
          <>
            <p className="text-on-surface-variant font-body-lg mt-4">
              Compare the details below against the invoice you are holding. They
              are read live from our records.
            </p>

            <div className="mt-8 bg-surface-container border border-white/10 rounded-lg px-6 py-2">
              <Row label="Order number">
                <span className="font-headline-md text-secondary">
                  {order.order_number}
                </span>
              </Row>
              <Row label="Order placed">
                {formatDeliveryDate(order.created_at)}
              </Row>
              <Row label="Total">
                {formatMoney(order.total_cents, order.currency)}{" "}
                <span className="text-on-surface-variant">
                  {(order.currency || "usd").toUpperCase()}
                </span>
              </Row>
              <Row label="Payment">
                {order.paid_at ? (
                  <span className="text-secondary">
                    Received {formatDeliveryDate(order.paid_at)}
                  </span>
                ) : (
                  <span className="text-on-surface-variant">Not yet received</span>
                )}
              </Row>
              <Row label="Status">
                {
                  STAGE_COPY[
                    (order.fulfillment_stage ?? "awaiting_payment") as FulfillmentStage
                  ].label
                }
              </Row>
              {order.tracking_number && (
                <Row label="Tracking">
                  <span className="break-all">{order.tracking_number}</span>
                  {order.courier && (
                    <span className="text-on-surface-variant"> · {order.courier}</span>
                  )}
                </Row>
              )}
              <Row label="Sold by">{sellerFor(order, settings).display}</Row>
            </div>

            {receipt?.redacted && (
              <p className="text-on-surface-variant text-xs mt-4 flex gap-2">
                <Icon name="lock" className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  The customer&apos;s name, address and full email are withheld. An
                  order number confirms a document; it does not open somebody
                  else&apos;s order.{" "}
                  <Link href="/login" className="text-secondary hover:underline">
                    Sign in
                  </Link>{" "}
                  to see this order in full if it is yours.
                </span>
              </p>
            )}

            <p className="text-on-surface-variant text-xs mt-6">
              Anything here disagreeing with your document?{" "}
              <Link href="/support" className="text-secondary hover:underline">
                Tell us
              </Link>
              .
            </p>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
