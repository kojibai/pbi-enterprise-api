// webauthn.ts
import { createPublicKey, verify as nodeVerify } from "node:crypto";
import type { JsonWebKey as NodeJsonWebKey } from "node:crypto";

import { base64UrlToBytes } from "./base64url.js";
import { sha256Bytes } from "./hash.js";

export type ClientData = Readonly<{
  type: string;
  challenge: string;
  origin: string;
  crossOrigin?: boolean;
}>;

export type ParsedAuthData = Readonly<{
  rpIdHash: Uint8Array; // 32 bytes
  flags: number; // 1 byte
  signCount: number; // u32
  raw: Uint8Array;
}>;

export function parseClientDataJSON(b64url: string): ClientData | null {
  try {
    const bytes = base64UrlToBytes(b64url);
    const text = Buffer.from(bytes).toString("utf8");

    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return null;

    const o = parsed as Record<string, unknown>;
    const type = o["type"];
    const challenge = o["challenge"];
    const origin = o["origin"];
    const crossOrigin = o["crossOrigin"];

    if (typeof type !== "string") return null;
    if (typeof challenge !== "string") return null;
    if (typeof origin !== "string") return null;
    if (crossOrigin !== undefined && typeof crossOrigin !== "boolean") return null;

    // exactOptionalPropertyTypes: omit property when undefined
    if (crossOrigin === undefined) return { type, challenge, origin };
    return { type, challenge, origin, crossOrigin };
  } catch {
    return null;
  }
}

export function parseAuthenticatorData(b64url: string): ParsedAuthData | null {
  const raw = base64UrlToBytes(b64url);
  if (raw.length < 37) return null;

  const rpIdHash = raw.slice(0, 32);
  const flags = raw[32]!;
  const signCount =
    (raw[33]! << 24) |
    (raw[34]! << 16) |
    (raw[35]! << 8) |
    raw[36]!;

  return { rpIdHash, flags, signCount: signCount >>> 0, raw };
}

export function flagsHasUP(flags: number): boolean {
  return (flags & 0x01) === 0x01;
}

export function flagsHasUV(flags: number): boolean {
  return (flags & 0x04) === 0x04;
}

/**
 * Verify a WebAuthn ES256 "assertion" signature.
 *
 * WebAuthn signature base = authenticatorData || SHA-256(clientDataJSON)
 * Signature is DER-encoded ECDSA over P-256.
 */
export function verifyWebAuthnES256(params: Readonly<{
  pubKeyJwk: NodeJsonWebKey;
  authenticatorData_b64url: string;
  clientDataJSON_b64url: string;
  signature_b64url: string;
}>): boolean {
  const authData = base64UrlToBytes(params.authenticatorData_b64url);
  const clientData = base64UrlToBytes(params.clientDataJSON_b64url);
  const sig = base64UrlToBytes(params.signature_b64url);

  const clientHash = sha256Bytes(clientData);
  const sigBase = Buffer.concat([Buffer.from(authData), Buffer.from(clientHash)]);

  // Node's createPublicKey expects node:crypto JsonWebKey typing, not DOM JsonWebKey.
  // Also, with exactOptionalPropertyTypes, we must not pass undefined-valued keys.
  const jwkClean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params.pubKeyJwk as Record<string, unknown>)) {
    if (v !== undefined) jwkClean[k] = v;
  }

  const keyObj = createPublicKey({
    key: jwkClean as unknown as NodeJsonWebKey,
    format: "jwk"
  });

  return nodeVerify("sha256", sigBase, keyObj, Buffer.from(sig));
}
