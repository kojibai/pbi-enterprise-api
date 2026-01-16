#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash, createPublicKey, verify as nodeVerify } from "node:crypto";
import type { JsonWebKey as NodeJsonWebKey } from "node:crypto";

import { sha256Hex } from "../src/hash.js";
import { verifyReceipt, computeReceiptHash } from "../src/verify.js";
import { canonicalize } from "../src/jcs.js";
import { base64UrlToBytes, hexToBytes } from "../src/base64url.js";
import type { PBIReceiptV1, PBIActionV1, VerifyPolicy, CredentialStore, VerifyResult } from "../src/types.js";

type ManifestReceipt = Readonly<{
  id: string;
  receiptPath: string;
  actionPath: string;
  credId: string;
  receiptHash: string;
  actionHash: string;
}>;

type Manifest = Readonly<{
  ver: "pbi-pack-1.1";
  createdAt: string;
  issuer: Readonly<{ name: string; aud: string }>;
  policy: Readonly<{
    rpIdAllowList: readonly string[];
    originAllowList: readonly string[];
    requireUP: boolean;
    requireUV: boolean;
  }>;
  pack: Readonly<{ packId: string; prevPackId?: string }>;
  merkle: Readonly<{ algo: "sha256"; leaf: "receiptHashHex"; root: string; count: number }>;
  receipts: readonly ManifestReceipt[];
  files: Readonly<Record<string, Readonly<{ sha256: string; bytes: number }>>>;
  issuerSig?: Readonly<{
    alg: "es256";
    keyId?: string;
    signedAt: string;
    pubKeyJwk: unknown;
    sig_b64url: string;
  }>;
}>;

type Proof = Readonly<{
  ver: "pbi-proof-1.0";
  createdAt: string;
  packId: string;
  prevPackId?: string;
  merkle: Readonly<{
    algo: "sha256";
    leaf: "receiptHashHex";
    root: string;
    index: number;
    siblings: readonly string[];
  }>;
  manifest: Manifest;
  leaf: Readonly<{
    id: string;
    credId: string;
    receiptHash: string;
    actionHash: string;
    receipt: PBIReceiptV1;
    action: PBIActionV1;
    pubKeyJwk: unknown;
  }>;
}>;

type TrustFile = Readonly<{
  ver: "pbi-trust-1.0";
  trustedIssuers: readonly Readonly<{
    keyId?: string;
    pubKeyJwk: unknown;
    notBefore?: string;
    notAfter?: string | null;
    issuer?: Readonly<{ name: string; aud: string }>;
  }>[];
  revokedKeyIds?: readonly string[];
}>;

type TrustDecision = Readonly<{
  mode: "none" | "jwk" | "trust";
  trustedKeyIds: ReadonlySet<string>;
  revokedKeyIds: ReadonlySet<string>;
  issuerConstraintsByKeyId: ReadonlyMap<string, Readonly<{ name: string; aud: string }>>;
  notBeforeByKeyId: ReadonlyMap<string, number>;
  notAfterByKeyId: ReadonlyMap<string, number | null>;
}>;

function readUtf8(p: string): string {
  return readFileSync(p, "utf8");
}
function readBytes(p: string): Uint8Array {
  return new Uint8Array(readFileSync(p));
}
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function requireHex64(label: string, v: string): void {
  if (!/^[0-9a-f]{64}$/.test(v)) throw new Error(`${label} must be 64 lowercase hex chars`);
}
function sha256HexUtf8(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}
function toNodeJwk(v: unknown): NodeJsonWebKey | null {
  if (!isRecord(v)) return null;
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) if (val !== undefined) out[k] = val;

  const kty = out["kty"];
  if (typeof kty !== "string") return null;

  if (kty === "EC") {
    const crv = out["crv"], x = out["x"], y = out["y"];
    if (typeof crv !== "string" || typeof x !== "string" || typeof y !== "string") return null;
  }
  return out as unknown as NodeJsonWebKey;
}

function loadManifest(dir: string): Manifest {
  const raw = readUtf8(join(dir, "manifest.json"));
  const u: unknown = JSON.parse(raw);
  if (!isRecord(u) || u["ver"] !== "pbi-pack-1.1") throw new Error("Invalid manifest version");
  return u as Manifest;
}

