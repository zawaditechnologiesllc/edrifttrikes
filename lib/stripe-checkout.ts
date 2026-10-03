import type Stripe from "stripe";

/**
 * Creating a Checkout Session against an account whose configuration we do not
 * control.
 *
 * ═══ THE PROBLEM ═══════════════════════════════════════════════════════════
 *
 * A Checkout Session carries two very different kinds of parameter. There is
 * the money and the plumbing — the line items, the URLs the buyer lands on,
 * the metadata the webhook reads to mark the order paid — and there is the
 * presentation: our copy on Stripe's page, the local-currency display, the
 * statement descriptor, the shipping address attached to the charge.
 *
 * Which presentation parameters an account ACCEPTS depends on that account's
 * settings, country, and which Stripe products are switched on for it. The
 * same request that works on one account is rejected outright by the next:
 *
 *     custom_text cannot be used with Managed Payments, which is enabled by
 *     default on your account. Remove custom_text, or pass
 *     managed_payments[enabled]=false to disable it for this request.
 *
 * Stripe returns that as a 400, so the session is never created, so the buyer
 * sees "Card checkout is unavailable right now" — and the cause is a display
 * preference. An entire storefront taken down by a sentence of marketing copy.
 *
 * ═══ THE RULE ══════════════════════════════════════════════════════════════
 *
 * Presentation is negotiable. The money and the plumbing are not.
 *
 * So the first attempt asks for everything, and if the account refuses a
 * presentation parameter, this NEGOTIATES — guided by Stripe's own error,
 * which names the parameter at fault — and asks again with one less feature.
 * It never silently changes an amount, a URL, or the metadata that ties the
 * payment to the order; if an account refuses one of those, the checkout fails
 * loudly, because a payment we cannot match to an order is worse than a
 * payment that did not happen.
 *
 * Where Stripe offers a way to KEEP a feature rather than drop it — as
 * Managed Payments does with `managed_payments[enabled]=false` — that is tried
 * first. Dropping our copy is the fallback to the fallback.
 *
 * ═══ IT ONLY PAYS THE COST ONCE ════════════════════════════════════════════
 *
 * What an account accepted is remembered against the Stripe client itself, so
 * the second buyer's session is created in one call with the shape that worked
 * for the first. Hung off the client via a WeakMap rather than a key-value
 * cache on purpose: rotating the secret key builds a new client (see
 * lib/stripe.ts), and the stale knowledge goes with the old one instead of
 * being applied to a different account's.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Parameters this module may give up, cheapest loss first.
 *
 * Every one of these is something the buyer SEES or something that enriches
 * the record afterwards. Losing any of them costs polish; losing the sale
 * costs the sale. A dotted name is a nested field.
 *
 * `customer_email` is last and is a deliberate inclusion: without it Stripe
 * simply asks the buyer for their address on its own page, and our order
 * already has it. It is a convenience, not plumbing.
 */
export const DROPPABLE_PARAMS: readonly string[] = [
  "custom_text",
  "adaptive_pricing",
  "submit_type",
  "customer_creation",
  "payment_intent_data.statement_descriptor_suffix",
  "payment_intent_data.shipping",
  "payment_intent_data.description",
  "payment_intent_data.metadata",
  "payment_intent_data",
  "customer_email",
];

/**
 * Parameters that are never negotiated away.
 *
 * `metadata` is in here and it is the one people get wrong. The Stripe webhook
 * on Render reads `session.metadata.order_id` to mark the order paid — see
 * server/src/index.js — so a session created without it takes the money and
 * leaves the order sitting unpaid forever, with no automatic way to connect
 * the two. That is strictly worse than the checkout refusing to start.
 */
export const REQUIRED_PARAMS: readonly string[] = [
  "mode",
  "line_items",
  "success_url",
  "cancel_url",
  "metadata",
];

/** Keep our own copy by switching Managed Payments off for this one request. */
export const MANAGED_PAYMENTS_OFF = "managed_payments=off";

/** An adjustment is either the opt-out above or `drop:<param path>`. */
export type Adjustment = string;

