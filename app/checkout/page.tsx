import CheckoutClient from "./CheckoutClient";
import { stripeConfigured } from "@/lib/stripe";
import { paypalConfigured } from "@/lib/paypal";
import { paypalCardFieldsEnabled } from "@/lib/env";

export const metadata = { title: "Checkout" };

// Must render per request: payment keys are RUNTIME Worker secrets, so a
// build-time (static) render would bake "no providers connected" forever.
export const dynamic = "force-dynamic";

// Read which payment providers are actually connected (server-side, from the
// secret env) and hand that to the client so it shows both, one, or neither.
export default function CheckoutPage() {
  return (
    <CheckoutClient
      methods={{ stripe: stripeConfigured(), paypal: paypalConfigured() }}
      paypalCardFields={paypalConfigured() && paypalCardFieldsEnabled()}
    />
  );
}
