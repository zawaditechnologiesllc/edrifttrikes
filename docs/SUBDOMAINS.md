# Turning on the regional subdomains

Five hostnames, all served by the one Worker that already serves the apex:

| Hostname | Storefront | Quotes in | Charged in |
| --- | --- | --- | --- |
| `usa.edrifttrikes.shop` | United States | USD | USD |
| `canada.edrifttrikes.shop` | Canada | CAD *(approx.)* | USD |
| `uae.edrifttrikes.shop` | United Arab Emirates | AED *(approx.)* | USD |
| `europe.edrifttrikes.shop` | Europe | EUR *(approx.)* | USD |
| `global.edrifttrikes.shop` | Worldwide | USD | USD |

---

## Registration and DNS are two different things

The domain is registered at **Spaceship**; the DNS is served by **Cloudflare**.
That split is normal and nothing about it needs changing — the registrar's only
job here is to say "this domain's nameservers are Cloudflare's", which it is
already doing if the site currently works.

**So there is nothing to do at Spaceship.** Do not add subdomain records there:
whatever is in Spaceship's own DNS panel is ignored while the nameservers point
elsewhere, and adding records there is the single most common way this goes
wrong — an hour spent editing a zone nobody is reading.

Confirm it in one command before anything else:

```bash
dig +short NS edrifttrikes.shop
```

You want two `*.ns.cloudflare.com` names back. If you get Spaceship's
nameservers instead, the zone is not on Cloudflare and nothing below applies
yet — move DNS to Cloudflare first (Cloudflare dashboard → Add a site →
follow the nameserver instructions → paste those two nameservers into
Spaceship under *Domain → Nameservers → Custom*).

---

## Do it from the repo (recommended)

The five hostnames are declared in `wrangler.jsonc` as **Custom Domains**, so
deploying is what creates them:

```bash
npm run deploy
```

That is the whole step. Cloudflare creates the DNS record for each hostname,
points it at the Worker and issues the certificate — **you do not create any
DNS records by hand**, and you should not: Cloudflare owns these records, and
a manually created A/CNAME for the same name will conflict with the one it is
trying to create.

Why in the repo rather than the dashboard: the list is then in version
control, `npm run deploy` is what applies it, and a region added to
`lib/regions.ts` without a matching hostname (or the reverse) fails a test
instead of being discovered by a customer.

### If you would rather click

Cloudflare dashboard → **Workers & Pages** → `edrifttrikes` → **Settings** →
**Domains & Routes** → **Add** → **Custom domain** → type the hostname → Add.
Repeat for each. Same result; it just will not survive the next deploy from
source unless `wrangler.jsonc` lists it too, so add it there as well.

---

## Then check it, in this order

```bash
# 1. DNS exists and is proxied (Cloudflare's IPs, not an origin server)
dig +short usa.edrifttrikes.shop

# 2. The certificate is live and the right storefront answers
curl -sI https://usa.edrifttrikes.shop | head -1
curl -s https://europe.edrifttrikes.shop/ | grep -o "Served by our European distributor"

# 3. The canonical still points at the apex — this is what stops five
#    hostnames reading as five copies of one shop
curl -sI https://europe.edrifttrikes.shop/shop | grep -i '^link:'
```

**Certificates take a few minutes.** A fresh custom domain commonly answers
with a TLS error for anywhere between one and fifteen minutes while the
certificate is issued. That is expected; it is not a misconfiguration, and
re-adding the domain restarts the clock rather than shortening it.

---

## What each hostname actually changes

Not much, on purpose. One catalogue, one database, one checkout.

- **The strip at the top** names the distributor and the currency.
- **Prices** gain a second line — `approx. 1.747 €` under `$1,899`.
- **Europe** gets a link to `/eu-consumer-rights`.
- **Everything else is identical**, and says so: every shared page sends
  `Link: <https://edrifttrikes.shop/…>; rel="canonical"`, so the catalogue and
  the policies are one set of documents with five front doors rather than five
  competing copies. `global.` canonicalises away entirely — it is an alias of
  the apex, not a sixth storefront.

### ⚠️ The currency is a display, not a charge

Every price is stored in US cents and **every payment settles in US dollars**.
The CAD, AED and EUR figures are conversions shown beside the dollar price for
guidance, always labelled `approx.`, and every regional storefront states that
the card is charged in dollars.

Charging in euros is a much bigger change than showing them — per-currency
prices, a gateway configured per currency, refunds in the original currency,
invoices that total correctly, and admin reporting that stops adding mixed
currencies together as though they were one. None of that exists, and quoting
a price you do not charge without saying which is which is a misleading price
indication (explicitly so in the EU) as well as a dispute waiting to be filed.

**The rates live in `lib/currency.ts` and two of them need looking after.**
AED is pegged to the dollar at 3.6725 and does not move. EUR and CAD float:
update `RATES` and `RATES_AS_OF` when they drift. If they go unchanged for more
than `RATE_MAX_AGE_DAYS` (120), the shop stops showing the second price
altogether rather than quoting a number it can no longer stand behind — so the
failure mode of forgetting is silence, not a wrong price.

---

## Where we do not ship

**Nigeria and India.** This is enforced, not just stated:

- they are **not in the checkout country picker** (`lib/countries.ts`);
- `isKnownCountry` **rejects them**, so a typed or autofilled value cannot
  reach a paid order that then has to be refunded by hand;
- the **footer of every page** says so, the **worldwide storefront's strip**
  says so, and the **shipping policy** says so in full.

Both still resolve for *reading*: an order placed before the exclusion still
shows its country name and flag in the admin and still gets a delivery band.
Only the "can somebody buy, to here, now" path consults the shippable list.

To change the list, edit `NOT_SHIPPED_CODES` in `lib/countries.ts`. The
disclaimer sentence is built from it, so the words and the enforcement cannot
drift apart.

---

## If something does not work

| Symptom | Cause |
| --- | --- |
| `dig` returns nothing | The deploy did not run, or the zone is not on this Cloudflare account. |
| TLS error for a few minutes | Normal. The certificate is being issued. |
| TLS error for over an hour | The hostname has a conflicting DNS record created by hand. Delete it and redeploy. |
| Subdomain shows the worldwide storefront | It is not in `lib/regions.ts`, or it resolved somewhere other than this Worker. |
| Prices show no local figure | The region quotes USD, or the floating rate has gone stale — see `RATES_AS_OF`. |
| A region 404s everything | The Worker is serving, but `ASSETS` is missing — redeploy from source. |

---

## One thing to verify yourself

The exact `wrangler.jsonc` Custom Domain syntax and the certificate timing
above are written from knowledge: **this build environment's network policy
blocks `developers.cloudflare.com`**, so they could not be re-checked against
the live documentation. The config parses and the shape has been stable for
years, but if `npm run deploy` rejects the `routes` block, use the dashboard
path above — it is the same mechanism, and the dashboard's own wording is
authoritative.
