import LegalPage from "@/components/storefront/LegalPage";
import { COMPANY } from "@/lib/company";
import {
  EU_COMPLIANCE,
  canPublishWithdrawalForm,
  contactIsSet,
  withdrawalFormLines,
} from "@/lib/compliance";
import { isReal } from "@/lib/seo";

export const metadata = {
  title: "EU & UK consumer rights",
  description:
    "Your right of withdrawal, the legal guarantee, and who to contact — for buyers in the European Union, the EEA and the United Kingdom.",
};

/**
 * The rights an EU, EEA or UK buyer has by law, said plainly.
 *
 * ═══ WHY THIS PAGE EXISTS SEPARATELY ═══════════════════════════════════════
 *
 * Because the withdrawal right has a price attached to not mentioning it. A
 * trader who never tells an EU buyer about the fourteen days does not get to
 * keep the fourteen days — the period becomes TWELVE MONTHS. The Returns page
 * describes this shop's own 30-day policy, which is a commercial promise and a
 * different thing from a statutory right; running the two together is how a
 * customer ends up believing the policy limits the law. It does not.
 *
 * ⚠️ THE BLOCKS BELOW RENDER NOTHING UNTIL THEY ARE REAL. An EU
 * representative or a GPSR responsible person is an appointment, not a
 * sentence — claiming one that has not been made is a false statement to a
 * regulator, in writing. Admin → System lists what is still outstanding.
 */
