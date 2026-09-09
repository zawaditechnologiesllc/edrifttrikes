# Build prompt — direct-to-consumer storefront

Copy everything below the line into a fresh coding session. Fill in the
`{{PLACEHOLDERS}}` first; everything else is buildable as written.

Nothing in this document is specific to one business. Swap the brand block and
the palette and it produces the same system in a different skin.

---

## THE BRIEF

Build a complete direct-to-consumer storefront and admin panel for
`{{BRAND_NAME}}`, a `{{WHAT_THE_BUSINESS_IS}}` selling `{{PRODUCT_CATEGORY}}`
worldwide, direct, with no dealers.

Not a template fill-in: a working shop that takes real money, emails real
customers on a real schedule, and can be run day to day by one non-technical
owner from an admin panel.

### Fill these in before starting

| Placeholder | Meaning | Example |
|---|---|---|
| `{{BRAND_NAME}}` | Display name everywhere | `Kite Coffee Roasters` |
| `{{LEGAL_NAME}}` | Registered entity, for policies | `Kite Trading Ltd` |
| `{{DOMAIN}}` | Canonical domain | `kitecoffee.com` |
| `{{SUPPORT_EMAIL}}` | On the domain, never free-mail | `support@kitecoffee.com` |
| `{{PRODUCT_CATEGORY}}` | What is sold | `single-origin coffee` |
| `{{PRODUCT_NOUN}}` | One item, in the owner's words | `bag` / `trike` / `board` |
| `{{CATEGORIES}}` | Top-level shop sections | `Beans, Equipment, Subscriptions` |
| `{{DELIVERY_MIN}}` / `{{DELIVERY_MAX}}` | Quoted window, days | `12` / `20` |
| `{{RETURN_DAYS}}` | Return window | `30` |
| `{{REFUND_DAYS}}` | Refund processing, days | `7` |
| `{{PALETTE}}` | See **Brand and theme** below | |

---

## 1. STACK AND HOSTING

- **Next.js 15 (App Router) + React 19 + TypeScript**, strict mode.
- **Tailwind CSS** with a design-token config — no raw hex in components.
- **Cloudflare Workers** via `@opennextjs/cloudflare` (OpenNext) for the app.
- **Supabase** for Postgres, Auth and Storage.
- **A small Express service on Render** for two jobs only: verifying payment
  webhooks, and running a `node-cron` clock.
- **Stripe** and **PayPal** for payments; **Resend** for email.
- **Tests: `node --test` with `tsx`.** No test framework, no mocking library.

### Two rules that will bite you if ignored

1. **`NEXT_PUBLIC_*` values are inlined at BUILD time on Cloudflare.** A
   variable set only as a runtime Worker variable renders as an empty string in
   the client bundle and the feature silently dies. Build a `serverEnv()` helper
   that reads `process.env` then falls back to `getCloudflareContext().env`, and
   for anything the browser needs, inject it per-request from the server
   (`window.__APP_ENV`) with a `/api/public-env` route as a third fallback for
   **statically prerendered pages**, whose layout was rendered at build time.
2. **Idempotency belongs in the database, not in application logic.** Every
   "did we already do this?" question is answered by a `UNIQUE` constraint.
   Claiming a step IS the insert; error code `23505` means someone else claimed
   it. Never `SELECT` then `INSERT`.

---

## 2. BRAND AND THEME

Put the entire visual identity in `tailwind.config.ts` as semantic tokens, so
re-skinning is one file. Components reference `bg-surface`, `text-primary`,
never `bg-[#131316]`.

Define at minimum:

```
surface, surface-container, surface-container-high, surface-container-highest,
surface-container-low, surface-container-lowest,
on-surface, on-surface-variant, outline,
primary, primary-container, on-primary,
secondary, on-secondary-fixed,     // the accent that carries CTAs
error, signal-orange,              // warnings and stock alerts
off-white, background
```

Also tokenise the type scale (`font-display-lg`, `font-headline-xl`,
`font-headline-md`, `font-body-lg`, `font-body-md`, `font-label-bold`) and the
layout rhythm (`max-width`, `margin-mobile`, `margin-desktop`, `gutter`).

