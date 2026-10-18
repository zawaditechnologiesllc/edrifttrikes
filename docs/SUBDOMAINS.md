# Turning on the regional subdomains

**Written for clicking, not typing.** No terminal, no commands. If a step
mentions a file, that is only so a developer knows where it lives — you do not
need to open it.

Five new addresses, all showing the same shop:

| Address | Shows | Prices shown in | Card charged in |
| --- | --- | --- | --- |
| `usa.edrifttrikes.shop` | United States storefront | US dollars | US dollars |
| `canada.edrifttrikes.shop` | Canada storefront | Canadian dollars *(approx.)* | US dollars |
| `uae.edrifttrikes.shop` | UAE storefront | Dirhams *(approx.)* | US dollars |
| `europe.edrifttrikes.shop` | Europe storefront | Euros *(approx.)* | US dollars |
| `global.edrifttrikes.shop` | Worldwide storefront | US dollars | US dollars |

Roughly 15 minutes, most of which is waiting.

---

## Before you start: nothing happens at Spaceship

This is the step people get wrong, so it is worth being blunt about.

Spaceship is where the domain is **registered**. Cloudflare is where its DNS is
**managed**. Those are different jobs. Spaceship's only remaining role is to say
"ask Cloudflare about this domain" — which it is already doing, or your website
would not load at all.

**Do not add subdomains in Spaceship.** Spaceship has a DNS page and it will
happily let you type records into it. Nothing will read them. People lose an
afternoon here.

Everything below happens in Cloudflare.

---

## Step 1 — Find the Worker (2 minutes)

1. Go to **dash.cloudflare.com** and log in.
2. In the left sidebar, click **Compute (Workers)**. Depending on when your
   account was set up this may be called **Workers & Pages**.
3. You will see a list of projects. Click the one for this shop — it is called
   **edrifttrikes**.

If you cannot find it, use the search box at the top and type `edrift`.

**If there is no such project**, stop here and tell me — it would mean the site
is being served some other way, and the rest of this would not apply.

---

## Step 2 — Add the five addresses (5 minutes)

Still inside the **edrifttrikes** Worker:

1. Click the **Settings** tab.
2. Find the section called **Domains & Routes**. (On some accounts this is
   under a **Triggers** tab instead — same thing, same list.)
3. Click **+ Add**.
4. Choose **Custom domain** — *not* Route. This matters: see the box below.
5. In the box, type the first address exactly:

   ```
   usa.edrifttrikes.shop
   ```

6. Click **Add domain**.
7. Repeat steps 3–6 for each of the remaining four:

   ```
   canada.edrifttrikes.shop
   uae.edrifttrikes.shop
   europe.edrifttrikes.shop
   global.edrifttrikes.shop
   ```

That is the whole setup. Cloudflare creates the DNS entry for each one and
issues its security certificate automatically.

> **Do not go and create DNS records for these.**
> Cloudflare has just created them and owns them. If you add your own A or
> CNAME record for the same name, the two fight and the address stays broken.
> There is nothing for you to add under the DNS tab.

> **Why "Custom domain" and not "Route":**
> A Route expects a server sitting behind the address already. These addresses
> have no server behind them — the Worker *is* the server. Picking Route gives
> you an address that resolves to nothing, with no error message explaining
> why.

---

## Step 3 — Wait for the padlock (1–15 minutes)

Each new address needs a security certificate before browsers will open it.
Cloudflare does this on its own.

In the **Domains & Routes** list, each address shows a status. It will say
something like *Initializing* or *Pending* and then settle on **Active**.

While it is pending, opening the address in a browser shows a certificate
warning. **That is normal and it is not broken.** It usually clears in a few
minutes and can occasionally take fifteen.

Do not delete and re-add a domain to speed this up. That restarts the clock
rather than shortening it.

---

## Step 4 — Make sure the new code is live

The subdomains need the code that knows what to do with them. Everything is
merged and ready, but it has to be *deployed*.

**Find out which kind of deploy your project uses:**

In the **edrifttrikes** Worker, look for a tab called **Deployments** or
**Builds**.

- **If you see a list of builds with commit messages and GitHub branch names**
  → your project rebuilds itself whenever code is merged. Look at the top of
  the list: if the most recent build succeeded and happened *after* today, you
  are done. If it failed, click it and send me what it says.

- **If you only see deployment versions with no GitHub connection** → the site
  is deployed by hand from somebody's computer, and that person needs to run
  it. Send them this line and nothing else:

  ```
  git pull && npm run deploy
  ```

  If nobody does that, tell me — the last several rounds of changes would not
  be live yet either, and that is worth knowing.

---

## Step 5 — Check it worked

In an ordinary browser tab, open each of these. You do not need any tools.

| Open this | You should see |
| --- | --- |
| `https://usa.edrifttrikes.shop` | A dark strip at the very top reading **UNITED STATES · Served by our United States distributor** |
| `https://canada.edrifttrikes.shop/shop` | Under each price, a second smaller line: **approx. CA$…** |
| `https://uae.edrifttrikes.shop/shop` | Under each price: **approx. AED …** |
| `https://europe.edrifttrikes.shop/shop` | Under each price: **approx. … €**, and a link in the top strip reading **Your EU consumer rights** |
| `https://global.edrifttrikes.shop` | A strip saying **WORLDWIDE**, including the sentence about Nigeria and India |

