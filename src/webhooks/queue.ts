import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";

export type WebhookEvent = "receipt.created";

export type WebhookPayload = {
  id: string;
  type: WebhookEvent;
  createdAt: string;
  data: {
    receipt: Record<string, unknown>;
    challenge: Record<string, unknown> | null;
  };
};

export async function enqueueReceiptCreated(
  apiKeyId: string,
  receiptId: string,
  payload: WebhookPayload
): Promise<number> {
  const endpoints = await pool.query(
    `SELECT id
     FROM webhook_endpoints
     WHERE api_key_id=$1
       AND enabled=TRUE
       AND events @> ARRAY['receipt.created']::text[]`,
    [apiKeyId]
  );

  if (endpoints.rowCount === 0) return 0;

  const deliveryIds = (endpoints.rows as Array<{ id: string }>).map((row) => row.id);
  let inserted = 0;

  for (const endpointId of deliveryIds) {
    const deliveryId = randomUUID();
    await pool.query(
      `INSERT INTO webhook_deliveries (id, endpoint_id, event, receipt_id, payload_json, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')`,
      [deliveryId, endpointId, "receipt.created", receiptId, payload]
    );
    inserted += 1;
  }

  return inserted;
}
