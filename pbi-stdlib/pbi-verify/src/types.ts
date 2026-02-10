// types.ts
// PBI (Presence-Bound Identity) — core wire types + verifier contracts
// Hardened for: strict TS, exactOptionalPropertyTypes, and node:crypto JWK interop (WebAuthn ES256).

import type { JsonWebKey as NodeJsonWebKey } from "node:crypto";

/* =========================
   JSON (safe, readonly)
========================= */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[];
export type JsonObject = { readonly [k: string]: JsonValue };

/* =========================
   Common string aliases
   (kept as `string` to avoid forcing a refactor; validation happens in runtime code)
========================= */

export type Base64UrlString = string;
export type HexString = string;

/* =========================
   Action (what was attempted)
========================= */

export type PBIActionV1 = Readonly<{
  ver: "pbi-action-1.0";
  aud: string;
  purpose: string;

  /**
   * HTTP method MUST be uppercase.
   * (Runtime should enforce normalization; type intentionally stays `string` to avoid breaking callers.)
   */
  method: string;

  /**
   * Normalized path (leading slash, no trailing slash unless root).
   */
  path: string;

  /**
   * Normalized query string or "" (no leading "?").
   */
  query: string;

  /**
   * Arbitrary structured parameters (JSON only).
   */
  params: JsonObject;
}>;

/* =========================
   WebAuthn author signature
========================= */

export type KASAuthorSigWebAuthnES256 = Readonly<{
  alg: "webauthn-es256";
  credId: Base64UrlString;
  authenticatorData: Base64UrlString;
  clientDataJSON: Base64UrlString;
  /**
   * DER-encoded ECDSA signature bytes (base64url)
   */
  signature: Base64UrlString;
}>;

/* =========================
   Receipt (the attested proof)
========================= */

export type PBIReceiptV1 = Readonly<{
  ver: "pbi-receipt-1.0";
  challengeId: string;
  challenge: Base64UrlString;
  actionHash: HexString;
  aud: string;
  purpose: string;
  authorSig: KASAuthorSigWebAuthnES256;
}>;

/* =========================
   Challenge record (server-side)
========================= */

export type ChallengeRecordV1 = Readonly<{
  ver: "pbi-chal-1.0";
  challengeId: string;
  challenge: Base64UrlString;
  actionHash: HexString;
  aud: string;
  purpose: string;

  /**
   * RFC3339 timestamp (UTC recommended)
   */
  expiresAt: string;

  /**
   * RFC3339 timestamp when consumed, else null
   */
  usedAt: string | null;
}>;

/* =========================
   Verify outcomes
========================= */

export const VERIFY_ERROR_CODES = [
  "invalid_version",
  "invalid_encoding",
  "invalid_structure",
  "challenge_not_found",
  "challenge_expired",
  "challenge_used",
  "action_hash_mismatch",
  "aud_mismatch",
  "purpose_mismatch",
  "origin_not_allowed",
  "rpId_not_allowed",
  "webauthn_type_mismatch",
  "challenge_mismatch",
  "signature_invalid",
  "flags_policy_violation",
  "nonfinite_number"
] as const;

export type VerifyErrorCode = (typeof VERIFY_ERROR_CODES)[number];

export type VerifyOk = Readonly<{
  ok: true;
  receiptHash: HexString;
  actionHash: HexString;

  /**
   * base64url(rpIdHash) from authenticatorData
   */
  rpIdHash_b64url: Base64UrlString;

  /**
   * base64url(SHA-256(clientDataJSON))
   */
  clientDataHash_b64url: Base64UrlString;

  /**
   * Authenticator flags byte as 2-char hex (e.g. "05")
   */
  flags_hex: string;

  /**
   * Authenticator signCount (u32)
   */
  signCount: number;
}>;

export type VerifyErr = Readonly<{
  ok: false;
  code: VerifyErrorCode;

  /**
   * Optional diagnostic string.
   * With exactOptionalPropertyTypes, this MUST be omitted (not set to undefined) when absent.
   */
  detail?: string;
}>;

export type VerifyResult = VerifyOk | VerifyErr;

/* =========================
   Verification policy
========================= */

export type VerifyPolicy = Readonly<{
  /**
   * List of RP IDs (e.g. "example.com") accepted for rpIdHash validation.
   */
  rpIdAllowList: readonly string[];

  /**
   * List of allowed WebAuthn origins (e.g. "https://example.com").
   */
  originAllowList: readonly string[];

  /**
   * Require User Presence (UP) flag in authenticatorData.
   */
  requireUP: boolean;

  /**
   * Require User Verification (UV) flag in authenticatorData.
   */
  requireUV: boolean;
}>;

/* =========================
   Store interfaces
========================= */

export type ChallengeStore = Readonly<{
  getChallenge: (challengeId: string) => Promise<ChallengeRecordV1 | null>;
  markUsed: (challengeId: string, receiptHash: HexString) => Promise<void>;
}>;

/**
 * NOTE: This is the key hardening change.
 *
 * We use Node’s `node:crypto` JsonWebKey type, NOT the DOM `JsonWebKey`.
 * - DOM JsonWebKey lacks an index signature → fails assignment under strict TS.
 * - Node’s createPublicKey({ format: "jwk" }) is typed against node:crypto JsonWebKey.
 *
 * If you ever want browser compatibility, keep this type here and do conversion at
 * the boundary (server verifier) instead of changing every caller.
 */
export type CredentialStore = Readonly<{
  /**
   * Return the registered credential public key as JWK (P-256, public only).
   * Must be compatible with node:crypto createPublicKey({ key, format: "jwk" }).
   */
  getPublicKeyJwk: (credId_b64url: string) => Promise<NodeJsonWebKey | null>;
}>;

/* =========================
   Optional: tighter JWK shape (still compatible with NodeJsonWebKey)
   (Use this in implementations/tests if you want stricter typing without forcing callers.)
========================= */

export type P256PublicJwk = Readonly<
  NodeJsonWebKey & {
    kty: "EC";
    crv: "P-256";
    x: string;
    y: string;
    alg?: "ES256";
  }
>;