**`{{PALETTE}}` — supply these and change nothing else to re-skin.** Pick a dark
or light base, one accent for calls to action, one for links/secondary actions,
and a warning colour. Check contrast: body text must clear 4.5:1 against its
surface, large headings 3:1.

Keep a couple of signature flourishes defined as CSS utilities rather than
scattered inline — a clip-path section divider, a hover-lift on cards. They cost
nothing and are what stop the site looking like a template.

---

## 3. DATA MODEL

Postgres via Supabase, **Row Level Security on every table**, with the
service-role key used server-side only.

```
categories        id, slug, name, description, image_url, position
products          id, slug, name, tagline, description, price_cents,
                  compare_at_cents, category_id, attributes…, stock, status
                  (draft|active|archived), featured, is_new, badge, hero_image,
                  shipping_cents, free_shipping, colors (jsonb), created_at,
                  updated_at
profiles          id (= auth.users.id), email, full_name, role (user|admin)
orders            id, order_number (human, e.g. XX-2026-0148), user_id (nullable
                  — guests buy without an account), email, status
                  (pending|paid|fulfilled|cancelled|refunded), subtotal_cents,
                  shipping_cents, tax_cents, total_cents, currency,
                  shipping_address (jsonb), stripe_session_id, paypal_order_id,
                  paid_at, paid_via, fulfillment_stage, stage_updated_at,
                  estimated_delivery_at, tracking_number, courier,
                  origin_* (see §11), risk_*, created_at
order_items       id, order_id, product_id, name, slug, price_cents, qty,
                  image_url, color
order_events      id, order_id, stage, title, body, email_sent, created_at
                  ** UNIQUE (order_id, stage) — this is the idempotency lock **
site_settings     single row: contact details, default shipping fee, tax rate,
                  logo_url
contact_messages  id, name, email, subject, message, replied_at, created_at
announcements     id, message, href, active, starts_at, ends_at, position
articles          id, slug, title, excerpt, body, cover_url, published,
                  published_at
wishlists         user_id, product_id
```

Write migrations as **numbered, individually re-runnable SQL files**
(`0001_init.sql`, `0002_…`). Every one must be safe to run twice: `create table
if not exists`, `add column if not exists`. Never a destructive migration.

**Code must survive an unrun migration.** Any feature depending on a newer
column has to degrade rather than 500 — try the insert with the new columns, and
on error retry without them. Losing a feature is a shame; losing an order is a
lost sale.

---

## 4. STOREFRONT

- **Home**: hero at ~62vh (never full-screen — the products must peek above the
  fold), then featured products immediately, then a reason-to-believe spec
  section, then category tiles, then a community/CTA block. Two hero CTAs: one
  for the ready-to-buy visitor, one that opens the spec on the same page for the
  much larger group who are not.
- **Shop**: filters for category, a product attribute, and **price**. Price
  bands must be **derived from the live catalogue** on round numbers, never
  hard-coded — a band with nothing in it is a link to an empty grid. Show the
  count beside each. Plus a min/max box as a plain GET form so the result is a
  shareable URL that works without JavaScript. Sort by newest and by price.
- **Product page**: gallery, price with any compare-at struck through, stock
  state, delivery estimate, **colour swatches (§8)**, add-to-cart, buy-now,
  wishlist, a downloadable spec PDF (§9), and the description rendered from
  plain text with headings and bullets detected.
- **Cart**: a slide-over drawer plus a full page. Prices refresh from the live
  product record on load — never trust a stale client price.
- **Search**, **wishlist**, **account dashboard** with order history and live
  tracking, **contact form**, and policy pages (terms, privacy, returns,
  shipping/warranty).
- **Announcement stripe**: admin-authored notices scrolling left-to-right at the
  top of every page, each with its own schedule and position.

Everything is server-rendered with `unstable_cache` + tags (`catalog`,
`content`, `settings`) and `revalidateTag` on every admin write.

---

## 5. CHECKOUT

- Guest checkout, **no forced account**. An account can be created later and
  must then pick up past orders by email match.
- **Country first**, then address fields whose labels and validation adapt to
  it (`State`/`Province`/`County`, `ZIP`/`Postcode`/`Postal code`). Get the
  country from a full ISO list with the main markets pinned to the top.
