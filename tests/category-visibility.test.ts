import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ALL_PRODUCTS_LINK,
  categoryLinks,
  categoryVisible,
  heroLinks,
  hiddenByCategory,
  hiddenCategoryIds,
  primaryShopLink,
  productVisible,
  visibleCategories,
  visibleProducts,
} from "../lib/categories";
import { hiddenCategoryFilter } from "../lib/db";
import type { Category, Product } from "../lib/types";

/**
 * Hiding a category hides everything about it.
 *
 * The first version of the toggle hid the LINKS: the nav, the footer and the
 * homepage tile. Its products stayed in the grid, stayed searchable, kept
 * working product pages and could still be bought — so switching a range off
 * produced a shop that still sold it, only with no way to browse it.
 *
 * These tests are about that gap. Two things matter most: a row from a
 * database that has not run migration 0021 must read as VISIBLE (otherwise
 * deploying the toggle empties the whole shop), and every failure mode must
 * fail OPEN — showing something that should have been hidden is a visibility
 * bug, while hiding everything is an outage.
 */

const cat = (over: Partial<Category> = {}): Category => ({
  id: "c-trikes",
  slug: "trikes",
  name: "Trikes",
  description: null,
  image_url: null,
  position: 0,
  ...over,
});

const product = (over: Partial<Product> = {}): Product =>
  ({
    id: "p1",
    slug: "voltage-drift",
    name: "Voltage Drift",
    category_id: "c-trikes",
    status: "active",
    price_cents: 189900,
    ...over,
  }) as Product;

describe("a category is visible unless it was switched off", () => {
  test("active: true is visible", () => {
    assert.equal(categoryVisible(cat({ active: true })), true);
  });

  test("active: false is hidden", () => {
    assert.equal(categoryVisible(cat({ active: false })), false);
  });

  test("NO active field at all is visible — the pre-migration shape", () => {
    // The row a database that has not run 0021 returns. If this ever reads as
    // hidden, deploying the toggle before its migration empties the storefront.
    const row = cat();
    assert.equal("active" in row, false);
    assert.equal(categoryVisible(row), true);
  });

  test("a missing category is not visible", () => {
    assert.equal(categoryVisible(null), false);
    assert.equal(categoryVisible(undefined), false);
  });
});

describe("splitting the categories", () => {
  const all = [
    cat({ id: "a", slug: "trikes", name: "Trikes", active: true }),
    cat({ id: "b", slug: "parts", name: "Parts", active: false }),
    cat({ id: "c", slug: "dirt-bikes", name: "Dirt Bikes" }), // pre-migration
  ];

  test("only the switched-on ones are visible, in their given order", () => {
    assert.deepEqual(
      visibleCategories(all).map((c) => c.slug),
      ["trikes", "dirt-bikes"]
    );
  });

  test("the hidden list holds only rows explicitly switched off", () => {
    assert.deepEqual(hiddenCategoryIds(all), ["b"]);
  });

  test("a pre-migration catalogue hides nothing at all", () => {
    assert.deepEqual(hiddenCategoryIds([cat(), cat({ id: "x", slug: "parts" })]), []);
  });

  test("the two views agree: nothing is both visible and hidden", () => {
    const hidden = new Set(hiddenCategoryIds(all));
    for (const c of visibleCategories(all)) {
      assert.equal(hidden.has(String(c.id)), false, `${c.slug} is in both lists`);
    }
  });

  test("empty and missing input are survivable", () => {
    assert.deepEqual(visibleCategories([]), []);
    assert.deepEqual(hiddenCategoryIds([]), []);
    assert.deepEqual(
      visibleCategories(undefined as unknown as Category[]),
      []
    );
  });
});

