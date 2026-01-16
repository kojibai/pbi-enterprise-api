#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { JsonWebKey as NodeJsonWebKey } from "node:crypto";

import { verifyReceipt } from "../src/verify.js";
import type {
  CredentialStore,
  PBIActionV1,
  PBIReceiptV1,
  VerifyPolicy,
  VerifyResult
} from "../src/types.js";

type ParsedArgs = Readonly<{
  receiptPath: string;
  actionPath?: string;
  pubkeyPath: string;
  rpIds: readonly string[];
  origins: readonly string[];
  requireUP: boolean;
  requireUV: boolean;
  expectedCredId?: string;
  pretty: boolean;
}>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readJsonFile(path: string): unknown {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as unknown;
}

/**
 * Convert unknown (JSON-parsed) JWK into a Node-compatible JsonWebKey and
 * strip undefined-valued properties for exactOptionalPropertyTypes.
 */
function toNodeJwk(v: unknown): NodeJsonWebKey | null {
  if (!isRecord(v)) return null;

  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) {
    if (val !== undefined) out[k] = val;
  }

  // Minimal sanity checks for a usable public EC JWK (WebAuthn ES256)
  const kty = out["kty"];
  if (typeof kty !== "string") return null;

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

function parseArgs(argv: readonly string[]): ParsedArgs | { error: string } {
  const rpIds: string[] = [];
  const origins: string[] = [];
  let receiptPath: string | undefined;
  let actionPath: string | undefined;
  let pubkeyPath: string | undefined;
  let expectedCredId: string | undefined;
  let requireUP = true;
  let requireUV = false;
  let pretty = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const next = argv[i + 1];

    if (a === "--receipt" && typeof next === "string") {
      receiptPath = next;
      i++;
      continue;
    }
    if (a === "--action" && typeof next === "string") {
      actionPath = next;
      i++;
      continue;
    }
    if (a === "--pubkey" && typeof next === "string") {
      pubkeyPath = next;
      i++;
      continue;
    }
    if (a === "--rpId" && typeof next === "string") {
      rpIds.push(next);
      i++;
      continue;
    }
    if (a === "--origin" && typeof next === "string") {
      origins.push(next);
      i++;
      continue;
    }
    if (a === "--credId" && typeof next === "string") {
      expectedCredId = next;
      i++;
      continue;
    }
    if (a === "--requireUV") {
      requireUV = true;
      continue;
    }
    if (a === "--no-requireUP") {
      requireUP = false;
      continue;
    }
    if (a === "--pretty") {
      pretty = true;
      continue;
    }
    if (a === "--help" || a === "-h") {
      return { error: "help" };
    }

    return { error: `Unknown arg: ${a}` };
  }

  if (!receiptPath) return { error: "Missing --receipt <path>" };
  if (!pubkeyPath) return { error: "Missing --pubkey <path-to-jwk.json>" };
  if (rpIds.length === 0) return { error: "Missing at least one --rpId <rpId>" };
  if (origins.length === 0) return { error: "Missing at least one --origin <origin>" };

  // exactOptionalPropertyTypes: omit optional properties when undefined
  return {
    receiptPath,
    pubkeyPath,
    rpIds,
    origins,
    requireUP,
    requireUV,
    pretty,
    ...(actionPath !== undefined ? { actionPath } : {}),
    ...(expectedCredId !== undefined ? { expectedCredId } : {})
  };
}

function printHelp(): void {
  const msg = `
Usage:
  pbi-verify --receipt <receipt.json> --pubkey <pubkey.jwk.json> --rpId <rpId> --origin <origin> [options]

Required:
  --receipt <path>       Path to PBI receipt JSON (pbi-receipt-1.0)
  --pubkey <path>        Path to credential public key JWK (P-256)
  --rpId <value>         Allowed rpId (repeatable)
  --origin <value>       Allowed origin (repeatable)

Optional:
  --action <path>        If provided, recompute actionHash from action JSON (pbi-action-1.0)
  --credId <b64url>      Require receipt.authorSig.credId match this exact value
  --requireUV            Require UV flag in authenticatorData
  --no-requireUP         Disable UP requirement (UNSAFE)
  --pretty               Pretty-print JSON output
  -h, --help             Show help

Exit codes:
  0 = verified ok
  1 = verification failed
  2 = usage error
`.trim();
  console.log(msg);
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  if ("error" in parsed) {
    if (parsed.error === "help") {
      printHelp();
      process.exit(0);
    }
    console.error(parsed.error);
    printHelp();
    process.exit(2);
    return;
  }

  const receiptAbs = resolve(parsed.receiptPath);
  const pubkeyAbs = resolve(parsed.pubkeyPath);

  const receiptU = readJsonFile(receiptAbs);
  const pubkeyU = readJsonFile(pubkeyAbs);

  if (!isRecord(receiptU)) {
    console.error("Invalid receipt JSON: expected object");
    process.exit(2);
    return;
  }
  if (!isRecord(pubkeyU)) {
    console.error("Invalid pubkey JSON: expected object");
    process.exit(2);
    return;
  }

  const receipt = receiptU as unknown as PBIReceiptV1;

  const pubKeyJwk = toNodeJwk(pubkeyU);
  if (!pubKeyJwk) {
    console.error("Invalid pubkey JWK: missing required fields (expected EC P-256 public key)");
    process.exit(2);
    return;
  }

  let action: PBIActionV1 | undefined;
  if (parsed.actionPath !== undefined) {
    const actionAbs = resolve(parsed.actionPath);
    const actionU = readJsonFile(actionAbs);
    if (!isRecord(actionU)) {
      console.error("Invalid action JSON: expected object");
      process.exit(2);
      return;
    }
    action = actionU as unknown as PBIActionV1;
  }

  const policy: VerifyPolicy = {
    rpIdAllowList: parsed.rpIds,
    originAllowList: parsed.origins,
    requireUP: parsed.requireUP,
    requireUV: parsed.requireUV
  };

  const credentialStore: CredentialStore = {
    async getPublicKeyJwk(credId_b64url: string): Promise<NodeJsonWebKey | null> {
      if (parsed.expectedCredId !== undefined && credId_b64url !== parsed.expectedCredId) return null;
      return pubKeyJwk;
    }
  };

  const res: VerifyResult = await verifyReceipt({
    receipt,
    policy,
    credentialStore,
    ...(action !== undefined ? { action } : {})
    // NOTE: challengeStore intentionally omitted for offline mode
  });

  const out = parsed.pretty ? JSON.stringify(res, null, 2) : JSON.stringify(res);
  console.log(out);
  process.exit(res.ok ? 0 : 1);
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(msg);
  process.exit(2);
});
