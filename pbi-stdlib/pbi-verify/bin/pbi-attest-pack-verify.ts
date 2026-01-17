#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { JsonWebKey as NodeJsonWebKey } from "node:crypto";

import type { PBIActionV1, PBIReceiptV1, VerifyPolicy, CredentialStore, VerifyResult } from "../src/types.js";
import { parsePolicyFile, buildVerifyPolicyFromPurpose, type PBIPolicyFile } from "../src/policy.js";
import { computePolicyHash, parseSignedPolicy, verifySignedPolicy } from "../src/policyHash.js";
import { verifyAttestation, type Attestation } from "../src/attest.js";
import { verifyReceipt, computeActionHash, computeReceiptHash } from "../src/verify.js";
import { sha256Hex } from "../src/hash.js";

import { parseAttestorTrustFile, verifyAttestorTrustAt, type AttestorTrustFile } from "../src/attestorTrust.js";

type Manifest = Readonly<{
  ver: "pbi-pack-2.0" | "pbi-attest-pack-2.0";
  createdAt: string;
  issuer: { name: string; aud: string };
  policy: { policyVer: string; policyHash: string; source: string };
  files: Record<string, { sha256: string }>;
}>;

type TrustEval = "strict" | "asof" | "both";

type ParsedArgs = Readonly<{
  dir: string;
  pretty: boolean;
  attestorTrustPath?: string;
  trustEval: TrustEval;
  trustNow?: string;
}>;

function usage(): void {
  console.log(
    [
      "Usage:",
      "  pbi-attest-pack-verify <packDir> [--pretty] [--attestor-trust <trust-attestors.json>] [--trust-eval strict|asof|both] [--trust-now <RFC3339>]",
      "",
      "Options:",
      "  --pretty                 Pretty-print JSON output",
      "  --attestor-trust <path>  Enforce attestor key allowlist + revocation + validity window",
      "  --trust-eval <mode>      strict (default) | asof | both",
      "                           strict = validate at current time",
      "                           asof   = validate at attestation.verifiedAt",
      "                           both   = require both strict + asof to pass",
      "  --trust-now <RFC3339>    Override 'now' used for strict validation (testing)",
      "  -h, --help               Show help",
      ""
    ].join("\n")
  );
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  let dir: string | undefined;
  let pretty = false;
  let attestorTrustPath: string | undefined;
  let trustEval: TrustEval = "strict";
  let trustNow: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const next = argv[i + 1];

    if (a === "--pretty") {
      pretty = true;
      continue;
    }

    if (a === "--attestor-trust" && typeof next === "string") {
      attestorTrustPath = next;
      i++;
      continue;
    }

    if (a === "--trust-eval" && typeof next === "string") {
      if (next !== "strict" && next !== "asof" && next !== "both") throw new Error("Invalid --trust-eval (use strict|asof|both)");
      trustEval = next;
      i++;
      continue;
    }

    if (a === "--trust-now" && typeof next === "string") {
      trustNow = next;
      i++;
      continue;
    }

    if (a === "-h" || a === "--help") {
      usage();
      process.exit(0);
    }

    if (!a.startsWith("-") && dir === undefined) {
      dir = a;
      continue;
    }

    throw new Error(`Unknown arg: ${a}`);
  }

  if (!dir) {
    usage();
    process.exit(2);
  }

  return {
    dir,
    pretty,
    trustEval,
    ...(attestorTrustPath !== undefined ? { attestorTrustPath } : {}),
    ...(trustNow !== undefined ? { trustNow } : {})
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readUtf8(p: string): string {
  return readFileSync(p, "utf8");
}

function readBytes(p: string): Uint8Array {
  return new Uint8Array(readFileSync(p));
}

function mustJsonObject(p: string): Record<string, unknown> {
  const u: unknown = JSON.parse(readUtf8(p));
  if (!isRecord(u)) throw new Error(`Invalid JSON object: ${p}`);
  return u;
}

function mustManifest(p: string): Manifest {
  const u = mustJsonObject(p);
  const ver = u["ver"];
if (ver !== "pbi-pack-2.0" && ver !== "pbi-attest-pack-2.0") {
  throw new Error("Invalid manifest version");
}
  return u as Manifest;
}

function requireFileHash(dir: string, name: string, expectedHex: string): void {
  const bytes = readBytes(join(dir, name));
  const got = sha256Hex(bytes);
  if (got !== expectedHex) throw new Error(`Hash mismatch for ${name}: expected ${expectedHex}, got ${got}`);
}

/** Strip undefined-valued properties for exactOptionalPropertyTypes */
function normalizeJwk(jwk: NodeJsonWebKey): NodeJsonWebKey {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(jwk as Record<string, unknown>)) {
    if (v !== undefined) out[k] = v;
  }
  return out as unknown as NodeJsonWebKey;
}

