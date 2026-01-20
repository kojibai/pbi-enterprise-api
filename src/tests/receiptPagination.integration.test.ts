import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
import { buildReceiptQuery } from "../pbi/receiptQuery.js";
import { encodeReceiptCursor } from "../pbi/receiptCursor.js";

if (!process.env.DATABASE_URL) {
  test("receipt pagination integration (skipped without DATABASE_URL)", { skip: "DATABASE_URL not set" }, () => {});
} else {
  test("receipt pagination stays stable across inserts", async () => {
    const apiKeyId = randomUUID();
    const base = new Date("2026-02-01T00:00:00Z");

    await pool.query(
      `INSERT INTO api_keys (id, label, key_hash, plan, quota_per_month, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE)`,
      [apiKeyId, "test", `hash_${apiKeyId}`, "enterprise", "100000"]
    );

    try {
      for (let i = 0; i < 5; i += 1) {
        const challengeId = randomUUID();
        const receiptId = randomUUID();
        const createdAt = new Date(base.getTime() + i * 1000);

        await pool.query(
          `INSERT INTO pbi_challenges (id, api_key_id, challenge_b64url, purpose, action_hash_hex, expires_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [challengeId, apiKeyId, "abc", "ACTION_COMMIT", "a".repeat(64), new Date(base.getTime() + 600000), createdAt]
        );

        await pool.query(
          `INSERT INTO pbi_receipts (id, api_key_id, challenge_id, receipt_hash_hex, decision, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [receiptId, apiKeyId, challengeId, "deadbeef", "PBI_VERIFIED", createdAt]
        );
      }

      const page1Query = buildReceiptQuery({ apiKeyId, limit: 2, order: "desc" });
      const page1 = await pool.query(page1Query.text, page1Query.values);
      assert.equal(page1.rowCount, 2);

      const last1 = page1.rows[1] as { created_at: string; id: string };
      const cursor1 = encodeReceiptCursor({ createdAt: new Date(last1.created_at), id: last1.id });

      // Insert a newer receipt after page 1
      const newChallengeId = randomUUID();
      const newReceiptId = randomUUID();
      await pool.query(
        `INSERT INTO pbi_challenges (id, api_key_id, challenge_b64url, purpose, action_hash_hex, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [newChallengeId, apiKeyId, "abc", "ACTION_COMMIT", "b".repeat(64), new Date(base.getTime() + 600000), new Date(base.getTime() + 10000)]
      );
      await pool.query(
        `INSERT INTO pbi_receipts (id, api_key_id, challenge_id, receipt_hash_hex, decision, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [newReceiptId, apiKeyId, newChallengeId, "deadbeef", "PBI_VERIFIED", new Date(base.getTime() + 10000)]
      );

      const page2Query = buildReceiptQuery({
        apiKeyId,
        limit: 2,
        order: "desc",
        cursor: { createdAt: new Date(last1.created_at), id: last1.id }
      });
      const page2 = await pool.query(page2Query.text, page2Query.values);
      assert.equal(page2.rowCount, 2);

      const last2 = page2.rows[1] as { created_at: string; id: string };
      const cursor2 = encodeReceiptCursor({ createdAt: new Date(last2.created_at), id: last2.id });

      const page3Query = buildReceiptQuery({
        apiKeyId,
        limit: 2,
        order: "desc",
        cursor: { createdAt: new Date(last2.created_at), id: last2.id }
      });
      const page3 = await pool.query(page3Query.text, page3Query.values);
      assert.ok(page3.rowCount === 1 || page3.rowCount === 0);

      assert.notEqual(cursor1, cursor2);
    } finally {
      await pool.query(`DELETE FROM pbi_receipts WHERE api_key_id=$1`, [apiKeyId]);
      await pool.query(`DELETE FROM pbi_challenges WHERE api_key_id=$1`, [apiKeyId]);
      await pool.query(`DELETE FROM api_keys WHERE id=$1`, [apiKeyId]);
    }
  });
}
