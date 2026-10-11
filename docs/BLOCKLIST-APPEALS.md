# When a filter blocks the shop

A customer sent a screenshot of a block page. It is the single most useful
thing anyone has produced about this problem, because **a block page always
names who is blocking**, and that turns a guess into a diagnosis.

---

## 1. What the screenshot actually says

The blocker is **UVT Internet Provider**, an internet provider in the Czech
Republic. Its wording:

> We have a legal obligation and a responsibility to ensure that our
> subscribers are not able to reach sites which are barred by law or that are
> likely to cause malicious damage to their online reputation or devices. You
> have tried to access a site at `https://edrifttrikes.shop/` which we consider
> to be harmful.

With an appeal route on the page itself: `podpora@uvt.cz`, `227 023 023`.

### What that rules out

This work started from the theory that European customers were being blocked
because the site was missing terms, or because the servers are not in the EU.
**The block page refutes both.**

| Theory | Verdict |
| --- | --- |
| Missing or inadequate terms | No. An ISP filter never reads a terms page, and no EU rule blocks a site for having an incomplete one. |
| Server location / data residency | No. GDPR governs where data may be *transferred*, and the penalty is a fine on the controller, not a network block. |
| GDPR, GPSR, an unappointed representative | No. These are enforced by regulators against the business, never by an ISP against a visitor. |
| A security or reputation classification | **Yes.** "likely to cause malicious damage" is the language of a malware/phishing/scam category. |

The EU compliance work in `docs/EU-COMPLIANCE.md` is still worth having — it is
the law, and the withdrawal right is expensive to omit. It is just not the
reason for this block, and treating it as the fix would have wasted the time.

### What it means

An ISP of this size does not classify domains itself. It subscribes to
commercial or community blocklists and category feeds, and enforces whatever
they say. So:

- The decision was almost certainly **automated**, on a reputation score.
- The same upstream feed is likely behind other reports, which is why the
  complaints cluster rather than appearing at random.
- Appealing to UVT alone fixes UVT. Fixing the **upstream feed** fixes everyone
  who subscribes to it, which is the one that matters.

---

## 2. What the shop was broadcasting, and what changed

A reputation feed scores a domain on signals it can read without a human. The
ones that were going the wrong way here were all in the same family — a young
domain on a TLD (`.shop`) with a poor reputation, presenting contact details
that do not resolve to anything.

Until this change, **every page of the site** published:

- `+1 (555) 010-0000` — the `555-0100`–`555-0199` block is **reserved for
  fiction**. Any automated checker recognises it, and so does any human.
- `100 Drift Lane, Los Angeles, CA 90001, USA` — a street address the business
  has never traded from.
- `hello@edrifttrikes.shop` — a mailbox that is not the support address.

Those were the project's shipped example values, used as the live fallback
whenever nobody had filled the settings form in. Young domain + cheap TLD +
fictional phone number + invented US address is close to the textbook
fingerprint of a scam storefront. It is not proof of anything, and it is
exactly the sort of thing a scoring model weighs.

The structured data (`lib/seo.ts`) and the invoices (`lib/invoice.ts`) had
always dropped unfilled values, on the stated principle that a missing detail
scores better than a fake one. The footer and the PDF product sheet had never
applied it.

### The code change

- `lib/placeholders.ts` — the rule in one place: `isReal`, `realOrNull`, and
  the examples as examples.
- `lib/company.ts` — `DEFAULT_SITE_SETTINGS` now carries **null** contact
  fields. A shop that has filled nothing in shows nothing.
- `components/storefront/SiteFooter.tsx` — filters every value; always keeps
  one real way to reach a human (`COMPANY.supportEmail`, a constant).
- `lib/product-sheet.ts` — same, for the PDF a buyer forwards to a purchasing
  department.
- `app/.well-known/security.txt/route.ts` — RFC 9116. A working address at a
  standard path, and a paragraph aimed at blocklist operators specifically.
- `tests/placeholders.test.ts` — asserts no shipped example can pass as real
  and that the defaults carry no contact details.

### What is still on the owner, and cannot be done in code

Nothing here invents a business. These are the gaps a reviewer will find:

1. **Real contact details** in Admin → Settings: a telephone number that is
   answered, and the address the business actually trades from. Until they are
   saved, the site now shows no phone number and no address — honest, but a
   shop with neither still scores poorly.
2. **`lib/company.ts` TODOs**: the registered legal entity name, the registered
   address, the governing-law jurisdiction.
3. A **WHOIS registrant** that is not fully redacted, or a visible company
   identity that matches the site.

---

## 3. The appeal, in order

Do these in sequence. Step 1 is free and tells you whether the rest is needed.

