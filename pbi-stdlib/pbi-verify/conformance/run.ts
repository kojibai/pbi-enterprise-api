#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import type { JsonWebKey as NodeJsonWebKey } from "node:crypto";

import type { VectorFile, VectorCase, ExternalVerifierInput, ExternalVerifierOutput } from "./types.js";

// If you're running internal mode from within the pbi-verify repo,
// this import should resolve. Otherwise use external mode.
import { verifyReceipt } from "../src/verify.js";
import type { CredentialStore, VerifyPolicy } from "../src/types.js";

function parseJsonFile<T>(p: string): T {
  const raw = readFileSync(p, "utf8");
  return JSON.parse(raw) as T;
}

function okOrCode(res: ExternalVerifierOutput): string {
  return res.ok ? "ok" : `err:${res.code}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Convert unknown/DOM-ish JWK objects coming from JSON into a Node-compatible JWK.
 * Also strips undefined-valued properties to avoid exactOptionalPropertyTypes issues.
 */
function toNodeJwk(v: unknown): NodeJsonWebKey | null {
  if (!isRecord(v)) return null;

  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) {
    if (val !== undefined) out[k] = val;
  }

  const kty = out["kty"];
  if (typeof kty !== "string") return null;

  // WebAuthn ES256: EC P-256 public key
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

async function runInternalAsync(test: VectorCase): Promise<ExternalVerifierOutput> {
  const policy: VerifyPolicy = {
    rpIdAllowList: [test.rpId],
    originAllowList: [test.origin],
    requireUP: true,
    requireUV: true
  };

  const jwk = toNodeJwk(test.pubKeyJwk);
  if (!jwk) {
    return { ok: false, code: "invalid_structure", detail: "pubKeyJwk invalid or missing required fields" };
  }

  const credentialStore: CredentialStore = {
    async getPublicKeyJwk(credId_b64url: string): Promise<NodeJsonWebKey | null> {
      // In conformance vectors we accept the single provided test key.
      // If you want stricter binding, add credId to the vector and enforce it here.
      void credId_b64url;
      return jwk;
    }
  };

  const res = await verifyReceipt({
    receipt: test.receipt,
    action: test.action,
    policy,
    credentialStore
    // offline mode: no challengeStore in this conformance harness
  });

if (res.ok) return { ok: true };
return {
  ok: false,
  code: res.code,
  ...(res.detail !== undefined ? { detail: res.detail } : {})
};

}

function runExternal(cmd: string, input: ExternalVerifierInput): ExternalVerifierOutput {
  const r = spawnSync(cmd, {
    shell: true,
    input: JSON.stringify(input),
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024
  });

  if (r.error) return { ok: false, code: "external_error", detail: String(r.error.message) };
  if (typeof r.stdout !== "string" || r.stdout.trim().length === 0) {
    return { ok: false, code: "external_no_output", detail: r.stderr?.toString() ?? "" };
  }

  try {
    const out = JSON.parse(r.stdout) as ExternalVerifierOutput;
    if (typeof out === "object" && out !== null && typeof (out as { ok?: unknown }).ok === "boolean") return out;
    return { ok: false, code: "external_bad_json", detail: "Output JSON missing ok:boolean" };
  } catch {
    return { ok: false, code: "external_bad_json", detail: r.stdout.slice(0, 400) };
  }
}

async function main(): Promise<void> {
  const vectorsPath = process.argv[2];
  if (!vectorsPath) {
    console.error("Usage: node conformance/run.ts <pbi-conf-1.0.json> [--external '<cmd>']");
    process.exit(2);
    return;
  }

  const externalIdx = process.argv.indexOf("--external");
  const externalCmd = externalIdx >= 0 ? process.argv[externalIdx + 1] : undefined;

  const vf = parseJsonFile<VectorFile>(vectorsPath);

  let failures = 0;

  for (const t of vf.cases) {
    // Normalize JWK for external verifiers too (helps cross-runtime consistency).
    const jwk = toNodeJwk(t.pubKeyJwk);
    if (!jwk) {
      console.log(`FAIL ${t.name} -> err:invalid_structure (expected ${t.expect.result === "ok" ? "ok" : `err:${t.expect.code}`})`);
      failures++;
      continue;
    }

    const input: ExternalVerifierInput = {
      rpId: t.rpId,
      origin: t.origin,
      action: t.action,
      receipt: t.receipt,
      pubKeyJwk: jwk
    };

    const out = externalCmd ? runExternal(externalCmd, input) : await runInternalAsync(t);

    const got = okOrCode(out);
    const exp = t.expect.result === "ok" ? "ok" : `err:${t.expect.code}`;

    const pass = got === exp;
    console.log(`${pass ? "PASS" : "FAIL"} ${t.name} -> ${got} (expected ${exp})`);

    if (!pass) failures++;
  }

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(msg);
  process.exit(2);
});
