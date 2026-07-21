import Link from "next/link";
import LegalPage from "@/components/storefront/LegalPage";
import { COMPANY } from "@/lib/company";

export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" eyebrow="Legal">
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and
        purchase of products from {COMPANY.name} (&ldquo;{COMPANY.name},&rdquo;
        &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;). By browsing this
        website, creating an account, or placing an order, you agree to these
        Terms. If you do not agree, do not use the site or purchase our products.
      </p>

      <h2>1. Who we are</h2>
      <p>
        {COMPANY.name} is a manufacturer that designs, builds, and sells electric
        drift trikes, go-carts, performance parts, and gear directly to consumers
        worldwide, with no intermediaries. Orders are fulfilled and shipped by us.
      </p>

      <h2>2. Eligibility &amp; accounts</h2>
      <p>
        You must be the age of legal majority in your jurisdiction to purchase.
        Our products are powered ride-on machines intended for adults and for
        supervised use only; they are not toys. You are responsible for keeping
        your account credentials secure and for all activity under your account.
      </p>

      <h2>3. Products, pricing &amp; orders</h2>
      <ul>
        <li>We strive for accuracy, but product descriptions, images, specifications, availability, and prices may contain errors and can change without notice.</li>
        <li>All prices are shown in the currency indicated at checkout and exclude shipping, duties, and taxes unless expressly stated.</li>
        <li>Your order is an offer to buy. We may accept or decline it, and we may cancel and refund any order — including for pricing or stock errors, suspected fraud, or shipping restrictions — before or after it is placed.</li>
        <li>Title and risk of loss pass to you upon delivery to the carrier, except where local law requires otherwise.</li>
      </ul>

      <h2>4. Payment</h2>
      <p>
        Payments are processed by third-party payment providers (including Stripe).
        By submitting payment information you represent that you are authorized to
        use the payment method. We do not store full card numbers on our servers.
      </p>

      <h2>5. Shipping, returns &amp; warranty</h2>
      <p>
        Shipping timelines, our limited warranty, and the returns process are set
        out in our{" "}
        <Link href="/shipping-warranty">Shipping &amp; Warranty</Link> and{" "}
        <Link href="/returns">Returns &amp; Refunds</Link> policies, which are
        incorporated into these Terms. Please read them before ordering.
      </p>

      <h2>6. Safety, assumption of risk &amp; proper use</h2>
      <div className="callout">
        <strong>Read this carefully.</strong> Drift trikes, go-carts, and related
        performance equipment are inherently dangerous and can cause serious
        injury or death. You use them entirely at your own risk.
      </div>
      <ul>
        <li>Our products are high-performance motorsport equipment for experienced users in appropriate, controlled, private environments. Many jurisdictions prohibit their use on public roads, sidewalks, or paths — you are solely responsible for knowing and obeying all applicable laws.</li>
        <li>Always wear appropriate protective equipment (helmet, gloves, eye and body protection). Never ride under the influence of alcohol or drugs, and never carry more riders than intended.</li>
        <li>Minors must be supervised by a responsible adult at all times. It is your responsibility to ensure any rider meets the age, size, and skill requirements and is capable of safe operation.</li>
        <li>You are responsible for inspecting, maintaining, and correctly assembling the product per our instructions before each use. Do not modify the product in ways that affect safety.</li>
        <li>To the maximum extent permitted by law, you assume all risks arising from the assembly, use, misuse, or storage of our products, and you release {COMPANY.name} from liability for any resulting injury, death, or property damage.</li>
      </ul>

      <h2>7. Prohibited conduct</h2>
      <p>You agree not to use the site or products to: violate any law; infringe our or others&rsquo; rights; resell products as an unauthorized dealer; interfere with the site&rsquo;s operation or security; or submit false, fraudulent, or abusive orders, payments, or disputes.</p>

      <h2>8. Contact us first — chargebacks &amp; dispute resolution</h2>
      <div className="callout">
        If anything is wrong with your order, <strong>contact us first</strong> at{" "}
        <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a> and
        give us at least {COMPANY.disputeWindowDays} days to make it right —
        <strong> before</strong> filing a chargeback or payment dispute with your
        bank or card issuer.
      </div>
      <ul>
        <li>By purchasing, you agree to raise any issue with our support team and to work through our returns and warranty process in good faith before initiating a chargeback or payment dispute.</li>
        <li>Filing a chargeback or dispute without first contacting us and allowing a reasonable opportunity to resolve the matter is a breach of these Terms. Where a dispute is later found to be unwarranted (sometimes called &ldquo;friendly fraud&rdquo;), you agree that we may treat it as such.</li>
        <li>We keep detailed order, delivery, and communication records and reserve the right to submit them to contest illegitimate chargebacks, to recover related fees and reasonable costs, to cancel outstanding orders, and to suspend accounts engaged in dispute abuse.</li>
        <li>This section asks you to contact us first; it does not, and cannot, remove any rights you may have under applicable law or your card network&rsquo;s rules. It exists so we can resolve genuine problems quickly and directly, which is almost always faster than a bank dispute.</li>
      </ul>

      <h2>9. Limited warranty &amp; disclaimers</h2>
      <p>
        Except for the express limited warranty in our{" "}
        <Link href="/shipping-warranty">Shipping &amp; Warranty</Link> policy, and
        to the maximum extent permitted by law, our products and this website are
        provided <strong>&ldquo;as is&rdquo;</strong> and{" "}
        <strong>&ldquo;as available,&rdquo;</strong> without warranties of any kind,
        express or implied, including merchantability, fitness for a particular
        purpose, and non-infringement. Some jurisdictions do not allow the
        exclusion of certain implied warranties, so parts of this section may not
        apply to you, and nothing here limits rights that cannot be limited by law.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, {COMPANY.name} and its owners,
        employees, and suppliers will not be liable for any indirect, incidental,
        special, consequential, or punitive damages, or for lost profits, arising
        out of or related to the products, the site, or these Terms. Our total
        aggregate liability for any claim will not exceed the amount you paid for
        the product giving rise to the claim. Nothing in these Terms excludes
        liability that cannot lawfully be excluded, including for death or personal
        injury caused by our proven negligence where applicable law so requires.
      </p>

      <h2>11. Indemnification</h2>
      <p>
        You agree to indemnify and hold harmless {COMPANY.name} from any claims,
        damages, losses, and costs (including reasonable legal fees) arising from
        your misuse of the products, your violation of these Terms, or your
        violation of any law or third-party right.
      </p>

      <h2>12. Governing law &amp; disputes</h2>
      <p>
        These Terms are governed by the laws of {COMPANY.governingLaw}, without
        regard to conflict-of-law rules. Except where prohibited by law, any
        dispute that cannot be resolved with our support team will be resolved by
        binding individual arbitration or in the courts of that jurisdiction, and
        you waive any right to participate in a class action. Mandatory consumer
        laws in your country of residence may give you additional rights that this
        section does not override.
      </p>

      <h2>13. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. The version in effect when you
        place an order applies to that order. Continued use of the site after
        changes take effect constitutes acceptance of the updated Terms.
      </p>

      <h2>14. Contact</h2>
      <p>
        Questions about these Terms? Email{" "}
        <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a> or
        visit our <Link href="/support">Support Hub</Link>.
      </p>
    </LegalPage>
  );
}
