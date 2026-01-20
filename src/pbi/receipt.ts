import { randomUUID } from "node:crypto";
import { hmacHex } from "../util/crypto.js";
import { config } from "../config.js";
import { pool } from "../db/pool.js";

export type ReceiptDecision = "PBI_VERIFIED" | "FAILED" | "EXPIRED" | "REPLAYED";

export type Receipt = {
  receiptId: string;
  receiptHashHex: string;
};

export function mintReceipt(challengeId: string, decision: ReceiptDecision): Receipt {
  const receiptId = randomUUID();
  const msg = `receipt:${receiptId}:challenge:${challengeId}:decision:${decision}`;
  const receiptHashHex = hmacHex(config.receiptSecret, msg);
  return { receiptId, receiptHashHex };
}

export type StoredReceipt = {
  id: string;
  apiKeyId: string;
  challengeId: string;
  receiptHashHex: string;
  decision: ReceiptDecision;
  createdAt: string;
};

export async function storeReceipt(
  apiKeyId: string,
  challengeId: string,
  decision: ReceiptDecision,
  receipt: Receipt
): Promise<void> {
  await pool.query(
    `INSERT INTO pbi_receipts (id, api_key_id, challenge_id, receipt_hash_hex, decision)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO NOTHING`,
    [receipt.receiptId, apiKeyId, challengeId, receipt.receiptHashHex, decision]
  );
}

export async function getReceiptById(apiKeyId: string, receiptId: string): Promise<StoredReceipt | null> {
  const res = await pool.query(
    `SELECT id, api_key_id, challenge_id, receipt_hash_hex, decision, created_at
     FROM pbi_receipts
     WHERE id=$1 AND api_key_id=$2
     LIMIT 1`,
    [receiptId, apiKeyId]
  );

  if (res.rowCount === 0) return null;

  const row = res.rows[0] as {
    id: string;
    api_key_id: string;
    challenge_id: string;
    receipt_hash_hex: string;
    decision: ReceiptDecision;
    created_at: string;
  };

  return {
    id: row.id,
    apiKeyId: row.api_key_id,
    challengeId: row.challenge_id,
    receiptHashHex: row.receipt_hash_hex,
    decision: row.decision,
    createdAt: row.created_at
  };
}

export async function getReceiptByChallengeId(apiKeyId: string, challengeId: string): Promise<StoredReceipt | null> {
  const res = await pool.query(
    `SELECT id, api_key_id, challenge_id, receipt_hash_hex, decision, created_at
     FROM pbi_receipts
     WHERE challenge_id=$1 AND api_key_id=$2
     ORDER BY created_at DESC
     LIMIT 1`,
    [challengeId, apiKeyId]
  );

  if (res.rowCount === 0) return null;

  const row = res.rows[0] as {
    id: string;
    api_key_id: string;
    challenge_id: string;
    receipt_hash_hex: string;
    decision: ReceiptDecision;
    created_at: string;
  };

  return {
    id: row.id,
    apiKeyId: row.api_key_id,
    challengeId: row.challenge_id,
    receiptHashHex: row.receipt_hash_hex,
    decision: row.decision,
    createdAt: row.created_at
  };
}
