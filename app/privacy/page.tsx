import Link from "next/link";
import LegalPage from "@/components/storefront/LegalPage";
import { COMPANY } from "@/lib/company";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" eyebrow="Legal">
      <p>
        This Privacy Policy explains how {COMPANY.name} (&ldquo;we&rdquo;) collects,
        uses, and protects your information when you use our website and buy our
        products. We sell worldwide and aim to respect the privacy rights that
        apply where you live.
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li><strong>Order &amp; account data</strong> — name, email, shipping and billing address, order history, and account credentials you create.</li>
        <li><strong>Payment data</strong> — processed by our payment provider (Stripe). We receive confirmation and limited details (such as the last digits and status); we do not store full card numbers.</li>
        <li><strong>Support &amp; contact data</strong> — messages you send us through the contact form, email, or newsletter sign-up.</li>
        <li><strong>Usage &amp; device data</strong> — basic technical information (such as IP address, browser type, and pages viewed) collected automatically to operate and secure the site.</li>
      </ul>

      <h2>2. How we use your information</h2>
      <ul>
        <li>To process, fulfill, and ship your orders and provide customer support.</li>
        <li>To send order confirmations, shipping updates, and — if you opt in — marketing emails you can unsubscribe from at any time.</li>
        <li>To operate, secure, and improve the site, and to prevent fraud and abuse (including verifying orders and defending against unwarranted disputes).</li>
        <li>To comply with legal obligations.</li>
      </ul>

      <h2>3. Who we share it with</h2>
      <p>
        We do not sell your personal information. We share it only with service
        providers who help us run the business, under confidentiality obligations,
        including:
      </p>
      <ul>
        <li><strong>Stripe</strong> — payment processing.</li>
        <li><strong>Supabase</strong> — database, authentication, and file storage.</li>
        <li><strong>Hosting &amp; email providers</strong> (such as our application host and Resend) — to run the site and send transactional email.</li>
        <li><strong>Shipping carriers</strong> — to deliver your order.</li>
        <li><strong>Authorities or advisors</strong> — where required by law or to protect our rights.</li>
      </ul>

      <h2>4. International transfers</h2>
      <p>
        Because we operate globally, your information may be processed in countries
        other than your own. Where required, we use appropriate safeguards for such
        transfers.
      </p>

      <h2>5. Cookies</h2>
      <p>
        We use essential cookies and similar technologies to keep you signed in,
        remember your cart, and secure the site. You can control cookies through
        your browser settings; disabling essential cookies may break parts of the
        checkout.
      </p>

      <h2>6. Your rights</h2>
      <p>
        Depending on where you live (for example under the EU/UK GDPR or the
        CCPA/CPRA in California), you may have the right to access, correct, delete,
        or port your personal data, to object to or restrict certain processing, and
        to opt out of marketing. To exercise any right, email{" "}
        <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>. We
        will respond as required by applicable law.
      </p>

      <h2>7. Data retention</h2>
      <p>
        We keep personal information for as long as needed to provide our services,
        meet legal, tax, and accounting obligations, resolve disputes, and enforce
        our agreements.
      </p>

      <h2>8. Security</h2>
      <p>
        We use reasonable technical and organizational measures to protect your
        information. No method of transmission or storage is completely secure, so
        we cannot guarantee absolute security.
      </p>

      <h2>9. Children</h2>
      <p>
        Our site and products are not directed to children, and we do not knowingly
        collect personal information from children. Purchases must be made by an
        adult.
      </p>

      <h2>10. Changes &amp; contact</h2>
      <p>
        We may update this policy from time to time; the &ldquo;last updated&rdquo;
        date above reflects the current version. Questions or requests? Email{" "}
        <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a> or
        visit our <Link href="/support">Support Hub</Link>.
      </p>
    </LegalPage>
  );
}
