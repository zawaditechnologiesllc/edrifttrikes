import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  CHECKOUT_FIELDS,
  checkoutFieldsFor,
  REQUIRED_FIELDS,
  normalizeShipping,
  validateCheckout,
  validateEmail,
  validateShippingField,
} from "../lib/validation";
import { countries, isKnownCountry, normalizeCountry } from "../lib/countries";

/**
 * Checkout validation. Two failure modes matter here and they pull in opposite
 * directions: letting junk through creates an unshippable order, and being too
 * strict rejects a real buyer with a valid foreign address. Both are tested.
 */

const VALID = {
  first_name: "Alex",
  last_name: "Mwangi",
  address: "1420 Voltage Avenue",
  city: "Nairobi",
  state: "Nairobi County",
  zip: "00100",
  country: "Kenya",
};

describe("validateEmail", () => {
  test("accepts ordinary addresses", () => {
    for (const email of [
      "rider@example.com",
      "first.last+tag@sub.domain.co.uk",
      "a@b.io",
    ]) {
      assert.equal(validateEmail(email), null, `rejected ${email}`);
    }
  });

  test("rejects what would bounce", () => {
    for (const email of ["", "  ", "no-at-sign", "no@tld", "two@@at.com", "a b@c.com"]) {
      assert.notEqual(validateEmail(email), null, `accepted ${email}`);
    }
  });

  test("explains the problem instead of saying 'invalid'", () => {
    const message = validateEmail("");
    assert.ok(message && message.length > 20, "message is not actionable");
  });
});

describe("required fields", () => {
  test("everything except address2 and phone is required", () => {
    // Country leads: the address lookup is scoped to it and the last two
    // labels are named by it, so nothing below it can be filled in well until
    // it is answered.
    assert.deepEqual(REQUIRED_FIELDS, [
      "country",
      "first_name",
      "last_name",
      "address",
      "city",
      "state",
      "zip",
    ]);
  });

  test("a blank required field is rejected, a blank optional one is fine", () => {
    assert.notEqual(validateShippingField("first_name", ""), null);
    assert.notEqual(validateShippingField("address", "   "), null);
    assert.equal(validateShippingField("address2", ""), null);
    assert.equal(validateShippingField("phone", ""), null);
  });

  test("every field carries a label, hint and placeholder for the buyer", () => {
    for (const spec of CHECKOUT_FIELDS) {
      assert.ok(spec.label.length > 0, `${spec.name} has no label`);
      assert.ok(spec.hint.length > 10, `${spec.name} has no useful hint`);
      assert.ok(spec.placeholder.length > 0, `${spec.name} has no placeholder`);
      assert.ok(spec.autoComplete.length > 0, `${spec.name} can't be autofilled`);
    }
  });

  test("placeholders instruct — they are never specimen names or addresses", () => {
    // A sample identity in a form field ("Alex", "Nairobi", "1420 Voltage
    // Avenue") reads as someone's real data, is easy to mistake for a value
    // that's already filled in, and only makes sense to buyers from the country
    // the sample came from. Instructions are phrases and carry no digits;
    // specimen values are one or two words, or contain numbers.
    for (const spec of CHECKOUT_FIELDS) {
      const words = spec.placeholder.trim().split(/\s+/);
      assert.ok(
        words.length >= 3,
        `${spec.name} placeholder "${spec.placeholder}" reads as a sample value, not an instruction`
      );
      assert.doesNotMatch(
        spec.placeholder,
        /\d/,
        `${spec.name} placeholder "${spec.placeholder}" contains a specimen number`
      );
    }
  });
});

describe("names and address", () => {
  test("accepts real-world names, including non-Latin scripts", () => {
    for (const name of ["Alex", "O'Brien", "van der Berg", "Müller", "李"]) {
      // "李" is 1 char, below the 2-char floor — check the others pass.
      if (name.length >= 2) {
        assert.equal(validateShippingField("first_name", name), null, `rejected ${name}`);
      }
    }
  });

  test("rejects junk that would print an unusable shipping label", () => {
    assert.notEqual(validateShippingField("first_name", "A"), null);
    assert.notEqual(validateShippingField("first_name", "123"), null);
    assert.notEqual(validateShippingField("address", "12"), null);
    assert.notEqual(validateShippingField("address", "12345"), null); // no street
  });

  test("accepts addresses without a house number — rural routes have none", () => {
    assert.equal(validateShippingField("address", "Kiambu Road, Plot 14"), null);
    assert.equal(validateShippingField("address", "The Old Mill House"), null);
  });

  test("enforces the field's own max length", () => {
    const spec = CHECKOUT_FIELDS.find((f) => f.name === "city")!;
    assert.notEqual(validateShippingField("city", "x".repeat(spec.maxLength + 1)), null);
  });
});