function requireFileHash(dir: string, name: string, expectedHex: string): void {
  requireHex64(`manifest.files.${name}.sha256`, expectedHex);
  const got = sha256Hex(readBytes(join(dir, name)));
  if (got !== expectedHex) throw new Error(`Hash mismatch for ${name}: expected ${expectedHex}, got ${got}`);
}

function manifestSigningPayload(manifest: Manifest): string {
  const m = manifest as unknown as Record<string, unknown>;
  const copy: Record<string, unknown> = { ...m };
  delete copy["issuerSig"];
  return canonicalize(copy as never);
}

function pubKeyKeyId(pubKeyJwk: NodeJsonWebKey): string {
  return sha256HexUtf8(canonicalize(pubKeyJwk as never));
}

function parseRfc3339ToMs(label: string, s: string): number {
  const t = Date.parse(s);
  if (!Number.isFinite(t)) throw new Error(`${label} must be RFC3339, got "${s}"`);
  return t;
}

/**
 * --trust accepts either:
 *  - raw issuer public JWK file(s), OR
 *  - pbi-trust-1.0 trust policy file(s)
 */
function loadTrust(paths: readonly string[]): TrustDecision {
  if (paths.length === 0) {
    return {
      mode: "none",
      trustedKeyIds: new Set<string>(),
      revokedKeyIds: new Set<string>(),
      issuerConstraintsByKeyId: new Map(),
      notBeforeByKeyId: new Map(),
      notAfterByKeyId: new Map()
    };
  }

  const trustedKeyIds = new Set<string>();
  const revokedKeyIds = new Set<string>();
  const issuerConstraintsByKeyId = new Map<string, Readonly<{ name: string; aud: string }>>();
  const notBeforeByKeyId = new Map<string, number>();
  const notAfterByKeyId = new Map<string, number | null>();

  let sawTrustFile = false;

  for (const p of paths) {
    const abs = resolve(p);
    const u: unknown = JSON.parse(readUtf8(abs));

    if (isRecord(u) && u["ver"] === "pbi-trust-1.0") {
      sawTrustFile = true;
      const tf = u as unknown as TrustFile;

      const revoked = tf.revokedKeyIds ?? [];
      for (const kid of revoked) {
        if (typeof kid !== "string") throw new Error("trust.revokedKeyIds must be strings");
        requireHex64("trust.revokedKeyIds[]", kid);
        revokedKeyIds.add(kid);
      }

      for (const entry of tf.trustedIssuers) {
        const jwk = toNodeJwk(entry.pubKeyJwk);
        if (!jwk) throw new Error(`Invalid trust trustedIssuers.pubKeyJwk in ${abs}`);

        const kid = entry.keyId ?? pubKeyKeyId(jwk);
        requireHex64("trust keyId", kid);
        trustedKeyIds.add(kid);

        if (entry.issuer) {
          const name = entry.issuer.name;
          const aud = entry.issuer.aud;
          if (typeof name !== "string" || typeof aud !== "string") throw new Error("trust issuer constraint invalid");
          issuerConstraintsByKeyId.set(kid, { name, aud });
        }

        if (entry.notBefore !== undefined) {
          if (typeof entry.notBefore !== "string") throw new Error("trust notBefore must be string");
          notBeforeByKeyId.set(kid, parseRfc3339ToMs("trust.notBefore", entry.notBefore));
        }

        if (entry.notAfter !== undefined) {
          if (entry.notAfter === null) {
            notAfterByKeyId.set(kid, null);
          } else {
            if (typeof entry.notAfter !== "string") throw new Error("trust notAfter must be string or null");
            notAfterByKeyId.set(kid, parseRfc3339ToMs("trust.notAfter", entry.notAfter));
          }
        }
      }

      continue;
    }

    // raw JWK
    const jwk = toNodeJwk(u);
    if (!jwk) throw new Error(`Invalid trusted issuer JWK (expected EC JWK or pbi-trust-1.0): ${abs}`);
    trustedKeyIds.add(pubKeyKeyId(jwk));
  }

  return {
    mode: sawTrustFile ? "trust" : "jwk",
    trustedKeyIds,
    revokedKeyIds,
    issuerConstraintsByKeyId,
    notBeforeByKeyId,
    notAfterByKeyId
  };
}

