import { randomBytes, randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
import { hashApiKey } from "../db/queries/apiKeys.js";

export type RotateApiKeyResult =
  | {
      ok: true;
      apiKeyId: string;
      rawApiKey: string;
      oldApiKeyId: string;
      oldApiKeyDisabled: boolean;
    }
  | { ok: false; error: "api_key_not_found" };

export function mintRawApiKey(): string {
  const rnd = Buffer.from(randomBytes(32)).toString("base64url");
  return `pbi_live_${rnd}`;
}

export async function rotateApiKey(params: {
  customerId: string;
  keyId: string;
  keepOldActive: boolean;
}): Promise<RotateApiKeyResult> {
  const existing = await pool.query(
    `SELECT id, label, plan, quota_per_month, scopes
     FROM api_keys
     WHERE id=$1 AND customer_id=$2
     LIMIT 1`,
    [params.keyId, params.customerId]
  );

  if (existing.rowCount === 0) {
    return { ok: false, error: "api_key_not_found" };
  }

  const row = existing.rows[0] as {
    id: string;
    label: string;
    plan: string;
    quota_per_month: string;
    scopes: string[] | null;
  };

  const raw = mintRawApiKey();
  const keyHash = hashApiKey(raw);
  const newId = randomUUID();

  await pool.query(
    `INSERT INTO api_keys (id, label, key_hash, plan, quota_per_month, is_active, customer_id, scopes)
     VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7)`,
    [newId, row.label, keyHash, row.plan, row.quota_per_month, params.customerId, row.scopes]
  );

  if (!params.keepOldActive) {
    await pool.query(`UPDATE api_keys SET is_active=FALSE WHERE id=$1 AND customer_id=$2`, [
      params.keyId,
      params.customerId
    ]);
  }

  return {
    ok: true,
    apiKeyId: newId,
    rawApiKey: raw,
    oldApiKeyId: params.keyId,
    oldApiKeyDisabled: !params.keepOldActive
  };
}
