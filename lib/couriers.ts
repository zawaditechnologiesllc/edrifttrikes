/**
 * Who carries the parcel, and how a customer follows it.
 *
 * Two things live here because they are the same decision made twice: the list
 * an admin picks from, and what that pick means for the customer's email. A
 * courier chosen from a dropdown can carry a tracking URL; a courier typed into
 * a free-text box is just a word, and the customer is left to search for it.
 *
 * DEPENDENCY-FREE, like lib/fulfillment.ts, so the admin form (client), the
 * server action and the email renderers can all read one definition.
 */

export type Courier = {
  /** Exactly what is stored on the order and printed to the customer. */
  name: string;
  /**
   * Public tracking page, with `{n}` where the number goes.
   *
   * Present ONLY for carriers whose public tracking URL is stable and takes the
   * number as a plain query parameter. A carrier whose page needs a postcode, a
   * session or a POST is deliberately left without one: a link that lands on an
   * error page is worse for the customer than no link, because they assume the
   * number is wrong rather than the link.
   */
  trackingUrl?: string;
};

/**
 * The courier the store is itself, for a parcel moving on its own arrangements
 * or under an internal reference. Never gets a tracking URL — there is no
 * external site to send anyone to.
 */
export const INTERNAL_COURIER = "E-Drift Logistics (in-house)";

/**
 * The list, grouped the way someone shipping a crate actually thinks: who can
 * take it anywhere, then who takes it once it lands.
 *
 * Order within a group is roughly by how often a store like this uses them.
 * Adding a courier is safe — it is a name and an optional URL, and nothing
 * else in the system needs to know about it.
 */
