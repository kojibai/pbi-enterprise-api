#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { randomBytes, createHash, generateKeyPairSync, sign as nodeSign } from "node:crypto";
import type { JsonWebKey as NodeJsonWebKey } from "node:crypto";

import type { PBIActionV1, PBIReceiptV1, VectorCase, VectorFile } from "./types.js";

function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (b64.length % 4)) % 4;
  const padded = b64 + "=".repeat(padLen);
  return new Uint8Array(Buffer.from(padded, "base64"));
}

function sha256Bytes(data: Uint8Array): Uint8Array {
  const h = createHash("sha256");
  h.update(Buffer.from(data));
  return new Uint8Array(h.digest());
}

function sha256Hex(bytes: Uint8Array): string {
  const h = createHash("sha256");
  h.update(Buffer.from(bytes));
  return h.digest("hex");
}

// Minimal RFC8785-ish canonicalizer sufficient for these vectors (no floats, no weird numbers).
function canonicalize(v: unknown): string {
  if (v === null) return "null";
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error("nonfinite_number");
    return JSON.stringify(v);
  }
  if (Array.isArray(v)) {
    return "[" + v.map((x) => canonicalize(x)).join(",") + "]";
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize(o[k])).join(",") + "}";
  }
  throw new Error("invalid_json");
}

function actionHash(action: PBIActionV1): string {
  const canon = canonicalize(action);
  return sha256Hex(new Uint8Array(Buffer.from(canon, "utf8")));
}

function beU32(n: number): Uint8Array {
  const out = new Uint8Array(4);
  out[0] = (n >>> 24) & 0xff;
  out[1] = (n >>> 16) & 0xff;
  out[2] = (n >>> 8) & 0xff;
  out[3] = n & 0xff;
  return out;
}

function makeAuthenticatorData(rpId: string, flags: number, signCount: number): Uint8Array {
  const rpIdHash = sha256Bytes(new Uint8Array(Buffer.from(rpId, "utf8"))); // 32 bytes
  const out = new Uint8Array(32 + 1 + 4);
  out.set(rpIdHash, 0);
  out[32] = flags & 0xff;
  out.set(beU32(signCount >>> 0), 33);
  return out;
}

function makeClientDataJSON(params: Readonly<{ challenge: string; origin: string }>): Uint8Array {
  // deterministic key order for vectors
  const obj = {
    type: "webauthn.get",
    challenge: params.challenge,
    origin: params.origin,
    crossOrigin: false
  };
  return new Uint8Array(Buffer.from(JSON.stringify(obj), "utf8"));
}

function webauthnSigBase(authData: Uint8Array, clientDataJSON: Uint8Array): Uint8Array {
  const clientHash = sha256Bytes(clientDataJSON);
  const out = new Uint8Array(authData.length + clientHash.length);
  out.set(authData, 0);
  out.set(clientHash, authData.length);
  return out;
}

function makeValidCase(params: Readonly<{ name: string; desc: string; rpId: string; origin: string }>): VectorCase {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pubKeyJwk = publicKey.export({ format: "jwk" }) as unknown as NodeJsonWebKey;

  const credId = b64url(randomBytes(16));

  const action: PBIActionV1 = {
    ver: "pbi-action-1.0",
    aud: "pbi.kojib.com",
    purpose: "transfer",
    method: "POST",
    path: "/v1/phi/transfer",
    query: "",
    params: {
      to: "phi_1q2w3e4r5t",
      amountPhi: "13.000000",
      nonce: "00000001"
    }
  };

  const challenge = b64url(randomBytes(32));
  const challengeId = "chal_" + b64url(randomBytes(8));

  const aHash = actionHash(action);

  const authData = makeAuthenticatorData(params.rpId, /*UP*/ 0x01 | /*UV*/ 0x04, 1);
  const clientData = makeClientDataJSON({ challenge, origin: params.origin });

  const sigBase = webauthnSigBase(authData, clientData);

  // WebAuthn ES256: ECDSA over SHA-256(sigBase), DER encoded
  const sigDer = nodeSign("sha256", Buffer.from(sigBase), { key: privateKey, dsaEncoding: "der" });

  const receipt: PBIReceiptV1 = {
    ver: "pbi-receipt-1.0",
    challengeId,
    challenge,
    actionHash: aHash,
    aud: action.aud,
    purpose: action.purpose,
    authorSig: {
      alg: "webauthn-es256",
      credId,
      authenticatorData: b64url(authData),
      clientDataJSON: b64url(clientData),
      signature: b64url(new Uint8Array(sigDer))
    }
  };

  return {
    name: params.name,
    desc: params.desc,
    rpId: params.rpId,
    origin: params.origin,
    action,
    receipt,
    pubKeyJwk,
    expect: { result: "ok" }
  };
}

