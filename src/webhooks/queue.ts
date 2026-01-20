import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";

export type WebhookEvent = "receipt.created";

export type WebhookPayload = {
  id: string; // delivery/event id (we set this per-endpoint delivery)
  type: WebhookEvent;
  createdAt: string;
  data: {
    receipt: Record<string, unknown>;
    challenge: Record<string, unknown> | null;
  };
};

type EndpointRow = { id: string };

function isEndpointRow(x: unknown): x is EndpointRow {
  return typeof x === "object" && x !== null && "id" in x && typeof (x as { id: unknown }).id === "string";
}

/**
 * Enqueue webhook deliveries for receipt.created.
 *
 * IMPORTANT:
 * - We generate a unique deliveryId per endpoint delivery.
 * - We stamp payload.id = deliveryId and payload.createdAt = now for consistency with headers.
 * - We write status='pending' explicitly (even though schema default exists) to keep behavior stable.
 */
export async function enqueueReceiptCreated(
  apiKeyId: string,
  receiptId: string,
  payload: WebhookPayload
): Promise<number> {
  const endpointsRes = await pool.query(
    `SELECT id
     FROM webhook_endpoints
     WHERE api_key_id=$1
       AND enabled=TRUE
       AND events @> ARRAY['receipt.created']::text[]`,
    [apiKeyId]
  );

  const rowsUnknown = endpointsRes.rows as unknown;
  const endpoints: EndpointRow[] = Array.isArray(rowsUnknown) ? rowsUnknown.filter(isEndpointRow) : [];

  if (endpoints.length === 0) return 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let inserted = 0;

    for (const ep of endpoints) {
      const deliveryId = randomUUID();

      const deliveryPayload: WebhookPayload = {
        ...payload,
        id: deliveryId,
        createdAt: new Date().toISOString()
      };

      await client.query(
        `INSERT INTO webhook_deliveries (id, endpoint_id, event, receipt_id, payload_json, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')`,
        [deliveryId, ep.id, "receipt.created", receiptId, deliveryPayload]
      );

      inserted += 1;
    }

    await client.query("COMMIT");
    return inserted;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback failure
    }
    throw err;
  } finally {
    client.release();
  }
}
