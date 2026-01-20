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

// How many deliveries a single tick can claim/process.
const CLAIM_BATCH_SIZE = 25;

// If a worker crashes after claiming (status=processing), we must requeue.
// We use updated_at as a conservative claim timestamp (no schema change required).
const RECLAIM_STALE_PROCESSING_SECONDS = 15 * 60;

// Avoid hangs: cap webhook POST time.
const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

export type WebhookWorker = {
  stop: () => void;
};

export function startWebhookDeliveryWorker(intervalMs = 5000): WebhookWorker {
  const timer = setInterval(() => {
    // IMPORTANT: swallow rejections so the process never crashes from the interval tick
    void processPendingDeliveries().catch((err: unknown) => {
      logger.warn({ err }, "webhook_worker_tick_failed");
    });
  }, intervalMs);

  return { stop: () => clearInterval(timer) };
}

export async function processPendingDeliveries(
  fetchImpl: typeof fetch = fetch,
  opts?: { fetchTimeoutMs?: number }
): Promise<number> {
  const fetchTimeoutMs =
    typeof opts?.fetchTimeoutMs === "number" && Number.isFinite(opts.fetchTimeoutMs) && opts.fetchTimeoutMs > 0
      ? opts.fetchTimeoutMs
      : DEFAULT_FETCH_TIMEOUT_MS;

  const claimed = await claimDeliveries(CLAIM_BATCH_SIZE);
  if (claimed.length === 0) return 0;

  let processed = 0;

  for (const row of claimed) {
    processed += 1;

    const rawBody = canonicalizeJson(row.payload_json);
    const timestamp = Math.floor(Date.now() / 1000);

    let secret: string;
    try {
      secret = decryptWebhookSecret({
        ciphertext: row.secret_ciphertext,
        iv: row.secret_iv,
        tag: row.secret_tag
      });
    } catch (err: unknown) {
      logger.error({ deliveryId: row.id, err }, "webhook_secret_decrypt_failed");
      await markDeliveryFailed(row.id, row.attempts + 1, "secret_decrypt_failed").catch((e: unknown) => {
        logger.warn({ err: e, deliveryId: row.id }, "webhook_delivery_fail_update_failed");
      });
      continue;
    }

    const signature = signWebhookPayload(secret, timestamp, row.id, rawBody);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), fetchTimeoutMs);

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
        body: rawBody,
        signal: controller.signal
      });

      if (resp.ok) {
        await markDeliveryDelivered(row.id);
      } else {
        await markDeliveryRetry(row.id, row.attempts + 1, `http_${resp.status}`);
      }
    } catch (err: unknown) {
      const isAbort =
        typeof err === "object" &&
        err !== null &&
        "name" in err &&
        typeof (err as { name?: unknown }).name === "string" &&
        (err as { name: string }).name === "AbortError";

      await markDeliveryRetry(row.id, row.attempts + 1, isAbort ? "timeout" : "network_error");
    } finally {
      clearTimeout(timeout);
    }
  }

  return processed;
}

/**
 * Claim deliveries safely across multiple instances:
 * - Requeue stale "processing" rows (worker crashed mid-flight)
 * - SELECT ... FOR UPDATE SKIP LOCKED to prevent double-claim
 * - Atomically set status='processing' before releasing the transaction
 */
async function claimDeliveries(limit: number): Promise<DeliveryRow[]> {
  // CRITICAL: pool.connect() can throw (wrong creds, db down). Catch it.
  let client: { query: (q: string, v?: unknown[]) => Promise<{ rows: unknown }>; release: () => void } | null = null;

  try {
    client = await pool.connect();
  } catch (err: unknown) {
    logger.warn({ err }, "webhook_worker_db_connect_failed");
    return [];
  }

  try {
    await client.query("BEGIN");

    // Reclaim stale processing rows so they don't get stuck forever.
    await client.query(
      `
      UPDATE webhook_deliveries
      SET status='pending',
          last_error='reclaimed_stale_processing',
          updated_at=now()
      WHERE status='processing'
        AND updated_at < now() - ($1 * interval '1 second')
      `,
      [RECLAIM_STALE_PROCESSING_SECONDS]
    );

    const claimed = await client.query(
      `
      WITH picked AS (
        SELECT d.id, d.endpoint_id
        FROM webhook_deliveries d
        JOIN webhook_endpoints e ON e.id = d.endpoint_id
        WHERE d.status='pending'
          AND d.next_attempt_at <= now()
          AND e.enabled=TRUE
        ORDER BY d.next_attempt_at ASC
        LIMIT $1
        FOR UPDATE OF d SKIP LOCKED
      )
      UPDATE webhook_deliveries d
      SET status='processing', updated_at=now()
      FROM picked p
      JOIN webhook_endpoints e ON e.id = p.endpoint_id
      WHERE d.id = p.id
      RETURNING d.id, d.endpoint_id, d.event, d.payload_json, d.attempts,
                e.url, e.secret_ciphertext, e.secret_iv, e.secret_tag
      `,
      [limit]
    );

    await client.query("COMMIT");

    const rows = claimed.rows;
    if (!Array.isArray(rows)) return [];

    // Lightweight runtime shape check without using `any`.
    const out: DeliveryRow[] = [];
    for (const r of rows) {
      if (typeof r !== "object" || r === null) continue;
      const o = r as Partial<Record<keyof DeliveryRow, unknown>>;
      if (
        typeof o.id === "string" &&
        typeof o.endpoint_id === "string" &&
        typeof o.event === "string" &&
        typeof o.attempts === "number" &&
        typeof o.url === "string" &&
        typeof o.secret_ciphertext === "string" &&
        typeof o.secret_iv === "string" &&
        typeof o.secret_tag === "string" &&
        "payload_json" in o
      ) {
        out.push({
          id: o.id,
          endpoint_id: o.endpoint_id,
          event: o.event,
          payload_json: o.payload_json as unknown,
          attempts: o.attempts,
          url: o.url,
          secret_ciphertext: o.secret_ciphertext,
          secret_iv: o.secret_iv,
          secret_tag: o.secret_tag
        });
      }
    }

    return out;
  } catch (err: unknown) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback failure
    }
    logger.warn({ err }, "webhook_worker_claim_failed");
    return [];
  } finally {
    client.release();
  }
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
     SET status='pending',
         attempts=$2,
         last_error=$3,
         next_attempt_at=now() + ($4 * interval '1 second'),
         updated_at=now()
     WHERE id=$1`,
    [deliveryId, attempts, error, delay]
  );
}
