"use client";

import { notShippedNames } from "@/lib/countries";

/**
 * The countries this shop does not ship to, said out loud.
 *
 * ═══ WHY IT IS ON THE STOREFRONT AND NOT ONLY IN THE POLICY ════════════════
 *
 * Because the cost of finding out late is asymmetric. Somebody in an excluded
 * country who reads it here loses nothing. Somebody who does not read it finds
 * out when their country is missing from the checkout picker — after choosing
 * a build, which is the point at which a shopper assumes the site is broken
 * rather than that they are excluded, and emails to say so.
 *
 * Built from NOT_SHIPPED_CODES rather than written out, so the sentence and
 * the enforcement cannot drift: changing the list changes this line, and
 * changing this line is not possible without changing the list.
 */
export default function ShippingExclusions({
  className = "",
}: {
  className?: string;
}) {
  const names = notShippedNames();
  if (names.length === 0) return null;

  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;

  return (
    <p className={`text-on-surface-variant text-sm ${className}`}>
      We ship factory-direct to every country{" "}
      <strong className="text-white">except {list}</strong>.
    </p>
  );
}
