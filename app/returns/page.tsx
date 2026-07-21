import Link from "next/link";
import LegalPage from "@/components/storefront/LegalPage";
import { COMPANY } from "@/lib/company";

export const metadata = { title: "Returns & Refunds" };

export default function ReturnsPage() {
  return (
    <LegalPage title="Returns & Refunds" eyebrow="Legal">
      <p>
        We want you riding, not waiting on hold. This policy explains how returns,
        refunds, and problem orders work at {COMPANY.name}. It forms part of our{" "}
        <Link href="/terms">Terms of Service</Link>.
      </p>

      <div className="callout">
        <strong>Have a problem? Contact us first.</strong> Email{" "}
        <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>{" "}
        before opening a bank or card dispute. Most issues — a delay, a wrong item,
        a shipping question, a defect — we can fix directly and far faster than a
        chargeback. Please give us at least {COMPANY.disputeWindowDays} days to
        resolve it.
      </div>

      <h2>1. Return window</h2>
      <p>
        You may request a return within {COMPANY.returnWindowDays} days of delivery.
        To be eligible, the item must be unused, in its original condition and
        packaging, with all accessories included. Returns started after the window,
        or for items outside these conditions, may be declined or subject to a
        reduced refund.
      </p>

      <h2>2. Items that can&rsquo;t be returned</h2>
      <ul>
        <li>Custom, made-to-order, or personalized builds (final sale).</li>
        <li>Items that have been used, ridden, assembled beyond inspection, damaged by the customer, or altered from their original condition.</li>
        <li>Consumable or safety-critical items where noted at purchase (e.g. items that have been worn or installed).</li>
        <li>Gift cards and shipping charges (except where the return is due to our error or a defect).</li>
      </ul>

      <h2>3. How to start a return</h2>
      <p>
        Email <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>{" "}
        with your order number and the reason for the return. We&rsquo;ll issue a
        return authorization and instructions. Please do not ship items back without
        authorization — unauthorized returns may not be refundable.
      </p>

      <h2>4. Return shipping &amp; restocking</h2>
      <ul>
        <li>Unless the return is due to our error or a defective product, you are responsible for return shipping costs, and original shipping is non-refundable.</li>
        <li>Because trikes and go-carts are large, heavy items, a reasonable restocking fee may apply to non-defective returns to cover inspection, repackaging, and handling. Any fee will be disclosed when we authorize the return.</li>
        <li>You are responsible for items until we receive them; we recommend a tracked, insured service.</li>
      </ul>

      <h2>5. Refunds</h2>
      <p>
        Once we receive and inspect your return, we&rsquo;ll notify you and, if
        approved, issue the refund to your original payment method within a
        reasonable period (typically 5&ndash;10 business days after inspection,
        subject to your bank). We may reduce a refund to reflect any loss in value
        from handling beyond what is needed to inspect the item.
      </p>

      <h2>6. Damaged, defective, or wrong items</h2>
      <p>
        Inspect your order on arrival. If an item arrives damaged, defective, or
        incorrect, contact us within 48 hours of delivery with photos and your order
        number. We&rsquo;ll make it right — repair, replacement parts, a replacement
        unit, or a refund — as appropriate and as covered by our{" "}
        <Link href="/shipping-warranty">warranty</Link>. Please keep all packaging
        until the issue is resolved.
      </p>

      <h2>7. Cancellations</h2>
      <p>
        You can request to cancel an order before it ships and we&rsquo;ll refund it
        in full. Once an order has shipped, the return process above applies.
      </p>

      <h2>8. Chargebacks</h2>
      <p>
        By purchasing, you agree to use this returns process and to contact{" "}
        <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a> in
        good faith before initiating a chargeback or payment dispute, as described
        in our <Link href="/terms">Terms of Service</Link>. Disputes filed without
        first contacting us may be contested with delivery and communication
        records. This does not remove any rights you have under applicable law or
        card-network rules — it simply gives us the chance to solve the problem
        directly, which is usually quicker for everyone.
      </p>

      <h2>9. International returns</h2>
      <p>
        We sell worldwide. For international orders, return shipping, duties, and
        taxes are handled per the instructions we provide with your return
        authorization. Your local consumer-protection laws may grant additional
        rights, which we honor where they apply.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions? Email{" "}
        <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a> or
        visit the <Link href="/support">Support Hub</Link>.
      </p>
    </LegalPage>
  );
}