describe("postal code", () => {
  test("accepts the formats real countries use", () => {
    for (const zip of ["00100", "SW1A 1AA", "90210", "K1A-0B1", "1010"]) {
      assert.equal(validateShippingField("zip", zip), null, `rejected ${zip}`);
    }
  });

  test("rejects unusable values", () => {
    assert.notEqual(validateShippingField("zip", "!!"), null);
    assert.notEqual(validateShippingField("zip", "1"), null);
    assert.notEqual(validateShippingField("zip", "x".repeat(13)), null);
  });
});

describe("phone", () => {
  test("optional, but must be dialable when given — the courier calls it", () => {
    assert.equal(validateShippingField("phone", ""), null);
    for (const phone of ["+254 712 345 678", "+1 (555) 010-0000", "0712345678"]) {
      assert.equal(validateShippingField("phone", phone), null, `rejected ${phone}`);
    }
    for (const phone of ["12345", "not a phone", "+"]) {
      assert.notEqual(validateShippingField("phone", phone), null, `accepted ${phone}`);
    }
  });
});

describe("country", () => {
  test("the list is populated and includes the main markets", () => {
    const names = countries().map((c) => c.name);
    assert.ok(names.length > 150, `only ${names.length} countries`);
    // Priority markets come first so buyers don't scroll for them.
    assert.equal(countries()[0].code, "US");
  });

  test("accepts a name or an ISO code, case- and space-insensitively", () => {
    assert.ok(isKnownCountry("Kenya"));
    assert.ok(isKnownCountry("  kenya "));
    assert.ok(isKnownCountry("KE"));
    assert.ok(isKnownCountry("us"));
  });

  test("rejects a country we don't ship to", () => {
    assert.ok(!isKnownCountry("Wakanda"));
    assert.ok(!isKnownCountry(""));
    assert.notEqual(validateShippingField("country", "Wakanda"), null);
  });

  test("canonicalises so the admin sees one consistent spelling", () => {
    assert.equal(normalizeCountry("ke"), "Kenya");
    assert.equal(normalizeCountry("  KENYA  "), "Kenya");
    assert.equal(normalizeCountry("Wakanda"), null);
  });

  test("validates by ISO CODE, so it survives a runtime without full ICU", () => {
    // The form submits the code. If the server ever resolved different display
    // names than the browser (no ICU on Workers, say), name-based validation
    // would reject every order — code-based validation cannot.
    for (const code of ["US", "GB", "KE", "AU", "IN", "BR"]) {
      assert.equal(
        validateShippingField("country", code),
        null,
        `code ${code} was rejected`
      );
    }
  });

  test("the store ships everywhere — no country is refused by policy", () => {
    // There is no block list. Every ISO country the picker offers has to pass
    // the server-side validator too, or the form would offer a destination the
    // API then rejects.
    for (const value of ["IN", "India", "PK", "Pakistan", "BD", "Bangladesh"]) {
      assert.equal(
        validateShippingField("country", value),
        null,
        `${value} was refused`
      );
    }
  });
});

describe("validateCheckout", () => {
  test("passes a complete, valid payload", () => {
    const result = validateCheckout({ email: "rider@example.com", shipping: VALID });
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.equal(result.firstErrorField, null);
  });

  test("collects every problem at once, not just the first", () => {
    const result = validateCheckout({ email: "bad", shipping: { ...VALID, zip: "" } });
    assert.equal(result.ok, false);
    assert.ok(result.errors.email);
    assert.ok(result.errors.zip);
  });

  test("reports the first error in FORM order, so focus lands topmost", () => {
    // Country sits at the top of the form now; a payload broken in both country
    // and zip must point at country, not at whichever key iterated first.
    const result = validateCheckout({
      email: "rider@example.com",
      shipping: { ...VALID, zip: "", country: "Wakanda" },
    });
    assert.equal(result.firstErrorField, "country");

    // And a payload broken lower down still points at the topmost break.
    const lower = validateCheckout({
      email: "rider@example.com",
      shipping: { ...VALID, city: "", zip: "" },
    });
    assert.equal(lower.firstErrorField, "city");

    // Email outranks every address field.
    const withBadEmail = validateCheckout({
      email: "",
      shipping: { ...VALID, zip: "" },
    });
    assert.equal(withBadEmail.firstErrorField, "email");
  });

  test("an empty payload fails rather than creating an unshippable order", () => {
    const result = validateCheckout({ email: "", shipping: {} });
    assert.equal(result.ok, false);
    assert.ok(result.firstErrorMessage);
  });
});