- **Address autocomplete** on the street field, called through **your own server
  route** so the provider key never reaches the browser. Selecting a suggestion
  fills city, region and postcode.
- **One validation module** used by the browser form and the server route. The
  browser check is a courtesy; the server check decides. Errors return the field
  name so the form can highlight it.
- **Recompute every price server-side from the database.** The client sends
  product ids, quantities and colours — nothing else about money.
- Never offer a variant the server would reject: validate the chosen colour
  against the product's own list and refuse with a readable message.
- **Nothing between the heading and the first field.** A checkout is not a
  place to explain the business. No tagline, no "how it works" band, no trust
  badges above the form — every pixel there stands between someone and paying,
  and it costs the most on a phone. Anything genuinely useful (the delivery
  window) belongs beside the total, where it does its work at the moment of
  deciding.
- **A hint under a field has to earn its place.** "Your family or surname" under
  *Last name* is a line of noise. Keep the ones that prevent a real mistake (an
  address format, why you want a phone number) and delete the rest — make the
  field's `hint` optional so there is nothing to write.
- **Do not clear the cart on redirect to the payment provider.** Clear it on the
  confirmation page, after payment actually succeeded. Emptying a cart for a
  buyer who bounces off the payment page loses the sale.
- **Put the amount in your own copy on the hosted payment page.** The provider
  renders its own summary, but it is a side column on desktop and a collapsed
  bar on mobile — and once local-currency conversion is on, the figure in it is
  not the currency the order is denominated in. State the charge amount, with
  cents, in the custom text beside the pay button. Send no zero-value line items
  (`Tax $0.00`) — they only push the total further down.
- **A display feature must never be able to break a payment.** Anything optional
  on a session — local-currency conversion, a custom field — goes in behind a
  retry that drops it and creates the session again. Losing the nicety is a
  shame; losing the sale is not acceptable.

**Order status is owned by payment, not by the checkout.** An order is created
`pending`. Only a verified webhook, a completed capture, or an admin marks it
`paid`.

---

## 6. POST-PURCHASE — THE PART MOST SHOPS GET WRONG

### Two different numbers, never conflated
- **The delivery window quoted to the buyer**: `{{DELIVERY_MIN}}`–`{{DELIVERY_MAX}}`
  days, plus a transit allowance of up to 7 days by destination zone
  (domestic 0 / near 3 / established 5 / extended 7). One module owns this and
  every surface reads it: product pages, cart, checkout, the payment page, the
  PDF, and every email.
- **The internal stage schedule**: when each tracking email fires. Day 0
  confirmed, day 1 preparing, day 3 shipped, day 10 in transit, day 25 arriving,
  day 27 out for delivery, day 28 ready for collection. `delivered` closes the
  journey but is **not** on the schedule — a clock cannot know a parcel arrived,
  so only an admin sets it.

  Seven steps, not four, and they still land on the same final day: the extra
  ones are visibility, not delay. Four steps left a **three-week silence**
  between "shipped" and "arriving", which is precisely the window in which a
  buyer starts wondering whether the order is real. Fill it with things that are
  actually true of a crated freight shipment — on the bench, on the long leg,
  with the local courier — and say something honest about each. "There is not
  much to see at this stage, freight goes quiet between hubs" is worth more than
  silence.

  **A step with no confirmation is not a step.** Every stage on the ladder must
  email, write an event row, appear on the customer's tracker and be settable by
  hand in the admin. A stage that only moves a badge is a stage the customer
  never learns about.

Put a **deliberate buffer** in the quote and *say so* in the shipped email —
"we add a 7-day buffer so a hold-up at the courier's end doesn't become a broken
promise; most orders arrive ahead of it". Without that sentence a three-week
estimate reads as a slow shop; with it, it reads as a careful one, and the buyer
stops watching the calendar.

### The stage engine
A dependency-free module holding the schedule, the copy for each stage, and pure
functions over it. `dueStage(paidAt, now)` returns the **last** due stage, not
the next one, so an order paid 40 days ago lands on its correct stage in one
step and a cron that was down for a week does not send four emails in a minute.

### The clock
A cron endpoint the Render service hits every few minutes, protected by a shared
secret, with a CI workflow as a backup trigger. Each run: advance due orders,
record an event row per stage, email only the final one, sweep abandoned orders,
and top up product colours.

