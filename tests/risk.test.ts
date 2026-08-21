import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  HIGH_THRESHOLD,
  REVIEW_THRESHOLD,
  RISK_FLAG_COPY,
  assessOrigin,
  isHostingNetwork,
  isVpnNetwork,
  riskSummary,
  zoneGapHours,
  zoneOffsetMinutes,
  type RiskFlag,
} from "../lib/risk";

/**
 * Judging where an order came from.
 *
 * The failure mode that matters here is NOT missing a fraudster — this cannot
 * catch a residential proxy and never claims to. It is putting a warning label
 * on a real customer. A store owner who sees a red badge on every VPN user
 * stops reading badges inside a week, and then the one that mattered goes past
 * unread. So most of what follows pins down when a flag must NOT appear.
 */

const AT = new Date("2026-08-21T12:00:00Z");

/** An ordinary customer at home, connecting from where they say they are. */
const ORDINARY = {
  country: "US",
  region: "New York",
  city: "Brooklyn",
  timezone: "America/New_York",
  network: "Comcast Cable Communications, LLC",
  asn: 7922,
  clientTimezone: "America/New_York",
};

describe("the ordinary customer", () => {
  test("is clear, with no flags at all", () => {
    const r = assessOrigin(ORDINARY, "US", AT);
    assert.deepEqual(r, { level: "clear", score: 0, flags: [] });
  });

  test("stays clear on a mobile network", () => {
    for (const network of [
      "T-Mobile USA, Inc.",
      "Vodafone Ltd",
      "Safaricom Limited",
      "Deutsche Telekom AG",
      "BT Group",
      "Orange S.A.",
    ]) {
      const r = assessOrigin({ ...ORDINARY, network }, "US", AT);
      assert.deepEqual(r.flags, [], `${network} was flagged`);
    }
  });

  test("stays clear across a timezone ALIAS for the same place", () => {
    // "Europe/Belfast" and "Europe/London" are the same offset. Flagging a
    // customer over which alias their browser reports would be indefensible.
    const r = assessOrigin(
      {
        ...ORDINARY,
        country: "GB",
        timezone: "Europe/London",
        clientTimezone: "Europe/Belfast",
      },
      "GB",
      AT
    );
    assert.deepEqual(r.flags, []);
  });
});

describe("what counts as a VPN network", () => {
  test("names the operators that sell it", () => {
    for (const n of ["NordVPN", "Mullvad VPN AB", "M247 Europe SRL", "Surfshark Ltd"]) {
      assert.equal(isVpnNetwork(n), true, `${n} not caught`);
    }
  });

  test("catches the long tail by the word itself", () => {
    assert.equal(isVpnNetwork("Some Small VPN Provider"), true);
  });

  test("does NOT fire on a name that merely contains the letters", () => {
    // "Vpnet Telecom" is an ISP. Substring matching would flag every one of
    // its customers.
    assert.equal(isVpnNetwork("Vpnet Telecom"), false);
    assert.equal(isVpnNetwork("Comcast Cable Communications"), false);
    assert.equal(isVpnNetwork(""), false);
    assert.equal(isVpnNetwork(null), false);
  });

  test("hosting is hosting, and a consumer ISP is not", () => {
    assert.equal(isHostingNetwork("DigitalOcean, LLC"), true);
    assert.equal(isHostingNetwork("Hetzner Online GmbH"), true);
    assert.equal(isHostingNetwork("Comcast Cable Communications"), false);
    assert.equal(isHostingNetwork("Safaricom Limited"), false);
  });
});

describe("comparing clocks", () => {
  test("reads an offset out of an IANA zone", () => {
    assert.equal(zoneOffsetMinutes("UTC", AT), 0);
    assert.equal(zoneOffsetMinutes("America/New_York", AT), -240);
    assert.equal(zoneOffsetMinutes("Asia/Kolkata", AT), 330);
  });

  test("returns null rather than guessing at a zone it cannot read", () => {
    assert.equal(zoneOffsetMinutes("Not/AZone", AT), null);
    assert.equal(zoneOffsetMinutes(""), null);
    assert.equal(zoneOffsetMinutes(null), null);
  });

  test("measures the gap in hours, including half-hour zones", () => {
    assert.equal(zoneGapHours("UTC", "Asia/Kolkata", AT), 5.5);
    assert.equal(zoneGapHours("America/New_York", "Europe/London", AT), 5);
  });

  test("no gap is reported when either side is unknown", () => {
    // A browser that reported nothing must not read as a mismatch.
    assert.equal(zoneGapHours("America/New_York", null, AT), null);
    assert.equal(zoneGapHours(null, "America/New_York", AT), null);
  });
});

