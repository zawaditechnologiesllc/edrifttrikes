# Orders, tracking & the support inbox

Every paid order walks a fixed timeline. The customer is emailed at each step
and can watch the same timeline live on their dashboard.

## The schedule

| Day after payment | Stage | Email subject | What the customer is told |
| --- | --- | --- | --- |
| **0** | `confirmed` | Order confirmed — preparing your shipment | Payment cleared; the crew is preparing the build. Quotes the delivery date. |
| **1** | `preparing` | Your order is being prepared | On the bench: assembly, pre-dispatch checks, crating. Quotes the delivery date. |
| **3** | `shipped` | Your order has shipped | Left the garage, now with the shipping partner. Quotes the delivery date, and explains the 7-day buffer in it. |
| **10** | `in_transit` | Your order is on its way | Left the origin facility, on the long leg. Says freight goes quiet between hubs, so the silence is expected. Quotes the delivery date. |
| **25** | `arriving` | Shipping complete — your package is arriving | Shipping complete, reached the destination hub. **Quotes the date they'll receive it.** |
| **27** | `out_for_delivery` | Out for delivery | With the local courier. Someone has to receive it — it is crated and cannot go through a door; otherwise it goes to the depot. |
| **28** | `ready_for_collection` | Your package is ready for collection | *"Your package is ready for collection. Kindly wait for a courier email or call to collect, or to confirm door delivery."* |

`delivered` closes the journey. It is on the customer's tracker as the final
rung but **not** on the schedule: a clock has no way of knowing a parcel
arrived, so only an admin (or a courier confirmation) sets it. `cancelled` is
the other admin-only stage. The scheduler never touches an order in either.

### Why seven steps and not four

The schedule used to be four: confirmed, shipped, arriving, ready. It ended on
the same day it does now — day 28 — but it said **nothing at all between day 3
and day 25**. Three silent weeks is the window in which a buyer starts
wondering whether the order exists, and support tickets are cheaper to prevent
than to answer. `preparing`, `in_transit` and `out_for_delivery` fill that gap
with things that are actually true of a crated freight shipment; they add
visibility, not delay.

Each of them is a full stage, not a decoration: it is emailed, it is written to
`order_events`, it appears on the customer's tracker, and an admin can set it by
hand. There is no such thing as a silent step here — see
`tests/order-journey.test.ts`, which walks a simulated order through all
twenty-eight days and asserts one email per stage, in order, with no duplicates.

**All of this lives in one file: [`lib/fulfillment.ts`](../lib/fulfillment.ts).**
Change a number in `FULFILLMENT_SCHEDULE` or a sentence in `STAGE_COPY` and the
scheduler, the emails, the admin panel and the customer tracker all follow. Do
not hardcode a day count or a message anywhere else.

## What the emails contain

**The payment-confirmed email is a complete receipt** — the document a customer
keeps. It has to answer, months later and without them logging in: what did I
buy, what did I pay, where is it going, and who do I chase. So it carries the
order number, the date placed, the date paid, the estimated delivery, every
line item, subtotal / shipping / tax / total, the
full delivery address, and the support address to quote the order number to.

**An unpaid order gets a cart-recovery email, not a confirmation.** An order
row is created the moment the checkout form is submitted — before any money has
moved, and before an admin has accepted it. Confirming an order at that point
confirms one the buyer may never pay for. So checkout sends
`sendAbandonedCartEmail` instead: the same receipt block, headed "we haven't
received payment for it yet — nothing has been charged and nothing has
shipped", with a link back to the cart. It comes from `no-reply@` with replies
routed to support, and it is the same message that alerts the store owner that
an order is sitting unpaid and waiting for them to mark it.

Later stage emails (shipped, arriving, ready for collection) are short status
updates and deliberately do not repeat the receipt.

**Guest buyers get an account invite in that same email.** When payment clears
on an order with no account behind it, `markOrderPaid` resolves the account
question BEFORE sending — linking the order if an account already exists for
that address, or generating a Supabase invite link if not. The link goes in the
confirmation itself rather than a second email, because that is the message a
buyer actually opens, and it replaces a "Track your order" button that would
otherwise point at an empty dashboard.

Following the link signs them in and confirms their address, which is exactly
what attaches the order (see the guest-order section below). Until they accept,
the order is untouched.