### Emails (all of them about *that* order, never generic)
1. **Order placed but unpaid** → *not* a confirmation. An abandoned-cart email
   with what they chose and a link that puts it back in their cart.
2. **Payment confirmed** → the complete receipt: order number, dates, every line
   with its colour and quantity, the money broken down, free shipping stated
   outright when it applies, the delivery address, and who to contact.
3. **Every delivery stage** → the itemised list plus tracking. One email per
   stage, exactly once, from the same copy table the tracker renders — so the
   inbox and the dashboard cannot tell two different stories.
4. **Refund initiated** → the amount, that refunds are processed by hand within
   `{{REFUND_DAYS}}` days, and that a credit not yet visible is usually the bank
   rather than the shop. From a `no-reply@` address on the same verified domain.
5. **Guest buyers** get an account-creation link in the confirmation, because
   linking to a dashboard they cannot see is worse than not linking at all.

Send directly from the app when it has its own Resend key; otherwise post the
**already-composed** subject and body to the Render service. The service must
never rewrite copy — the two paths have to say the same words.

### Abandoned-order recovery
After the first email, chase at **day 3, day 7 and day 12**, then stop. Before
every send, check whether that email address has bought anything since; if so,
stop permanently. Fail **safe** — if the check errors, skip the send. Each
reminder claims a distinct `order_events` stage, so two overlapping cron runs
cannot double-send. Never invent a discount, a deadline or a stock scare.

---

## 7. ADMIN PANEL

Gate on `profiles.role = 'admin'` in a shared `requireAdmin()`.

- **Products**: create, edit, archive; image upload with client-side compression;
  bulk import from a plain-text product sheet.
- **Orders**: list with status, stage and origin; a detail page to change payment
  status, jump the delivery stage, set tracking, and connect a guest order to an
  account by emailing a signup link.
- **The same ladder the customer sees**, on the order detail page — every step,
  not just the ones already taken, because the question being asked when someone
  opens an order is "where is this and what happens next". Add the two things
  only this side needs: whether each completed step actually **emailed** (a step
  recorded but not emailed is the signature of a failed send) and the **due
  date** of each remaining step, projected from the payment date, so "should
  this have moved by now?" needs no arithmetic.
- **Tracking**: a courier **dropdown** (~100 carriers, grouped by region, plus
  "Other — type it in") and a **Generate** button producing an internal
  reference (`XXX-2608-G625N2-C`: prefix, year+month, random body from an
  alphabet with no I/L/O/U/0/1, check character). Show the admin, before saving,
  whether the customer will get a clickable link — and only link out when the
  courier has a known tracking URL **and** the number is not one you generated.
  A link that lands on "not found" makes the customer think nothing shipped.
- **Invoices**: a PDF per order, downloadable from the order page, in two
  variants — a **proforma** (any time; states what is owed and that it is not a
  tax invoice) and a **paid invoice** (once payment clears; states method, date,
  gateway reference and a nil balance). The paid one must **refuse to render for
  an unpaid order**: a document headed "PAID IN FULL" for money nobody sent is a
  fabricated record. **Date the invoice to the day the order was placed**, not
  the day the PDF was generated — an invoice records a transaction and carries
  that transaction's date, and it makes the document deterministic, so two
  downloads can never disagree about their own date. (Keep the *payment* date
  as the real payment date: different fact, and the one that reconciles against
  the gateway.) Carry the customer's email and address, every line with its own
  arithmetic, the currency named outright, and the delivery and tracking detail
  — that last part is what makes an invoice evidence rather than a summary.
  Print no placeholder, ever.
- **Invoice identity**: trading name (DBA), registered legal entity, tax number
  and a footer note, all admin-editable because a trading name changes. Decide
  deliberately which way it propagates and say so in the UI, because both are
  defensible and the difference is invisible until somebody compares two copies:
  print the CURRENT values and every document follows a rename (including ones
  already sent), or freeze a per-order snapshot and invoices already issued
  never move. Record the snapshot either way — it costs one column and it is the
  audit trail of what the shop traded as on the day.
