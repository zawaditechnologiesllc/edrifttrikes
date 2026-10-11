import { COMPANY } from "@/lib/company";
import { isReal } from "@/lib/seo";

/**
 * What selling into the EU actually requires of this shop.
 *
 * ═══ READ THIS BEFORE EDITING THE VALUES BELOW ═════════════════════════════
 *
 * Three of these are not copy. They are appointments — a named organisation,
 * with an address, that has agreed to act. Writing a plausible-looking name
 * into a constant does not create one, and a policy page that claims an EU
 * representative this business has not appointed is a worse position than one
 * that says nothing: it is a false statement to regulators and customers, in
 * writing, on the record.
 *
 * So every unfilled value here renders as NOTHING to a customer, and shows up
 * as a gap in Admin → System instead. Filling them in is a business task, not
 * a code change.
 *
 * ═══ THE REQUIREMENTS, AND WHERE THEY COME FROM ════════════════════════════
 *
 *  - RIGHT OF WITHDRAWAL — Directive 2011/83/EU. Fourteen days from the day
 *    the buyer physically receives the goods, no reason required. If the
 *    trader never tells them about it, the period becomes TWELVE MONTHS. That
 *    is the single most expensive thing on this page to get wrong, and it is
 *    free to get right.
 *  - LEGAL GUARANTEE — Directive (EU) 2019/771. Two years on goods, owed by
 *    the seller and independent of any commercial warranty.
 *  - PRE-CONTRACT INFORMATION — the trader's identity and geographic address,
 *    the total price including taxes and delivery, before the buyer is bound.
 *  - GPSR — Regulation (EU) 2023/988, applying since 13 December 2024. A
 *    product may only be placed on the EU market if an economic operator
 *    ESTABLISHED IN THE EU takes responsibility for it, and that operator's
 *    details have to travel with the product.
 *  - GDPR ARTICLE 27 — a controller outside the EU that offers goods to people
 *    in the EU appoints a representative in the Union, in writing.
 *
 * ⚠️ NOT LEGAL ADVICE. These are the obligations the public sources agree on;
 * member states add their own, and a lawyer should see this before it is
 * relied upon. See docs/EU-COMPLIANCE.md for the sources.
 *
 * ⚠️ DO NOT ADD AN ODR LINK. The EU Online Dispute Resolution platform closed
 * on 20 July 2025 and the duty to link to it went with it. Most templates on
 * the internet still carry that link; publishing one now points customers at a
 * dead service, which is itself misleading.
 */

export type ContactBlock = {
  name: string;
  address: string;
  email: string;
};

const UNSET: ContactBlock = { name: "", address: "", email: "" };

export const EU_COMPLIANCE = {
  /**
   * GDPR Article 27 representative — the contact point in the Union for
   * individuals and supervisory authorities.
   *
   * TODO: appoint one in writing, then record them here. Several providers do
   * this as a paid service; it does not have to be a lawyer.
   */
  representative: UNSET,

  /**
   * GPSR responsible person — the economic operator established in the EU who
   * takes responsibility for the product.
   *
   * TODO: this is usually the EU distributor or an authorised representative.
   * Whoever it is has to have agreed in writing, and their details must also
   * appear on the product, its packaging, the parcel or an accompanying
   * document — not only here.
   */
  responsiblePerson: UNSET,

  /** Where an EU buyer sends goods back. TODO: the distributor's address. */
  euReturnsAddress: "",

  /**
   * The supervisory authority a buyer may complain to. Left general on
   * purpose: a person complains to the authority where they live, not to ours.
   */
  supervisoryAuthorityNote:
    "You may lodge a complaint with the data protection authority in the EU or EEA country where you live, work, or where you believe the issue arose.",

  withdrawalDays: 14,
  /** Days to refund after a valid withdrawal, from Directive 2011/83/EU. */
  refundDays: 14,
  /** Years of legal guarantee on goods sold to EU consumers. */
  guaranteeYears: 2,
} as const;

/** Is this contact block actually filled in, and not a shipped placeholder? */
export function contactIsSet(block: ContactBlock | undefined): boolean {
  if (!block) return false;
  return isReal(block.name) && isReal(block.address) && isReal(block.email);
}