## The two emails at purchase time

These are deliberately separate:

1. **Order received** — sent the instant the buyer submits checkout, *before*
   they are redirected to Stripe or PayPal. A buyer who closes the tab
   mid-payment still has their order number.
2. **Order confirmed** (the `confirmed` stage above) — sent when payment
   actually clears. This is the shipping confirmation.

## How an order gets marked paid

Every route funnels into one function, `markOrderPaid()` in
[`lib/orders.ts`](../lib/orders.ts):

```
Stripe webhook (Render)  →  POST /api/internal/order-paid  →  markOrderPaid()
PayPal capture (app)     →                                    markOrderPaid()
PayPal webhook (Render)  →  POST /api/internal/order-paid  →  markOrderPaid()
Admin sets status = paid →                                    markOrderPaid()
```

It stamps `paid_at` (the anchor every later stage counts from), sets the
`confirmed` stage, stores the quoted delivery date, and sends the shipping
confirmation.

The Stripe webhook has to stay on Render because verifying a Stripe signature
needs the raw request body — but it no longer owns any order logic, it just
proves the payment is real and calls the app.

## Idempotency — why nobody gets emailed twice

Every stage transition inserts a row into `order_events`, which is
`UNIQUE (order_id, stage)`. Claiming a stage *is* the insert, and only the
caller that wins the insert sends the email.

That single constraint is what makes all of this safe:

- Stripe retries a webhook → second insert collides → no second email.
- The PayPal webhook and the synchronous capture both fire → one wins.
- Two cron runs overlap → one wins.
- An admin double-clicks Update → one wins.

There is no locking and no application-level dedupe to get wrong.

## The scheduler

**Primary:** the Render service runs `node-cron` hourly (`FULFILLMENT_CRON`,
default `0 * * * *`) and POSTs to the app's `/api/cron/orders`. The work lives
in the app because that is where the schedule, the templates and the database
access already are; Render just owns the clock, because it is the always-on
process.

**Backup:** `.github/workflows/fulfillment-cron.yml` hits the same endpoint
every 6 hours, so orders keep moving when Render is asleep, redeploying, or its
cron has quietly stopped. Running both is harmless — see idempotency above.

**Manual:** `POST /orders/advance` on Render (internal key required) runs a
sweep immediately, which is how you test the journey without waiting.

The endpoint processes at most 25 orders per call — Workers have a per-request
CPU budget — and returns `remaining: true` when more is queued. Both callers
loop until it drains.

### Catching up after an outage

`dueStage()` returns the *furthest* stage an order is due for, not the next one.
If the scheduler is down for three weeks, orders jump straight to where they
actually belong. Skipped stages are still written to the timeline so the
customer's history is complete, but **only the stage they land on sends an
email** — nobody gets four emails in one minute.

## Required configuration

| Where | Variable | Why |
| --- | --- | --- |
| Cloudflare | `INTERNAL_API_KEY` | Authenticates the scheduler and the paid-transition endpoint |
| Cloudflare | `NEXT_PUBLIC_SITE_URL` | Links in the emails |
| Render | `SITE_URL` | Where the scheduler POSTs |
| Render | `INTERNAL_API_KEY` | Same value as Cloudflare |
| Render | `FULFILLMENT_CRON` | Optional; defaults to hourly |
| GitHub | Variable `SITE_URL`, secret `INTERNAL_API_KEY` | Backup scheduler (skipped if unset) |

Render must be on a plan that doesn't sleep (`starter` or above) for the primary
scheduler to be reliable. On the free plan, the keep-warm workflow and the
GitHub backup scheduler are what keep orders moving.

Run **`supabase/migrations/0006_fulfillment_tracking.sql`** and
**`0007_paid_source_and_replies.sql`** before deploying.
Until it runs, the tracker degrades to the plain order list and the scheduler
returns an error telling you exactly which file to run. The migration also
backfills existing paid orders onto the right stage and marks their past stages
as already-emailed, so switching this on does not blast old customers.

## Paid orders view

`/admin/orders/paid` shows every order money has actually been received for.
It's separate from the main orders list because that list includes abandoned
`pending` rows, which makes it useless for answering "what have we taken?".

Each row carries a **source badge** read from `orders.paid_via`, recorded by
`markOrderPaid()`:

