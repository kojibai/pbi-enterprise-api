import { pool } from "../db/pool.js";
import { monthKey } from "../util/time.js";
import { randomUUID } from "node:crypto";

export type UsageKind = "challenge" | "verify";

export async function recordUsage(apiKeyId: string, kind: UsageKind, units: bigint): Promise<void> {
  const mk = monthKey(new Date());
  await pool.query(
    `INSERT INTO usage_events (id, api_key_id, month_key, kind, units)
     VALUES ($1, $2, $3, $4, $5)`,
    [randomUUID(), apiKeyId, mk, kind, units.toString()]
  );
}

export async function getUsageForMonth(apiKeyId: string, mk: string): Promise<Record<UsageKind, bigint>> {
  const res = await pool.query(
    `SELECT kind, COALESCE(SUM(units), 0)::bigint AS total
     FROM usage_events
     WHERE api_key_id=$1 AND month_key=$2
     GROUP BY kind`,
    [apiKeyId, mk]
  );

  const out: Record<UsageKind, bigint> = { challenge: 0n, verify: 0n };
  for (const row of res.rows as Array<{ kind: UsageKind; total: string }>) {
    out[row.kind] = BigInt(row.total);
  }
  return out;
}