export default function EuConsumerRights() {
  const showForm = canPublishWithdrawalForm();
  const hasRep = contactIsSet(EU_COMPLIANCE.representative);
  const hasRp = contactIsSet(EU_COMPLIANCE.responsiblePerson);
  const hasEuReturns = isReal(EU_COMPLIANCE.euReturnsAddress);

  return (
    <LegalPage title="EU & UK consumer rights" eyebrow="For buyers in Europe">
      <p>
        If you are buying as a consumer in the European Union, the European
        Economic Area or the United Kingdom, you have rights that apply
        automatically. They do not depend on this page, they are not affected by
        anything in our Terms, and nothing in our own returns policy can reduce
        them. This page sets them out so you know what they are.
      </p>

      <h2>1. Your right to change your mind — {EU_COMPLIANCE.withdrawalDays} days</h2>
      <p>
        You may withdraw from your purchase within{" "}
        <strong>{EU_COMPLIANCE.withdrawalDays} days</strong> without giving any
        reason. The period starts on the day you — or someone you nominate who
        is not the carrier — physically receive the goods. Where an order
        arrives in several deliveries, it starts on the day you receive the
        last one.
      </p>
      <p>
        To withdraw, tell us clearly before the {EU_COMPLIANCE.withdrawalDays}{" "}
        days are up. An email to{" "}
        <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>{" "}
        saying you are withdrawing is enough — a statement in your own words is
        as valid as any form. Sending the notice before the deadline is what
        counts; you do not have to have returned the goods by then.
      </p>

      <h2>2. What happens after you withdraw</h2>
      <ul>
        <li>
          We refund everything you paid, including the standard delivery cost,
          within <strong>{EU_COMPLIANCE.refundDays} days</strong> of being told.
          If you chose a more expensive delivery option than our standard one,
          we refund the standard cost.
        </li>
        <li>
          We may hold the refund until the goods are back with us, or until you
          show they have been sent, whichever is earlier.
        </li>
        <li>
          You send the goods back without undue delay and within{" "}
          {EU_COMPLIANCE.withdrawalDays} days of telling us.
        </li>
        <li>
          Unless we have failed to tell you about this right, you pay the direct
          cost of returning the goods. These are large, crated items and that
          cost can be significant — ask us for an estimate before you decide.
        </li>
        <li>
          You may handle the goods as you would in a shop. If you go further
          than that and their value drops as a result, we may deduct the
          difference.
        </li>
      </ul>

      <h2>3. The model withdrawal form</h2>
      <p>
        You do not have to use this form. It is the model form from Annex I(B)
        of Directive 2011/83/EU, provided because you are entitled to be offered
        it. Complete it and send it to us only if you wish.
      </p>
      {showForm ? (
        <pre className="whitespace-pre-wrap border border-white/15 rounded-lg p-5 text-sm bg-surface-container">
          {withdrawalFormLines().join("\n")}
        </pre>
      ) : (
        <p>
          <em>
            Our registered company details are being finalised, so we are not
            publishing a pre-addressed form yet rather than publishing one with
            gaps in it. You do not need it: email{" "}
            <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>{" "}
            stating that you withdraw from your order, and that is a valid
            withdrawal with full effect.
          </em>
        </p>
      )}

      <h2>4. The legal guarantee — {EU_COMPLIANCE.guaranteeYears} years</h2>
      <p>
        Separately from the {EU_COMPLIANCE.withdrawalDays}-day withdrawal right,
        goods sold to consumers in the EU come with a legal guarantee of
        conformity of <strong>{EU_COMPLIANCE.guaranteeYears} years</strong> from
        delivery. If the goods are faulty, do not match how they were described,
        or do not work as goods of that kind should, you are entitled to have
        them repaired or replaced and, where that is not possible, to a
        reduction in price or to unwind the purchase.
      </p>
      <p>
        This is owed by us as the seller, it is free of charge to you, and it
        exists whether or not any commercial warranty applies. Our own warranty
        is in addition to it and never in place of it.
      </p>

      <h2>5. When the right to withdraw does not apply</h2>
      <p>
        The withdrawal right does not cover goods made to your specification or
        clearly personalised. Where a product has been built to a configuration
        you chose, we will say so on the product page before you order. It also
        does not apply to sealed goods unsuitable for return on health or
        hygiene grounds once unsealed.
      </p>

      <h2>6. Who you are buying from</h2>
      <p>
        {isReal(COMPANY.legalName) ? COMPANY.legalName : COMPANY.name}
        {isReal(COMPANY.address) ? `, ${COMPANY.address}` : ""}. Contact us at{" "}
        <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>.
      </p>
      <p>
        Prices shown include no EU import VAT or duty unless stated. Depending
        on the destination these may be charged on arrival, and they are payable
        by the buyer. We tell you the total we charge before you pay.
      </p>

      {hasEuReturns && (
        <>
          <h2>7. Returns address in Europe</h2>
          <p>{EU_COMPLIANCE.euReturnsAddress}</p>
        </>
      )}

      {hasRp && (
        <>
          <h2>Product safety — responsible person in the EU</h2>
          <p>
            Under Regulation (EU) 2023/988 the economic operator established in
            the European Union responsible for these products is:
          </p>
          <p>
            {EU_COMPLIANCE.responsiblePerson.name}
            <br />
            {EU_COMPLIANCE.responsiblePerson.address}
            <br />
            <a href={`mailto:${EU_COMPLIANCE.responsiblePerson.email}`}>
              {EU_COMPLIANCE.responsiblePerson.email}
            </a>
          </p>
        </>
      )}

      {hasRep && (
        <>
          <h2>Data protection — our representative in the EU</h2>
          <p>
            Our representative in the Union under Article 27 of the GDPR, whom
            you may contact on any matter relating to your personal data, is:
          </p>
          <p>
            {EU_COMPLIANCE.representative.name}
            <br />
            {EU_COMPLIANCE.representative.address}
            <br />
            <a href={`mailto:${EU_COMPLIANCE.representative.email}`}>
              {EU_COMPLIANCE.representative.email}
            </a>
          </p>
        </>
      )}

      <h2>Complaints</h2>
      <p>
        Email{" "}
        <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>{" "}
        and we will answer. {EU_COMPLIANCE.supervisoryAuthorityNote} You may
        also contact the consumer protection authority in your own country.
      </p>
      <p>
        {/*
          Deliberately not linking the EU ODR platform: it closed on 20 July
          2025 and the duty to link to it went with it. Most policy templates
          still carry that link, and pointing a customer at a dead service is
          its own kind of misleading.
        */}
        Nothing on this page limits your statutory rights.
      </p>
    </LegalPage>
  );
}