export const COURIER_GROUPS: { label: string; couriers: Courier[] }[] = [
  {
    label: "Global express & freight",
    couriers: [
      { name: "DHL Express", trackingUrl: "https://www.dhl.com/en/express/tracking.html?AWB={n}&brand=DHL" },
      { name: "FedEx", trackingUrl: "https://www.fedex.com/fedextrack/?trknbr={n}" },
      { name: "UPS", trackingUrl: "https://www.ups.com/track?tracknum={n}" },
      { name: "TNT", trackingUrl: "https://www.tnt.com/express/en_us/site/tracking.html?searchType=con&cons={n}" },
      { name: "Aramex", trackingUrl: "https://www.aramex.com/us/en/track/results?ShipmentNumber={n}" },
      { name: "DHL eCommerce" },
      { name: "DHL Global Forwarding" },
      { name: "SkyNet Worldwide Express" },
      { name: "EMS (international post)" },
      { name: "Maersk" },
      { name: "Kuehne+Nagel" },
      { name: "DB Schenker" },
      { name: "Expeditors" },
      { name: "Freightos / forwarder" },
    ],
  },
  {
    label: "United States",
    couriers: [
      { name: "USPS", trackingUrl: "https://tools.usps.com/go/TrackConfirmAction?tLabels={n}" },
      { name: "UPS Ground" },
      { name: "FedEx Ground" },
      { name: "FedEx Freight" },
      { name: "OnTrac", trackingUrl: "https://www.ontrac.com/tracking/?number={n}" },
      { name: "XPO Logistics" },
      { name: "Old Dominion Freight Line" },
      { name: "Estes Express Lines" },
      { name: "Saia LTL Freight" },
      { name: "ABF Freight" },
      { name: "R+L Carriers" },
      { name: "TForce Freight" },
      { name: "Southeastern Freight Lines" },
    ],
  },
  {
    label: "Canada & Mexico",
    couriers: [
      { name: "Canada Post", trackingUrl: "https://www.canadapost-postescanada.ca/track-reperage/en#/resultList?searchFor={n}" },
      { name: "Purolator", trackingUrl: "https://www.purolator.com/en/shipping/tracker?pin={n}" },
      { name: "Canpar Express" },
      { name: "Estafeta" },
      { name: "Correos de México" },
    ],
  },
  {
    label: "United Kingdom & Ireland",
    couriers: [
      { name: "Royal Mail", trackingUrl: "https://www.royalmail.com/track-your-item#/tracking-results/{n}" },
      { name: "Parcelforce Worldwide", trackingUrl: "https://www.parcelforce.com/track-trace?trackNumber={n}" },
      { name: "Evri", trackingUrl: "https://www.evri.com/track/parcel/{n}" },
      { name: "DPD UK", trackingUrl: "https://track.dpd.co.uk/search?reference={n}" },
      { name: "Yodel" },
      { name: "An Post" },
      { name: "DX Freight" },
    ],
  },
  {
    label: "Europe",
    couriers: [
      { name: "DPD" },
      { name: "GLS" },
      { name: "PostNL" },
      { name: "Deutsche Post / DHL Paket" },
      { name: "Colissimo (La Poste)" },
      { name: "Chronopost" },
      { name: "Bpost" },
      { name: "PostNord" },
      { name: "Swiss Post" },
      { name: "Austrian Post" },
      { name: "Correos (Spain)" },
      { name: "CTT (Portugal)" },
      { name: "Poste Italiane" },
      { name: "BRT (Bartolini)" },
      { name: "InPost" },
      { name: "Packeta" },
    ],
  },
  {
    label: "Asia-Pacific",
    couriers: [
      { name: "Australia Post", trackingUrl: "https://auspost.com.au/mypost/track/#/details/{n}" },
      { name: "StarTrack" },
      { name: "NZ Post" },
      { name: "Japan Post" },
      { name: "Yamato Transport" },
      { name: "Sagawa Express" },
      { name: "Korea Post" },
      { name: "CJ Logistics" },
      { name: "SF Express" },
      { name: "China Post" },
      { name: "Cainiao" },
      { name: "YunExpress" },
      { name: "J&T Express" },
      { name: "Ninja Van" },
      { name: "Singapore Post" },
      { name: "Hongkong Post" },
      { name: "Kerry Express" },
      { name: "Thailand Post" },
      { name: "Pos Malaysia" },
      { name: "Vietnam Post" },
      { name: "PT Pos Indonesia" },
      { name: "2GO Express" },
    ],
  },
  {
    label: "Middle East & Africa",
    couriers: [
      { name: "Emirates Post" },
      { name: "Saudi Post (SPL)" },
      { name: "Qatar Post" },
      { name: "Israel Post" },
      { name: "Turkish Post (PTT)" },
      { name: "MNG Kargo" },
      { name: "Posta Kenya" },
      { name: "G4S Courier" },
      { name: "Wells Fargo Courier" },
      { name: "The Courier Guy" },
      { name: "South African Post Office" },
      { name: "Egypt Post" },
      { name: "Nigerian Postal Service (NIPOST)" },
    ],
  },
  {
    label: "Latin America",
    couriers: [
      { name: "Correios (Brazil)" },
      { name: "Jadlog" },
      { name: "Andreani" },
      { name: "OCA (Argentina)" },
      { name: "Correos de Chile" },
      { name: "Servientrega" },
    ],
  },
  {
    label: "Other",
    couriers: [{ name: INTERNAL_COURIER }, { name: "Local courier" }],
  },
];

/** Every courier, flat. */
export const COURIERS: Courier[] = COURIER_GROUPS.flatMap((g) => g.couriers);

/** Names only, for the admin select and for validating what it submits. */
export const COURIER_NAMES: string[] = COURIERS.map((c) => c.name);

/** Look one up by name, case- and whitespace-insensitively. */
export function findCourier(name: string | null | undefined): Courier | null {
  const wanted = String(name ?? "").trim().toLowerCase();
  if (!wanted) return null;
  return COURIERS.find((c) => c.name.toLowerCase() === wanted) ?? null;
}

