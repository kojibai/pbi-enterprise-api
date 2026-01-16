import type {
  PBIActionV1,
  PBIReceiptV1,
  VerifyPolicy,
  VerifyResult,
  ChallengeStore,
  CredentialStore,
  VerifyErrorCode
} from "./types.js";

import { sha256HexFromCanonicalJson, sha256HexFromUtf8, sha256B64Url } from "./hash.js";
import { bytesToBase64Url, bytesToHex, base64UrlToBytes } from "./base64url.js";
import {
  parseAuthenticatorData,
  parseClientDataJSON,
  flagsHasUP,
  flagsHasUV,
  verifyWebAuthnES256
} from "./webauthn.js";
import { canonicalize } from "./jcs.js";
import type { JsonWebKey as NodeJsonWebKey } from "node:crypto";

function err(code: VerifyErrorCode, detail?: string): VerifyResult {
  return {
    ok: false,
    code,
    ...(detail !== undefined ? { detail } : {})
  };
}

// Convert whatever CredentialStore returns (often DOM JsonWebKey or unknown)
// into node:crypto JsonWebKey, stripping undefined-valued properties to satisfy
// exactOptionalPropertyTypes: true.
function toNodeJwk(v: unknown): NodeJsonWebKey | null {
  if (!v || typeof v !== "object") return null;

  const inObj = v as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const [k, val] of Object.entries(inObj)) {
    if (val !== undefined) out[k] = val;
  }

  // Minimal sanity check (avoids passing junk into createPublicKey)
  if (typeof out["kty"] !== "string") return null;

  return out as unknown as NodeJsonWebKey;
}

export function computeActionHash(action: PBIActionV1): string {
  return sha256HexFromCanonicalJson(action);
}

export function computeReceiptHash(receipt: PBIReceiptV1): string {
  // Core receipt hash = sha256(JCS(receipt))
  // (extensions should be ignored by callers by passing only core fields)
  return sha256HexFromCanonicalJson(receipt);
}

export async function verifyReceipt(
  params: Readonly<{
    receipt: PBIReceiptV1;
    policy: VerifyPolicy;
    credentialStore: CredentialStore;
    challengeStore?: ChallengeStore;
    // Optional: recompute actionHash from action (stronger)
    action?: PBIActionV1;
  }>
): Promise<VerifyResult> {
  const { receipt, policy, credentialStore, challengeStore, action } = params;

  if (receipt.ver !== "pbi-receipt-1.0") return err("invalid_version");
  if (receipt.authorSig.alg !== "webauthn-es256") return err("invalid_version");

  // Decode + parse client data
  const clientData = parseClientDataJSON(receipt.authorSig.clientDataJSON);
  if (!clientData) return err("invalid_structure", "clientDataJSON parse failed");

  if (clientData.type !== "webauthn.get") return err("webauthn_type_mismatch");
  if (clientData.challenge !== receipt.challenge) return err("challenge_mismatch");
  if (!policy.originAllowList.includes(clientData.origin)) return err("origin_not_allowed");
  if (clientData.crossOrigin === true) return err("origin_not_allowed", "crossOrigin true not allowed");

  // Parse authenticatorData
  const auth = parseAuthenticatorData(receipt.authorSig.authenticatorData);
  if (!auth) return err("invalid_structure", "authenticatorData too short");

  // rpIdHash check
  const rpOk = policy.rpIdAllowList.some((rpId) => {
    const expectedHex = sha256HexFromUtf8(rpId);
    return expectedHex === bytesToHex(auth.rpIdHash);
  });
  if (!rpOk) return err("rpId_not_allowed");

  // Flags policy
  if (policy.requireUP && !flagsHasUP(auth.flags)) return err("flags_policy_violation", "UP required");
  if (policy.requireUV && !flagsHasUV(auth.flags)) return err("flags_policy_violation", "UV required");

  // Challenge lifecycle checks (server-side optional)
  if (challengeStore) {
    const chal = await challengeStore.getChallenge(receipt.challengeId);
    if (!chal) return err("challenge_not_found");
    if (chal.challenge !== receipt.challenge) return err("challenge_mismatch");
    if (chal.aud !== receipt.aud) return err("aud_mismatch");
    if (chal.purpose !== receipt.purpose) return err("purpose_mismatch");
    if (chal.actionHash !== receipt.actionHash) return err("action_hash_mismatch");

    const now = Date.now();
    const exp = Date.parse(chal.expiresAt);
    if (!Number.isFinite(exp)) return err("invalid_structure", "expiresAt not RFC3339");
    if (now >= exp) return err("challenge_expired");
    if (chal.usedAt !== null) return err("challenge_used");
  }

  // Optional: recompute actionHash
  if (action) {
    const recomputed = computeActionHash(action);
    if (recomputed !== receipt.actionHash) return err("action_hash_mismatch");
  }

  // Public key lookup (store may return DOM JsonWebKey; normalize to NodeJsonWebKey)
  const jwkRaw = await credentialStore.getPublicKeyJwk(receipt.authorSig.credId);
  if (!jwkRaw) return err("signature_invalid", "unknown credId");

  const jwk = toNodeJwk(jwkRaw);
  if (!jwk) return err("signature_invalid", "invalid JWK");

  // Signature verify
  const sigOk = verifyWebAuthnES256({
    pubKeyJwk: jwk,
    authenticatorData_b64url: receipt.authorSig.authenticatorData,
    clientDataJSON_b64url: receipt.authorSig.clientDataJSON,
    signature_b64url: receipt.authorSig.signature
  });
  if (!sigOk) return err("signature_invalid");

  const receiptHash = computeReceiptHash(receipt);

  // If we have a challengeStore, mark used atomically after verification
  if (challengeStore) {
    await challengeStore.markUsed(receipt.challengeId, receiptHash);
  }

  // Extra computed values for audits/debug
  const rpIdHash_b64url = bytesToBase64Url(auth.rpIdHash);

  const clientBytes = base64UrlToBytes(receipt.authorSig.clientDataJSON);
  const clientDataHash_b64url = sha256B64Url(clientBytes);

  return {
    ok: true,
    receiptHash,
    actionHash: receipt.actionHash,
    rpIdHash_b64url,
    clientDataHash_b64url,
    flags_hex: auth.flags.toString(16).padStart(2, "0"),
    signCount: auth.signCount
  };
}

// Deterministic “exactly what you hash” helpers
export function canonicalizeJsonForHashing(v: unknown): string {
  // safe-ish: only intended for internal debugging / tooling
  // caller should ensure v is JSON
  return canonicalize(v as never);
}
