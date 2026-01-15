import { pool } from "../pool.js";
import { sha256Hex } from "../../util/crypto.js";
import { b64urlToBytes } from "../../util/base64url.js";

export type ApiKeyRecord = {
  id: string;
  plan: "starter" | "pro" | "enterprise";
  quotaPerMonth: bigint;
  isActive: boolean;
  label: string;
};

export function hashApiKey(raw: string): string {
  const bytes = new TextEncoder().encode(raw);
  return sha256Hex(bytes);
}

export async function getApiKeyByRaw(raw: string): Promise<ApiKeyRecord | null> {
  const keyHash = hashApiKey(raw);
  const res = await pool.query(
    `SELECT id, plan, quota_per_month, is_active, label FROM api_keys WHERE key_hash=$1`,
    [keyHash]
  );
  if (res.rowCount === 0) return null;

  const row = res.rows[0] as {
    id: string;
    plan: "starter" | "pro" | "enterprise";
    quota_per_month: string;
    is_active: boolean;
    label: string;
  };

  return {
    id: row.id,
    plan: row.plan,
    quotaPerMonth: BigInt(row.quota_per_month),
    isActive: row.is_active,
    label: row.label
  };
}