/** True when a name is one the dropdown offers. */
export function isKnownCourier(name: string | null | undefined): boolean {
  return findCourier(name) !== null;
}

/* -------------------------------------------------------------------------
 * Internal tracking references
 * ---------------------------------------------------------------------- */

/** Marks a reference the STORE issued, not one a courier did. */
export const TRACKING_PREFIX = "EDT";

/**
 * No I, L, O, U, 0 or 1.
 *
 * These references get read down a phone line and typed off a printed label.
 * Every pair this leaves out is one that gets confused in exactly that
 * situation, and a mistyped tracking number costs a support conversation.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Check character over the significant part, so a typo does not silently pass. */
function checkChar(payload: string): string {
  let sum = 0;
  const chars = payload.toUpperCase().replace(/-/g, "");
  for (let i = 0; i < chars.length; i++) {
    const value = ALPHABET.indexOf(chars[i]);
    // Digits outside the alphabet (the date part is 0-9) still have to count,
    // or a swapped month would go undetected. Fall back to the code point.
    sum += ((value >= 0 ? value : chars.charCodeAt(i)) + 1) * (i + 1);
  }
  return ALPHABET[sum % ALPHABET.length];
}

/** `EDT-2608-4F7K2M-J` — prefix, year+month, random body, check character. */
export const TRACKING_PATTERN = new RegExp(
  `^${TRACKING_PREFIX}-\\d{4}-[${ALPHABET}]{6}-[${ALPHABET}]$`
);

/**
 * A fresh internal reference.
 *
 * WHAT THIS IS NOT: a courier's tracking number. Nothing here is registered
 * with anyone — it is the store's own handle for a shipment, which is what the
 * customer's tracker follows. When the courier issues a real number, that one
 * goes in instead. The admin form says so at the point of clicking.
 *
 * `now` and `random` are injectable so the format can be tested for real
 * rather than asserted loosely.
 */
export function generateTrackingNumber(
  now: Date = new Date(),
  random: () => number = Math.random
): string {
  const when = Number.isNaN(now.getTime()) ? new Date() : now;
  const yy = String(when.getUTCFullYear() % 100).padStart(2, "0");
  const mm = String(when.getUTCMonth() + 1).padStart(2, "0");
  let body = "";
  for (let i = 0; i < 6; i++) {
    const pick = Math.floor(random() * ALPHABET.length);
    // A random() that returns exactly 1 (or anything out of range) must not
    // index past the end and produce "undefined" in a tracking number.
    body += ALPHABET[Math.min(Math.max(pick, 0), ALPHABET.length - 1)];
  }
  const stem = `${TRACKING_PREFIX}-${yy}${mm}-${body}`;
  return `${stem}-${checkChar(`${yy}${mm}${body}`)}`;
}

/** True when a value has the shape of one of ours — no check-character maths. */
export function looksInternal(value: string | null | undefined): boolean {
  return TRACKING_PATTERN.test(String(value ?? "").trim().toUpperCase());
}

/** True when it is one of ours AND the check character agrees. */
export function isValidInternalTracking(value: string | null | undefined): boolean {
  const v = String(value ?? "").trim().toUpperCase();
  if (!looksInternal(v)) return false;
  const [, date, body, check] = v.split("-");
  return checkChar(`${date}${body}`) === check;
}

/**
 * Where to send the customer to follow this parcel, or null.
 *
 * Null for an internal reference even when a courier is named: a number the
 * courier never issued will not resolve on their site, and a customer who gets
 * "not found" from UPS concludes the store has not really shipped anything.
 */
export function trackingUrlFor(
  courier: string | null | undefined,
  trackingNumber: string | null | undefined
): string | null {
  const number = String(trackingNumber ?? "").trim();
  if (!number) return null;
  if (looksInternal(number)) return null;
  const match = findCourier(courier);
  if (!match?.trackingUrl) return null;
  return match.trackingUrl.replace("{n}", encodeURIComponent(number));
}
