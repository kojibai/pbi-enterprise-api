#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash, createPublicKey, verify as nodeVerify } from "node:crypto";
import type { JsonWebKey as NodeJsonWebKey } from "node:crypto";

import { canonicalize } from "../src/jcs.js";
import { base64UrlToBytes } from "../src/base64url.js";

type TrustRootsFile = Readonly<{
  ver: "pbi-trust-roots-1.0";
  createdAt: string;
  trustedRoots: readonly Readonly<{
    name: string;
    alg: "es256";
    keyId: string; // sha256(canonicalize(pubKeyJwk))
    pubKeyJwk: unknown;
    notBefore: string; // RFC3339
    notAfter: string | null; // RFC3339 | null
  }>[];
  revokedRootKeyIds: readonly string[];
  revocations: readonly unknown[];
}>;

type SignedTrustBundle = Readonly<{
  ver: "pbi-attestor-trust-signed-1.0";
  createdAt: string;
  payload: unknown; // pbi-attestor-trust-1.0
  sig: Readonly<{
    alg: "es256";
    keyId: string;
    signedAt: string;
    pubKeyJwk: unknown;
    sig_b64url: string;
  }>;
}>;

type VerifyOut =
  | Readonly<{
      ok: true;
      bundleVer: "pbi-attestor-trust-signed-1.0";
      rootKeyId: string;
      signedAt: string;
      signedTarget: "payload";
      payloadHash: string;
    }>
  | Readonly<{ ok: false; code: string; detail?: string }>;

