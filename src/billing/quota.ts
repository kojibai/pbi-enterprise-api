import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
import { monthKey } from "../util/time.js";

export type UsageKind = "challenge" | "verify";

export type QuotaResult =
  | { ok: true; monthKey: string; usedAfter: bigint; quota: bigint }
  | { ok: false; monthKey: string; used: bigint; quota: bigint };

function advisoryLockKey(apiKeyId: string): string {
  // stable 64-bit lock key from uuid string using md5 -> first 16 hex -> bigint
  // used inside SQL.
  return apiKeyId;
}

export async function consumeQuotaUnit(
  apiKeyId: string,
  kind: UsageKind,
  quotaPerMonth: bigint
): Promise<QuotaResult> {
  const mk = monthKey(new Date());

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Serialize quota checks per apiKeyId within this transaction
    // pg_advisory_xact_lock(bigint)
    await client.query(
      `SELECT pg_advisory_xact_lock(
         ('x' || substr(md5($1), 1, 16))::bit(64)::bigint
       )`,
      [advisoryLockKey(apiKeyId)]
    );

    const usedRes = await client.query(
      `SELECT COALESCE(SUM(units), 0)::bigint AS used
       FROM usage_events
       WHERE api_key_id=$1 AND month_key=$2`,
      [apiKeyId, mk]
    );

    const used = BigInt((usedRes.rows[0] as { used: string }).used);
    const nextUsed = used + 1n;

    if (nextUsed > quotaPerMonth) {
      await client.query("ROLLBACK");
      return { ok: false, monthKey: mk, used, quota: quotaPerMonth };
    }

    await client.query(
      `INSERT INTO usage_events (id, api_key_id, month_key, kind, units)
       VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), apiKeyId, mk, kind, "1"]
    );

    await client.query("COMMIT");
    return { ok: true, monthKey: mk, usedAfter: nextUsed, quota: quotaPerMonth };
  } catch {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore
    }
    throw new Error("quota_consume_failed");
  } finally {
    client.release();
  }
}