function verifyIssuerSig(
  manifest: Manifest,
  trust: TrustDecision
): Readonly<{ verified: boolean; issuerKeyId: string | null }> {
  const sig = manifest.issuerSig;
  if (!sig) return { verified: false, issuerKeyId: null };

  if (sig.alg !== "es256") throw new Error("Invalid manifest.issuerSig.alg");

  const pub = toNodeJwk(sig.pubKeyJwk);
  if (!pub) throw new Error("Invalid manifest.issuerSig.pubKeyJwk");

  const issuerKeyId = pubKeyKeyId(pub);
  requireHex64("issuerKeyId", issuerKeyId);

  if (trust.mode !== "none") {
    if (!trust.trustedKeyIds.has(issuerKeyId)) throw new Error(`Untrusted issuer key: ${issuerKeyId}`);
    if (trust.revokedKeyIds.has(issuerKeyId)) throw new Error(`Revoked issuer key: ${issuerKeyId}`);

    const now = Date.now();
    const nb = trust.notBeforeByKeyId.get(issuerKeyId);
    const na = trust.notAfterByKeyId.get(issuerKeyId);

    if (nb !== undefined && now < nb) throw new Error(`Issuer key not yet valid: ${issuerKeyId}`);
    if (na !== undefined && na !== null && now > na) throw new Error(`Issuer key expired: ${issuerKeyId}`);

    const c = trust.issuerConstraintsByKeyId.get(issuerKeyId);
    if (c) {
      if (manifest.issuer.name !== c.name || manifest.issuer.aud !== c.aud) {
        throw new Error(
          `Issuer constraint mismatch for key ${issuerKeyId}: expected ${c.name}/${c.aud}, got ${manifest.issuer.name}/${manifest.issuer.aud}`
        );
      }
    }
  }

  const payload = manifestSigningPayload(manifest);
  const sigBytes = base64UrlToBytes(sig.sig_b64url);
  const keyObj = createPublicKey({ key: pub, format: "jwk" });

  const ok = nodeVerify("sha256", Buffer.from(payload, "utf8"), keyObj, Buffer.from(sigBytes));
  if (!ok) throw new Error("issuerSig verification failed");

  return { verified: true, issuerKeyId };
}

function merkleRootFromProof(leafHex: string, index: number, siblings: readonly string[]): string {
  requireHex64("proof leaf", leafHex);
  let acc = leafHex;
  let idx = index;

  for (const sib of siblings) {
    requireHex64("proof sibling", sib);

    const leftRight = (idx % 2) === 0 ? ([acc, sib] as const) : ([sib, acc] as const);
    const lb = hexToBytes(leftRight[0]);
    const rb = hexToBytes(leftRight[1]);
    if (!lb || !rb) throw new Error("Invalid hex in merkle proof");

    const both = new Uint8Array(lb.length + rb.length);
    both.set(lb, 0);
    both.set(rb, lb.length);

    acc = sha256Hex(both);
    idx = Math.floor(idx / 2);
  }

  return acc;
}

function parseArgs(argv: readonly string[]): { mode: "pack"; dir: string; trust: string[] } | { mode: "proof"; proofPath: string; trust: string[] } {
  const trust: string[] = [];
  let dir: string | undefined;
  let proofPath: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const next = argv[i + 1];

    if (a === "--trust" && typeof next === "string") { trust.push(next); i++; continue; }
    if (a === "--proof" && typeof next === "string") { proofPath = next; i++; continue; }
    if (!a.startsWith("-") && dir === undefined) { dir = a; continue; }
    if (a === "--help" || a === "-h") {
      console.log("Usage: pbi-pack-verify <packDir> [--trust <issuerPubKey.jwk.json|trust.json> ...] OR pbi-pack-verify --proof <proof.json> [--trust ...]");
      process.exit(0);
    }
    throw new Error(`Unknown arg: ${a}`);
  }

  if (proofPath !== undefined) return { mode: "proof", proofPath, trust };
  if (dir === undefined) throw new Error("Missing packDir or --proof <proof.json>");
  return { mode: "pack", dir, trust };
}

