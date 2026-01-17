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
    keyId: string; // sha256(canonical(pubKeyJwk))
    pubKeyJwk: unknown;
    notBefore: string; // RFC3339
    notAfter: string | null; // RFC3339 | null
  }>[];
  revokedRootKeyIds: readonly string[];
  revocations: readonly unknown[];
}>;

type SigBlock = Readonly<{
  alg: "es256";
  keyId: string;
  signedAt: string;
  pubKeyJwk: unknown;
  sig_b64url: string;
}>;

type VerifyOut =
  | Readonly<{
      ok: true;
      bundleVer: string;
      rootKeyId: string;
      signedAt: string;
      payloadHash: string;
    }>
  | Readonly<{ ok: false; code: string; detail?: string }>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function err(code: string, detail?: string): VerifyOut {
  return { ok: false, code, ...(detail !== undefined ? { detail } : {}) };
}

function parseRoots(u: unknown): TrustRootsFile | null {
  if (!isRecord(u)) return null;
  if (u["ver"] !== "pbi-trust-roots-1.0") return null;
  if (!Array.isArray(u["trustedRoots"])) return null;
  if (!Array.isArray(u["revokedRootKeyIds"])) return null;
  return u as TrustRootsFile;
}

/** Strip undefined-valued props (exactOptionalPropertyTypes-safe) + minimal ES256 EC JWK checks */
function normalizeJwk(u: unknown): NodeJsonWebKey | null {
  if (!isRecord(u)) return null;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(u)) if (v !== undefined) out[k] = v;

  if (out["kty"] !== "EC") return null;
  if (out["crv"] !== "P-256") return null;
  if (typeof out["x"] !== "string" || (out["x"] as string).length === 0) return null;
  if (typeof out["y"] !== "string" || (out["y"] as string).length === 0) return null;

  return out as unknown as NodeJsonWebKey;
}

function parseSigBlock(u: unknown): SigBlock | null {
  if (!isRecord(u)) return null;
  if (u["alg"] !== "es256") return null;
  if (typeof u["keyId"] !== "string" || (u["keyId"] as string).length === 0) return null;
  if (typeof u["signedAt"] !== "string" || (u["signedAt"] as string).length === 0) return null;
  if (typeof u["sig_b64url"] !== "string" || (u["sig_b64url"] as string).length === 0) return null;
  if (u["pubKeyJwk"] === undefined) return null;

  return {
    alg: "es256",
    keyId: u["keyId"] as string,
    signedAt: u["signedAt"] as string,
    pubKeyJwk: u["pubKeyJwk"],
    sig_b64url: u["sig_b64url"] as string
  };
}

