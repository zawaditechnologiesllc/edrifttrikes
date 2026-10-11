# Selling into the EU, and the regional storefronts

Two separate things got tangled together when this was first asked for, so they
are kept apart here.

1. **Regional subdomains** — `usa.`, `canada.`, `uae.`, `europe.` — which are a
   presentation choice.
2. **EU compliance** — which is a set of obligations that apply wherever the
   buyer is, on any hostname.

Neither one is a fix for a site being blocked. See "On being blocked" below.

---

## 1. The regional subdomains

`lib/regions.ts` holds the four regions and the host parsing.

### What they are

One catalogue, one database, one checkout, presented with the facts that are
true for a buyer in that region: which distributor serves them, the currency
note, and which consumer-protection regime they buy under.

### What stops them becoming four duplicate sites

Every shared page sends `Link: <https://edrifttrikes.shop/…>; rel="canonical"`
from `middleware.ts`. Only a region's own landing page is canonical to itself.

Four hostnames serving identical pages without this is how a shop teaches a
search engine that three quarters of its pages are duplicates, and at worst how
a young domain acquires a doorway-site reputation — the kind of signal that
gets it filtered rather than ranked.

### The host header is not trusted

`regionFromHost()` matches the leftmost label **and** checks the remainder is a
host we actually answer on. Without that second check,
`europe.edrifttrikes.shop.evil.test` would select the Europe storefront, and
with it a different set of legal statements. Covered by `tests/regions.test.ts`.

### DNS, which is not in this repository

Each subdomain needs a DNS record and a Worker custom domain in Cloudflare.
Until that exists the hostnames do not resolve; nothing in the code can create
them.

---

## 2. What EU law asks of a seller outside the EU

`lib/compliance.ts` holds the facts and the gap list. Admin → System renders it.

### Right of withdrawal — the expensive one to omit

Directive 2011/83/EU. **14 days** from the day the consumer physically receives
the goods, no reason required.

> If the trader has not provided the withdrawal information, the withdrawal
> period expires **12 months** after the end of the initial period.

That is the whole reason `/eu-consumer-rights` exists as its own page. The
Returns page describes this shop's own 30-day policy, which is a commercial
promise; running the two together invites a customer to believe the policy
limits the statutory right. It does not.

Other points from the Directive that the page states: refund within 14 days
including standard delivery cost; the trader's identity and geographic address
before the buyer is bound; the model withdrawal form from Annex I(B), which the
trader must offer and the consumer need not use.

### Legal guarantee of conformity

Directive (EU) 2019/771 — two years on goods sold to consumers, owed by the
seller, free of charge, independent of any commercial warranty.

### GPSR — an EU responsible person

Regulation (EU) 2023/988, applying since 13 December 2024. A product may only be
placed on the EU market if an economic operator **established in the EU** takes
responsibility for it, and that operator's details must appear on the product,
its packaging, the parcel or an accompanying document — not only on a web page.
The Commission published guidelines on 19 November 2025.

Usually the EU distributor or an authorised representative. Marketplaces already
enforce this on listings.

### GDPR Article 27 — a representative in the Union

A controller outside the EU that offers goods to people in the EU appoints one
**in writing**. The threshold is low: delivering to the EU, accepting payment
from EU buyers, or tracking EU visitors is enough to be "offering goods". The
Article 27(2) exemptions are narrow and an online shop is unlikely to meet them.

### What NOT to add: the ODR link

The EU Online Dispute Resolution platform **closed on 20 July 2025**, and the
duty to link to it was repealed with it by Regulation (EU) 2024/3228. Most
policy templates on the internet still carry that link. Publishing one now
points customers at a dead service, which is its own kind of misleading. This
site deliberately does not link it — see the comment in
`app/eu-consumer-rights/page.tsx`.

### Why unfilled values render as nothing

An EU representative and a GPSR responsible person are **appointments**, not
sentences. Writing a plausible name into a constant does not create one, and a
policy page claiming a representative who has not been appointed is a false
statement to a regulator, in writing, on the record — a worse position than
silence. So every unset value renders nothing to a customer and appears instead
as a gap in Admin → System.

---

## 3. On being blocked — settled, and it is not this

The theory that prompted this work was that the site is blocked in Europe
because of missing terms. **It is not**, and there is now a screenshot that
settles it rather than an argument about it.

The blocker is **UVT Internet Provider**, an ISP in the Czech Republic, whose
page says the site is "considered to be harmful". That is a security and
reputation classification, of the kind an ISP takes from a commercial
blocklist. No ISP filter reads a terms page, and no EU rule blocks a site for
having an incomplete one.

**The appeal, the diagnostic sequence and the evidence are in
[BLOCKLIST-APPEALS.md](./BLOCKLIST-APPEALS.md).** That is the document to work
from; this one is the law.

The compliance work here is still worth having — the withdrawal right in
particular is expensive to omit — it is simply not the reason for the block,
and treating it as the fix would have wasted the time.

One thing in that file belongs here too, because it is the same principle. The
project used to ship example contact details (`+1 (555) 010-0000` — the range
reserved for fiction — and a Los Angeles address) as the **live fallback**,
so every page published them until an admin saved real ones. Unverifiable
contact details on a young domain are a genuine adverse signal, and they are
the reason `lib/placeholders.ts` exists and the defaults are now null. It is
the rule already stated above — an unfilled value renders as nothing — applied
to the part of the site a customer reads rather than only to the schema.

### Server location

If EU data residency ever becomes a genuine requirement, it is available
honestly: Supabase offers EU regions, and the data can be hosted there. Making
systems *report* an EU location while the data sits elsewhere does not satisfy
any data-residency rule — the rule is about where the data actually is — and it
is a misrepresentation to regulators and customers. Not done, and not
recommended.

---

## Sources

Consulted 11 October 2026. Law-firm and vendor commentary, not primary law;
the regulation texts on EUR-Lex and a qualified lawyer are the authority.

- GPSR responsible person and Commission guidelines —
  [Baker McKenzie](https://www.bakermckenzie.com/en/insight/publications/resources/product-risk-radar-articles/general-product-safety-regulation),
  [Matheson](https://www.matheson.com/insights/the-general-product-safety-regulation-new-guidance/),
  [ecommercegermany](https://ecommercegermany.com/blog/gpsr-general-product-safety-regulation/)
- ODR platform closure, 20 July 2025 —
  [CMS](https://cms.law/en/deu/legal-updates/the-odr-platform-is-closing-what-businesses-need-to-know),
  [Iubenda](https://www.iubenda.com/en/blog/discontinuation-of-the-european-online-dispute-resolution-odr-platform/)
- GDPR Article 27 representative —
  [Taylor Wessing](https://www.taylorwessing.com/en/insights-and-events/insights/2021/07/gdpr-eu-representative),
  [Taylor Wessing on enforcement](https://www.taylorwessing.com/en/insights-and-events/insights/2021/06/gdpr-fine-for-failure-to-appoint-an-eu-representative)
- Consumer Rights Directive 2011/83/EU, withdrawal and information duties —
  [European Parliament summary](https://oeil.europarl.europa.eu/oeil/en/document-summary?id=1180212),
  [CCPC guidance](https://www.ccpc.ie/business/wp-content/uploads/sites/3/2017/03/CRD-Guidance_FINAL.pdf)