describe("a product inherits its category's visibility", () => {
  test("a product of a switched-off category is hidden", () => {
    const p = product({ category: cat({ active: false }) });
    assert.equal(productVisible(p), false);
  });

  test("a product of a switched-on category is shown", () => {
    assert.equal(productVisible(product({ category: cat({ active: true }) })), true);
  });

  test("a product of a pre-migration category is shown", () => {
    assert.equal(productVisible(product({ category: cat() })), true);
  });

  test("a product filed under NOTHING is shown", () => {
    // Being uncategorised is not the same as being in a hidden category, and
    // switching one category off must not sweep up every loose product.
    assert.equal(productVisible(product({ category_id: null, category: null })), true);
  });

  test("a product read WITHOUT the join is shown, not hidden", () => {
    // Fail-open: a forgotten join should make the filter do nothing, never
    // empty the catalogue.
    assert.equal(productVisible(product({ category: undefined })), true);
  });

  test("visibleProducts drops exactly the hidden ones", () => {
    const rows = [
      product({ id: "keep-1", category: cat({ active: true }) }),
      product({ id: "drop", category: cat({ id: "c-parts", active: false }) }),
      product({ id: "keep-2", category_id: null, category: null }),
      product({ id: "keep-3", category: cat() }),
    ];
    assert.deepEqual(
      visibleProducts(rows).map((p) => p.id),
      ["keep-1", "keep-2", "keep-3"]
    );
  });
});

describe("the checkout's id-only check", () => {
  const hidden = new Set(["c-parts"]);

  test("refuses a product in a switched-off category", () => {
    assert.equal(hiddenByCategory("c-parts", hidden), true);
  });

  test("allows a product in a switched-on category", () => {
    assert.equal(hiddenByCategory("c-trikes", hidden), false);
  });

  test("allows an uncategorised product", () => {
    assert.equal(hiddenByCategory(null, hidden), false);
    assert.equal(hiddenByCategory(undefined, hidden), false);
  });

  test("an unreadable category list blocks nothing", () => {
    // The fail-open case: if the categories could not be read the set is
    // empty, and every checkout still goes through.
    assert.equal(hiddenByCategory("c-parts", new Set()), false);
  });
});

describe("the links the nav, footer and hero are built from", () => {
  const all = [
    cat({ id: "a", slug: "trikes", name: "Trikes" }),
    cat({ id: "b", slug: "parts", name: "Parts", active: false }),
    cat({ id: "c", slug: "dirt-bikes", name: "Dirt Bikes" }),
  ];

  test("a switched-off category gets no link anywhere", () => {
    const links = categoryLinks(all);
    assert.deepEqual(links.map((l) => l.label), ["Trikes", "Dirt Bikes"]);
    assert.equal(
      links.some((l) => l.href.includes("parts")),
      false,
      "a hidden category still has a door"
    );
  });

  test("slugs are encoded, so an odd one cannot break the URL", () => {
    const links = categoryLinks([cat({ slug: "go karts & trikes" })]);
    assert.equal(links[0].href, "/shop?category=go%20karts%20%26%20trikes");
  });

  test("the hero shows at most two doors, named after the ranges", () => {
    const doors = heroLinks(all);
    assert.deepEqual(doors.map((d) => d.label), ["Shop Trikes", "Shop Dirt Bikes"]);
    assert.deepEqual(doors.map((d) => d.href), [
      "/shop?category=trikes",
      "/shop?category=dirt-bikes",
    ]);
  });

  test("a third category does not crowd the hero", () => {
    const doors = heroLinks([...all, cat({ id: "d", slug: "gear", name: "Gear" })]);
    assert.equal(doors.length, 2);
  });

  test("switching a range off removes its hero button", () => {
    const doors = heroLinks([
      cat({ id: "a", slug: "trikes", name: "Trikes" }),
      cat({ id: "c", slug: "dirt-bikes", name: "Dirt Bikes", active: false }),
    ]);
    assert.deepEqual(doors.map((d) => d.label), ["Shop Trikes"]);
  });

  test("with everything switched off the hero still has a door — the whole shop", () => {
    const doors = heroLinks([cat({ active: false })]);
    assert.deepEqual(doors, [ALL_PRODUCTS_LINK]);
    assert.equal(doors[0].href, "/shop");
  });

  test("no categories at all (or no database) falls back the same way", () => {
    assert.deepEqual(heroLinks([]), [ALL_PRODUCTS_LINK]);
    assert.deepEqual(primaryShopLink([]), ALL_PRODUCTS_LINK);
  });

  test("the marketing CTA names the first live range", () => {
    assert.equal(primaryShopLink(all).label, "Shop Trikes");
    assert.equal(primaryShopLink(all).href, "/shop?category=trikes");
  });
});

