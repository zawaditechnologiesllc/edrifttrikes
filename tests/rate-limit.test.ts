import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  CONTACT_COOLDOWN_SECONDS,
  cooldownRemaining,
  formatCountdown,
  formatWait,
} from "../lib/rate-limit";

/**
 * Contact-form cooldown. Two ways to get this wrong, both user-visible: locking
 * out someone who is entitled to send, or letting a spammer straight back in.
 */

const SENT = new Date("2026-01-01T12:00:00Z");
const at = (secondsLater: number) => new Date(SENT.getTime() + secondsLater * 1000);

describe("cooldownRemaining", () => {
  test("the window is two minutes", () => {
    assert.equal(CONTACT_COOLDOWN_SECONDS, 120);
  });

  test("a first-ever sender is never blocked", () => {
    assert.equal(cooldownRemaining(null), 0);
    assert.equal(cooldownRemaining(undefined), 0);
  });

  test("blocks immediately after sending, for the full window", () => {
    assert.equal(cooldownRemaining(SENT, at(0)), 120);
    assert.equal(cooldownRemaining(SENT, at(1)), 119);
    assert.equal(cooldownRemaining(SENT, at(60)), 60);
  });

  test("releases exactly at the window, not a moment later", () => {
    assert.equal(cooldownRemaining(SENT, at(119)), 1);
    assert.equal(cooldownRemaining(SENT, at(120)), 0);
    assert.equal(cooldownRemaining(SENT, at(10_000)), 0);
  });

  test("rounds UP, so a countdown never shows 0 while the server still refuses", () => {
    // At 119.5s elapsed there is half a second left; reporting 0 would let the
    // UI enable the button against a server that would reject the submission.
    const remaining = cooldownRemaining(SENT, at(119.5));
    assert.equal(remaining, 1);
    assert.ok(Number.isInteger(remaining));
  });

  test("accepts an ISO string, as the database returns", () => {
    assert.equal(cooldownRemaining(SENT.toISOString(), at(60)), 60);
  });

  test("clock skew can't lock someone out", () => {
    // A "last sent" timestamp in the future means skew between hosts, not abuse.
    assert.equal(cooldownRemaining(at(600), SENT), 0);
    assert.equal(cooldownRemaining("not a date", SENT), 0);
  });

  test("honours a custom window", () => {
    assert.equal(cooldownRemaining(SENT, at(30), 60), 30);
    assert.equal(cooldownRemaining(SENT, at(30), 10), 0);
  });
});

describe("formatWait", () => {
  test("reads naturally at every scale", () => {
    assert.equal(formatWait(1), "1 second");
    assert.equal(formatWait(45), "45 seconds");
    assert.equal(formatWait(60), "1 minute");
    assert.equal(formatWait(120), "2 minutes");
    assert.equal(formatWait(65), "1 minute 5 seconds");
    assert.equal(formatWait(0), "0 seconds");
  });
});

describe("formatCountdown", () => {
  test("pads seconds so the countdown doesn't jitter", () => {
    assert.equal(formatCountdown(120), "2:00");
    assert.equal(formatCountdown(65), "1:05");
    assert.equal(formatCountdown(9), "0:09");
    assert.equal(formatCountdown(0), "0:00");
  });

  test("never renders a negative clock", () => {
    assert.equal(formatCountdown(-5), "0:00");
  });
});