| Badge | Set by |
| --- | --- |
| Stripe | The Stripe webhook on Render, after signature verification |
| PayPal | The PayPal capture in the app, or the PayPal webhook on Render |
| Manual | An admin flipping the status to `paid` in the dashboard |
| Unknown | Orders paid before migration 0007 ran that couldn't be inferred |

Manual is deliberately the odd one out visually: it's the row that didn't come
from a gateway, so it's the one worth a second look when reconciling takings.
Migration 0007 backfills existing orders by inspecting `stripe_session_id`
(`cs_…` means Stripe; anything else non-empty means PayPal).

`fulfilled` orders count as paid — they're paid orders that have since been
delivered, and excluding them would understate revenue.

## Support inbox

`/admin/messages` is the contact form's inbox. Replying emails the customer via
Resend with their original message quoted underneath.

**The message row is written by the app** (`lib/actions/contact.ts`) at
submission time, before the notification email is sent. That ordering is
deliberate: if the mail provider is down you still have the message. Previously
only the Render `/contact` endpoint persisted, which meant that on the primary
direct-Resend path *nothing was ever stored* and this inbox would have been
permanently empty. Render's endpoint no longer inserts, so messages aren't
doubled on the fallback path.

A reply is emailed **before** the message is marked replied — if Resend rejects
it, the message stays flagged unanswered rather than being filed away with a
reply the customer never got. If the email sends but the record fails to save,
the admin is told exactly that, so nobody sends it twice.

The nav badge and the overview tile both count `handled = false`.

## Guest orders on the rider dashboard

Buyers check out without an account, so those orders are stored with
`user_id = NULL`. When the same person registers later, their history follows
them — matched on the email they checked out with.

Two mechanisms, deliberately overlapping:

1. **RLS** lets a signed-in user read an unclaimed order placed with their
   email, so the dashboard is right even if the claim below hasn't run.
2. **`claimGuestOrders()`** (`lib/orders.ts`) sets `user_id` on those rows,
   making the link permanent rather than re-derived on every request. It runs
   on every dashboard load and is idempotent — a claimed row has a non-null
   `user_id` and is skipped, so the steady-state cost is one indexed read.

Migration 0010 also backfills: anyone who bought as a guest and registered
*before* it ran sees their history on their next visit.

Order status keeps updating exactly as before — the scheduler selects on status
and stage, not on who owns the row, so linking an order changes nothing about
its journey.

### When the link happens

Four points, so a customer's history is theirs before they reach any page:

| Trigger | Covers |
| --- | --- |
| **Database trigger** (`on_auth_user_confirmed`, migration 0011) | The instant Supabase stamps `email_confirmed_at` — confirmation, an accepted invite, a changed address. No app code involved, so no route can forget. |
| `/auth/callback` | Email confirmation, magic links, accepted invites — attaches before the redirect, so the dashboard is right on arrival. |
| Sign-in and sign-up | A session beginning without the address newly changing. |
| Dashboard load | The safety net, and what keeps things correct on a database where the trigger could not be installed. |

The database trigger is the real guarantee; the app-side calls are belt and
braces. All of them are idempotent and cost one indexed read when there is
nothing to claim.

**The one case none of this can cover** is a customer who checked out with a
different address than they registered with — there is nothing to match on. The
empty dashboard says so plainly, names the address being matched, and points
them at support, rather than leaving them to conclude their order vanished.

### ⚠️ The security gate

The match is gated on the account's email being **confirmed**
(`verifiedUserEmail` in [`lib/account.ts`](../lib/account.ts), and
`public.current_user_email()` in the database). Without that gate, anyone could
register with a stranger's email and immediately read their name, full shipping
address, phone number and purchases.

**That gate is only as strong as your Supabase setting.** With
Authentication → Providers → Email → "Confirm email" turned **off**, Supabase
stamps `email_confirmed_at` at signup and the check passes for anybody. Keep
email confirmation on.

### Connecting a guest order by hand

`/admin/orders/<id>` shows an **Account** panel: who owns the order, or a
**Connect order to customer** button when nobody does. What that button does
depends on what it finds:

- **An account already exists for the order's email** → the order is linked to
  it immediately. No email is sent, because there is nothing to invite them to.
- **No account** → a Supabase invite link is generated and emailed. Following it
  signs the customer in and confirms their address, which is exactly what lets
  the order attach itself.