export type ComplianceGap = {
  key: string;
  label: string;
  /** What is actually at stake — not "best practice", the real consequence. */
  why: string;
  done: boolean;
  /** True where trading into the EU without it is the legal problem. */
  blocking: boolean;
};

/**
 * What is still missing before this shop is straight with an EU buyer.
 *
 * Rendered in Admin → System. Deliberately blunt about consequence: a
 * checklist that says "recommended" gets ignored, and two of these carry a
 * cost that is easy to state exactly.
 */
export function euComplianceGaps(): ComplianceGap[] {
  return [
    {
      key: "legalName",
      label: "Registered legal entity name",
      why:
        "EU law requires the trader's identity before the buyer is bound. The site currently prints the trading name, which is not the same thing — and a policy page that cannot name its own company reads as evasive to a customer and to a filter.",
      done: isReal(COMPANY.legalName) && COMPANY.legalName !== COMPANY.name,
      blocking: true,
    },
    {
      key: "address",
      label: "Registered geographic address",
      why:
        "Also required pre-contract. The shipped value is a bracketed placeholder; a reputation scanner looks the address up, finds nothing, and scores the domain down for it.",
      done: isReal(COMPANY.address),
      blocking: true,
    },
    {
      key: "representative",
      label: "GDPR Article 27 representative in the EU",
      why:
        "A controller outside the EU that offers goods to people in the EU appoints one in writing. There is no small-shop exemption that an online store selling into the EU is likely to meet.",
      done: contactIsSet(EU_COMPLIANCE.representative),
      blocking: true,
    },
    {
      key: "responsiblePerson",
      label: "GPSR responsible person established in the EU",
      why:
        "Since 13 December 2024 a product may only be placed on the EU market if an EU-established operator takes responsibility for it. Without one, the compliant answer is not to sell into the EU — and marketplaces already enforce this on listings.",
      done: contactIsSet(EU_COMPLIANCE.responsiblePerson),
      blocking: true,
    },
    {
      key: "euReturns",
      label: "An EU returns address",
      why:
        "A withdrawal right the buyer cannot practically use invites chargebacks and complaints. Shipping a trike back across the Atlantic is not a usable remedy.",
      done: isReal(EU_COMPLIANCE.euReturnsAddress),
      blocking: false,
    },
    {
      key: "governingLaw",
      label: "Governing law",
      why:
        "Still a placeholder in the Terms. Note that whatever it says, it cannot take away the mandatory consumer rights of a buyer in the EU, the UK or Australia.",
      done: isReal(COMPANY.governingLaw),
      blocking: false,
    },
  ];
}

/** Everything that is not yet done. */
export function outstandingGaps(): ComplianceGap[] {
  return euComplianceGaps().filter((g) => !g.done);
}

/**
 * Can the EU consumer-rights page state the trader's identity?
 *
 * The withdrawal form is addressed TO somebody. Without a name and an address
 * it is not a form, it is a blank — so the page says plainly that the details
 * are being finalised rather than printing an empty template and calling it
 * compliance.
 */
export function canPublishWithdrawalForm(): boolean {
  return isReal(COMPANY.legalName) && isReal(COMPANY.address);
}

/**
 * The model withdrawal form, Annex I(B) of Directive 2011/83/EU.
 *
 * The wording is the Directive's, with this trader's details filled in. A
 * trader may provide it; a consumer is never obliged to use it, and the page
 * says so, because implying the form is the only route is itself a way of
 * narrowing the right.
 */
export function withdrawalFormLines(): string[] {
  return [
    `To ${COMPANY.legalName}, ${COMPANY.address}, ${COMPANY.supportEmail}:`,
    "",
    "I/We hereby give notice that I/We withdraw from my/our contract of sale of the following goods:",
    "",
    "Ordered on / received on: ____________________",
    "Order number: ____________________",
    "Name of consumer(s): ____________________",
    "Address of consumer(s): ____________________",
    "",
    "Signature of consumer(s) (only if this form is notified on paper): ____________________",
    "Date: ____________________",
  ];
}
