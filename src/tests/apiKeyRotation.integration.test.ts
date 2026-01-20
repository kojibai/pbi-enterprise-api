import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
import { rotateApiKey } from "../portal/apiKeyService.js";

if (!process.env.DATABASE_URL) {
  test("api key rotation integration (skipped without DATABASE_URL)", { skip: "DATABASE_URL not set" }, () => {});
} else {
  test("rotateApiKey creates new key and disables old by default", async () => {
    const customerId = randomUUID();
    const apiKeyId = randomUUID();

    await pool.query(
      `INSERT INTO customers (id, email, plan, quota_per_month, is_active)
       VALUES ($1, $2, $3, $4, TRUE)`,
      [customerId, `${customerId}@example.com`, "enterprise", "100000"]
    );

    await pool.query(
      `INSERT INTO api_keys (id, label, key_hash, plan, quota_per_month, is_active, customer_id)
       VALUES ($1, $2, $3, $4, $5, TRUE, $6)`,
      [apiKeyId, "test", `hash_${apiKeyId}`, "enterprise", "100000", customerId]
    );

    try {
      const result = await rotateApiKey({ customerId, keyId: apiKeyId, keepOldActive: false });
      assert.equal(result.ok, true);

      const oldRow = await pool.query(`SELECT is_active FROM api_keys WHERE id=$1`, [apiKeyId]);
      assert.equal(oldRow.rows[0]?.is_active, false);

      const newRow = await pool.query(`SELECT is_active FROM api_keys WHERE id=$1`, [result.apiKeyId]);
      assert.equal(newRow.rows[0]?.is_active, true);
    } finally {
      await pool.query(`DELETE FROM api_keys WHERE customer_id=$1`, [customerId]);
      await pool.query(`DELETE FROM customers WHERE id=$1`, [customerId]);
    }
  });
}