The order is **not** modified in the invite case. It stays a guest order until
the customer actually accepts, so an unaccepted invite leaves no trace of a
relationship that does not exist yet.

If the invite email fails to send, the link is still valid — the admin panel
shows it so it can be passed on by hand rather than lost.

The orders list marks every row **Linked** or **Guest**, so it is obvious at a
glance which customers can see their own tracking.

## The guest receipt

`/order-confirmation` is reachable by someone who has just paid and is, by
definition, not signed in. It tries RLS first, which returns the complete order
to its rightful owner; only if that finds nothing does it fall back to a
privileged read keyed on the order number — and **that copy is redacted**: the
email is masked and the shipping address removed.

The order number is 8 random hex characters (~4.3 billion), so enumeration is
impractical. The redaction means that even a lucky guess yields no name,
address or contact details — only what was bought and where it has got to.

## Confirming an order by hand

Setting the payment status to **paid**, or moving the delivery stage to
**Confirmed**, sends the customer the full receipt and hands the order to the
scheduler, which takes it the rest of the way on its own.

Two things make that reliable, and both were previously broken:

**An admin's click always emails.** The stage-claim rule (`UNIQUE (order_id,
stage)`) exists to stop webhook retries and overlapping cron runs
double-emailing. It was also swallowing deliberate admin actions: re-confirming
an order whose `confirmed` event already existed sent nothing at all. Automated
paths still claim-once; the admin path sends whenever "email the customer" is
ticked.

**The schedule gets an anchor.** Every later stage counts from `paid_at`. Moving
an order forward by hand without one left it frozen — the change stuck, but
nothing ever advanced it again. `setOrderStage` now back-dates `paid_at` to when
that stage would have fallen due, so the remaining stages land on the correct
days rather than all at once.

The scheduler only advances orders whose status is `paid`. If a stage is set on
an order that isn't, the admin panel says so rather than leaving it silently
stranded.

## What each email actually says

Every stage email is about **that customer's specific order**, not a generic
status ping:

- The **payment-confirmed** email carries the complete receipt.
- **Shipped, arriving and ready-for-collection** carry an itemised "In this
  shipment" block — enough that the message is unmistakably about their
  purchase, without repeating the whole document four times.
- **Free shipping is stated outright** ("Shipping FREE" plus "Free shipping
  applied to this order — you paid nothing for delivery"). A bare zero reads
  like a missing value, and it is a benefit worth naming.
- The estimated delivery date appears exactly once — most stage messages
  interpolate it themselves, so the standalone line only renders where the copy
  doesn't already carry it.
- The **shipped** email explains *why* the date is so far out: the quote carries
  a 7-day buffer (`DELIVERY_BUFFER_DAYS` in `lib/delivery.ts`) so a hold-up at
  the courier's end doesn't become a broken promise, and most orders land ahead
  of it. Without that sentence a three-week estimate reads as the store being
  slow; with it, it reads as the store being careful — and the customer stops
  watching the calendar. The wording lives in `STAGE_COPY.shipped`, so the
  dashboard tracker says the same thing, and a test binds it to the constant.

## Admin controls

`/admin/orders/<id>` gives you, in one save:

- **Payment status** — setting it to `paid` runs the same transition a webhook
  would (starts the schedule, emails the customer).
- **Delivery stage** — jump an order forward ahead of schedule.
- **Tracking number + courier** — saved before any stage email, so the email
  carries them. See *Tracking numbers and couriers* below.
- **"Email the customer about a stage change"** — untick to correct a mistaken
  stage silently.

Every save reports either what changed or the exact reason it failed — including
tracking-only saves, which used to report "No changes to save." over a write
that had in fact succeeded.

## Tracking numbers and couriers

**The courier is a dropdown**, grouped by region, with ~98 carriers in it
(`lib/couriers.ts`). Anything not on it goes in **Other — type it in**, and an
order saved before the dropdown existed keeps whatever it had, in that box.

**Generate** puts an internal reference in the tracking field:

```
EDT-2608-G625N2-C
 |    |     |    └── check character — catches a single mistyped character
 |    |     └─────── random, from an alphabet with no I, L, O, U, 0 or 1
 |    └───────────── year and month, so a stale reference is obvious
 └────────────────── the store's own prefix
