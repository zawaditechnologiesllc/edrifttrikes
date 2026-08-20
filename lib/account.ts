/**
 * Deciding which orders belong to a signed-in rider.
 *
 * Buyers check out as guests, so those orders carry `user_id = NULL` and are
 * only connected to a person by the email they typed. Turning that into
 * ownership is the security-sensitive part of the rider dashboard, so it lives
 * here: pure, dependency-free and directly unit-tested, rather than buried in a
 * query.
 */

/** The shape we need from a Supabase auth user. */
export type AuthUserLike = {
  email?: string | null;
  email_confirmed_at?: string | null;
  /** Older Supabase versions expose this instead. */
  confirmed_at?: string | null;
};

/**
 * The user's email, but ONLY once they have proved they own it.
 *
 * THIS IS THE GATE ON THE WHOLE FEATURE. An unconfirmed address proves
 * nothing: without this check, anyone could register with a stranger's email
 * and immediately read that person's orders — their name, full shipping
 * address, phone number and what they bought.
 *
 * ⚠️ It is only as strong as the Supabase setting behind it. With
 * "Confirm email" turned OFF, Supabase stamps `email_confirmed_at` at signup
 * and this returns an address nobody has proved they own. Keep confirmation on.
 */
export function verifiedUserEmail(user: AuthUserLike | null | undefined): string | null {
  if (!user) return null;
  const confirmed = user.email_confirmed_at ?? user.confirmed_at ?? null;
  if (!confirmed) return null;
  const email = (user.email ?? "").trim().toLowerCase();
  return email ? email : null;
}

/**
 * Strip the characters PostgREST treats as structure in an `or` filter.
 *
 * The email is interpolated into that grammar, where comma and parentheses are
 * syntax rather than data. Supabase has already validated the address, so this
 * is belt and braces — and it matches how searchProducts sanitises its own
 * filter.
 */
export function filterSafeEmail(email: string): string {
  return email.replace(/[,()\\*]/g, "");
}

/**
 * PostgREST `or` expression selecting every order this user owns.
 *
 * Two routes, because guest orders are claimed asynchronously:
 *  - rows already linked to the account, and
 *  - unclaimed rows placed with their confirmed email.
 *
 * With no verified email, it narrows to linked rows only — never to "all
 * unclaimed orders", which is the failure mode that would matter.
 *
 * This filter shapes the response; it is NOT what makes it safe. The same rule
 * is enforced by RLS (migration 0010), so a tampered value changes nothing.
 */
export function orderOwnershipFilter(
  userId: string,
  verifiedEmail: string | null
): string {
  const owned = `user_id.eq.${userId}`;
  if (!verifiedEmail) return owned;
  const safe = filterSafeEmail(verifiedEmail);
  if (!safe) return owned;
  return `${owned},and(user_id.is.null,email.eq.${safe})`;
}

/**
 * Mask an email for display to someone who has not proved they own it.
 *
 * "rider@example.com" → "r•••r@example.com". Enough for the buyer to recognise
 * which address their receipt went to, not enough to harvest the address from
 * a receipt page reached with only an order number.
 */
export function maskEmail(email: string | null | undefined): string {
  const value = (email ?? "").trim();
  const at = value.lastIndexOf("@");
  if (at < 1) return "your email";
  const local = value.slice(0, at);
  const domain = value.slice(at);
  if (local.length <= 2) return `${local[0]}•••${domain}`;
  return `${local[0]}•••${local[local.length - 1]}${domain}`;
}
