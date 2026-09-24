import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { recordGatewayIds } from "../lib/orders";

/**
 * Recording the gateway's ids on an order.
 *
 * ═══ THE BUG THIS EXISTS TO STOP ═══════════════════════════════════════════
 *
 * PostgREST sends an update as ONE statement. A payload naming a column the
 * database does not have is rejected whole — the columns that were fine are not
 * written either.
 *
 * So `.update({ stripe_session_id, gateway_reference })` does not degrade
 * gracefully on a database that has not run migration 0018. It writes nothing,
 * and `stripe_session_id` is what the PayPal card-fields capture looks an order
 * up by. The deploy looks healthy; payments stop being captured.
 * ═══════════════════════════════════════════════════════════════════════════
 */

type Update = Record<string, unknown>;

/**
 * A Supabase stand-in that rejects unknown columns the way PostgREST does —
 * whole statement, nothing written, error PGRST204.
 */
function fakeAdmin(knownColumns: string[]) {
  const applied: Update[] = [];
  const rejected: Update[] = [];
  const row: Update = {};

  const admin = {
    from() {
      return {
        update(patch: Update) {
          return {
            eq() {
              const unknown = Object.keys(patch).find(
                (c) => !knownColumns.includes(c)
              );
              if (unknown) {
                rejected.push(patch);
                return Promise.resolve({
                  error: {
                    code: "PGRST204",
                    message: `Could not find the '${unknown}' column of 'orders' in the schema cache`,
                  },
                });
              }
              applied.push(patch);
              Object.assign(row, patch);
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { admin: admin as any, applied, rejected, row };
}

const ALL = ["stripe_session_id", "gateway_reference", "gateway_account"];
/** A database that has run every migration EXCEPT 0018. */
const PRE_0018 = ["stripe_session_id"];

describe("a database that has run migration 0018", () => {
  test("records the legacy id and both new columns", async () => {
    const db = fakeAdmin(ALL);
    await recordGatewayIds(db.admin, "order-1", {
      legacySessionId: "cs_live_abc",
      reference: "cs_live_abc",
      account: "5KP3u95bQpv",
    });
    assert.equal(db.rejected.length, 0);
    assert.deepEqual(db.row, {
      stripe_session_id: "cs_live_abc",
      gateway_reference: "cs_live_abc",
      gateway_account: "5KP3u95bQpv",
    });
  });

  test("the legacy column is written in a statement of its own", async () => {
    // The entire fix. Bundled with a newer column it shares that column's fate.
    const db = fakeAdmin(ALL);
    await recordGatewayIds(db.admin, "order-1", {
      legacySessionId: "cs_live_abc",
      reference: "cs_live_abc",
    });
    assert.equal(db.applied.length, 2);
    assert.deepEqual(db.applied[0], { stripe_session_id: "cs_live_abc" });
    assert.deepEqual(db.applied[1], { gateway_reference: "cs_live_abc" });
  });
});

describe("a database that has NOT run migration 0018", () => {
  test("THE PAYPAL LOOKUP KEY STILL LANDS", async () => {
    /**
     * The regression. loadOrder({ paypalOrderId }) finds the order by
     * stripe_session_id — if this write is lost, the inline card-fields capture
     * cannot find the order and the buyer's payment is never captured.
     */
    const db = fakeAdmin(PRE_0018);
    await recordGatewayIds(db.admin, "order-1", {
      legacySessionId: "5O190127TN364715T",
      reference: "5O190127TN364715T",
    });
    assert.equal(db.row.stripe_session_id, "5O190127TN364715T");
  });

  test("the stripe session id still lands, so tracking write-back survives", async () => {
    const db = fakeAdmin(PRE_0018);
    await recordGatewayIds(db.admin, "order-1", {
      legacySessionId: "cs_live_abc",
      reference: "cs_live_abc",
      account: null,
    });
    assert.equal(db.row.stripe_session_id, "cs_live_abc");
  });

  test("the newer columns are refused, and that is not fatal", async () => {
    const db = fakeAdmin(PRE_0018);
    await assert.doesNotReject(() =>
      recordGatewayIds(db.admin, "order-1", {
        legacySessionId: "cs_live_abc",
        reference: "cs_live_abc",
        account: "acct",
      })
    );
    assert.equal(db.rejected.length, 1);
    assert.deepEqual(db.rejected[0], {
      gateway_reference: "cs_live_abc",
      gateway_account: "acct",
    });
  });

  test("an Authorize.Net order with no legacy id does not throw either", async () => {
    const db = fakeAdmin(PRE_0018);
    await assert.doesNotReject(() =>
      recordGatewayIds(db.admin, "order-1", { account: "5KP3u95bQpv" })
    );
    assert.deepEqual(db.applied, []);
  });
});

describe("not writing when there is nothing to write", () => {
  test("no ids means no statements at all", async () => {
    const db = fakeAdmin(ALL);
    await recordGatewayIds(db.admin, "order-1", {});
    assert.equal(db.applied.length, 0);
    assert.equal(db.rejected.length, 0);
  });

  test("empty and null ids are not ids", async () => {
    const db = fakeAdmin(ALL);
    await recordGatewayIds(db.admin, "order-1", {
      legacySessionId: "",
      reference: null,
      account: undefined,
    });
    assert.equal(db.applied.length, 0);
  });

  test("an over-long reference is bounded rather than rejected by the column", async () => {
    const db = fakeAdmin(ALL);
    await recordGatewayIds(db.admin, "order-1", { reference: "x".repeat(500) });
    assert.equal(String(db.row.gateway_reference).length, 200);
  });
});