```

> **A generated reference is ours, not the courier's.** Nothing is registered
> with anyone — it is a handle for a shipment, and the customer's own tracker
> follows it. When the courier gives you their number, paste it over the top.

**Whether the customer gets a link is decided for you.** The email links the
tracking number straight to the courier's tracking page when — and only when —
both of these hold:

1. the courier is one we hold a tracking URL for (the big carriers; the rest are
   in the list without one), **and**
2. the number is not one of ours.

Otherwise the number goes out as plain text. That rule exists because a link
that lands on "not found" is worse than no link: the customer concludes nothing
shipped, and emails support. The admin form shows you which of the three cases
you are in *before* you save.

Adding a courier is a one-line change to `COURIER_GROUPS` — a name, and a
`trackingUrl` with `{n}` where the number goes, if you have one you trust.

## Testing the journey without waiting 28 days

The cleanest way is to move `paid_at` backwards and let the scheduler do the
rest — this exercises the real code path, emails included:

```sql
-- Pretend this order was paid 25 days ago, then run a sweep.
update public.orders
   set paid_at = now() - interval '25 days'
 where order_number = 'EDT-XXXXXXXX';

-- Let it re-send stages you want to see again.
delete from public.order_events
 where order_id = (select id from public.orders where order_number = 'EDT-XXXXXXXX')
   and stage in ('preparing', 'shipped', 'in_transit', 'arriving',
                  'out_for_delivery', 'ready_for_collection');
