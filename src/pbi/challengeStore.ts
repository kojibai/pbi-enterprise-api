import { pool } from "../db/pool.js";
import { randomUUID, randomBytes } from "node:crypto";
import { bytesToB64url } from "../util/base64url.js";
import { PBIPurpose, PBIChallenge } from "./types.js";

export async function createChallenge(
  apiKeyId: string,
  purpose: PBIPurpose,
  actionHashHex: string,
  ttlSeconds: number
): Promise<PBIChallenge> {
  const id = randomUUID();
  const challenge = bytesToB64url(new Uint8Array(randomBytes(32)));
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  await pool.query(
    `INSERT INTO pbi_challenges (id, api_key_id, challenge_b64url, purpose, action_hash_hex, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, apiKeyId, challenge, purpose, actionHashHex, expiresAt.toISOString()]
  );

  return {
    id,
    challengeB64Url: challenge,
    purpose,
    actionHashHex,
    expiresAtIso: expiresAt.toISOString()
  };
}

export type StoredChallenge = {
  id: string;
  apiKeyId: string;
  challengeB64Url: string;
  purpose: PBIPurpose;
  actionHashHex: string;
  expiresAt: Date;
  usedAt: Date | null;
};

export async function getChallenge(challengeId: string): Promise<StoredChallenge | null> {
  const res = await pool.query(
    `SELECT id, api_key_id, challenge_b64url, purpose, action_hash_hex, expires_at, used_at
     FROM pbi_challenges WHERE id=$1`,
    [challengeId]
  );
  if (res.rowCount === 0) return null;

  const row = res.rows[0] as {
    id: string;
    api_key_id: string;
    challenge_b64url: string;
    purpose: PBIPurpose;
    action_hash_hex: string;
    expires_at: string;
    used_at: string | null;
  };

  return {
    id: row.id,
    apiKeyId: row.api_key_id,
    challengeB64Url: row.challenge_b64url,
    purpose: row.purpose,
    actionHashHex: row.action_hash_hex,
    expiresAt: new Date(row.expires_at),
    usedAt: row.used_at ? new Date(row.used_at) : null
  };
}

export async function markChallengeUsed(challengeId: string): Promise<void> {
  await pool.query(`UPDATE pbi_challenges SET used_at=now() WHERE id=$1 AND used_at IS NULL`, [challengeId]);
}