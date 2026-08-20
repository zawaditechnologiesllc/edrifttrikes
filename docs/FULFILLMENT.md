# Orders, tracking & the support inbox

Every paid order walks a fixed timeline. The customer is emailed at each step
and can watch the same timeline live on their dashboard.

## The schedule

| Day after payment | Stage | Email subject | What the customer is told |
| --- | --- | --- | --- |
| **0** | `confirmed` | Order confirmed — preparing your shipment | Payment cleared; the crew is preparing the build. Quotes the delivery date. |
| **3** | `shipped` | Your order has shipped | Left the garage, now with the shipping partner. Quotes the delivery date. |
| **25** | `arriving` | Shipping complete — your package is arriving | Shipping complete, reached the destination hub. **Quotes the date they'll receive it.** |
| **28** | `ready_for_collection` | Your package is ready for collection | *"Your package is ready for collection. Kindly wait for a courier email or call to collect, or to confirm door delivery."* |

Two stages exist outside the schedule and are admin-only: `delivered` and
`cancelled`. The scheduler never touches an order in either.

**All of this lives in one file: [`lib/fulfillment.ts`](../lib/fulfillment.ts).**
Change a number in `FULFILLMENT_SCHEDULE` or a sentence in `STAGE_COPY` and the
scheduler, the emails, the admin panel and the customer tracker all follow. Do
not hardcode a day count or a message anywhere else.

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

## Admin controls

`/admin/orders/<id>` gives you, in one save:

- **Payment status** — setting it to `paid` runs the same transition a webhook
  would (starts the schedule, emails the customer).
- **Delivery stage** — jump an order forward ahead of schedule.
- **Tracking number + courier** — saved before any stage email, so the email
  carries them.
- **"Email the customer about a stage change"** — untick to correct a mistaken
  stage silently.

Every save reports either what changed or the exact reason it failed.

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
   and stage in ('shipped', 'arriving', 'ready_for_collection');
```

Then trigger a sweep:

```bash
curl -X POST https://<render-url>/orders/advance -H "x-internal-key: $INTERNAL_API_KEY"
```

The response reports what moved. Use a test order and your own email address.
