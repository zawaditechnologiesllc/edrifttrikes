/**
 * What the buyer is told when a payment gateway hands them back.
 *
 * ═══ THE DATABASE DECIDES, NOT THE QUERY STRING ════════════════════════════
 *
 * Every gateway returns the buyer through their own browser, so the URL is
 * theirs to edit. `confirmationView` therefore takes the ORDER'S STORED STATUS
 * as the fact and the query parameter only as a hint that refines the wording
 * of a state the database already agrees with. A hint can never promote an
 * unpaid order to "confirmed", and "confirmed" is never shown for an order the
 * database says is still pending.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This exists because Authorize.Net has a state Stripe and PayPal do not:
 * HELD FOR REVIEW. The gateway has the transaction and has not approved it, so
 * the return handler refuses to mark the order paid and sends the buyer here
 * with ?payment=review. Before this module that parameter went nowhere and the
 * page said "Order Confirmed" over an order nobody had paid for.
 *
 * DEPENDENCY-FREE: pure functions over plain data, so both pages and the tests
 * (tests/payment-return.test.ts) read from the same copy.
 */

import type { Order } from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* The confirmation page                                                       */
/* -------------------------------------------------------------------------- */

export type ConfirmationTone = "confirmed" | "pending" | "review" | "stopped";

export type ConfirmationView = {
  tone: ConfirmationTone;
  /** Name from components/Icon. */
  icon: string;
  /** Tailwind colour class for the icon and heading accent. */
  accent: string;
  title: string;
  message: string;
  /**
   * True only when the money is actually in. Gates anything that implies a
   * completed purchase — the receipt block, the delivery tracker.
   */
  settled: boolean;
};

/**
 * What the confirmation page should say for an order in `status`.
 *
 * `status` is null when the order could not be read back (the receipt lookup
 * failed, or the page was opened without an order number). That is NOT treated
 * as a failure: the Stripe redirect lands here before the webhook has always
 * landed, and telling a buyer who has just paid that something went wrong is
 * worse than the generic reassurance. It only affects the copy — nothing
 * downstream believes the order is paid on the strength of it.
 */
export function confirmationView(
  status: Order["status"] | null | undefined,
  hint?: string | null
): ConfirmationView {
  if (status === "cancelled" || status === "refunded") {
    return {
      tone: "stopped",
      icon: "error_outline",
      accent: "text-signal-orange",
      title: status === "refunded" ? "Order refunded" : "Order cancelled",
      message:
        status === "refunded"
          ? "This order has been refunded. The money is on its way back to the card or account it came from — banks usually take a few working days to show it."
          : "This order has been cancelled and nothing will ship. If that's not what you expected, contact us and we'll sort it out.",
      settled: false,
    };
  }

  if (!status || status === "paid" || status === "fulfilled") {
    return {
      tone: "confirmed",
      icon: "check_circle",
      accent: "text-secondary",
      title: "Order Confirmed",
      message:
        "The garage is on it. You can follow every step here or on your rider dashboard.",
      settled: true,
    };
  }

  // status === "pending" — the order exists, the money does not.
  if (normalizeHint(hint) === "review") {
    return {
      tone: "review",
      icon: "schedule",
      accent: "text-signal-orange",
      title: "Payment under review",
      message:
        "Your card details went through, but the payment processor is reviewing the transaction before releasing it. This is routine on larger orders and usually clears within a few hours. We'll email you the moment it does — and nothing ships, and nothing is charged twice, until it has.",
      settled: false,
    };
  }

  return {
    tone: "pending",
    icon: "schedule",
    accent: "text-signal-orange",
    title: "Payment pending",
    message:
      "Your order is saved, but we haven't seen the payment clear yet. If you have just paid, this page can run a moment ahead of the gateway — give it a minute and refresh. Nothing ships until payment clears.",
    settled: false,
  };
}

/* -------------------------------------------------------------------------- */
/* Back on the checkout page                                                   */
/* -------------------------------------------------------------------------- */

export type CheckoutNotice = { title: string; message: string };

/**
 * The banner shown when a gateway sent the buyer back WITHOUT a payment.
 *
 * Every branch says plainly that no money was taken. A buyer bounced back to a
 * silent checkout page assumes the worst — that they have been charged and the
 * order is lost — and either pays twice or files a chargeback. Both are more
 * expensive than a sentence.
 */
export function checkoutNotice(params: {
  payment?: string | null;
  error?: string | null;
}): CheckoutNotice | null {
  const payment = normalizeHint(params.payment);
  const error = normalizeHint(params.error);

  if (payment === "cancelled") {
    // Distinct from a decline, and worth its own words: the buyer chose this,
    // so the copy should not read as though something went wrong.
    return {
      title: "Payment cancelled",
      message:
        "You backed out of the payment page, so no money has been taken. Your order details are still here whenever you want to finish — or pick a different payment method below.",
    };
  }

  if (payment === "failed") {
    return {
      title: "That payment didn't go through",
      message:
        "The card was declined or the payment could not be completed, and no money has been taken. Your order details are still here — try again, or choose a different payment method below.",
    };
  }

  if (payment === "incomplete") {
    return {
      title: "We didn't get a full answer back",
      message:
        "The payment page sent us back without a complete result, so nothing has been charged. Please try again. If it happens twice, contact us before retrying and we'll check whether anything reached us.",
    };
  }

  if (error === "paypal") {
    return {
      title: "PayPal couldn't complete that payment",
      message:
        "No money has been taken. Try PayPal again, or pay by card instead — your order details are still filled in below.",
    };
  }

  return null;
}

/** Lower-cased, trimmed, and never an array from a repeated query parameter. */
function normalizeHint(value: unknown): string {
  if (Array.isArray(value)) return normalizeHint(value[0]);
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