- **A machine-readable record on each invoice**: a QR carrying the DOCUMENT —
  seller, entity, tax number, buyer, every line, totals, payment and its gateway
  reference — not a link to it. No network round trip, nothing to go stale.
  Print the same string underneath, rendered from that one string so the two
  cannot drift. Size the code for the medium, not the layout: a whole document
  is a version-20 symbol, and squeezed into a gutter its modules fall to a third
  of a millimetre — readable on screen, gone after a photocopy. **A code too
  dense to scan is not a smaller feature, it is no feature**, so give it its own
  page if that is what it takes, and verify by decoding it off the rendered PDF
  at print resolutions rather than trusting the encoder.
- **A `/verify/<order>` page** stating checkable facts read live, with personal
  details redacted for anyone who has not proved the order is theirs. Do **not**
  print its address on the invoice: the code already carries the record, so
  there is nothing to visit, and a URL on a document is an invitation to mistype
  it. **The page must certify nothing** — no badge, no score, no "verified merchant" mark. A shop
  awarding itself one is worth nothing and reads as though it knows. The value
  is that the page and the document agree, which the reader establishes.
- **Messages** from the contact form, with replies sent by email.
- **Announcements**: create, edit, delete, schedule.
- **Settings**: contact details, shipping fee, tax rate, logo upload.
- **System status**: which env vars and migrations are live, recent orders, and a
  trust checklist (§10).

⚠️ **Anything under the admin path that is a route handler must gate itself.**
Route handlers do not run layouts, so the layout that protects every admin page
does nothing for a `route.ts` beside it — leaving a document full of customer
names, addresses and payment references served to anyone who guesses the URL.

**Every admin control must report what it did.** A save that reports "no changes"
over a write that succeeded is indistinguishable from a broken button — compare
against the stored row and name what changed.

---

## 8. PRODUCT COLOURS

The admin writes them in the product sheet, and **real sheets write them three
different ways**. Support all three or the picker will not appear on most of the
catalogue:

```
Colors: Midnight Black #101010, Voltage Blue #1e5bff, Hazard Lime   ← heading

COLOURS                                                             ← heading alone
- Midnight Black                                                       on its line
- Voltage Blue

- Available in Red, Black, White, Blue, and Purple                  ← a SENTENCE,
                                                                       mid-list
```

Parse commas, semicolons or newlines; accept the hex before, after or in
brackets; drop duplicates; the hex is optional.

**Keep ONE list of colour headings** shared by the sheet importer and the
description reader. When those two are maintained separately they drift, and a
sheet saying "Colour Options:" imports perfectly and then shows no swatches —
the colours sit in the database with nothing willing to read them. Cover both
spellings and the obvious synonyms (available colors, colors available, color
options, colour choices, colorways, frame colours, finish, finishes, shades).

**The sentence form needs guards**, because a false positive renders a sentence
fragment as a swatch on the live shop. Require the phrase ("available in",
"comes in", "offered in", "choose from"), at least two items, no item that looks
like a measurement, and at least one item containing a real colour word. Then
"Available in 48V, 60V and 72V" and "Available in the UK, Europe and North
America" both correctly yield nothing. Strip the conjunction off the last item
or the Oxford comma gives you a colour called "and Purple".

**Read colours from the description too**, for products uploaded before the
column existed. Provide an admin button that writes them onto every product in
one pass, **paging through the whole catalogue**, and that reports which
products still have none. Never overwrite a list edited by hand. Show in the
edit form when the colours on screen came from the sheet and are **not saved
yet** — prefilling silently means the admin closes the page assuming they are.

**The swatches, Amazon-style:**
- A `Colour: <name>` line above that **follows the pointer** — hovering a tile
  names it before you commit. Keyboard focus drives it too.
- Square tiles where **the tile is the border and the swatch sits inside with a
  ~3px gap**. That gap is what makes a selected tile read as selected; a ring
  drawn onto the colour looks like an edge of the colour.
- An inset hairline on every swatch, or a near-black colour on a dark card is an
  invisible button.
- No hex in the sheet → show the name in the tile, never a blank or a guess.
- **Select the first colour from the moment the page loads.** Do not block
  add-to-cart to force a choice: every unit has a colour whether or not the
  buyer thought about it, and stopping checkout over it costs sales. Do not
  label it optional either — a selected default needs no explanation. The
  server applies the same default when a line arrives with no colour (a stale
  cart, a non-browser request), and still refuses a colour the product does not
  come in: quietly substituting one would put a colour on the order the buyer
  explicitly did not ask for.