### Step 1 — find out who else has classified the domain

Check, and write down what each one says:

- **Google Search Console** → Security & Manual Actions → Security Issues. This
  is the one that matters most; if Google has flagged the site, Chrome, Firefox
  and Safari all show a warning.
- **Google Safe Browsing** site status: `transparencyreport.google.com/safe-browsing/search`
- **VirusTotal** (`virustotal.com`) — enter the domain. It aggregates ~70
  engines, and it names the specific vendors that flag it. **This is usually
  where the upstream feed shows up.**
- **Spamhaus DBL** (`check.spamhaus.org`), **URLhaus**, **Sucuri SiteCheck**.
- The filter vendors' own lookups: Cisco Talos, Fortiguard, Symantec/Broadcom
  WebPulse, Zscaler, Trend Micro. Each has a public "submit a
  reclassification" form, and each is free.
- **Cloudflare**, Security → WAF and Bots, and any country rules. A block the
  shop is doing to itself looks identical from outside.

### Step 2 — fix anything real that they found

If a scanner reports injected content, a compromised dependency or a malicious
redirect, that is a genuine incident and takes priority over every appeal.
Appealing an accurate detection wastes the one appeal you get.

### Step 3 — appeal to each one that is wrong

Reclassification requests are judged on whether the domain looks like a real
business, by a human, in about a minute. Give them that minute:

- What the site is, and what it sells.
- The registered business, and a contact that answers.
- That no part of the site asks for credentials and there is no download.
- Payments go through Stripe, PayPal and Authorize.Net — named processors, each
  of which has already run its own onboarding check on the business.
- The specific URL that was blocked.

### Step 4 — UVT itself

Send this to `podpora@uvt.cz`. Fill the bracketed parts; do not send it with
brackets still in it.

```
Subject: False positive — https://edrifttrikes.shop/ blocked as harmful

Hello,

A customer of ours in the Czech Republic cannot reach our website on your
network. Your block page says https://edrifttrikes.shop/ is "considered to be
harmful".

We believe this is a false positive and would be grateful if you could review
it.

We are [registered legal entity name], a manufacturer and online retailer of
electric drift trikes and go-karts, selling direct to customers worldwide.
The site is an ordinary storefront: a product catalogue and a checkout.

- It hosts no downloads and distributes no software.
- It asks for no credentials other than an optional customer account on our
  own domain.
- Card payments are handled entirely by Stripe, PayPal and Authorize.Net on
  their own domains. We never see or store card details.
- Our security contact is published at
  https://edrifttrikes.shop/.well-known/security.txt

If a scanner has reported something specific about the site, we would very much
like to know what it is — we will fix it. If the classification came from an
upstream blocklist, we would appreciate knowing which one so that we can
approach them directly.

Business details:
  Registered name: [legal entity name]
  Registered address: [address]
  Website: https://edrifttrikes.shop/
  Contact: support@edrifttrikes.shop
  Telephone: [number that is actually answered]

Thank you for looking at this.

[Name]
[Role], [legal entity name]
```

### Step 5 — keep the evidence

Ask any customer who reports a block for a screenshot of the **block page**,
not of the browser tab, plus their country and their ISP. Four screenshots
naming four different blockers is a different problem from four naming the
same one, and only the page tells you which you have.

---

## 4. Two things not to do

**Do not register a new domain to escape it.** A new domain is the single
strongest adverse signal there is — "domain registered in the last 30 days" is
a scoring rule in every one of these systems — so a shop that moves domains
each time it is filtered looks exactly like the thing being filtered. Domain
age is an asset that only accrues by waiting. Burning it to dodge one ISP
trades a fixable classification for a permanent handicap, and it abandons every
link, bookmark and search result the shop has earned.

**Do not spoof the server's location.** Reporting an EU location while the data
sits elsewhere satisfies no data-residency rule — the rule is about where the
data actually is — and it is a misrepresentation to regulators and customers.
If EU residency ever becomes a real requirement it is available honestly:
Supabase offers EU regions. Separately, none of this is why the block happened.

---

## 5. Honest limits of this document

- The live site could not be fetched from the environment this was written in
  (no outbound DNS for the domain), so **what is actually deployed right now
  was not verified** — this describes the code in this repository. Load the
  footer of the production site and confirm there is no `555` number on it.
- Which upstream feed UVT subscribes to is not known. Step 1 is how to find
  out, and VirusTotal is the quickest route to it.
- There is no way to know from here whether the placeholder details are *the*
  reason for the classification. They are a real negative signal, they were
  fixable, and they are fixed. The checks in step 1 are what replace guessing.
