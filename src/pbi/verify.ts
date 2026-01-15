import { b64urlToBytes } from "../util/base64url.js";
import { sha256Bytes, verifyEs256Pem } from "../util/crypto.js";
import { config } from "../config.js";
import type { WebAuthnAssertionBundle } from "./types.js";

type ClientData = {
  type: string;
  challenge: string;
  origin: string;
  crossOrigin?: boolean;
};

export type VerifyWebAuthnInput = {
  expectedChallengeB64Url: string;
  assertion: WebAuthnAssertionBundle;
};

export type VerifyWebAuthnOutput = {
  ok: boolean;
  reason:
    | "OK"
    | "BAD_CLIENT_DATA"
    | "BAD_ORIGIN"
    | "BAD_CHALLENGE"
    | "MISSING_UP"
    | "MISSING_UV"
    | "BAD_SIGNATURE";
};

function parseClientData(jsonBytes: Uint8Array): ClientData | null {
  try {
    const text = new TextDecoder().decode(jsonBytes);
    const v = JSON.parse(text) as unknown;

    if (typeof v !== "object" || v === null) return null;

    const obj = v as Record<string, unknown>;

    const type = obj.type;
    const challenge = obj.challenge;
    const origin = obj.origin;
    const crossOrigin = obj.crossOrigin;

    if (typeof type !== "string") return null;
    if (typeof challenge !== "string") return null;
    if (typeof origin !== "string") return null;

    // exactOptionalPropertyTypes: only include crossOrigin if it's actually a boolean
    const base: ClientData = { type, challenge, origin };
    if (typeof crossOrigin === "boolean") return { ...base, crossOrigin };

    return base;
  } catch {
    return null;
  }
}

export function verifyWebAuthnAssertion(input: VerifyWebAuthnInput): VerifyWebAuthnOutput {
  const authenticatorData = b64urlToBytes(input.assertion.authenticatorDataB64Url);
  const clientDataJSON = b64urlToBytes(input.assertion.clientDataJSONB64Url);
  const signature = b64urlToBytes(input.assertion.signatureB64Url);

  const client = parseClientData(clientDataJSON);
  if (!client) return { ok: false, reason: "BAD_CLIENT_DATA" };
  if (client.type !== "webauthn.get") return { ok: false, reason: "BAD_CLIENT_DATA" };

  if (client.challenge !== input.expectedChallengeB64Url) return { ok: false, reason: "BAD_CHALLENGE" };
  if (!config.allowedOrigins.includes(client.origin)) return { ok: false, reason: "BAD_ORIGIN" };

  // We need flags byte 32 to exist. With noUncheckedIndexedAccess, indexing can be undefined.
  // Ensure length > 32 so authenticatorData[32] is safe.
  if (authenticatorData.length <= 32) return { ok: false, reason: "BAD_CLIENT_DATA" };

  const flagsByte = authenticatorData[32];
  if (typeof flagsByte !== "number") return { ok: false, reason: "BAD_CLIENT_DATA" };

  const UP = (flagsByte & 0x01) !== 0;
  const UV = (flagsByte & 0x04) !== 0;

  if (!UP) return { ok: false, reason: "MISSING_UP" };
  if (!UV) return { ok: false, reason: "MISSING_UV" };

  // Signed bytes = authenticatorData || SHA256(clientDataJSON)
  const clientHash = sha256Bytes(clientDataJSON);
  const signed = new Uint8Array(authenticatorData.length + clientHash.length);
  signed.set(authenticatorData, 0);
  signed.set(clientHash, authenticatorData.length);

  const okSig = verifyEs256Pem(input.assertion.pubKeyPem, signed, signature);
  if (!okSig) return { ok: false, reason: "BAD_SIGNATURE" };

  return { ok: true, reason: "OK" };
}