Colour is part of the **cart line identity**: the same item in two colours is two
lines, and it must reach `order_items` and every email and PDF.

---

## 9. PRODUCT SPEC PDF

Generate a downloadable A4 spec sheet per product, **with no PDF library** —
write the PDF bytes directly. It is a few hundred lines and removes a dependency
from the critical path.

- Standard-14 fonts, WinAnsi encoding; make the character folding **idempotent**
  (fold twice and an en dash must not vanish).
- The store logo at the top and as a low-opacity watermark (`ExtGState /ca`).
- Page breaks that return the new cursor rather than mutating a captured one —
  the classic bug here is text spilling below the footer because a helper
  updated a variable the caller already had by value.
- Contents: name, tagline, price, full description, the colour list, delivery
  window, and contact details.

**Say why a logo will not print.** An image decoder that returns null on failure
means the sheet silently falls back to a text watermark, and an admin who
uploads a logo, sees it in the preview (a browser reads anything) and finds it
missing from the PDF cannot tell whether the upload, the save or the file is at
fault — three different fixes, one silence. Expose a probe that uses the
writer's own decoder and names the actual problem (interlaced PNG, 16-bit with
transparency, CMYK or progressive JPEG, not a raster image), refuse the upload
at save time, and show the state of the CURRENTLY stored logo in the admin,
separating "not saved" from "saved but unreachable" (a private storage bucket)
from "downloaded but unusable".

---

## 10. BEING FOUND, AND LOOKING LEGITIMATE

A new domain scores badly on trust checkers, and the fix is real signals, not
clever ones.

**Build:**
- `Organization`/`OnlineStore` and `WebSite` JSON-LD in the root layout, and
  `Product` + `Offer` on product pages, with **the real price and the real
  stock**.
- Build the markup from the same settings the footer renders, so the name,
  address and phone can never disagree across the site.
- A **placeholder guard**: any value still holding a shipped default is *omitted*
  from structured data rather than published. A fictional address that a checker
  follows and cannot find scores **lower** than no address at all.
- `sitemap.xml` from the live catalogue, and a `Sitemap:` line in `robots.txt` —
  a brand-new domain has almost no inbound links, so this is the only way to say
  "here is everything".
- A **trust checklist in the admin** naming what is still a placeholder and why
  it matters.

**Never build:**
- `aggregateRating` or `Review` markup for reviews that do not exist. It is the
  commonest cause of a Google structured-data manual action, and the penalty
  falls on the whole domain.
- Hidden text, cloaking, or content served to crawlers but not to people.
- Markup or pages imitating a review or trust-rating service.

Each of those is detected, and the outcome is the opposite of what a new shop
needs. What actually moves the number: contact details that resolve, public
WHOIS, a claimed business profile, and real reviews collected after delivery.

---

## 11. FRAUD REVIEW, WITHOUT BLOCKING ANYONE

Record on each order what the CDN already knows about the connection — country,
region, city, network/ASN — plus **the timezone the browser reports for
itself**. That pair is the useful one: a VPN moves the IP but not the computer's
clock. It costs nothing and adds no latency; it rides along on the request.

- **Do not store the IP address.** Most sensitive field, least useful for review.
- Turn it into advisory flags: Tor, commercial VPN, datacentre connection, clock
  mismatch, shipping to another country, no location data. Show a country column
  on the order list with a badge only when something is worth a look, and a full
  panel on the order page with **every flag explained in plain English**.
- **Never refuse an order on these signals.** A corporate VPN, a privacy-minded
  customer, an expat and a traveller all trip them. Score it so no single flag
  except Tor reaches the top level — an owner who sees red on every VPN user
  stops reading badges within a week.
- **Do not IP-block countries.** It costs real customers and stops almost no
  fraud: a carder on a VPN shipping to a mule address never touches it. Card
  fraud is stopped at the payment layer — issuing-country mismatch, CVC and
  postcode checks, 3DS liability shift — all of which are dashboard settings.

---

## 12. AI CRAWLERS