function toNodeJwk(u: unknown): NodeJsonWebKey {
  if (!isRecord(u)) throw new Error("Invalid JWK (expected object)");
  const jwk = normalizeJwk(u as unknown as NodeJsonWebKey);
  const kty = (jwk as unknown as Record<string, unknown>)["kty"];
  if (typeof kty !== "string" || kty.length === 0) throw new Error("Invalid JWK (missing kty)");
  return jwk;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dir = resolve(args.dir);

  const manifest = mustManifest(join(dir, "manifest.json"));

  // 1) Verify file integrity
  for (const [name, info] of Object.entries(manifest.files)) {
    requireFileHash(dir, name, info.sha256);
  }

  // 2) Load policy (signed or unsigned) and validate policyHash
  const policyPath = join(dir, manifest.policy.source);
  const policyU = mustJsonObject(policyPath);

  let policy: PBIPolicyFile;

  if (policyU["ver"] === "pbi-policy-signed-1.0") {
    const sp = parseSignedPolicy(policyU);
    if (!sp) throw new Error("Invalid signed policy format");

    const vr = verifySignedPolicy(sp);
    if (!vr.ok) throw new Error(`Signed policy verification failed: ${vr.code}${vr.detail ? ` (${vr.detail})` : ""}`);

    const parsed = parsePolicyFile(sp.policy);
    if (!parsed) throw new Error("Invalid policy file inside signed policy");
    policy = parsed;
  } else {
    const parsed = parsePolicyFile(policyU);
    if (!parsed) throw new Error("Invalid policy file");
    policy = parsed;
  }

  const policyHash = computePolicyHash(policy);
  if (policyHash !== manifest.policy.policyHash) {
    throw new Error(`policyHash mismatch: manifest=${manifest.policy.policyHash} computed=${policyHash}`);
  }

  // 3) Load receipt/action/pubkey/attestation
  const action = mustJsonObject(join(dir, "action.json")) as unknown as PBIActionV1;
  const receipt = mustJsonObject(join(dir, "receipt.json")) as unknown as PBIReceiptV1;
  const pubKeyJwk = toNodeJwk(mustJsonObject(join(dir, "pubkey.jwk.json")));
  const att = mustJsonObject(join(dir, "attestation.json")) as unknown as Attestation;

  // 3b) Optional: enforce attestor trust pinning BEFORE verifying attestation signature
  let trustMode: "none" | "trust" = "none";
  let attestorKeyId: string | null = null;

  let trustAsOf: { ok: boolean; code?: string } | null = null;
  let trustNow: { ok: boolean; code?: string } | null = null;

  if (args.attestorTrustPath !== undefined) {
    trustMode = "trust";

    const trustU = mustJsonObject(resolve(args.attestorTrustPath));
    const trust = parseAttestorTrustFile(trustU);
    if (!trust) throw new Error("Invalid attestor trust file");

    const attPub = toNodeJwk(att.verifier.pubKeyJwk as unknown);

    const asOfIso = att.verifiedAt;
    const nowIso = args.trustNow ?? new Date().toISOString();

    const asOfRes = verifyAttestorTrustAt({
      trust: trust as AttestorTrustFile,
      attestorKid: att.verifier.kid,
      attestorPubKeyJwk: attPub,
      atIso: asOfIso
    });

    const nowRes = verifyAttestorTrustAt({
      trust: trust as AttestorTrustFile,
      attestorKid: att.verifier.kid,
      attestorPubKeyJwk: attPub,
      atIso: nowIso
    });

    trustAsOf = asOfRes.ok ? { ok: true } : { ok: false, code: asOfRes.code };
    trustNow = nowRes.ok ? { ok: true } : { ok: false, code: nowRes.code };

    if (args.trustEval === "asof") {
      if (!asOfRes.ok) throw new Error(asOfRes.detail ?? asOfRes.code);
      attestorKeyId = asOfRes.keyId;
    } else if (args.trustEval === "strict") {
      if (!nowRes.ok) throw new Error(nowRes.detail ?? nowRes.code);
      attestorKeyId = nowRes.keyId;
    } else {
      // both
      if (!asOfRes.ok) throw new Error(asOfRes.detail ?? asOfRes.code);
      if (!nowRes.ok) throw new Error(nowRes.detail ?? nowRes.code);
      attestorKeyId = nowRes.keyId;
    }
  }

  // 4) Build verify policy from purpose
  const vpOrErr = buildVerifyPolicyFromPurpose({ policyFile: policy, purpose: receipt.purpose });
  if ("ok" in vpOrErr && vpOrErr.ok === false) {
    throw new Error(`Policy purpose error: ${vpOrErr.code}${vpOrErr.detail ? ` (${vpOrErr.detail})` : ""}`);
  }
  const verifyPolicy = vpOrErr as VerifyPolicy;

  // 5) Verify receipt cryptographically + action binding
  const credentialStore: CredentialStore = {
    async getPublicKeyJwk(_credId_b64url: string): Promise<NodeJsonWebKey | null> {
      return pubKeyJwk;
    }
  };

  const res: VerifyResult = await verifyReceipt({
    receipt,
    action,
    policy: verifyPolicy,
    credentialStore
  });

  if (!res.ok) throw new Error(`Receipt verification failed: ${res.code}${res.detail ? ` (${res.detail})` : ""}`);

  // 6) Verify attestation signature + consistency
  if (att.ver !== "pbi-attest-1.0") throw new Error("Invalid attestation version");

  const attOk = verifyAttestation(att);
  if (!attOk) throw new Error("Attestation signature invalid");

  const computedReceiptHash = computeReceiptHash(receipt);
  const computedActionHash = computeActionHash(action);

  if (att.receiptHash !== computedReceiptHash) throw new Error("Attestation receiptHash mismatch");
  if (att.actionHash !== receipt.actionHash) throw new Error("Attestation actionHash mismatch vs receipt");
  if (computedActionHash !== receipt.actionHash) throw new Error("ActionHash mismatch (recomputed vs receipt)");
  if (att.policyHash !== policyHash) throw new Error("Attestation policyHash mismatch");
  if (att.policyVer !== policy.ver) throw new Error("Attestation policyVer mismatch");
  if (att.aud !== receipt.aud) throw new Error("Attestation aud mismatch");
  if (att.purpose !== receipt.purpose) throw new Error("Attestation purpose mismatch");
  if (att.challengeId !== receipt.challengeId) throw new Error("Attestation challengeId mismatch");

  // 7) Output
  const out = {
    ok: true,
    manifestVer: manifest.ver,
    policyVer: policy.ver,
    policyHash,
    receiptHash: computedReceiptHash,
    actionHash: computedActionHash,
    decision: att.decision,
    verifiedAt: att.verifiedAt,
    trustMode,
    trustEval: args.trustEval,
    attestorKeyId,
    trustAsOf,
    trustNow
  };

  console.log(args.pretty ? JSON.stringify(out, null, 2) : JSON.stringify(out));
  process.exit(0);
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(msg);
  process.exit(1);
});
