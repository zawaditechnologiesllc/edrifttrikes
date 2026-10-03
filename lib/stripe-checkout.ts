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
 * ═══ THE LIST IS A PREFERENCE, NOT A LIMIT ═════════════════════════════════
 *
 * The first version of this file could only give up a parameter whose name it
 * knew. That is the wrong way round, and Managed Payments is the proof: it
 * shipped AFTER the Stripe SDK this repo pins, so a list written from today's
 * API cannot contain tomorrow's conflict. The next feature Stripe switches on
 * by default would have taken the checkout down exactly as this one did.
 *
 * So the rule is inverted. PROTECTED_PARAMS below is a short, closed list of
 * what may never be given up, and EVERYTHING ELSE we send is negotiable —
 * including parameters that do not exist yet, ours or Stripe's.
 *
 * This list only sets the ORDER of sacrifice: cheapest loss first, so an
 * account that objects to several things loses the least important one first.
 * A parameter missing from here is still droppable; it just has no stated
 * preference. A dotted name is a nested field.
 *
 * `customer_email` is near the end and is a deliberate inclusion: without it
 * Stripe simply asks the buyer for their address on its own page, and our
 * order already has it. It is a convenience, not plumbing.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const DROP_ORDER: readonly string[] = [
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

/** Kept as the old name so existing callers and tests do not have to change. */
export const DROPPABLE_PARAMS = DROP_ORDER;

/**
 * The only parameters that are never negotiated away — the whole protected
 * core, and the reason the open-world rule above is safe.
 *
 * A path here protects its descendants too: naming `line_items` protects
 * `line_items[0][price_data][unit_amount]`, so a wrong amount can never be
 * "fixed" by throwing the line item away.
 *
 * `metadata` is in here and it is the one people get wrong. The Stripe webhook
 * on Render reads `session.metadata.order_id` to mark the order paid — see
 * server/src/index.js — so a session created without it takes the money and
 * leaves the order sitting unpaid forever, with no automatic way to connect
 * the two. That is strictly worse than the checkout refusing to start.
 *
 * Note what is NOT here: `payment_intent_data.metadata` is a different path
 * and only carries dispute evidence, so that copy may go.
 */
export const PROTECTED_PARAMS: readonly string[] = [
  "mode",
  "line_items",
  "success_url",
  "cancel_url",
  "metadata",
];

/** Kept as the old name so existing callers and tests do not have to change. */
export const REQUIRED_PARAMS = PROTECTED_PARAMS;

/** Is this parameter path protected, either exactly or as a descendant? */
export function isProtected(name: string): boolean {
  if (!name) return false;
  return PROTECTED_PARAMS.some((p) => name === p || name.startsWith(`${p}.`));
}

/** Keep our own copy by switching Managed Payments off for this one request. */
export const MANAGED_PAYMENTS_OFF = "managed_payments=off";

/**
 * THE LAST RESORT: send the protected core and nothing else.
 *
 * For the case no amount of parsing can cover — an account that refuses
 * something while naming nothing we can act on, or in wording no regex of
 * ours matches. One attempt, at the very end, with the five parameters that
 * make a session a session. It is a real payment page: less of one than we
 * asked for, but a buyer can complete it and the order still reconciles.
 *
 * NOT tried when the error named something protected. A wrong amount must
 * surface as a wrong amount; stripping the page bare until Stripe accepts a
 * bad line item would be the worst behaviour in this file.
 */
export const MINIMAL_SESSION = "minimal-session";

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
  /*
   * And the prose, for the errors that name the parameter only there. These
   * are the shapes Stripe actually uses; the open-world rule means a NEW
   * shape costs us the precision of the drop, not the sale — the minimal
   * session still gets the buyer to a payment page.
   */
  const NAME = "([a-z_]+(?:\\[[a-z_0-9]+\\])*)";
  const patterns = [
    // "custom_text cannot be used with Managed Payments…", "X is not allowed
    // when…", "X is only available…", "X must be…"
    new RegExp(`^\\s*${NAME}\\s+(?:cannot|can't|is|are|may|must|does)\\b`, "i"),
    new RegExp(`unknown parameter:?\\s*${NAME}`, "i"),
    new RegExp(`(?:cannot pass|not allowed to pass|remove|unset)\\s+\`?${NAME}\`?`, "i"),
    // "The `custom_text` parameter is not supported…"
    new RegExp(`\`?${NAME}\`?\\s+parameter\\b`, "i"),
    new RegExp(`parameter:?\\s+\`?${NAME}\`?`, "i"),
    // "…is not supported when using custom_text"
    new RegExp(`(?:when using|in combination with|together with)\\s+\`?${NAME}\`?`, "i"),
  ];
  for (const re of patterns) push(re.exec(message)?.[1]);

  return out;
}

/** Does this error point at Managed Payments as the reason? */
export function mentionsManagedPayments(e: unknown): boolean {
  return /managed[\s_]?payments/i.test(errorMessage(e));
}

/**
 * Did Stripe name something we must not touch?
 *
 * The gate on the minimal session. If the complaint is about an amount, a URL
 * or the metadata, no amount of stripping the page back will help and trying
 * would only bury the real error — so we stop and let it through.
 */
export function namedProtected(e: unknown): boolean {
  return offendingParams(e).some((n) => isProtected(n));
}