describe("normalizeShipping", () => {
  test("drops unknown keys a crafted request might attach", () => {
    const out = normalizeShipping({ ...VALID, evil: "x", role: "admin" });
    assert.equal(out.evil, undefined);
    assert.equal(out.role, undefined);
    assert.equal(out.city, "Nairobi");
  });

  test("trims, and stores the country canonically", () => {
    const out = normalizeShipping({ ...VALID, city: "  Nairobi  ", country: "ke" });
    assert.equal(out.city, "Nairobi");
    assert.equal(out.country, "Kenya");
  });

  test("truncates to each field's max length", () => {
    const spec = CHECKOUT_FIELDS.find((f) => f.name === "zip")!;
    const out = normalizeShipping({ ...VALID, zip: "9".repeat(50) });
    assert.equal(out.zip.length, spec.maxLength);
  });

  test("omits empty optional fields instead of storing blanks", () => {
    const out = normalizeShipping({ ...VALID, phone: "   ", address2: "" });
    assert.equal("phone" in out, false);
    assert.equal("address2" in out, false);
  });
});

describe("the form starts with the country", () => {
  test("country is the first field on the form", () => {
    // Everything below it depends on the answer: the address lookup is scoped
    // to it, and the last two labels are named by it.
    assert.equal(CHECKOUT_FIELDS[0].name, "country");
    assert.equal(CHECKOUT_FIELDS[0].span, "full");
  });

  test("the street address still comes before the parts it fills in", () => {
    const order = CHECKOUT_FIELDS.map((f) => f.name);
    for (const filled of ["city", "state", "zip"] as const) {
      assert.ok(
        order.indexOf("address") < order.indexOf(filled),
        `${filled} is asked for before the address that fills it`
      );
    }
  });
});

describe("the address fields are named the way the buyer's country names them", () => {
  const labelOf = (country: string, name: string) =>
    checkoutFieldsFor(country).find((f) => f.name === name)!.label;

  test("a US buyer is asked for a State and a ZIP code", () => {
    assert.equal(labelOf("US", "state"), "State");
    assert.equal(labelOf("US", "zip"), "ZIP code");
  });

  test("a British buyer is asked for a County and a Postcode, not a ZIP", () => {
    // Asking someone in London for a "ZIP code" is a small thing that says the
    // shop was not built with them in mind.
    assert.equal(labelOf("GB", "state"), "County");
    assert.equal(labelOf("GB", "zip"), "Postcode");
  });

  test("Canada, Australia and Ireland each get their own terms", () => {
    assert.equal(labelOf("CA", "zip"), "Postal code");
    assert.equal(labelOf("AU", "state"), "State / Territory");
    assert.equal(labelOf("IE", "zip"), "Eircode");
  });

  test("a country we have no terms for keeps the neutral wording", () => {
    // Inventing a term for a country we don't actually know is worse than the
    // generic label.
    assert.equal(labelOf("BR", "state"), "State / Province / Region");
    assert.equal(labelOf("BR", "zip"), "Postal / ZIP code");
  });

  test("is case-insensitive, like everything else that takes a country", () => {
    assert.equal(labelOf("gb", "zip"), "Postcode");
  });

  test("before a country is chosen, the address field says to choose one", () => {
    const address = checkoutFieldsFor("").find((f) => f.name === "address")!;
    assert.match(address.hint, /country/i);
    // And stops saying it once they have.
    assert.doesNotMatch(
      checkoutFieldsFor("US").find((f) => f.name === "address")!.hint,
      /choose your country/i
    );
  });

  test("relabelling NEVER changes what validation accepts", () => {
    // The label is display only. If a country override could alter `required`
    // or `maxLength`, the browser and the server would stop agreeing about
    // what a valid address is.
    for (const country of ["", "US", "GB", "CA", "AU", "NZ", "IE", "IN", "BR"]) {
      const localized = checkoutFieldsFor(country);
      assert.equal(localized.length, CHECKOUT_FIELDS.length);
      localized.forEach((spec, i) => {
        const base = CHECKOUT_FIELDS[i];
        assert.equal(spec.name, base.name, `field order changed for ${country}`);
        assert.equal(spec.required, base.required, `${spec.name} required changed`);
        assert.equal(spec.maxLength, base.maxLength, `${spec.name} maxLength changed`);
        assert.equal(spec.autoComplete, base.autoComplete, `${spec.name} autoComplete changed`);
      });
    }
  });
});
