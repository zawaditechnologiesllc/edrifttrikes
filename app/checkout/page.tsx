import CheckoutClient from "./CheckoutClient";
import { stripeConfigured } from "@/lib/stripe";
import { paypalConfigured } from "@/lib/paypal";

export const metadata = { title: "Checkout" };

// Read which payment providers are actually connected (server-side, from the
// secret env) and hand that to the client so it shows both, one, or neither.
export default function CheckoutPage() {
  return (
    <CheckoutClient
      methods={{ stripe: stripeConfigured(), paypal: paypalConfigured() }}
    />
  );
}
