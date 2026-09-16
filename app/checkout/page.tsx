import CheckoutClient from "./CheckoutClient";
import { stripeConfigured } from "@/lib/stripe";
import { paypalConfigured } from "@/lib/paypal";
import { authorizeNetConfigured } from "@/lib/authorize-net";
import { paypalCardFieldsEnabled } from "@/lib/env";
import { checkoutNotice } from "@/lib/payment-return";

export const metadata = { title: "Checkout" };

// Must render per request: payment keys are RUNTIME Worker secrets, so a
// build-time (static) render would bake "no providers connected" forever.
export const dynamic = "force-dynamic";

// Read which payment providers are actually connected (server-side, from the
// secret env) and hand that to the client so it shows all, some, or none.
export default async function CheckoutPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ payment?: string; error?: string }>;
}) {
  const searchParams = await searchParamsPromise;

  /**
   * A buyer sent back here by a gateway WITHOUT having paid.
   *
   * All three return paths land on /checkout with a reason in the query string
   * — Authorize.Net's `?payment=failed|incomplete`, PayPal's `?error=paypal` —
   * and until now nothing read any of them: a declined card dropped the buyer
   * on a silent form with no clue what had happened or whether they had been
   * charged. Resolved server-side so the banner is in the first paint rather
   * than appearing a beat later.
   */
  const notice = checkoutNotice(searchParams);

  return (
    <CheckoutClient
      methods={{
        stripe: stripeConfigured(),
        paypal: paypalConfigured(),
        authorizenet: authorizeNetConfigured(),
      }}
      paypalCardFields={paypalConfigured() && paypalCardFieldsEnabled()}
      notice={notice}
    />
  );
}