type ClientDataObj = {
  type: string;
  challenge: string;
  origin: string;
  crossOrigin: boolean;
};

function parseClientData(clientDataJSON_b64url: string): ClientDataObj {
  const bytes = b64urlToBytes(clientDataJSON_b64url);
  const parsed = JSON.parse(Buffer.from(bytes).toString("utf8")) as ClientDataObj;
  return parsed;
}

function mutateClientDataOrigin(clientDataJSON_b64url: string, newOrigin: string): string {
  const parsed = parseClientData(clientDataJSON_b64url);
  parsed.origin = newOrigin;
  return b64url(new Uint8Array(Buffer.from(JSON.stringify(parsed), "utf8")));
}

function mutateClientDataType(clientDataJSON_b64url: string, newType: string): string {
  const parsed = parseClientData(clientDataJSON_b64url);
  parsed.type = newType;
  return b64url(new Uint8Array(Buffer.from(JSON.stringify(parsed), "utf8")));
}

function mutateClientDataChallenge(clientDataJSON_b64url: string, newChallenge: string): string {
  const parsed = parseClientData(clientDataJSON_b64url);
  parsed.challenge = newChallenge;
  return b64url(new Uint8Array(Buffer.from(JSON.stringify(parsed), "utf8")));
}

function mutateAuthenticatorDataRpId(autData_b64url: string, newRpId: string): string {
  const bytes = b64urlToBytes(autData_b64url);
  if (bytes.length < 37) return autData_b64url;

  const rpIdHash = sha256Bytes(new Uint8Array(Buffer.from(newRpId, "utf8"))); // 32 bytes
  bytes.set(rpIdHash, 0);
  return b64url(bytes);
}

function mutateAuthenticatorDataFlags(autData_b64url: string, newFlags: number): string {
  const bytes = b64urlToBytes(autData_b64url);
  if (bytes.length < 37) return autData_b64url;
  bytes[32] = newFlags & 0xff;
  return b64url(bytes);
}

function flipLastByte(b64urlSig: string): string {
  const bytes = b64urlToBytes(b64urlSig);
  if (bytes.length === 0) return b64urlSig;

  const lastIdx = bytes.length - 1;
  const last = bytes[lastIdx];
  if (last === undefined) return b64urlSig;

  bytes[lastIdx] = (last ^ 0x01) & 0xff;
  return b64url(bytes);
}

