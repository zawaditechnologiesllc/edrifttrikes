import { getStripe } from "@/lib/stripe";

/**
 * What Stripe says about the connected account — the settings side of the
 * checkout problem.
 *
 * ═══ WHY THIS CANNOT JUST ANSWER THE QUESTION ══════════════════════════════
 *
 * There is no Stripe endpoint that says "here are the Checkout Session
 * parameters this account will accept". The account object carries
 * capabilities (which payment methods are live), settings (branding, card
 * payments, payouts) and a country — none of which map onto the session
 * parameters that actually get rejected. Managed Payments is the proof: it is
 * not in the SDK this repo pins AT ALL, so no amount of reading a typed
 * account object could have predicted the error it causes.
 *
 * So the authority on what an account accepts stays where it has to be: the
 * negotiation in lib/stripe-checkout.ts, which learns it from Stripe's own
 * refusals. This file is the DIAGNOSTIC — the thing that answers "what is
 * switched on over there?" when a new account behaves differently from the
 * last one.
 *
 * ═══ IT FINDS FEATURES THAT POSTDATE THIS CODE ═════════════════════════════
 *
 * The trick is to ignore the typings. Stripe returns the account as JSON and
 * the SDK hands back whatever arrived, so a feature added next year is already
 * in the response — just not in any interface. Stripe models its feature
 * toggles consistently as `{ enabled: boolean }`, so walking the response for
 * that shape surfaces tomorrow's flags, by name, without a code change. That
 * is how an owner would have SEEN Managed Payments switched on, rather than
 * discovering it from a 400.
 *
 * ⚠️ NOTHING PERSONAL LEAVES THIS FUNCTION. An account object carries the
 * business owner's name, email, address, date of birth and bank details. Only
 * booleans, capability statuses and FIELD NAMES are reported — never a value
 * that could be personal data. A test holds this: it feeds in a full account
 * object stuffed with personal details and asserts none of it survives.
 */

export type StripeAccountSummary = {
  /** False when the account could not be read at all. */
  ok: boolean;
  /** Why, when it could not. Never the key. */
  error?: string;
  country?: string;
  defaultCurrency?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  /** Capability name → status ("active", "pending", "inactive"). */
  capabilities?: Record<string, string>;
  /**
   * Every `{ enabled: boolean }` toggle found anywhere in the account, by
   * dotted path. This is where a feature like Managed Payments shows up.
   */
  featureFlags?: Record<string, boolean>;
  /** Top-level field names the account carried, for spotting anything new. */
  fields?: string[];
};

/** Keys whose VALUES are safe to report: scalars that cannot be personal data. */
const SAFE_SCALARS = [
  "country",
  "default_currency",
  "charges_enabled",
  "payouts_enabled",
  "details_submitted",
] as const;

const isObject = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

/**
 * Walk the account for `{ enabled: boolean }` toggles.
 *
 * Bounded in depth so a deeply nested or self-referential response cannot run
 * away, and it records the PATH rather than the surrounding object, so nothing
 * travelling beside a flag can come with it.
 */
function collectFlags(
  node: unknown,
  path: string,
  out: Record<string, boolean>,
  depth = 0
): void {
  if (depth > 4 || !isObject(node)) return;
  if (typeof node.enabled === "boolean") {
    out[path || "enabled"] = node.enabled;
  }
  for (const [key, value] of Object.entries(node)) {
    // Never descend into the branches that hold people: the owner's identity,
    // the company's filings, the bank accounts.
    if (["individual", "company", "external_accounts", "tos_acceptance", "business_profile", "requirements", "future_requirements"].includes(key)) {
      continue;
    }
    if (isObject(value)) collectFlags(value, path ? `${path}.${key}` : key, out, depth + 1);
  }
}

/**
 * Reduce a raw account object to the safe summary. Pure — exported for tests,
 * which is the only way to prove the redaction holds.
 */
export function summarizeAccount(raw: unknown): StripeAccountSummary {
  if (!isObject(raw)) return { ok: false, error: "no account object" };

  const summary: StripeAccountSummary = { ok: true };

  for (const key of SAFE_SCALARS) {
    const value = raw[key];
    if (typeof value === "string") {
      if (key === "country") summary.country = value;
      if (key === "default_currency") summary.defaultCurrency = value.toUpperCase();
    }
    if (typeof value === "boolean") {
      if (key === "charges_enabled") summary.chargesEnabled = value;
      if (key === "payouts_enabled") summary.payoutsEnabled = value;
      if (key === "details_submitted") summary.detailsSubmitted = value;
    }
  }

  if (isObject(raw.capabilities)) {
    const caps: Record<string, string> = {};
    for (const [name, status] of Object.entries(raw.capabilities)) {
      if (typeof status === "string") caps[name] = status;
    }
    if (Object.keys(caps).length > 0) summary.capabilities = caps;
  }

  const flags: Record<string, boolean> = {};
  collectFlags(raw, "", flags, 0);
  if (Object.keys(flags).length > 0) summary.featureFlags = flags;

  // Names only. A field we have never heard of is the interesting one, and its
  // name is the whole signal.
  summary.fields = Object.keys(raw).sort();

  return summary;
}

/**
 * Read the connected account. NEVER THROWS — this is a diagnostic, and a
 * diagnostic that can break the page it is on is worse than no diagnostic.
 */
export async function describeStripeAccount(): Promise<StripeAccountSummary> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "no Stripe secret key configured" };
  try {
    const account = await stripe.accounts.retrieve();
    return summarizeAccount(account as unknown);
  } catch (e) {
    return {
      ok: false,
      error: String((e as Error)?.message || e).slice(0, 200),
    };
  }
}
