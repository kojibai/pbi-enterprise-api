import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
import { generateWebhookSecret } from "../webhooks/secret.js";
import { processPendingDeliveries } from "../webhooks/worker.js";
import { signWebhookPayload } from "../webhooks/signature.js";

const hasDb = Boolean(process.env.DATABASE_URL);
const hasWebhookKey = Boolean(process.env.PBI_WEBHOOK_SECRET_KEY);

if (!hasDb || !hasWebhookKey) {
  test("webhook worker integration (skipped without DATABASE_URL or PBI_WEBHOOK_SECRET_KEY)", { skip: "missing env" }, () => {});
} else {
  test("webhook worker retries and then delivers", async () => {
    const apiKeyId = randomUUID();
    const endpointId = randomUUID();
    const deliveryId = randomUUID();
    const receiptId = randomUUID();
    const { raw, encrypted } = generateWebhookSecret();
    const payload = { id: randomUUID(), type: "receipt.created", createdAt: new Date().toISOString(), data: { receipt: {}, challenge: null } };

    await pool.query(
      `INSERT INTO api_keys (id, label, key_hash, plan, quota_per_month, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE)`,
      [apiKeyId, "test", `hash_${apiKeyId}`, "enterprise", "100000"]
    );

    try {
      await pool.query(
        `INSERT INTO webhook_endpoints
           (id, api_key_id, url, events, secret_hash, secret_ciphertext, secret_iv, secret_tag, enabled)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)`,
        [endpointId, apiKeyId, "https://example.test/webhook", ["receipt.created"], encrypted.hash, encrypted.ciphertext, encrypted.iv, encrypted.tag]
      );

      await pool.query(
        `INSERT INTO webhook_deliveries (id, endpoint_id, event, receipt_id, payload_json, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')`,
        [deliveryId, endpointId, "receipt.created", receiptId, payload]
      );

      let callCount = 0;
      const fetchImpl: typeof fetch = async (_input, init) => {
        callCount += 1;
        const headers = new Headers(init?.headers);
        const timestamp = Number(headers.get("X-PBI-Timestamp"));
        const deliveryHeader = headers.get("X-PBI-Delivery-Id");
        const signatureHeader = headers.get("X-PBI-Signature");
        const rawBody = typeof init?.body === "string" ? init.body : "";
        const expected = signWebhookPayload(raw, timestamp, deliveryHeader ?? "", rawBody);
        assert.equal(signatureHeader, `v1=${expected}`);
        return new Response("", { status: callCount === 1 ? 500 : 200 });
      };

      await processPendingDeliveries(fetchImpl);
      const afterFirst = await pool.query(`SELECT status, attempts FROM webhook_deliveries WHERE id=$1`, [deliveryId]);
      assert.equal(afterFirst.rows[0]?.status, "pending");
      assert.equal(afterFirst.rows[0]?.attempts, 1);

      await pool.query(`UPDATE webhook_deliveries SET next_attempt_at=now() WHERE id=$1`, [deliveryId]);
      await processPendingDeliveries(fetchImpl);
      const afterSecond = await pool.query(`SELECT status FROM webhook_deliveries WHERE id=$1`, [deliveryId]);
      assert.equal(afterSecond.rows[0]?.status, "delivered");
    } finally {
      await pool.query(`DELETE FROM webhook_deliveries WHERE endpoint_id=$1`, [endpointId]);
      await pool.query(`DELETE FROM webhook_endpoints WHERE id=$1`, [endpointId]);
      await pool.query(`DELETE FROM api_keys WHERE id=$1`, [apiKeyId]);
    }
  });
}
