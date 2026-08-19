/**
 * Cooldown maths for public form submissions.
 *
 * Pure and dependency-free so it is directly unit-testable and usable on both
 * the client (to run the countdown) and the server (to enforce it).
 */

/** Minimum gap between two contact-form messages, in seconds. */
export const CONTACT_COOLDOWN_SECONDS = 120;

/**
 * Seconds still to wait before another submission is allowed.
 *
 * Returns 0 when the caller is free to send. Rounds UP, so a UI counting this
 * down never says "0" while the server would still refuse.
 */
export function cooldownRemaining(
  lastSentAt: Date | string | null | undefined,
  now: Date = new Date(),
  windowSeconds: number = CONTACT_COOLDOWN_SECONDS
): number {
  if (!lastSentAt) return 0;
  const last = typeof lastSentAt === "string" ? new Date(lastSentAt) : lastSentAt;
  if (Number.isNaN(last.getTime())) return 0;

  const elapsed = (now.getTime() - last.getTime()) / 1000;
  // A clock skew that puts the last message in the future must not lock someone
  // out for hours — treat anything nonsensical as expired.
  if (elapsed < 0) return 0;
  if (elapsed >= windowSeconds) return 0;
  return Math.ceil(windowSeconds - elapsed);
}

/** "2 minutes", "1 minute 5 seconds", "45 seconds" — for a human-facing message. */
export function formatWait(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  if (s < 60) return `${s} second${s === 1 ? "" : "s"}`;
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  const minPart = `${mins} minute${mins === 1 ? "" : "s"}`;
  if (rem === 0) return minPart;
  return `${minPart} ${rem} second${rem === 1 ? "" : "s"}`;
}

/** "1:45" / "0:09" — for a live countdown next to a disabled button. */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${mins}:${String(rem).padStart(2, "0")}`;
}