describe("the signals that do fire", () => {
  test("a commercial VPN with a mismatched clock is high", () => {
    const r = assessOrigin(
      {
        country: "US",
        network: "NordVPN",
        timezone: "America/New_York",
        clientTimezone: "Asia/Kolkata",
      },
      "US",
      AT
    );
    assert.equal(r.level, "high");
    assert.deepEqual(r.flags, ["known_vpn", "timezone_mismatch"]);
  });

  test("a VPN is never counted as hosting as well", () => {
    // A VPN company IS a hosting company. Counting both would double-weight
    // every VPN user straight past the threshold.
    const r = assessOrigin({ country: "US", network: "NordVPN" }, "US", AT);
    assert.deepEqual(r.flags, ["known_vpn"]);
  });

  test("Tor is recognised from the placeholder country", () => {
    const r = assessOrigin({ country: "T1" }, "DE", AT);
    assert.ok(r.flags.includes("tor"));
    assert.equal(r.level, "high");
  });

  test("Tor is NOT also reported as 'browsing from another country'", () => {
    // T1 is not a country. Saying the buyer is browsing from somewhere else
    // would be a statement about a place that does not exist.
    const r = assessOrigin({ country: "T1" }, "DE", AT);
    assert.ok(!r.flags.includes("country_mismatch"));
    assert.ok(!r.flags.includes("unknown_origin"), "Tor already explains the absence");
  });

  test("shipping abroad is noticed but is not on its own alarming", () => {
    // Gifts, expats and people travelling. This must stay below "high".
    const r = assessOrigin(ORDINARY, "CA", AT);
    assert.deepEqual(r.flags, ["country_mismatch"]);
    assert.equal(r.level, "review");
  });

  test("a datacentre connection alone is a look, not an alarm", () => {
    const r = assessOrigin(
      { ...ORDINARY, network: "Amazon.com, Inc.", asn: 16509 },
      "US",
      AT
    );
    assert.deepEqual(r.flags, ["hosting_network"]);
    assert.equal(r.level, "review");
  });

  test("but a datacentre shipping to another country is high", () => {
    const r = assessOrigin(
      { country: "NL", network: "DigitalOcean, LLC", timezone: "Europe/Amsterdam" },
      "US",
      AT
    );
    assert.equal(r.level, "high");
  });
});

describe("what happens when we know nothing", () => {
  test("an empty record is clear, not suspicious", () => {
    // Local dev, a direct hit that bypassed the CDN, an order from before this
    // existed. None of that is a fraud signal.
    const r = assessOrigin({}, "US", AT);
    assert.deepEqual(r.flags, ["unknown_origin"]);
    assert.equal(r.level, "clear");
  });

  test("a missing shipping country never produces a mismatch", () => {
    for (const ship of [null, undefined, ""]) {
      const r = assessOrigin(ORDINARY, ship, AT);
      assert.ok(!r.flags.includes("country_mismatch"), `${String(ship)} produced one`);
    }
  });

  test("knowing the network but not the country is still knowing something", () => {
    const r = assessOrigin({ network: "Comcast Cable" }, "US", AT);
    assert.deepEqual(r.flags, []);
  });
});

describe("the thresholds hold the line", () => {
  test("no single flag except Tor reaches high", () => {
    // The whole design: one fact about a connection is never a fraud case.
    const singles: [RiskFlag, Parameters<typeof assessOrigin>[0], string][] = [
      ["known_vpn", { country: "US", network: "NordVPN" }, "US"],
      ["hosting_network", { country: "US", network: "Linode" }, "US"],
      [
        "timezone_mismatch",
        {
          country: "US",
          network: "Comcast",
          timezone: "America/New_York",
          clientTimezone: "Europe/Berlin",
        },
        "US",
      ],
      ["country_mismatch", ORDINARY, "CA"],
      ["unknown_origin", {}, "US"],
    ];
    for (const [flag, origin, ship] of singles) {
      const r = assessOrigin(origin, ship, AT);
      assert.deepEqual(r.flags, [flag], `${flag} did not come out alone`);
      assert.notEqual(r.level, "high", `${flag} alone reached high`);
    }
  });

  test("the thresholds are ordered, and clear really is zero-ish", () => {
    assert.ok(REVIEW_THRESHOLD < HIGH_THRESHOLD);
    assert.equal(assessOrigin(ORDINARY, "US", AT).score, 0);
  });
});

describe("what the admin is told", () => {
  test("every flag has copy, and the copy says what it ISN'T", () => {
    // A flag without the caveat becomes an excuse to cancel a real order.
    const hedges = /also|but|normal|legitimate|ordinary|only means|not by itself|same/i;
    for (const [flag, copy] of Object.entries(RISK_FLAG_COPY)) {
      assert.ok(copy.label.length > 0, `${flag} has no label`);
      assert.ok(copy.detail.length > 40, `${flag} detail is too thin`);
      assert.match(copy.detail, hedges, `${flag} states a verdict with no caveat`);
    }
  });

  test("never uses the language of a verdict", () => {
    for (const [flag, copy] of Object.entries(RISK_FLAG_COPY)) {
      const text = `${copy.label} ${copy.detail}`.toLowerCase();
      for (const word of ["fraudster", "criminal", "stolen card", "block them", "reject"]) {
        assert.ok(!text.includes(word), `${flag} says "${word}"`);
      }
    }
  });

  test("summarises in one line for the list", () => {
    assert.equal(riskSummary({ level: "clear", score: 0, flags: [] }), "Nothing unusual");
    assert.equal(
      riskSummary({ level: "high", score: 60, flags: ["known_vpn", "timezone_mismatch"] }),
      "Commercial VPN · Clock doesn't match the IP"
    );
  });
});