On the three non-dollar storefronts, the top strip also says **"Prices are
charged in US dollars."** If you can see that sentence, the important part is
working.

---

## What each address actually changes

Less than you might expect, and that is deliberate. It is **one shop**: one
product catalogue, one set of orders, one checkout. Nobody has to maintain five
websites.

What differs per address:

- the strip at the top naming the distributor and the currency
- the second, approximate price line
- Europe gets a link to the EU consumer rights page

Everything else is identical, and the site tells Google so. Five addresses
serving identical pages, without that signal, is how a shop teaches a search
engine that most of its pages are duplicates — which is the opposite of what
you want from this.

---

## When someone lands on the wrong one

Your teams hand out their own links, so a European clicking the USA team's
Instagram link is the ordinary case, not a rare one.

When that happens, a thin band appears under the top strip:

> It looks like you're in **Germany**. Our **Europe** storefront is set up for
> you — same products, same prices.  **Switch to Europe →**   *Stay here*

It **never moves them automatically.** That is deliberate, and worth knowing
why: a redirect would break the very links your teams are handing out. Anyone
travelling, on a work VPN, or simply guessed wrong about would be bounced off
the storefront they were sent to, and your UAE team's link would stop landing
on the UAE storefront. The country comes from the visitor's internet
connection, which is a good basis for a suggestion and a bad one for a
decision.

A few things it does quietly:

- **It keeps their place.** Switching from a product page lands on that
  product on the other storefront, not back at a homepage.
- **It asks once.** "Stay here" is remembered, so somebody who says no is not
  asked again every time they open a page.
- **It says nothing when it has nothing to say** — to an American on the USA
  storefront, to anyone on the worldwide one, or when the connection cannot be
  placed at all. No banner, and no lookup either.

Nothing to configure. It works from the moment this is deployed.

---

## ⚠️ About the prices — please read this one

**The local prices are a guide. Every card is charged in US dollars.**

A customer in Germany sees `$1,899` with `approx. 1.747 €` underneath, and
`$1,899` is what leaves their account. The site says so on every regional
storefront, which is both honest and legally required in the EU — showing a
price you do not actually charge, without saying which is which, is a
misleading price indication there.

**If you want to genuinely charge in euros**, that is a bigger job and a
separate conversation: it needs a price per currency per product, your payment
providers configured for each currency, refunds going back in the original
currency, invoices that add up, and your revenue reporting changed so it stops
adding euros and dollars together as if they were the same number. Tell me if
you want it and I will scope it properly.

### The one thing you need to maintain

Exchange rates move. Two of the three need occasional attention:

- **Dirhams (AED)** — fixed by the UAE central bank at 3.6725 to the dollar
  since 1997. Never needs touching.
- **Euros and Canadian dollars** — these float.

**If nobody updates them for 120 days, the site stops showing the local price
entirely** and shows only the dollar price. That is on purpose: a missing
guide price is a small loss, a wrong one is an argument with a customer.

So the failure mode of forgetting is that the feature quietly switches itself
off — not that customers see bad numbers. When you notice it has gone, ask me
to refresh the rates and it comes back. It is a two-line change.

---

## Where we do not ship

**Nigeria and India**, as you asked.

This is not just a notice — a customer from either country **cannot complete a
checkout**:

- neither country appears in the country list at checkout;
- if someone's browser autofills it anyway, the order is refused;
- the notice appears in three places: the footer of **every** page, the top
  strip on the **worldwide** storefront, and the **Shipping & Warranty** page
  in full.

The wording is built from the same list that does the blocking, so the two can
never disagree.

Both countries still appear correctly on any order placed *before* this
change — nothing in your existing records is affected.

To add or remove a country from this list, just ask. It is one line.

---

## If something does not work

| What you see | What it means |
| --- | --- |
| Certificate warning, first few minutes | Normal. Wait. |
| Certificate warning after an hour | A DNS record for that name was created by hand and is conflicting. Send me a screenshot of your DNS tab. |
| The address does not load at all | The Custom Domain was not added, or **Route** was picked instead of **Custom domain**. Check the Domains & Routes list. |
| It loads, but no coloured strip at the top | The new code is not deployed yet — go back to Step 4. |
| Prices show no second line on canada/uae/europe | Either the code is not deployed, or the exchange rates have gone stale. Tell me which address and I will check. |
| Nigeria or India still appears at checkout | The new code is not deployed yet. |

Send me a screenshot of anything that does not match and I will tell you which
of these it is.

---

## A note for whoever maintains the code

The five hostnames are also declared in `wrangler.jsonc` as Custom Domains, so
a deploy from source creates them without anyone clicking. The dashboard steps
above and that file do the same thing; the file is there so the list is in
version control and so `tests/regions.test.ts` can bind it to `lib/regions.ts`
— a region with no hostname is a storefront nobody can reach, and a hostname
with no region silently serves the worldwide site.

The exact Custom Domain config syntax and the certificate timing in this
document were written from knowledge: this build environment's network policy
blocks `developers.cloudflare.com`, so they could not be re-checked against the
live documentation. The dashboard steps above do not depend on that and are the
safer path.
