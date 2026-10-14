import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  BEST_SELLER_WINDOW_DAYS,
  SELLING_STATUSES,
  isPromotable,
  rankBySold,
} from "../lib/best-seller";
import type { Product } from "../lib/types";

/**
 * WHICH PRODUCT THE CAMPAIGN PROMOTES.
 *
 * Counted from paid orders rather than taken from the `featured` flag, which is
 * an opinion somebody set once. The two failures that matter:
 *
 *   - counting PENDING orders, which would let the very buyers this campaign
 *     chases nominate the product it then promotes back at them;
 *   - promoting something unpublished or sold out, which sends every reader of
 *     a two-month sequence to a dead end — worse than no offer at all, because
 *     the offer is the part of the email that asks them to click.
 */

describe("ranking by units actually sold", () => {
  test("sums quantities per product, highest first", () => {
    assert.deepEqual(
      rankBySold([
        { product_id: "a", qty: 1 },
        { product_id: "b", qty: 5 },
        { product_id: "a", qty: 3 },
      ]),
      [
        { productId: "b", units: 5 },
        { productId: "a", units: 4 },
      ]
    );
  });

  test("ONLY PAID MONEY COUNTS", () => {
    // The query filters on status; this is the list it is allowed to use.
    assert.deepEqual([...SELLING_STATUSES], ["paid", "fulfilled"]);
    assert.ok(!(SELLING_STATUSES as readonly string[]).includes("pending"));
  });

  test("a tie resolves the same way every time", () => {
    // Otherwise the "best seller" flips between two equal products run to run,
    // and a two-month campaign looks like it is guessing.
    const lines = [
      { product_id: "zebra", qty: 2 },
      { product_id: "apple", qty: 2 },
    ];
    assert.deepEqual(rankBySold(lines), rankBySold([...lines].reverse()));
    assert.equal(rankBySold(lines)[0].productId, "apple");
  });

  test("a line whose product was deleted is skipped, not counted as one", () => {
    assert.deepEqual(rankBySold([{ product_id: null, qty: 9 }]), []);
  });

  test("nonsense quantities do not become sales", () => {
    assert.deepEqual(
      rankBySold([
        { product_id: "a", qty: null },
        { product_id: "a", qty: 0 },
        { product_id: "a", qty: -4 },
        { product_id: "a", qty: Number.NaN },
        { product_id: "a", qty: 2 },
      ]),
      [{ productId: "a", units: 2 }]
    );
  });

  test("nothing sold yet is an empty ranking, not a crash", () => {
    assert.deepEqual(rankBySold([]), []);
  });

  test("the window is a year — one old spike cannot define it forever", () => {
    assert.equal(BEST_SELLER_WINDOW_DAYS, 365);
  });
});

describe("whether the winner is fit to promote", () => {
  const product = (over: Partial<Product>) =>
    ({ status: "active", stock: 5, slug: "voltage-drift", ...over }) as Product;

  test("an active, in-stock, reachable product is", () => {
    assert.equal(isPromotable(product({})), true);
  });

  test("UNTRACKED STOCK IS NOT THE SAME AS NO STOCK", () => {
    // A null stock column means the shop does not count units for this
    // product — refusing to promote it would quietly exclude the whole
    // made-to-order range.
    assert.equal(isPromotable(product({ stock: null as unknown as number })), true);
    assert.equal(isPromotable(product({ stock: undefined })), true);
  });

  test("sold out, unpublished or unreachable is not", () => {
    assert.equal(isPromotable(product({ stock: 0 })), false);
    assert.equal(isPromotable(product({ status: "draft" })), false);
    assert.equal(isPromotable(product({ status: "archived" })), false);
    assert.equal(isPromotable(product({ slug: "" })), false);
  });

  test("nothing at all is not promotable", () => {
    assert.equal(isPromotable(null), false);
    assert.equal(isPromotable(undefined), false);
  });
});