export type NegotiationState = {
  /** Adjustments to apply to the next attempt. */
  applied: Adjustment[];
  /**
   * Drops we are HOLDING BACK while we try to keep the feature instead. If the
   * opt-out is itself refused, these are what we fall back to.
   */
  pending: Adjustment[];
  /**
   * Adjustments this account has REFUSED, which must never be applied again.
   *
   * Only the opt-out can land here — you cannot be refused for removing a
   * parameter — and it is what stops the one loop this negotiation can form:
   * opt-out refused → opt-out removed → Managed Payments complains again →
   * opt-out re-added, for ever.
   */
  rejected: Adjustment[];
};

/* -------------------------------------------------------------------------- */
/* Reading Stripe's error                                                      */
/* -------------------------------------------------------------------------- */

type StripeishError = {
  type?: string;
  rawType?: string;
  param?: string;
  message?: string;
  raw?: { type?: string; param?: string; message?: string };
};

const asError = (e: unknown): StripeishError => (e ?? {}) as StripeishError;

/**
 * Is this Stripe saying "your request is wrong", as opposed to a card decline,
 * a network blip or an outage?
 *
 * Only this kind is worth negotiating with. Retrying a rate limit or an API
 * error with one less feature would just make a second request fail the same
 * way while hiding what actually happened.
 */
export function isInvalidRequest(e: unknown): boolean {
  const err = asError(e);
  return (
    err.type === "StripeInvalidRequestError" ||
    err.rawType === "invalid_request_error" ||
    err.raw?.type === "invalid_request_error"
  );
}

/** The message, from wherever this particular error shape carries it. */
export function errorMessage(e: unknown): string {
  const err = asError(e);
  return String(err.message || err.raw?.message || "");
}

/**
 * Which parameters Stripe is complaining about.
 *
 * `error.param` is the reliable source and comes first, but Stripe does not
 * always set it — the Managed Payments conflict above arrives with the
 * parameter named only in the prose. So the message is mined as well, for the
 * three shapes Stripe actually uses:
 *
 *     custom_text cannot be used with Managed Payments…      (leading name)
 *     Received unknown parameter: custom_text
 *     You cannot pass `custom_text` …  /  Invalid …: custom_text
 *
 * Returns candidates, not conclusions: the caller checks each against
 * DROPPABLE_PARAMS before acting, so a wrong guess here cannot remove
 * anything it should not.
 */