```

Then trigger a sweep:

```bash
curl -X POST https://<render-url>/orders/advance -H "x-internal-key: $INTERNAL_API_KEY"
```

The response reports what moved. Use a test order and your own email address.

## Who marks an order paid

**An admin does.** `paid` is the switch that starts everything: it sets
`paid_at`, computes the delivery date from the buyer's own window
(`lib/delivery.ts`), moves the order to `confirmed`, and sends the receipt.
Until then the order sits `pending` and the buyer has only the cart-recovery
email.

From that moment the cron takes over and no further admin action is needed. It
advances the order through `preparing` (day 1), `shipped` (day 3),
`in_transit` (day 10), `arriving` (day 25), `out_for_delivery` (day 27) and
`ready_for_collection` (day 28), emailing at each step. Every one of those
writes `fulfillment_stage` on the order row, which is the single column both the
admin order list and the rider dashboard render from — so a stage the cron sets
overnight is visible in both places on the next page load, with no separate
sync.

Payment webhooks (Stripe, PayPal) also mark an order paid when a provider
confirms a capture, through the same `markOrderPaid` path. That is deliberate:
an order that has been genuinely paid for must not sit `pending` because nobody
was at a desk. If you want payment to be admin-only, disable the webhooks in the
provider dashboards rather than in code — the code path is the one that keeps
paid orders and captured money in agreement.

## No duty, customs or import charges anywhere

The store used to disclose an estimated 13.5% import duty in the cart, at
checkout, on Stripe's payment page, on the receipt, in the confirmation email
and in the PDF product sheet. It read as an unquantified surcharge and cost
sales, so it was removed completely — `computeDuty` and `DEFAULT_DUTY_RATE_BPS`
no longer exist.

Tests assert the absence, not just the presence of what replaced it:
`computeCartTotals` must return exactly `subtotal`, `shipping`, `tax` and
`total`; and the Stripe copy, the PDF sheet and the cart-recovery email are each
checked against `/duty|customs|import charge|tariff/i`. A stray extra key in the
totals would otherwise surface as a line on every surface at once.

## Chasing orders that were never paid for

An unpaid order is the most convertible audience the store has: someone who
wanted the thing and stopped. The sequence, counted from when the order was
created:

| Day | What happens |
| --- | --- |
| 0 | The checkout API sends the first email — the receipt, and a link back |
| 3 | A nudge |
| 7 | A firmer one |
| 12 | The last. Nothing after this, ever |

The schedule and all three pieces of copy live in `lib/abandoned.ts`;
`sweepAbandonedOrders()` in `lib/orders.ts` runs it, from the same hourly cron
that advances paid orders.

**It stops the moment there is any reason to.** Paid, fulfilled, cancelled or
refunded ends it — mailing "you left something behind" about an order the store
itself cancelled reads as incompetence. So does chasing someone who has since
bought: the check looks at **every** order for that email address, not just this
one, and matches on the email rather than the account because most abandoned
orders are guests. If that check errors it fails **safe** and skips the send — a
missed reminder costs a maybe, a reminder to a paying customer costs their
confidence in the shop.

**Send-once survives overlapping cron runs** the same way the delivery schedule
does: each reminder inserts an `order_events` row keyed `abandoned_<step>`, and
the UNIQUE `(order_id, stage)` constraint means exactly one racer wins. There is
no migration for this — the column is plain text and the admin timeline renders
each row's title, so a reminder shows up there as "Unpaid-order reminder sent
(day 7)".

**A late sweep sends one email, not three.** If the cron is down for a week,
`dueReminder` returns the furthest due step and the skipped ones are claimed
silently — so a recovered scheduler can never work backwards and send a day-3
note after the day-12 one.

**Switching it on is safe.** The sweep only looks back `ABANDONED_WINDOW_DAYS`
(14). Every pending order older than that is left alone rather than mailed out
of the blue, which matters on a database that has been accumulating unpaid
orders for months.

### The link carries what they were buying

Every one of these emails links to `/cart?recover=<order id>`, which puts that
order's exact items, colours and quantities back in the cart
(`components/cart/CartRecovery.tsx` + `/api/cart/recover`). A bare link to the
shop would ask them to find the trike again — the work that made them give up.

It is **additive**: anything already in the cart stays, and a line already there
is not re-added, so a live cart is never destroyed to restore a stale one.

The order ID is the capability — a random UUID that appears nowhere public. The
short, guessable order *number* is deliberately not accepted, the response
carries line items only (never the email, address or totals), and the link stops
working once the order is paid.

## Where an order came from

Every order now records what the Cloudflare edge already knew about the
connection that placed it — and what the buyer's own browser said about itself.
It shows as a country column on `/admin/orders` and a full panel on the order
page.

**It costs nothing and slows nothing down.** Cloudflare resolves all of this
before the Worker runs; it rides along on the request. No lookup, no third-party
API, no added latency.

**No IP address is stored.** It is the most sensitive field available and the
least useful for review — country, city and network answer "does this add up?"
without the store holding an identifier it would then have to protect, disclose
and delete on request. (Migration `0015_order_origin.sql`.)

### The signals

| Flag | What it means |
|---|---|
| **Tor exit node** | `cf-ipcountry` came back `T1`. Real location unknowable. |
| **Commercial VPN** | The network belongs to a company that sells VPN access. |
| **Datacentre connection** | A hosting or cloud provider, not a home or mobile ISP. |
| **Clock doesn't match the IP** | The browser's own timezone disagrees with the one the IP resolves to. **The strongest single hint here** — a VPN moves the IP but not the computer's clock. |
| **Browsing from another country** | Connecting from one country, shipping to another. |
| **No location data** | The edge could not place the connection at all. |

Scores add up to `clear` / `check` / `review`. **No single flag except Tor
reaches the top level on its own** — one fact about a connection is never a
fraud case, and an owner who sees a red badge on every VPN user stops reading
badges inside a week.

### ⚠️ What this is not

> **It does not detect VPNs, and nothing does reliably.** It detects connections
> that don't look residential, and facts that contradict each other. A
> **residential proxy** — the kind card fraudsters actually buy, routing through
> a compromised home router in the victim's own city — looks exactly like a
> customer and passes every check here.
>
> So it is a **review tool, not a gate**. Nothing in the app refuses an order on
> these signals and nothing should: a corporate VPN, a privacy-minded customer,
> an expat and a business traveller all trip them, and every one is a real sale.
> The control that actually stops a stolen card is at the payment layer — see
> [`PAYMENTS.md` §7](./PAYMENTS.md).

Every flag in the admin panel is printed with a plain-English caveat for exactly
this reason; a flag without one becomes an excuse to cancel a real order.

## Colours fill themselves in

The same cron pass runs `syncProductColors()`: any product whose `colors` is
empty but whose description names colours gets them written onto the row.

`productColorOptions()` already falls back to the description at read time, so
the picker appears either way — this makes it permanent, which means the admin
sees and can edit the colours in the product form. It only ever touches products
with no colours set, so it can never overwrite an admin's choice, and it
revalidates the catalog cache when it writes anything.