function main(): void {
  const outPath = process.argv[2] ?? "pbi-conf-1.0.json";
  const rpId = process.argv[3] ?? "api.kojib.com";
  const origin = process.argv[4] ?? "https://pbi.kojib.com";

  const valid = makeValidCase({
    name: "valid_01",
    desc: "Valid receipt: origin ok, rpId ok, actionHash matches, signature valid.",
    rpId,
    origin
  });

  // Failure: origin mismatch (origin check should fail before signature verification)
  const invalidOrigin: VectorCase = {
    ...valid,
    name: "invalid_origin_01",
    desc: "Invalid origin: clientDataJSON.origin not allowlisted.",
    receipt: {
      ...valid.receipt,
      authorSig: {
        ...valid.receipt.authorSig,
        clientDataJSON: mutateClientDataOrigin(valid.receipt.authorSig.clientDataJSON, "https://evil.example")
      }
    },
    expect: { result: "error", code: "origin_not_allowed" }
  };

  // Failure: webauthn type mismatch (checked early)
  const webauthnTypeMismatch: VectorCase = {
    ...valid,
    name: "webauthn_type_mismatch_01",
    desc: "Invalid clientDataJSON.type: verifier rejects non-webauthn.get assertions.",
    receipt: {
      ...valid.receipt,
      authorSig: {
        ...valid.receipt.authorSig,
        clientDataJSON: mutateClientDataType(valid.receipt.authorSig.clientDataJSON, "webauthn.create")
      }
    },
    expect: { result: "error", code: "webauthn_type_mismatch" }
  };

  // Failure: challenge mismatch (receipt.challenge != clientDataJSON.challenge)
  const challengeMismatch: VectorCase = {
    ...valid,
    name: "challenge_mismatch_01",
    desc: "Challenge mismatch: receipt.challenge differs from clientDataJSON.challenge.",
    receipt: {
      ...valid.receipt,
      // keep clientDataJSON unchanged; only receipt.challenge changes
      challenge: b64url(randomBytes(32))
    },
    expect: { result: "error", code: "challenge_mismatch" }
  };

  // Failure: rpId not allowed (authenticatorData.rpIdHash mismatch)
  const rpIdNotAllowed: VectorCase = {
    ...valid,
    name: "rpId_not_allowed_01",
    desc: "Invalid rpIdHash: authenticatorData.rpIdHash not allowlisted.",
    receipt: {
      ...valid.receipt,
      authorSig: {
        ...valid.receipt.authorSig,
        authenticatorData: mutateAuthenticatorDataRpId(valid.receipt.authorSig.authenticatorData, "evil.example")
      }
    },
    expect: { result: "error", code: "rpId_not_allowed" }
  };

  // Failure: UV flag missing (requireUV true in verifier policy)
  const flagsPolicyViolationUv: VectorCase = {
    ...valid,
    name: "flags_policy_violation_uv_01",
    desc: "Flags policy violation: UV flag missing (requireUV=true).",
    receipt: {
      ...valid.receipt,
      authorSig: {
        ...valid.receipt.authorSig,
        // UP only, UV cleared
        authenticatorData: mutateAuthenticatorDataFlags(valid.receipt.authorSig.authenticatorData, 0x01)
      }
    },
    expect: { result: "error", code: "flags_policy_violation" }
  };

  // Failure: action tamper (recomputed hash mismatch)
  const actionHashMismatch: VectorCase = {
    ...valid,
    name: "action_hash_mismatch_01",
    desc: "Action tampered: verifier recomputes actionHash and rejects.",
    action: {
      ...valid.action,
      params: { ...valid.action.params, amountPhi: "14.000000" }
    },
    expect: { result: "error", code: "action_hash_mismatch" }
  };

  // Failure: signature invalid (flip one byte)
  const invalidSignature: VectorCase = {
    ...valid,
    name: "invalid_signature_01",
    desc: "Invalid signature: signature bytes modified.",
    receipt: {
      ...valid.receipt,
      authorSig: {
        ...valid.receipt.authorSig,
        signature: flipLastByte(valid.receipt.authorSig.signature)
      }
    },
    expect: { result: "error", code: "signature_invalid" }
  };

  const file: VectorFile = {
    ver: "pbi-conf-1.0",
    spec: "pbi-spec-1.0",
    createdAt: new Date().toISOString(),
    cases: [
      valid,
      invalidOrigin,
      webauthnTypeMismatch,
      challengeMismatch,
      rpIdNotAllowed,
      flagsPolicyViolationUv,
      actionHashMismatch,
      invalidSignature
    ]
  };

  writeFileSync(outPath, JSON.stringify(file, null, 2) + "\n", "utf8");

  const receiptCanon = canonicalize(valid.receipt);
  const receiptHash = sha256Hex(new Uint8Array(Buffer.from(receiptCanon, "utf8")));
  console.log(`Wrote ${outPath}`);
  console.log(`valid_01 receiptHash (for indexing): ${receiptHash}`);
}

main();
