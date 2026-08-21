import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  DELIVERY_BASE_MAX_DAYS,
  DELIVERY_MIN_DAYS,
  MAX_ROUTE_EXTRA_DAYS,
  ROUTE_ZONES,
  deliveryDaysFor,
  deliveryEstimateSentence,
  deliveryWindow,
  formatDeliveryWindow,
  routeZone,
} from "../lib/delivery";
import { FULFILLMENT_SCHEDULE, SCHEDULE_SPAN_DAYS } from "../lib/fulfillment";
import { countryNames } from "../lib/countries";

/**
 * The delivery window quoted to the customer.
 *
 * This number appears on the product page, at checkout, on Stripe's payment
 * page, in the PDF sheet and in every email. The thing worth testing is not the
 * arithmetic — it's that every surface can only ever read ONE number, and that
 * the number is never a promise the fulfilment schedule can't keep.
 */

describe("the base window", () => {
  test("is 12–20 days when we don't know where it's going", () => {
    // A product page has no address yet. The base window is the shortest
    // honest quote, and every surface that shows it also says longer routes
    // take more.
    assert.deepEqual(deliveryWindow(null), {
      min: 12,
      max: 20,
      extraDays: 0,
      country: null,
    });
    assert.deepEqual(deliveryWindow(undefined), deliveryWindow(null));
    assert.deepEqual(deliveryWindow(""), deliveryWindow(null));
    assert.equal(formatDeliveryWindow(), "12–20 days");
  });
});

describe("varying by destination", () => {
  test("the home market gets the base window", () => {
    assert.equal(routeZone("US"), "domestic");
    assert.equal(formatDeliveryWindow("US"), "12–20 days");
    assert.equal(deliveryWindow("US").extraDays, 0);
  });

  test("US territories ship on the domestic route", () => {
    // Puerto Rico is not a foreign customs destination, and quoting it three
    // weeks would lose the sale for no reason.
    for (const code of ["PR", "VI", "GU"]) {
      assert.equal(routeZone(code), "domestic", `${code} is not domestic`);
    }
  });

  test("neighbours, established lanes and everywhere else each add more", () => {
    assert.equal(routeZone("CA"), "near");
    assert.equal(routeZone("GB"), "established");
    assert.equal(routeZone("BR"), "extended");

    const us = deliveryWindow("US").max;
    const ca = deliveryWindow("CA").max;
    const gb = deliveryWindow("GB").max;
    const br = deliveryWindow("BR").max;
    assert.ok(us < ca && ca < gb && gb < br, "the zones are not strictly ordered");
  });

  test("no destination adds more than the stated maximum", () => {
    // The site tells buyers the variance is "up to 7 days". A zone that added
    // more would make that sentence false.
    for (const extra of Object.values(ROUTE_ZONES)) {
      assert.ok(extra <= MAX_ROUTE_EXTRA_DAYS, `a zone adds ${extra} days`);
    }
    for (const name of countryNames()) {
      const w = deliveryWindow(name);
      assert.ok(
        w.max <= DELIVERY_BASE_MAX_DAYS + MAX_ROUTE_EXTRA_DAYS,
        `${name} quotes ${w.max} days`
      );
      assert.ok(w.min >= DELIVERY_MIN_DAYS, `${name} quotes ${w.min} days`);
      assert.ok(w.min < w.max, `${name} has a backwards window`);
    }
  });

  test("takes an ISO code or a display name, and lands on the same window", () => {
    // The checkout form submits a code; an order row stores the name. If these
    // resolved differently, the confirmation email would quote a different
    // window than the checkout page did.
    for (const [code, name] of [
      ["US", "United States"],
      ["CA", "Canada"],
      ["GB", "United Kingdom"],
      ["BR", "Brazil"],
    ]) {
      assert.deepEqual(
        deliveryWindow(code),
        deliveryWindow(name),
        `${code} and "${name}" disagree`
      );
    }
  });

  test("is case- and space-insensitive, like the rest of the address handling", () => {
    assert.equal(deliveryWindow("us").max, deliveryWindow("US").max);
    assert.equal(deliveryWindow("  united states  ").max, deliveryWindow("US").max);
  });

  test("treats a destination it cannot place as a distant one", () => {
    // Guessing "domestic" for an unrecognised country would under-promise on
    // exactly the orders most likely to be slow.
    assert.equal(routeZone("Wakanda"), "extended");
    assert.equal(deliveryWindow("Wakanda").extraDays, MAX_ROUTE_EXTRA_DAYS);
    assert.equal(deliveryWindow("Wakanda").country, null);
  });
});

describe("the date the customer is given", () => {
  test("is the far end of their own window", () => {
    assert.equal(deliveryDaysFor("US"), deliveryWindow("US").max);
    assert.equal(deliveryDaysFor("BR"), deliveryWindow("BR").max);
    assert.equal(deliveryDaysFor(null), DELIVERY_BASE_MAX_DAYS);
  });

  test("NEVER lands after the tracking schedule finishes", () => {
    // The order tracker's last stage falls on SCHEDULE_SPAN_DAYS. A quoted date
    // beyond it would mean promising a delivery after the point the system
    // stops updating the customer — the exact contradiction this module exists
    // to prevent.
    for (const name of countryNames()) {
      assert.ok(
        deliveryDaysFor(name) <= SCHEDULE_SPAN_DAYS,
        `${name} is quoted day ${deliveryDaysFor(name)}, past the schedule's day ${SCHEDULE_SPAN_DAYS}`
      );
    }
  });

  test("never lands before the order has even shipped", () => {
    const shippedOn = FULFILLMENT_SCHEDULE.find((s) => s.stage === "shipped")!.afterDays;
    assert.ok(DELIVERY_MIN_DAYS > shippedOn);
  });
});

describe("the sentence shown to buyers", () => {
  test("says the window varies when we have no destination", () => {
    // Without this the base window reads as a promise to everyone, including
    // the buyers a week further away.
    const s = deliveryEstimateSentence(null);
    assert.ok(s.includes("12–20 days"));
    assert.ok(s.includes(String(MAX_ROUTE_EXTRA_DAYS)), "the variance isn't mentioned");
  });

  test("drops the caveat once the destination is known", () => {
    // At that point the number IS theirs, and hedging it would just be noise.
    const s = deliveryEstimateSentence("BR");
    assert.ok(s.includes(formatDeliveryWindow("BR")));
    assert.ok(!s.includes(`up to ${MAX_ROUTE_EXTRA_DAYS} days`));
  });

  test("drops it for the home market too, not just for distant ones", () => {
    // A US buyer's window IS the base window — telling them longer routes take
    // more is a caveat about somebody else's order.
    const s = deliveryEstimateSentence("US");
    assert.ok(s.includes("12–20 days"));
    assert.ok(
      !s.includes(`up to ${MAX_ROUTE_EXTRA_DAYS} days`),
      "the home market still gets the caveat"
    );
  });

  test("quotes the destination's own numbers, not the base ones", () => {
    assert.ok(!deliveryEstimateSentence("BR").includes("12–20"));
  });
});