function sha256HexUtf8(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function keyIdFromPubJwk(pubKeyJwk: NodeJsonWebKey): string {
  return sha256HexUtf8(canonicalize(pubKeyJwk as never));
}

function withinWindow(nowMs: number, notBeforeIso: string, notAfterIso: string | null): boolean {
  const nb = Date.parse(notBeforeIso);
  if (!Number.isFinite(nb)) throw new Error("Invalid notBefore timestamp");
  if (nowMs < nb) return false;

  if (notAfterIso !== null) {
    const na = Date.parse(notAfterIso);
    if (!Number.isFinite(na)) throw new Error("Invalid notAfter timestamp");
    if (nowMs > na) return false;
  }
  return true;
}

function usage(): void {
  console.log(
    [
      "Usage:",
      "  pbi-attestor-trust-verify --bundle <trust-attestors.signed.json> --roots <trust-roots.json> [--pretty]",
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

  const bundlePath = resolve(argv[bundleIdx + 1] ?? "");
  const rootsPath = resolve(argv[rootsIdx + 1] ?? "");
  if (!bundlePath || !rootsPath) {
    console.error(JSON.stringify(err("usage_error", "Missing --bundle or --roots value"), null, pretty ? 2 : 0));
    process.exit(2);
  }

  const bundleU = JSON.parse(readFileSync(bundlePath, "utf8")) as unknown;
  const rootsU = JSON.parse(readFileSync(rootsPath, "utf8")) as unknown;

  const roots = parseRoots(rootsU);
  if (!roots) {
    console.error(JSON.stringify(err("invalid_roots", "Invalid trust-roots.json (expected pbi-trust-roots-1.0)"), null, pretty ? 2 : 0));
    process.exit(1);
  }

  if (!isRecord(bundleU)) {
    console.error(JSON.stringify(err("invalid_bundle", "Bundle JSON must be an object"), null, pretty ? 2 : 0));
    process.exit(1);
  }

  const bundleVer = bundleU["ver"];
  if (typeof bundleVer !== "string" || bundleVer.length === 0) {
    console.error(JSON.stringify(err("invalid_bundle", "Bundle missing ver"), null, pretty ? 2 : 0));
    process.exit(1);
  }

  // Accept either signature property name
  const sigField = isRecord(bundleU["issuerSig"]) ? "issuerSig" : isRecord(bundleU["sig"]) ? "sig" : null;
  if (!sigField) {
    console.error(JSON.stringify(err("invalid_bundle", "Bundle missing signature block (sig or issuerSig)"), null, pretty ? 2 : 0));
    process.exit(1);
  }

  const sig = parseSigBlock(bundleU[sigField]);
  if (!sig) {
    console.error(JSON.stringify(err("invalid_bundle", "Invalid signature block shape"), null, pretty ? 2 : 0));
    process.exit(1);
  }

  const pub = normalizeJwk(sig.pubKeyJwk);
  if (!pub) {
    console.error(JSON.stringify(err("invalid_bundle", "Invalid signature pubKeyJwk (expected EC P-256 JWK)"), null, pretty ? 2 : 0));
    process.exit(1);
  }

  const computedKeyId = keyIdFromPubJwk(pub);
  if (computedKeyId !== sig.keyId) {
    console.error(
      JSON.stringify(err("keyid_mismatch", `Signature keyId mismatch: sig=${sig.keyId} computed=${computedKeyId}`), null, pretty ? 2 : 0)
    );
    process.exit(1);
  }

  // Root allowlist + revocation + validity window
  const nowMs = Date.now();

  const root = roots.trustedRoots.find((r) => r.keyId === sig.keyId);
  if (!root) {
    console.error(JSON.stringify(err("untrusted_root", `Untrusted root key: ${sig.keyId}`), null, pretty ? 2 : 0));
    process.exit(1);
  }

  const revoked = new Set<string>(roots.revokedRootKeyIds);
  if (revoked.has(sig.keyId)) {
    console.error(JSON.stringify(err("revoked_root", `Revoked root key: ${sig.keyId}`), null, pretty ? 2 : 0));
    process.exit(1);
  }

  if (!withinWindow(nowMs, root.notBefore, root.notAfter)) {
    console.error(JSON.stringify(err("root_expired", `Root key expired/not-yet-valid: ${sig.keyId}`), null, pretty ? 2 : 0));
    process.exit(1);
  }

  // ✅ CRITICAL FIX: verify EXACTLY what the signer signed:
  // canonicalize(bundle minus signature field)
  const payloadObj: Record<string, unknown> = { ...bundleU };
  delete payloadObj[sigField];

  const payload = canonicalize(payloadObj as never);
  const payloadHash = sha256HexUtf8(payload);

  const sigBytes = base64UrlToBytes(sig.sig_b64url);
  const keyObj = createPublicKey({ key: pub, format: "jwk" });

  const ok = nodeVerify("sha256", Buffer.from(payload, "utf8"), keyObj, Buffer.from(sigBytes));
  if (!ok) {
    console.error(JSON.stringify(err("bad_signature", "Signed trust bundle signature invalid"), null, pretty ? 2 : 0));
    process.exit(1);
  }

  const out: VerifyOut = {
    ok: true,
    bundleVer,
    rootKeyId: sig.keyId,
    signedAt: sig.signedAt,
    payloadHash
  };

  console.log(pretty ? JSON.stringify(out, null, 2) : JSON.stringify(out));
  process.exit(0);
}

main();
