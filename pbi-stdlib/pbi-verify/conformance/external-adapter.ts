#!/usr/bin/env node
import { readFileSync } from "node:fs";
import type { JsonWebKey as NodeJsonWebKey } from "node:crypto";

import { verifyReceipt } from "../src/verify.js";
import type { VerifyPolicy, CredentialStore } from "../src/types.js";

type Input = Readonly<{
  rpId: string;
  origin: string;
  action: unknown;
  receipt: unknown;
  pubKeyJwk: unknown;
}>;

type Output =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; code: string; detail?: string }>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toNodeJwk(v: unknown): NodeJsonWebKey | null {
  if (!isRecord(v)) return null;

  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) if (val !== undefined) out[k] = val;

  const kty = out["kty"];
  if (typeof kty !== "string") return null;

  if (kty === "EC") {
    const crv = out["crv"];
    const x = out["x"];
    const y = out["y"];
    if (typeof crv !== "string" || typeof x !== "string" || typeof y !== "string") return null;
  }

  return out as unknown as NodeJsonWebKey;
}

async function main(): Promise<void> {
  const raw = readFileSync(0, "utf8");
  const input = JSON.parse(raw) as Input;

  const jwk = toNodeJwk(input.pubKeyJwk);
  if (!jwk) {
    const out: Output = { ok: false, code: "invalid_structure", detail: "pubKeyJwk invalid" };
    process.stdout.write(JSON.stringify(out));
    process.exit(1);
    return;
  }

  const policy: VerifyPolicy = {
    rpIdAllowList: [input.rpId],
    originAllowList: [input.origin],
    requireUP: true,
    requireUV: true
  };

  const credentialStore: CredentialStore = {
    async getPublicKeyJwk(_credId: string): Promise<NodeJsonWebKey | null> {
      return jwk;
    }
  };

  const res = await verifyReceipt({
    receipt: input.receipt as never,
    action: input.action as never,
    policy,
    credentialStore
  });

  if (res.ok) {
    const out: Output = { ok: true };
    process.stdout.write(JSON.stringify(out));
    process.exit(0);
    return;
  }

  const out: Output = {
    ok: false,
    code: res.code,
    ...(res.detail !== undefined ? { detail: res.detail } : {})
  };
  process.stdout.write(JSON.stringify(out));
  process.exit(1);
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  const out: Output = { ok: false, code: "external_error", detail: msg };
  process.stdout.write(JSON.stringify(out));
  process.exit(2);
});