Keep one list of ~45 named AI crawler tokens. Disallow every one in
`robots.txt`, and enforce it in middleware with a `403` and no page content.

- **Keep the statement readable.** Let `robots.txt` itself stay reachable to the
  crawlers being turned away, carrying a short prose statement of who the
  business is and its one real domain and support address. If nothing is
  available, an assistant asked about the shop answers from whatever a third
  party published.
- **Do not block search engines.** Block the AI-training tokens; leave the
  search crawlers. Blocking the latter removes the real shop from results and
  leaves any clones.
- **Do not block generic HTTP clients** (`curl`, `node-fetch`,
  `python-requests`, `Go-http-client`). Your own webhooks and cron arrive as
  those; blocking them stops fulfilment silently.
- Note in the docs that a user-agent rule cannot catch a scraper that lies, and
  that the CDN's own AI-crawler toggle runs earlier and costs nothing.

---

## 13. SECURITY

RLS on every table; admin writes behind `requireAdmin()`; service-role key
server-side only; webhook signature verification; sanitised search input;
rate-limited public forms with a bot-protection widget; security headers
including HSTS; secrets only ever as encrypted variables.

---

## 14. HOW TO WRITE THE CODE

These are what separate this from a generated project.

- **Comment the WHY, never the what.** `// Read fresh: money math must never be
  stale.` Not `// get settings`. Where a decision has a cost, name the cost.
- **Pure, dependency-free modules for anything worth testing.** Delivery windows,
  the stage schedule, colours, couriers, validation, price bands, risk scoring —
  each a module with no database, no framework and no environment, so the
  browser, the server and the tests all read one definition.
- **Tests describe consequences, not functions.** `test("STOPS the moment the
  buyer has bought anything")`, not `test("shouldRemind returns false")`. Say in
  the test what breaks in the real world if it fails.
- **Mutation-check the important ones.** Reintroduce the bug and confirm the test
  goes red. A test that cannot fail is decoration.
- **Fail safe, always.** A failed email must never roll back an order. An
  unreachable database must not take down the sitemap. An unknown country is
  served, not refused.
- **One definition per fact.** If a number appears in two files, one of them is
  going to be wrong later. Where two must be written separately, bind them with
  a test. This applies to *lists* too: two modules keeping their own copy of the
  same vocabulary is the same bug with a longer fuse.
- **Get a real input before widening a parser.** Ask for one actual file. Two
  rounds were spent adding heading synonyms to a parser when the real sheets had
  no heading at all — the colours were a sentence in a bullet list, and one look
  at the file would have said so.
- **Verify in a browser, not in the diff.** Render the page, take the
  screenshot, click the button. Several of the worst bugs in this codebase were
  invisible in review and obvious on screen.

---

## 15. ENVIRONMENT

**App (Cloudflare):** `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RENDER_API_URL`,
`INTERNAL_API_KEY`, `STRIPE_SECRET_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`,
`PAYPAL_ENV`, `MAPS_API_KEY` (optional), `ANALYTICS_TOKEN` (optional),
`TURNSTILE_SECRET_KEY` (optional).

**Service (Render):** `SITE_URL`, `INTERNAL_API_KEY` (same value), `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`,
`ORDERS_NOTIFICATION_EMAIL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`PAYPAL_WEBHOOK_ID`.

Write a deployment doc that assumes **no prior knowledge**: numbered steps,
exact dashboard paths, and a troubleshooting table mapping each error message to
its cause.

---

## 16. ORDER OF WORK

1. Schema, RLS, seed data, auth, admin gate.
2. Storefront: catalogue, product page, cart. Design tokens first.
3. Checkout: validation, server-side price recomputation, one payment provider.
4. Order state: paid transition, stage engine, `order_events` uniqueness.
5. Emails: receipt first, then stage emails, then abandoned recovery.
6. The clock: cron endpoint, scheduler, backup trigger.
7. Admin: orders, products, settings, messages.
8. The extras: colours, PDF sheets, announcements, wishlist, articles.
9. SEO and structured data, the sitemap, the crawler policy.
10. Fraud review fields, the trust checklist, the deployment doc.

Ship each step to production before starting the next. Full test suite,
typecheck and both builds clean every time.