export function offendingParams(e: unknown): string[] {
  const out: string[] = [];
  const push = (raw: string | undefined | null) => {
    if (!raw) return;
    // Stripe writes nested params as `payment_intent_data[shipping]`; we use
    // dots. Normalise so both spellings match DROPPABLE_PARAMS.
    const name = raw
      .trim()
      .replace(/[`'"]/g, "")
      .replace(/\]/g, "")
      .replace(/\[/g, ".");
    if (name && !out.includes(name)) out.push(name);
  };

  const err = asError(e);
  push(err.param ?? err.raw?.param);

  const message = errorMessage(e);
  // A message that opens with the parameter name, which is how the conflict
  // errors ("X cannot be used with Y", "X is not allowed when…") read.
  push(/^\s*([a-z_]+(?:\[[a-z_]+\])?)\s+(?:cannot|can't|is not|may not)\b/i.exec(message)?.[1]);
  push(/unknown parameter:?\s*([a-z_]+(?:\[[a-z_]+\])?)/i.exec(message)?.[1]);
  push(/(?:cannot pass|not allowed to pass|remove)\s+`?([a-z_]+(?:\[[a-z_]+\])?)`?/i.exec(message)?.[1]);

  return out;
}

/** Does this error point at Managed Payments as the reason? */
export function mentionsManagedPayments(e: unknown): boolean {
  return /managed[\s_]?payments/i.test(errorMessage(e));
}

/* -------------------------------------------------------------------------- */
/* Deciding what to try next                                                   */
/* -------------------------------------------------------------------------- */

/** The droppable entry a named parameter belongs to, or null. */
export function droppableFor(name: string): string | null {
  if (!name) return null;
  if (REQUIRED_PARAMS.includes(name)) return null;
  // Exact match first, then the nearest droppable ANCESTOR: Stripe may name
  // `payment_intent_data.shipping.address`, and the thing we know how to
  // remove is `payment_intent_data.shipping`.
  if (DROPPABLE_PARAMS.includes(name)) return name;
  const ancestors = DROPPABLE_PARAMS.filter((d) => name.startsWith(`${d}.`));
  if (ancestors.length > 0) {
    // The most specific ancestor, so we give up as little as possible.
    return ancestors.reduce((a, b) => (b.length > a.length ? b : a));
  }
  // A bare leaf name — Stripe sometimes reports `shipping` for
  // `payment_intent_data[shipping]`. Only accept it if exactly one droppable
  // ends that way, so an ambiguous name is never guessed at.
  const leaves = DROPPABLE_PARAMS.filter((d) => d.endsWith(`.${name}`));
  return leaves.length === 1 ? leaves[0] : null;
}

/**
 * Given the error from the last attempt, what should the next one change?
 *
 * Returns the next state, or null when there is nothing honest left to try —
 * in which case the caller re-throws and the real Stripe error reaches the
 * logs, which is the whole point of not looping blindly.
 */
export function negotiate(
  e: unknown,
  state: NegotiationState
): NegotiationState | null {
  if (!isInvalidRequest(e)) return null;

  const named = offendingParams(e);

  /*
   * Our own opt-out was refused — the account cannot disable Managed Payments
   * per request, or this API version does not know the parameter. Take it back
   * out, remember that it does not work here, and fall back to dropping what
   * it was protecting.
   *
   * `pending` is empty when the opt-out came from the LEARNED set rather than
   * from this negotiation: the account's configuration changed under us. That
   * is not a dead end — removing the parameter is itself a different request,
   * so it is retried, and `rejected` keeps the next round from adding it back.
   * Getting this wrong is how stale knowledge wedges a checkout that would
   * otherwise work.
   */
  if (
    state.applied.includes(MANAGED_PAYMENTS_OFF) &&
    named.some((n) => n === "managed_payments" || n.startsWith("managed_payments."))
  ) {
    const applied = state.applied.filter((a) => a !== MANAGED_PAYMENTS_OFF);
    return {
      applied: [...applied, ...state.pending],
      pending: [],
      rejected: [...state.rejected, MANAGED_PAYMENTS_OFF],
    };
  }

  const drops = named
    .map((n) => droppableFor(n))
    .filter((d): d is string => Boolean(d))
    .map((d) => `drop:${d}`)
    .filter((d) => !state.applied.includes(d) && !state.pending.includes(d));

  /*
   * Managed Payments names its own remedy, so take it: keep the feature and
   * switch the product off for this request. The drops we WOULD have made are
   * held in `pending` in case the opt-out is refused in turn.
   */
  if (
    mentionsManagedPayments(e) &&
    !state.applied.includes(MANAGED_PAYMENTS_OFF) &&
    !state.rejected.includes(MANAGED_PAYMENTS_OFF)
  ) {
    return {
      applied: [...state.applied, MANAGED_PAYMENTS_OFF],
      pending: [...state.pending, ...drops],
      rejected: state.rejected,
    };
  }

  if (drops.length > 0) {
    return {
      applied: [...state.applied, ...drops],
      pending: state.pending,
      rejected: state.rejected,
    };
  }

  // Stripe named nothing we are allowed to touch. Deliberately NOT walking the
  // droppable list speculatively: a genuinely bad request (a negative amount,
  // a malformed URL) would then burn ten API calls and still fail, with the
  // real error buried under nine irrelevant ones.
  return null;
}

/* -------------------------------------------------------------------------- */
/* Applying it                                                                 */
/* -------------------------------------------------------------------------- */

/** Remove a dotted path, returning a new object. Never mutates the input. */
export function omitPath<T extends Record<string, unknown>>(obj: T, path: string): T {
  const [head, ...rest] = path.split(".");
  if (!head || !(head in obj)) return obj;
  if (rest.length === 0) {
    const copy = { ...obj };
    delete copy[head];
    return copy;
  }
  const child = obj[head];
  if (!child || typeof child !== "object" || Array.isArray(child)) return obj;
  const pruned = omitPath(child as Record<string, unknown>, rest.join("."));
  /*
   * An object left with no keys is removed rather than sent empty: Stripe
   * rejects some empty hashes, and an empty `payment_intent_data: {}` carries
   * no meaning worth the risk.
   */
  if (Object.keys(pruned).length === 0) {
    const copy = { ...obj };
    delete copy[head];
    return copy;
  }
  return { ...obj, [head]: pruned };
}

/** Build the parameters for an attempt from the adjustments agreed so far. */
export function applyAdjustments<T extends Record<string, unknown>>(
  params: T,
  applied: readonly Adjustment[]
): Record<string, unknown> {
  let out: Record<string, unknown> = { ...params };
  for (const adjustment of applied) {
    if (adjustment === MANAGED_PAYMENTS_OFF) {
      out = { ...out, managed_payments: { enabled: false } };
      continue;
    }
    if (adjustment.startsWith("drop:")) {
      out = omitPath(out, adjustment.slice("drop:".length));
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* What this account turned out to accept                                      */
/* -------------------------------------------------------------------------- */

/*
 * Keyed by the Stripe client instance, so a rotated key starts over with a
 * clean slate instead of inheriting the previous account's quirks — and so no
 * key material is ever used as a cache key.
 */
const learned = new WeakMap<object, Adjustment[]>();

/** Exported for tests and diagnostics; empty until a session has been created. */
export function learnedAdjustments(stripe: object): Adjustment[] {
  return learned.get(stripe) ?? [];
}

/** Forget what we learned — for tests, and after a configuration change. */
export function forgetLearnedAdjustments(stripe: object): void {
  learned.delete(stripe);
}

/**
 * How many times we will ask. Each rung gives up exactly one feature, and the
 * ladder is DROPPABLE_PARAMS plus the Managed Payments opt-out, so this is the
 * worst case plus a little headroom — not a number to tune.
 */
const MAX_ATTEMPTS = DROPPABLE_PARAMS.length + 2;

export type SessionResult = {
  session: Stripe.Checkout.Session;
  /** The adjustments the successful attempt used. Empty means "as asked". */
  applied: Adjustment[];
  /** How many requests it took, including the one that worked. */
  attempts: number;
};

/**
 * Create a Checkout Session, negotiating with the account's configuration.
 *
 * Throws the LAST Stripe error if no honest variation is accepted, so a real
 * problem still surfaces as itself rather than as "unavailable".
 */
export async function createCheckoutSession(
  stripe: Pick<Stripe, "checkout">,
  params: Record<string, unknown>,
  log: (message: string) => void = (m) => console.warn(m)
): Promise<SessionResult> {
  let state: NegotiationState = {
    applied: [...learnedAdjustments(stripe as object)],
    pending: [],
    rejected: [],
  };
  if (state.applied.length > 0) {
    log(
      `[checkout] Stripe: reusing the shape this account accepted — ${state.applied.join(", ")}`
    );
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const body = applyAdjustments(params, state.applied);
    try {
      /*
       * Cast because `managed_payments` is not in the typings for the pinned
       * API version yet, and because the drops above make the shape dynamic.
       * The object is built from a typed literal in the caller — this is the
       * only place its type is loosened, and it is loosened on purpose.
       */
      const session = await stripe.checkout.sessions.create(
        body as unknown as Stripe.Checkout.SessionCreateParams
      );
      /*
       * Only remember a NON-EMPTY set. Caching "nothing needed" would mean
       * writing an entry on the happy path for no benefit, and the happy path
       * is already one call.
       */
      if (state.applied.length > 0) {
        learned.set(stripe as object, [...state.applied]);
        log(
          `[checkout] Stripe accepted the session after ${attempt} attempt(s) with: ` +
            `${state.applied.join(", ")} — remembered for this account`
        );
      }
      return { session, applied: [...state.applied], attempts: attempt };
    } catch (e) {
      lastError = e;
      const next = negotiate(e, state);
      if (!next) break;
      log(
        `[checkout] Stripe refused a session parameter (${errorMessage(e).slice(0, 160)}) — ` +
          `retrying with: ${next.applied.join(", ") || "no adjustments"}`
      );
      state = next;
      /*
       * A learned set that no longer works is wrong, not just unlucky — the
       * account's configuration changed. Clear it so the next checkout starts
       * from the full feature set rather than from stale knowledge.
       */
      forgetLearnedAdjustments(stripe as object);
    }
  }
  throw lastError;
}