async function verifyPack(dirArg: string, trust: TrustDecision): Promise<void> {
  const dir = resolve(dirArg);
  const m = loadManifest(dir);

  for (const [name, info] of Object.entries(m.files)) {
    requireFileHash(dir, name, info.sha256);
  }

  // packId recompute: manifest minus issuerSig and minus pack.packId
  requireHex64("pack.packId", m.pack.packId);
  const baseNoSig = JSON.parse(JSON.stringify(m)) as Record<string, unknown>;
  delete baseNoSig["issuerSig"];
  if (isRecord(baseNoSig["pack"])) {
    const packObj = baseNoSig["pack"] as Record<string, unknown>;
    delete packObj["packId"];
  }
  const recomputedPackId = sha256HexUtf8(canonicalize(baseNoSig as never));
  if (recomputedPackId !== m.pack.packId) {
    throw new Error(`packId mismatch: manifest=${m.pack.packId} computed=${recomputedPackId}`);
  }

  // merkle root verify
  requireHex64("merkle.root", m.merkle.root);
  const leaves = m.receipts.map((r) => {
    requireHex64(`receipts[${r.id}].receiptHash`, r.receiptHash);
    return r.receiptHash;
  });
  const computedRoot = (() => {
    let level = leaves.slice();
    for (;;) {
      if (level.length === 1) return level[0]!;
      const next: string[] = [];
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i]!;
        const right = level[i + 1] ?? left;
        const lb = hexToBytes(left);
        const rb = hexToBytes(right);
        if (!lb || !rb) throw new Error("Invalid leaf hex");
        const both = new Uint8Array(lb.length + rb.length);
        both.set(lb, 0);
        both.set(rb, lb.length);
        next.push(sha256Hex(both));
      }
      level = next;
    }
  })();
  if (computedRoot !== m.merkle.root) {
    throw new Error(`merkle.root mismatch: manifest=${m.merkle.root} computed=${computedRoot}`);
  }

  const sigInfo = verifyIssuerSig(m, trust);

  const pubkeyCache = new Map<string, NodeJsonWebKey>();
  const credentialStore: CredentialStore = {
    async getPublicKeyJwk(credId_b64url: string): Promise<NodeJsonWebKey | null> {
      const cached = pubkeyCache.get(credId_b64url);
      if (cached) return cached;

      const jwkPath = join(dir, "pubkeys", `${credId_b64url}.jwk.json`);
      const u: unknown = JSON.parse(readUtf8(jwkPath));
      const jwk = toNodeJwk(u);
      if (!jwk) return null;

      pubkeyCache.set(credId_b64url, jwk);
      return jwk;
    }
  };

  const policy: VerifyPolicy = {
    rpIdAllowList: m.policy.rpIdAllowList,
    originAllowList: m.policy.originAllowList,
    requireUP: m.policy.requireUP,
    requireUV: m.policy.requireUV
  };

  let okCount = 0;
  const results: Record<string, VerifyResult> = {};

  for (const r of m.receipts) {
    const receiptU: unknown = JSON.parse(readUtf8(join(dir, r.receiptPath)));
    const actionU: unknown = JSON.parse(readUtf8(join(dir, r.actionPath)));
    if (!isRecord(receiptU)) throw new Error(`Invalid ${r.receiptPath}`);
    if (!isRecord(actionU)) throw new Error(`Invalid ${r.actionPath}`);

    const receipt = receiptU as unknown as PBIReceiptV1;
    const action = actionU as unknown as PBIActionV1;

    const receiptHash = computeReceiptHash(receipt);
    if (receiptHash !== r.receiptHash) {
      throw new Error(`receiptHash mismatch for ${r.id}: manifest=${r.receiptHash} computed=${receiptHash}`);
    }
    if (receipt.actionHash !== r.actionHash) {
      throw new Error(`actionHash mismatch for ${r.id}: manifest=${r.actionHash} receipt=${receipt.actionHash}`);
    }
    if (receipt.authorSig.credId !== r.credId) {
      throw new Error(`credId mismatch for ${r.id}: manifest=${r.credId} receipt=${receipt.authorSig.credId}`);
    }

    const res = await verifyReceipt({ receipt, action, policy, credentialStore });
    results[r.id] = res;
    if (res.ok) okCount++;
  }

  console.log(JSON.stringify({
    manifest: m.ver,
    trustMode: trust.mode,
    issuerKeyId: sigInfo.issuerKeyId,
    issuerSigVerified: sigInfo.verified,
    packId: m.pack.packId,
    prevPackId: m.pack.prevPackId ?? null,
    merkleRoot: m.merkle.root,
    verifiedCount: okCount,
    total: m.receipts.length,
    results
  }, null, 2));

  process.exit(okCount === m.receipts.length ? 0 : 1);
}