/**
 * The regression guard.
 *
 * Every bug this file is about came from the same thing: a category slug typed
 * into a component. One is enough — it survives the toggle, and it is a live
 * door into a range the owner has withdrawn. So the sources that render
 * category links must not contain one.
 */
describe("no category slug is written into a component", () => {
  const SOURCES = [
    "components/storefront/SiteHeader.tsx",
    "components/storefront/SiteFooter.tsx",
    "app/page.tsx",
    "app/our-story/page.tsx",
  ];

  for (const file of SOURCES) {
    test(`${file} builds its category links from the data`, () => {
      const src = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
      const literal = src.match(/category=(?!\$)[a-z0-9-]+/gi);
      assert.equal(
        literal,
        null,
        `${file} hard-codes ${literal?.join(", ")} — switching that category off will leave this link live`
      );
    });
  }
});

/**
 * The query filter.
 *
 * This is the one line in the data layer that can empty the shop by being
 * subtly wrong, and the storefront's worst failure mode is an empty shop — so
 * it is pinned down here rather than trusted. The read that uses it also falls
 * back to an unfiltered query if the server rejects it (see getProductsCached),
 * which is the belt to this braces.
 */
describe("the filter that excludes a hidden category's products", () => {
  test("no hidden categories means NO filter at all", () => {
    // Not a filter that matches everything — none. A shop with nothing hidden
    // must issue exactly the query it issued before this feature existed.
    assert.equal(hiddenCategoryFilter([]), null);
    assert.equal(hiddenCategoryFilter(new Set()), null);
  });

  test("uncategorised products are explicitly kept", () => {
    // SQL's NOT IN is NULL for a NULL column, so without the is.null clause
    // every product with no category would vanish the moment one category was
    // switched off.
    const filter = hiddenCategoryFilter(["c-parts"]);
    assert.ok(filter?.startsWith("category_id.is.null,"), filter ?? "null");
  });

  test("it excludes exactly the ids given", () => {
    assert.equal(
      hiddenCategoryFilter(["c-parts", "c-gear"]),
      "category_id.is.null,category_id.not.in.(c-parts,c-gear)"
    );
  });

  test("empty ids are dropped rather than left in the list", () => {
    // A trailing empty value would make the list unparseable.
    assert.equal(
      hiddenCategoryFilter(["c-parts", ""]),
      "category_id.is.null,category_id.not.in.(c-parts)"
    );
    assert.equal(hiddenCategoryFilter([""]), null);
  });

  test("an id with a comma or bracket cannot end the list early", () => {
    // Our ids are uuids, so this never fires in practice — it is here because
    // an unquoted value containing a comma would silently change which
    // categories the query excludes.
    assert.equal(
      hiddenCategoryFilter(["a,b", "plain"]),
      'category_id.is.null,category_id.not.in.("a,b",plain)'
    );
    assert.equal(
      hiddenCategoryFilter(['ev"il)']),
      'category_id.is.null,category_id.not.in.("evil)")'
    );
  });

  test("it is built from the hidden ids the categories give", () => {
    // The two halves joined up: what the admin switched off, as a filter.
    const all = [
      cat({ id: "a", slug: "trikes" }),
      cat({ id: "b", slug: "parts", active: false }),
    ];
    assert.equal(
      hiddenCategoryFilter(hiddenCategoryIds(all)),
      "category_id.is.null,category_id.not.in.(b)"
    );
  });
});