function err(code: string, detail?: string): VerifyOut {
  return { ok: false, code, ...(detail !== undefined ? { detail } : {}) };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function sha256HexUtf8(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** exactOptionalPropertyTypes-safe: strip undefined fields */
function normalizeJwkObject(u: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(u)) if (v !== undefined) out[k] = v;
  return out;
}

/** Minimal P-256 EC public JWK parser for ES256 verification */
function toEcP256PublicJwk(u: unknown): NodeJsonWebKey | null {
  if (!isRecord(u)) return null;
  const out = normalizeJwkObject(u);

  if (out["kty"] !== "EC") return null;
  if (out["crv"] !== "P-256") return null;
  if (typeof out["x"] !== "string" || out["x"].length === 0) return null;
  if (typeof out["y"] !== "string" || out["y"].length === 0) return null;

  return out as unknown as NodeJsonWebKey;
}

function keyIdFromPubJwk(pubKeyJwk: NodeJsonWebKey): string {
  return sha256HexUtf8(canonicalize(pubKeyJwk as never));
}

function parseRoots(u: unknown): TrustRootsFile | null {
  if (!isRecord(u)) return null;
  if (u["ver"] !== "pbi-trust-roots-1.0") return null;
  if (!Array.isArray(u["trustedRoots"])) return null;
  if (!Array.isArray(u["revokedRootKeyIds"])) return null;
  return u as TrustRootsFile;
}

function parseSignedBundle(u: unknown): SignedTrustBundle | null {
  if (!isRecord(u)) return null;
  if (u["ver"] !== "pbi-attestor-trust-signed-1.0") return null;
  if (typeof u["createdAt"] !== "string") return null;

  const sigU = u["sig"];
  if (!isRecord(sigU)) return null;

  if (sigU["alg"] !== "es256") return null;
  if (typeof sigU["keyId"] !== "string" || sigU["keyId"].length === 0) return null;
  if (typeof sigU["signedAt"] !== "string" || sigU["signedAt"].length === 0) return null;
  if (typeof sigU["sig_b64url"] !== "string" || sigU["sig_b64url"].length === 0) return null;
  if (sigU["pubKeyJwk"] === undefined) return null;

  return u as SignedTrustBundle;
}

function withinWindow(nowMs: number, notBeforeIso: string, notAfterIso: string | null): boolean {
  const nb = Date.parse(notBeforeIso);
  if (!Number.isFinite(nb)) throw new Error("Invalid root notBefore timestamp");
  if (nowMs < nb) return false;

  if (notAfterIso !== null) {
    const na = Date.parse(notAfterIso);
    if (!Number.isFinite(na)) throw new Error("Invalid root notAfter timestamp");
    if (nowMs > na) return false;
  }
  return true;
}

function usage(): void {
  console.log(
    [
      "Usage:",
      "  pbi-attestor-trust-verify --bundle <trust-attestors.signed.json> --roots <trust-roots.json> [--pretty]",
      "",
      "Notes:",
      "  - Signature is verified over canonicalize(bundle.payload) (UTF-8).",
      ""
    ].join("\n")
  );
}

function main(): void {
  const argv = process.argv.slice(2);
  const pretty = argv.includes("--pretty");

  const bundleIdx = argv.indexOf("--bundle");
  const rootsIdx = argv.indexOf("--roots");

  if (bundleIdx < 0 || rootsIdx < 0) {
    usage();
    process.exit(2);
  }

  const bundlePath = argv[bundleIdx + 1];
  const rootsPath = argv[rootsIdx + 1];

  if (!bundlePath || !rootsPath) {
    console.error(JSON.stringify(err("usage_error", "Missing --bundle or --roots value"), null, pretty ? 2 : 0));
    process.exit(2);
  }

  const bundleU = JSON.parse(readFileSync(resolve(bundlePath), "utf8")) as unknown;
  const rootsU = JSON.parse(readFileSync(resolve(rootsPath), "utf8")) as unknown;

  const roots = parseRoots(rootsU);
  if (!roots) {
    console.error(JSON.stringify(err("invalid_roots", "Invalid trust-roots.json (expected pbi-trust-roots-1.0)"), null, pretty ? 2 : 0));
    process.exit(1);
  }

  const bundle = parseSignedBundle(bundleU);
  if (!bundle) {
    console.error(JSON.stringify(err("invalid_bundle", "Invalid signed trust bundle"), null, pretty ? 2 : 0));
    process.exit(1);
  }

  const pub = toEcP256PublicJwk(bundle.sig.pubKeyJwk);
  if (!pub) {
    console.error(JSON.stringify(err("invalid_bundle", "Invalid sig.pubKeyJwk (expected EC P-256 public JWK)"), null, pretty ? 2 : 0));
    process.exit(1);
  }

  // keyId must match pubKeyJwk
  const computedKeyId = keyIdFromPubJwk(pub);
  if (computedKeyId !== bundle.sig.keyId) {
    console.error(
      JSON.stringify(err("keyid_mismatch", `Signature keyId mismatch: sig=${bundle.sig.keyId} computed=${computedKeyId}`), null, pretty ? 2 : 0)
    );
    process.exit(1);
  }

  // Root allowlist + revocation + validity window
  const root = roots.trustedRoots.find((r) => r.keyId === bundle.sig.keyId);
  if (!root) {
    console.error(JSON.stringify(err("untrusted_root", `Untrusted root key: ${bundle.sig.keyId}`), null, pretty ? 2 : 0));
    process.exit(1);
  }

  const revoked = new Set<string>(roots.revokedRootKeyIds);
  if (revoked.has(bundle.sig.keyId)) {
    console.error(JSON.stringify(err("revoked_root", `Revoked root key: ${bundle.sig.keyId}`), null, pretty ? 2 : 0));
    process.exit(1);
  }

  const nowMs = Date.now();
  if (!withinWindow(nowMs, root.notBefore, root.notAfter)) {
    console.error(JSON.stringify(err("root_expired", `Root key expired/not-yet-valid: ${bundle.sig.keyId}`), null, pretty ? 2 : 0));
    process.exit(1);
  }

  // ✅ IMPORTANT: signature is over canonicalize(bundle.payload) only
  const payloadCanon = canonicalize(bundle.payload as never);
  const payloadHash = sha256HexUtf8(payloadCanon);

  const sigBytes = base64UrlToBytes(bundle.sig.sig_b64url);
  const keyObj = createPublicKey({ key: pub, format: "jwk" });

  const ok = nodeVerify("sha256", Buffer.from(payloadCanon, "utf8"), keyObj, Buffer.from(sigBytes));
  if (!ok) {
    console.error(JSON.stringify(err("bad_signature", "Signed trust bundle signature invalid"), null, pretty ? 2 : 0));
    process.exit(1);
  }

  const out: VerifyOut = {
    ok: true,
    bundleVer: "pbi-attestor-trust-signed-1.0",
    rootKeyId: bundle.sig.keyId,
    signedAt: bundle.sig.signedAt,
    signedTarget: "payload",
    payloadHash
  };

  console.log(pretty ? JSON.stringify(out, null, 2) : JSON.stringify(out));
  process.exit(0);
}

main();