async function verifyProof(proofPath: string, trust: TrustDecision): Promise<void> {
  const u: unknown = JSON.parse(readUtf8(resolve(proofPath)));
  if (!isRecord(u) || u["ver"] !== "pbi-proof-1.0") throw new Error("Invalid proof version");

  const proof = u as unknown as Proof;
  const m = proof.manifest;

  const sigInfo = verifyIssuerSig(m, trust);

  // packId recompute
  requireHex64("pack.packId", m.pack.packId);
  const baseNoSig = JSON.parse(JSON.stringify(m)) as Record<string, unknown>;
  delete baseNoSig["issuerSig"];
  if (isRecord(baseNoSig["pack"])) {
    const packObj = baseNoSig["pack"] as Record<string, unknown>;
    delete packObj["packId"];
  }
  const recomputedPackId = sha256HexUtf8(canonicalize(baseNoSig as never));
  if (recomputedPackId !== m.pack.packId) {
    throw new Error(`packId mismatch: manifest=${m.pack.packId} computed=${recomputedPackId}`);
  }

  const rootFromProof = merkleRootFromProof(proof.leaf.receiptHash, proof.merkle.index, proof.merkle.siblings);
  if (rootFromProof !== proof.merkle.root) {
    throw new Error(`proof merkle.root mismatch: proof=${proof.merkle.root} computed=${rootFromProof}`);
  }
  if (proof.merkle.root !== m.merkle.root) {
    throw new Error(`manifest merkle.root mismatch: manifest=${m.merkle.root} proof=${proof.merkle.root}`);
  }

  const computedReceiptHash = computeReceiptHash(proof.leaf.receipt);
  if (computedReceiptHash !== proof.leaf.receiptHash) {
    throw new Error(`receiptHash mismatch: leaf=${proof.leaf.receiptHash} computed=${computedReceiptHash}`);
  }
  if (proof.leaf.receipt.actionHash !== proof.leaf.actionHash) {
    throw new Error(`actionHash mismatch: leaf=${proof.leaf.actionHash} receipt=${proof.leaf.receipt.actionHash}`);
  }

  const pubKeyJwk = toNodeJwk(proof.leaf.pubKeyJwk);
  if (!pubKeyJwk) throw new Error("Invalid proof.leaf.pubKeyJwk");

  const credentialStore: CredentialStore = {
    async getPublicKeyJwk(credId_b64url: string): Promise<NodeJsonWebKey | null> {
      if (credId_b64url !== proof.leaf.credId) return null;
      return pubKeyJwk;
    }
  };

  const policy: VerifyPolicy = {
    rpIdAllowList: m.policy.rpIdAllowList,
    originAllowList: m.policy.originAllowList,
    requireUP: m.policy.requireUP,
    requireUV: m.policy.requireUV
  };

  const res = await verifyReceipt({
    receipt: proof.leaf.receipt,
    action: proof.leaf.action,
    policy,
    credentialStore
  });

  console.log(JSON.stringify({
    proof: proof.ver,
    trustMode: trust.mode,
    issuerKeyId: sigInfo.issuerKeyId,
    issuerSigVerified: sigInfo.verified,
    packId: m.pack.packId,
    prevPackId: m.pack.prevPackId ?? null,
    merkleRoot: m.merkle.root,
    leafId: proof.leaf.id,
    verified: res
  }, null, 2));

  process.exit(res.ok ? 0 : 1);
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  const trust = loadTrust(parsed.trust);

  if (parsed.mode === "proof") {
    await verifyProof(parsed.proofPath, trust);
    return;
  }

  await verifyPack(parsed.dir, trust);
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(msg);
  process.exit(2);
});
