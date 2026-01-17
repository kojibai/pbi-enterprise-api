import { createPrivateKey, createPublicKey, sign as nodeSign, verify as nodeVerify } from "node:crypto";
import type { JsonWebKey as NodeJsonWebKey } from "node:crypto";

import { base64UrlToBytes, bytesToBase64Url } from "./base64url.js";

type Jwk = NodeJsonWebKey;

/**
 * Strip undefined-valued properties so exactOptionalPropertyTypes never bites us,
 * and so Node's crypto JWK input stays clean.
 */
function normalizeJwk(jwk: Jwk): Jwk {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(jwk as Record<string, unknown>)) {
    if (v !== undefined) out[k] = v;
  }
  return out as unknown as Jwk;
}

/**
 * Minimal sanity checks for Ed25519 JWKs.
 * (Ed25519 keys are usually OKP/Ed25519 with "x" and optionally "d" for private.)
 */
function assertEd25519Jwk(jwk: Jwk, mustHavePrivateD: boolean): void {
  const o = jwk as unknown as Record<string, unknown>;
  const kty = o["kty"];
  const crv = o["crv"];
  const x = o["x"];
  const d = o["d"];

  if (kty !== "OKP") throw new Error("attest_key_invalid: kty must be OKP");
  if (crv !== "Ed25519") throw new Error("attest_key_invalid: crv must be Ed25519");
  if (typeof x !== "string" || x.length === 0) throw new Error("attest_key_invalid: missing x");

  if (mustHavePrivateD) {
    if (typeof d !== "string" || d.length === 0) throw new Error("attest_key_invalid: missing d");
  }
}

export type Attestation = Readonly<{
  ver: "pbi-attest-1.0";
  decision: "accept" | "reject";
  receiptHash: string; // hex
  actionHash: string; // hex
  challengeId: string;
  aud: string;
  purpose: string;
  policyVer: string;
  policyHash: string; // hex
  verifiedAt: string; // RFC3339
  verifier: Readonly<{
    kid: string;
    alg: "ed25519";
    pubKeyJwk: Jwk;
  }>;
  verifierSig: Readonly<{
    alg: "ed25519";
    kid: string;
    sig: string; // base64url
  }>;
}>;

export type AttestKey = Readonly<{
  kid: string;
  alg: "ed25519";
  // Ed25519 JWKs. Private key includes "d".
  privKeyJwk: Jwk;
  pubKeyJwk: Jwk;
}>;

export function attestMessage(params: Readonly<{
  receiptHash: string;
  decision: "accept" | "reject";
  policyHash: string;
  verifiedAt: string;
}>): Uint8Array {
  const s = `pbi-attest-1.0:${params.receiptHash}:${params.decision}:${params.policyHash}:${params.verifiedAt}`;
  return new Uint8Array(Buffer.from(s, "utf8"));
}

export function signAttestation(params: Readonly<{
  base: Omit<Attestation, "verifierSig" | "verifier">;
  key: AttestKey;
}>): Attestation {
  if (params.key.alg !== "ed25519") throw new Error("attest_key_invalid: alg must be ed25519");

  const priv = normalizeJwk(params.key.privKeyJwk);
  const pub = normalizeJwk(params.key.pubKeyJwk);

  assertEd25519Jwk(priv, true);
  assertEd25519Jwk(pub, false);

  const msg = attestMessage({
    receiptHash: params.base.receiptHash,
    decision: params.base.decision,
    policyHash: params.base.policyHash,
    verifiedAt: params.base.verifiedAt
  });

  const keyObj = createPrivateKey({ key: priv, format: "jwk" });
  const sig = nodeSign(null, Buffer.from(msg), keyObj); // Ed25519 => algorithm must be null
  const sigB64u = bytesToBase64Url(new Uint8Array(sig));

  return {
    ...params.base,
    verifier: { kid: params.key.kid, alg: "ed25519", pubKeyJwk: pub },
    verifierSig: { alg: "ed25519", kid: params.key.kid, sig: sigB64u }
  };
}

export function verifyAttestation(att: Attestation): boolean {
  if (att.ver !== "pbi-attest-1.0") return false;
  if (att.verifier.alg !== "ed25519") return false;
  if (att.verifierSig.alg !== "ed25519") return false;
  if (att.verifierSig.kid !== att.verifier.kid) return false;

  const pub = normalizeJwk(att.verifier.pubKeyJwk);
  try {
    assertEd25519Jwk(pub, false);
  } catch {
    return false;
  }

  const msg = attestMessage({
    receiptHash: att.receiptHash,
    decision: att.decision,
    policyHash: att.policyHash,
    verifiedAt: att.verifiedAt
  });

  const sig = base64UrlToBytes(att.verifierSig.sig);
  const keyObj = createPublicKey({ key: pub, format: "jwk" });
  return nodeVerify(null, Buffer.from(msg), keyObj, Buffer.from(sig));
}
