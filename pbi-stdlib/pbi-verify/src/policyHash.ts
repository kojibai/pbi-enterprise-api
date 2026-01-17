import { createPublicKey, verify as nodeVerify, createHash } from "node:crypto";
import type { JsonWebKey as NodeJsonWebKey } from "node:crypto";

import { canonicalize } from "./jcs.js";
import { base64UrlToBytes } from "./base64url.js";
import type { PBIPolicyFile } from "./policy.js";

export type SignedPolicySig = Readonly<{
  alg: "ed25519";
  kid: string;
  pubKeyJwk: NodeJsonWebKey;
  sig: string; // base64url
}>;

export type PBISignedPolicyFile = Readonly<{
  ver: "pbi-policy-signed-1.0";
  policy: PBIPolicyFile;
  sig: SignedPolicySig;
}>;

export type VerifySignedPolicyResult =
  | Readonly<{ ok: true; keyId: string }>
  | Readonly<{ ok: false; code: string; detail?: string }>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function normalizeJwk(jwk: NodeJsonWebKey): NodeJsonWebKey {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(jwk as Record<string, unknown>)) {
    if (v !== undefined) out[k] = v;
  }
  return out as unknown as NodeJsonWebKey;
}

function sha256HexUtf8(s: string): string {
  const h = createHash("sha256");
  h.update(Buffer.from(s, "utf8"));
  return h.digest("hex");
}

/**
 * Policy hash = sha256( JCS(policyFile) ) hex
 */
export function computePolicyHash(policy: PBIPolicyFile): string {
  const canon = canonicalize(policy as never);
  return sha256HexUtf8(canon);
}

/**
 * Parse signed policy object (pbi-policy-signed-1.0).
 * Returns null if shape invalid.
 */
export function parseSignedPolicy(u: unknown): PBISignedPolicyFile | null {
  if (!isRecord(u)) return null;
  if (u["ver"] !== "pbi-policy-signed-1.0") return null;

  const policyU = u["policy"];
  const sigU = u["sig"];

  if (!isRecord(policyU)) return null;
  if (!isRecord(sigU)) return null;

  // We delegate strict validation of policy to parsePolicyFile in policy.ts at call site
  const alg = sigU["alg"];
  const kid = sigU["kid"];
  const pubKeyJwkU = sigU["pubKeyJwk"];
  const sig = sigU["sig"];

  if (alg !== "ed25519") return null;
  if (typeof kid !== "string" || kid.length === 0) return null;
  if (!isRecord(pubKeyJwkU)) return null;
  if (typeof sig !== "string" || sig.length === 0) return null;

  const pubKeyJwk = normalizeJwk(pubKeyJwkU as unknown as NodeJsonWebKey);

  return {
    ver: "pbi-policy-signed-1.0",
    policy: policyU as unknown as PBIPolicyFile,
    sig: {
      alg: "ed25519",
      kid,
      pubKeyJwk,
      sig
    }
  };
}

/**
 * Signing payload for signed policies: stable and minimal.
 * We sign:  "pbi-policy-signed-1.0:<policyHash>"
 */
function signedPolicyMessage(policy: PBIPolicyFile): Uint8Array {
  const h = computePolicyHash(policy);
  const s = `pbi-policy-signed-1.0:${h}`;
  return new Uint8Array(Buffer.from(s, "utf8"));
}

/**
 * keyId for trust pinning / allowlisting: sha256(JCS(pubKeyJwk)) hex
 */
export function keyIdFromPubKeyJwk(pubKeyJwk: NodeJsonWebKey): string {
  const canon = canonicalize(normalizeJwk(pubKeyJwk) as never);
  return sha256HexUtf8(canon);
}

/**
 * Verify a signed policy file.
 * - checks ed25519 signature
 * - returns keyId (sha256 over canonical JWK)
 */
export function verifySignedPolicy(sp: PBISignedPolicyFile): VerifySignedPolicyResult {
  try {
    if (sp.ver !== "pbi-policy-signed-1.0") {
      return { ok: false, code: "invalid_version", detail: "signed policy ver mismatch" };
    }
    if (sp.sig.alg !== "ed25519") {
      return { ok: false, code: "invalid_structure", detail: "sig.alg must be ed25519" };
    }

    const pub = normalizeJwk(sp.sig.pubKeyJwk);
    const keyId = keyIdFromPubKeyJwk(pub);

    const msg = signedPolicyMessage(sp.policy);
    const sigBytes = base64UrlToBytes(sp.sig.sig);

    const keyObj = createPublicKey({ key: pub, format: "jwk" });
    const ok = nodeVerify(null, Buffer.from(msg), keyObj, Buffer.from(sigBytes));
    if (!ok) return { ok: false, code: "signature_invalid", detail: "policy signature invalid" };

    return { ok: true, keyId };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "invalid_structure", ...(msg ? { detail: msg } : {}) };
  }
}