/* -------------------------------------------------------------------------- */
/* Deciding what to try next                                                   */
/* -------------------------------------------------------------------------- */

/** The droppable entry a named parameter belongs to, or null. */
export function droppableFor(name: string): string | null {
  if (!name) return null;
  // The protected core, and anything inside it, is off the table.
  if (isProtected(name)) return null;

  // Something we have a stated preference about.
  if (DROP_ORDER.includes(name)) return name;

  // The nearest known ANCESTOR: Stripe may name
  // `payment_intent_data.shipping.address.line1`, and the thing we know how to
  // remove is `payment_intent_data.shipping`.
  const ancestors = DROP_ORDER.filter((d) => name.startsWith(`${d}.`));
  if (ancestors.length > 0) {
    // The most specific one, so we give up as little as possible.
    return ancestors.reduce((a, b) => (b.length > a.length ? b : a));
  }

  // A bare leaf name — Stripe sometimes reports `shipping` for
  // `payment_intent_data[shipping]`. Resolve it only when exactly one known
  // path ends that way; more than one is ambiguous and is not guessed at.
  const leaves = DROP_ORDER.filter((d) => d.endsWith(`.${name}`));
  if (leaves.length === 1) return leaves[0];
  if (leaves.length > 1) return null;

  /*
   * OPEN WORLD. A parameter nobody has heard of — a Stripe feature newer than
   * this code, or one we added without updating DROP_ORDER — is still
   * negotiable, because it is not protected. This single line is what stops
   * the next Managed Payments from being an outage.
   *
   * Dropping something we are not actually sending is harmless: the body comes
   * back unchanged, and the caller notices that there was no progress and
   * moves on rather than asking again for the same thing.
   */
  return name;
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

  /*
   * Stripe named nothing we can act on — no `param`, and wording none of the
   * patterns match. One last attempt with the protected core alone, which is
   * still a working payment page.
   *
   * Refused outright when the complaint WAS about the protected core: a
   * request that is wrong about an amount or a URL is not made right by
   * sending less of it, and the real error has to reach the logs.
   */
  if (!namedProtected(e) && !state.applied.includes(MINIMAL_SESSION)) {
    return {
      applied: [...state.applied, MINIMAL_SESSION],
      pending: [],
      rejected: state.rejected,
    };
  }

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
    if (adjustment === MINIMAL_SESSION) {
      /*
       * Keep ONLY the protected core, and nothing that was added before this
       * — including the Managed Payments opt-out, since the point of the
       * minimal session is to stop guessing about this account entirely.
       */
      const core: Record<string, unknown> = {};
      for (const key of PROTECTED_PARAMS) {
        if (key in out) core[key] = out[key];
      }
      out = core;
      continue;
    }
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
 * A bound on the whole negotiation, counting the rounds where we think as well
 * as the ones where we ask.
 *
 * Generous rather than tuned: each round that SENDS has to have changed the
 * request body, and the body can only lose parameters, so the number of
 * requests is bounded by the number of parameters whatever this says. This
 * exists so a pathological error message cannot spin, not to ration retries.
 */
const MAX_STEPS = DROP_ORDER.length * 2 + 6;

export type SessionResult = {
  session: Stripe.Checkout.Session;
  /** The adjustments the successful attempt used. Empty means "as asked". */
  applied: Adjustment[];
  /** How many requests Stripe actually received, including the one that worked. */
  attempts: number;
};

const sameState = (a: NegotiationState, b: NegotiationState) =>
  JSON.stringify(a) === JSON.stringify(b);

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
  let lastBodyJson: string | null = null;
  let sent = 0;

  for (let step = 0; step < MAX_STEPS; step++) {
    const body = applyAdjustments(params, state.applied);
    const bodyJson = JSON.stringify(body);

    /*
     * NO PROGRESS. The adjustment changed nothing, which happens when Stripe
     * names a parameter we do not actually send — a plausible outcome of
     * reading a name out of prose. Sending an identical request would waste a
     * call and get an identical answer, so negotiate further from the same
     * error instead. The useless drop stays in `applied`, which is what stops
     * it being chosen again.
     */
    if (bodyJson === lastBodyJson) {
      const next = negotiate(lastError, state);
      if (!next || sameState(next, state)) break;
      state = next;
      continue;
    }

    lastBodyJson = bodyJson;
    sent++;
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
        const minimal = state.applied.includes(MINIMAL_SESSION);
        const line =
          `[checkout] Stripe accepted the session after ${sent} attempt(s) with: ` +
          `${state.applied.join(", ")} — remembered for this account`;
        if (minimal) {
          /*
           * Louder, because this one is a real loss: the buyer gets a plain
           * Stripe page with none of our copy. The sale completes, but the
           * owner should know and should look at /api/health.
           */
          console.error(
            `${line}. THE MINIMAL SESSION WAS USED — this account refused something ` +
              "without naming it, so every presentation parameter was dropped. " +
              `Last Stripe error: ${errorMessage(lastError).slice(0, 200)}`
          );
        } else {
          log(line);
        }
      }
      return { session, applied: [...state.applied], attempts: sent };
    } catch (e) {
      lastError = e;
      const next = negotiate(e, state);
      if (!next || sameState(next, state)) break;
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
