import { pool } from "../db/pool.js";
import { decryptWebhookSecret } from "./secret.js";
import { signWebhookPayload } from "./signature.js";
import { logger } from "../util/logger.js";
import { canonicalizeJson } from "../util/jsonCanonical.js";

type DeliveryRow = {
  id: string;
  endpoint_id: string;
  event: string;
  payload_json: unknown;
  attempts: number;
  url: string;
  secret_ciphertext: string;
  secret_iv: string;
  secret_tag: string;
};

const RETRY_DELAYS_SECONDS = [30, 120, 600, 3600, 21600, 43200, 86400, 172800];

export type WebhookWorker = {
  stop: () => void;
};

export function startWebhookDeliveryWorker(intervalMs = 5000): WebhookWorker {
  const timer = setInterval(() => {
    void processPendingDeliveries();
  }, intervalMs);

  return {
    stop: () => clearInterval(timer)
  };
}

export async function processPendingDeliveries(fetchImpl: typeof fetch = fetch): Promise<number> {
  let rows;
  try {
    rows = await pool.query(
      `SELECT d.id, d.endpoint_id, d.event, d.payload_json, d.attempts,
              e.url, e.secret_ciphertext, e.secret_iv, e.secret_tag
       FROM webhook_deliveries d
       JOIN webhook_endpoints e ON e.id = d.endpoint_id
       WHERE d.status='pending'
         AND d.next_attempt_at <= now()
         AND e.enabled=TRUE
       ORDER BY d.next_attempt_at ASC
       LIMIT 25`
    );
  } catch (err) {
    logger.warn({ err }, "webhook_worker_db_unavailable");
    return 0;
  }

  let processed = 0;

  for (const row of rows.rows as DeliveryRow[]) {
    processed += 1;
    const payload = row.payload_json;
    const rawBody = canonicalizeJson(payload);
    const timestamp = Math.floor(Date.now() / 1000);

    let secret = "";
    try {
      secret = decryptWebhookSecret({
        ciphertext: row.secret_ciphertext,
        iv: row.secret_iv,
        tag: row.secret_tag
      });
    } catch (e) {
      logger.error({ deliveryId: row.id }, "webhook_secret_decrypt_failed");
      await markDeliveryFailed(row.id, row.attempts + 1, "secret_decrypt_failed");
      continue;
    }

    const signature = signWebhookPayload(secret, timestamp, row.id, rawBody);

    try {
      const resp = await fetchImpl(row.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-PBI-Event": row.event,
          "X-PBI-Delivery-Id": row.id,
          "X-PBI-Timestamp": String(timestamp),
          "X-PBI-Signature": `v1=${signature}`
        },
        body: rawBody
      });

      if (resp.ok) {
        await markDeliveryDelivered(row.id);
      } else {
        await markDeliveryRetry(row.id, row.attempts + 1, `http_${resp.status}`);
      }
    } catch (e) {
      await markDeliveryRetry(row.id, row.attempts + 1, "network_error");
    }
  }

  return processed;
}

async function markDeliveryDelivered(deliveryId: string): Promise<void> {
  await pool.query(
    `UPDATE webhook_deliveries
     SET status='delivered', updated_at=now()
     WHERE id=$1`,
    [deliveryId]
  );
}

async function markDeliveryFailed(deliveryId: string, attempts: number, error: string): Promise<void> {
  await pool.query(
    `UPDATE webhook_deliveries
     SET status='failed', attempts=$2, last_error=$3, updated_at=now()
     WHERE id=$1`,
    [deliveryId, attempts, error]
  );
}

async function markDeliveryRetry(deliveryId: string, attempts: number, error: string): Promise<void> {
  if (attempts >= RETRY_DELAYS_SECONDS.length) {
    await markDeliveryFailed(deliveryId, attempts, error);
    return;
  }

  const delay = RETRY_DELAYS_SECONDS[attempts - 1] ?? 30;
  await pool.query(
    `UPDATE webhook_deliveries
     SET attempts=$2,
         last_error=$3,
         next_attempt_at=now() + ($4 * interval '1 second'),
         updated_at=now()
     WHERE id=$1`,
    [deliveryId, attempts, error, delay]
  );
}
