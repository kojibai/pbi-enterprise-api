// scripts/verify-vectors.ts
import { readFileSync } from "node:fs";
import type { JsonWebKey as NodeJsonWebKey } from "node:crypto";

import { verifyReceipt } from "../src/verify.js";
import type {
  PBIReceiptV1,
  PBIActionV1,
  VerifyPolicy,
  CredentialStore,
  ChallengeStore,
  ChallengeRecordV1
} from "../src/types.js";

/**
 * Convert unknown/DOM-ish JWK objects coming from JSON into a Node-compatible JWK
 * and strip undefined-valued optionals for exactOptionalPropertyTypes.
 */
function toNodeJwk(v: unknown): NodeJsonWebKey | null {
  if (!v || typeof v !== "object") return null;

  const inObj = v as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const [k, val] of Object.entries(inObj)) {
    if (val !== undefined) out[k] = val;
  }

  // Minimal sanity checks for a usable public EC JWK
  const kty = out["kty"];
  if (typeof kty !== "string") return null;

  // Most WebAuthn ES256 keys are EC P-256 with x/y
  if (kty === "EC") {
    const crv = out["crv"];
    const x = out["x"];
    const y = out["y"];
    if (typeof crv !== "string") return null;
    if (typeof x !== "string") return null;
    if (typeof y !== "string") return null;
  }

  return out as unknown as NodeJsonWebKey;
}

type VectorExpect = Readonly<{ result: "ok" | "error"; code?: string }>;

type VectorEntry = Readonly<{
  action: PBIActionV1;
  receipt: PBIReceiptV1;
  expect: VectorExpect;
}>;

type VectorFile = Readonly<{
  ver: string;
  vectors: Record<string, VectorEntry>;
  rp: Readonly<{
    rpId: string;
    origin_allowed: readonly string[];
    publicKeyJwk: unknown; // from JSON file; normalize at runtime
    credId_b64url: string;
  }>;
}>;

function parseVectorFile(path: string): VectorFile {
  const raw = readFileSync(path, "utf8");
  const parsed: unknown = JSON.parse(raw);

  // Keep parsing minimal; this is a dev/test harness.
  // Verification correctness is exercised by verifyReceipt itself.
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Vector file JSON is not an object");
  }
  return parsed as VectorFile;
}

async function main(): Promise<void> {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node dist/scripts/verify-vectors.js <path/to/pbi-vec-1.0.json>");
    process.exit(2);
  }

  const vf = parseVectorFile(filePath);

  const jwk = toNodeJwk(vf.rp.publicKeyJwk);
  if (!jwk) {
    throw new Error("Vector file rp.publicKeyJwk is invalid or missing required fields");
  }

  const credentialStore: CredentialStore = {
    async getPublicKeyJwk(credId_b64url: string): Promise<NodeJsonWebKey | null> {
      return credId_b64url === vf.rp.credId_b64url ? jwk : null;
    }
  };

  for (const [name, v] of Object.entries(vf.vectors)) {
    // Per-vector policy overrides (for negative cases that must fail policy checks)
    const policy: VerifyPolicy = {
      rpIdAllowList: name.startsWith("rpId_not_allowed")
        ? ["wrong.example"] // intentionally wrong RP; should force rpId_not_allowed
        : [vf.rp.rpId],
      originAllowList: vf.rp.origin_allowed,
      requireUP: true,
      requireUV: false
    };

    // Per-vector challenge store behavior (for replay prevention tests)
    const challengeStore: ChallengeStore = {
      async getChallenge(challengeId: string): Promise<ChallengeRecordV1 | null> {
        if (challengeId !== "chal_test_0001") return null;

        return {
          ver: "pbi-chal-1.0",
          challengeId: "chal_test_0001",
          challenge: v.receipt.challenge,
          actionHash: v.receipt.actionHash,
          aud: v.receipt.aud,
          purpose: v.receipt.purpose,
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          usedAt: name.startsWith("challenge_used")
            ? new Date(Date.now() - 5_000).toISOString()
            : null
        };
      },
      async markUsed(_challengeId: string, _receiptHash: string): Promise<void> {
        // no-op for vectors
      }
    };

    const res = await verifyReceipt({
      receipt: v.receipt,
      action: v.action,
      policy,
      credentialStore,
      challengeStore
    });

    const ok = res.ok ? "ok" : `err:${res.code}`;
    console.log(`${name}: ${ok}`);

    if (v.expect.result === "ok" && !res.ok) process.exitCode = 1;
    if (v.expect.result === "error" && res.ok) process.exitCode = 1;

    // If the vector specifies an error code, enforce it.
    if (v.expect.result === "error" && v.expect.code && !res.ok) {
      if (res.code !== v.expect.code) process.exitCode = 1;
    }
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
