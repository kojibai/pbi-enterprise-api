#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash, createPrivateKey, createPublicKey, sign as nodeSign } from "node:crypto";
import type { JsonWebKey as NodeJsonWebKey } from "node:crypto";

import { sha256Hex } from "../src/hash.js";
import { computeReceiptHash, computeActionHash } from "../src/verify.js";
import { canonicalize } from "../src/jcs.js";
import { bytesToBase64Url, hexToBytes } from "../src/base64url.js";
import type { PBIReceiptV1, PBIActionV1, HexString } from "../src/types.js";

type ManifestReceipt = Readonly<{
  id: string;
  receiptPath: string;
  actionPath: string;
  credId: string;
  receiptHash: HexString;
  actionHash: HexString;
}>;

type ManifestFileInfo = Readonly<{
  sha256: string;
  bytes: number;
}>;

type ManifestIssuerSig = Readonly<{
  alg: "es256";
  keyId: HexString; // sha256(canonical(pubKeyJwk))
  signedAt: string;
  pubKeyJwk: NodeJsonWebKey;
  sig_b64url: string; // DER ECDSA bytes (base64url)
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
  pack: Readonly<{ packId: HexString; prevPackId?: HexString }>;
  merkle: Readonly<{ algo: "sha256"; leaf: "receiptHashHex"; root: HexString; count: number }>;
  receipts: readonly ManifestReceipt[];
  files: Readonly<Record<string, ManifestFileInfo>>;
  issuerSig?: ManifestIssuerSig;
}>;

type Proof = Readonly<{
  ver: "pbi-proof-1.0";
  createdAt: string;
  packId: HexString;
  prevPackId?: HexString;
  merkle: Readonly<{
    algo: "sha256";
    leaf: "receiptHashHex";
    root: HexString;
    index: number;
    siblings: readonly HexString[]; // sibling hashes from leaf->root
  }>;
  manifest: Manifest; // full manifest including issuerSig (proof does NOT get hashed into manifest.files)
  leaf: Readonly<{
    id: string;
    credId: string;
    receiptHash: HexString;
    actionHash: HexString;
    receipt: PBIReceiptV1;
    action: PBIActionV1;
    pubKeyJwk: NodeJsonWebKey;
  }>;
}>;

type Args = Readonly<{
  dir: string;
  privKeyPem: string;
  issuerName: string;
  issuerAud: string;
  rpId: string;
  origin: string;
  requireUP: boolean;
  requireUV: boolean;
  createdAt: string;
  prevPackId?: string;
}>;

function readUtf8(p: string): string {
  return readFileSync(p, "utf8");
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

function fileInfo(absPath: string): ManifestFileInfo {
  const bytes = new Uint8Array(readFileSync(absPath));
  return { sha256: sha256Hex(bytes), bytes: bytes.byteLength };
}

function listJsonFiles(absDir: string): string[] {
  return readdirSync(absDir)
    .filter((n) => n.endsWith(".json"))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function merkleRootHex(leavesHex: readonly string[]): string {
  if (leavesHex.length === 0) throw new Error("Cannot compute merkle root with 0 leaves");

  let level = leavesHex.slice();
  for (;;) {
    if (level.length === 1) return level[0]!;
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]!;
      const right = level[i + 1] ?? left;

      const lb = hexToBytes(left);
      const rb = hexToBytes(right);
      if (!lb || !rb) throw new Error("Invalid hex in merkle leaves");

      const both = new Uint8Array(lb.length + rb.length);
      both.set(lb, 0);
      both.set(rb, lb.length);

      next.push(sha256Hex(both));
    }
    level = next;
  }
}

function merkleProofSiblings(leavesHex: readonly string[], index: number): HexString[] {
  if (index < 0 || index >= leavesHex.length) throw new Error("Merkle proof index out of range");
  let idx = index;
  let level = leavesHex.slice();
  const siblings: string[] = [];

  for (;;) {
    if (level.length === 1) break;

    const isRight = (idx % 2) === 1;
    const sibIdx = isRight ? idx - 1 : idx + 1;
    const sibling = level[sibIdx] ?? level[idx]!; // duplicate last leaf if odd
    siblings.push(sibling);

    // build next level
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]!;
      const right = level[i + 1] ?? left;

      const lb = hexToBytes(left);
      const rb = hexToBytes(right);
      if (!lb || !rb) throw new Error("Invalid hex in merkle level");

      const both = new Uint8Array(lb.length + rb.length);
      both.set(lb, 0);
      both.set(rb, lb.length);

      next.push(sha256Hex(both));
    }

    idx = Math.floor(idx / 2);
    level = next;
  }

  return siblings as HexString[];
}

function parseArgs(argv: readonly string[]): Args | { error: string } {
  let dir: string | undefined;
  let privKeyPem: string | undefined;

  let issuerName = "Kojib PBI";
  let issuerAud = "pbi.kojib.com";
  let rpId = "api.kojib.com";
  let origin = "https://pbi.kojib.com";
  let requireUP = true;
  let requireUV = false;
  let createdAt = new Date().toISOString();
  let prevPackId: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const next = argv[i + 1];

    if (a === "--dir" && typeof next === "string") { dir = next; i++; continue; }
    if (a === "--privkey" && typeof next === "string") { privKeyPem = next; i++; continue; }
    if (a === "--issuerName" && typeof next === "string") { issuerName = next; i++; continue; }
    if (a === "--issuerAud" && typeof next === "string") { issuerAud = next; i++; continue; }
    if (a === "--rpId" && typeof next === "string") { rpId = next; i++; continue; }
    if (a === "--origin" && typeof next === "string") { origin = next; i++; continue; }
    if (a === "--createdAt" && typeof next === "string") { createdAt = next; i++; continue; }
    if (a === "--prevPackId" && typeof next === "string") { prevPackId = next; i++; continue; }
    if (a === "--requireUV") { requireUV = true; continue; }
    if (a === "--no-requireUP") { requireUP = false; continue; }
    if (a === "--help" || a === "-h") return { error: "help" };

    return { error: `Unknown arg: ${a}` };
  }

  if (!dir) return { error: "Missing --dir <pack-folder>" };
  if (!privKeyPem) return { error: "Missing --privkey <issuer-es256-private.pem>" };
  if (prevPackId !== undefined) requireHex64("prevPackId", prevPackId);

  return {
    dir,
    privKeyPem,
    issuerName,
    issuerAud,
    rpId,
    origin,
    requireUP,
    requireUV,
    createdAt,
    ...(prevPackId !== undefined ? { prevPackId } : {})
  };
}

function printHelp(): void {
  console.log(`
Usage:
  pbi-pack-seal --dir <pack-folder> --privkey <issuer-es256-private.pem> [options]

Options:
  --issuerName <string>
  --issuerAud <string>
  --rpId <string>
  --origin <string>
  --createdAt <RFC3339>
  --prevPackId <64-hex>          (chain-of-custody)
  --requireUV
  --no-requireUP
`.trim());
}

function toNodeJwk(v: unknown): NodeJsonWebKey | null {
  if (!isRecord(v)) return null;
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) {
    if (val !== undefined) out[k] = val;
  }
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

function mainSeal(args: Args): void {
  const dir = resolve(args.dir);

  const receiptsDir = join(dir, "receipts");
  const actionsDir = join(dir, "actions");
  const pubkeysDir = join(dir, "pubkeys");
  const proofsDir = join(dir, "proofs");
  const manifestPath = join(dir, "manifest.json");

  mkdirSync(proofsDir, { recursive: true });

  const receiptFiles = listJsonFiles(receiptsDir);
  if (receiptFiles.length === 0) throw new Error("No receipts found in receipts/");

  const receipts: ManifestReceipt[] = [];
  const fileMap: Record<string, ManifestFileInfo> = {};

  // Load receipt/action pairs and compute hashes
  for (const rf of receiptFiles) {
    const id = rf.replace(/\.json$/i, "");
    const receiptPathRel = `receipts/${rf}`;
    const actionPathRel = `actions/${id}.json`;

    const receiptAbs = join(receiptsDir, rf);
    const actionAbs = join(actionsDir, `${id}.json`);

    const receiptU: unknown = JSON.parse(readUtf8(receiptAbs));
    const actionU: unknown = JSON.parse(readUtf8(actionAbs));

    if (!isRecord(receiptU)) throw new Error(`Invalid ${receiptPathRel} (expected object)`);
    if (!isRecord(actionU)) throw new Error(`Invalid ${actionPathRel} (expected object)`);

    const receipt = receiptU as unknown as PBIReceiptV1;
    const action = actionU as unknown as PBIActionV1;

    const receiptHash = computeReceiptHash(receipt);
    requireHex64(`${receiptPathRel}.receiptHash`, receiptHash);

    const actionHash = computeActionHash(action);
    requireHex64(`${actionPathRel}.actionHash`, actionHash);

    if (actionHash !== receipt.actionHash) {
      throw new Error(`actionHash mismatch for ${id}: computed=${actionHash} receipt=${receipt.actionHash}`);
    }

    receipts.push({
      id,
      receiptPath: receiptPathRel,
      actionPath: actionPathRel,
      credId: receipt.authorSig.credId,
      receiptHash,
      actionHash: receipt.actionHash
    });

    fileMap[receiptPathRel] = fileInfo(receiptAbs);
    fileMap[actionPathRel] = fileInfo(actionAbs);
  }

  // Hash pubkeys used by receipts (must be named pubkeys/<credId>.jwk.json)
  const uniqueCredIds = Array.from(new Set(receipts.map((r) => r.credId))).sort();
  for (const credId of uniqueCredIds) {
    const jwkRel = `pubkeys/${credId}.jwk.json`;
    const jwkAbs = join(pubkeysDir, `${credId}.jwk.json`);
    const jwkU: unknown = JSON.parse(readUtf8(jwkAbs));
    const jwk = toNodeJwk(jwkU);
    if (!jwk) throw new Error(`Invalid ${jwkRel} (expected EC P-256 public JWK)`);
    fileMap[jwkRel] = fileInfo(jwkAbs);
  }

  // Stable merkle leaves ordering: receipts array order (sorted by filename already)
  const leaves = receipts.map((r) => r.receiptHash);
  const merkleRoot = merkleRootHex(leaves);
  requireHex64("merkle.root", merkleRoot);

  // Base manifest WITHOUT issuerSig and WITHOUT pack.packId
  const baseNoPackId: Record<string, unknown> = {
    ver: "pbi-pack-1.1",
    createdAt: args.createdAt,
    issuer: { name: args.issuerName, aud: args.issuerAud },
    policy: {
      rpIdAllowList: [args.rpId],
      originAllowList: [args.origin],
      requireUP: args.requireUP,
      requireUV: args.requireUV
    },
    pack: {
      ...(args.prevPackId !== undefined ? { prevPackId: args.prevPackId } : {})
    },
    merkle: { algo: "sha256", leaf: "receiptHashHex", root: merkleRoot, count: receipts.length },
    receipts,
    files: fileMap
  };

  const packId = sha256HexUtf8(canonicalize(baseNoPackId as never));
  requireHex64("pack.packId", packId);

  // Manifest to sign includes packId but not issuerSig yet
  const manifestToSign: Record<string, unknown> = {
    ...baseNoPackId,
    pack: {
      packId,
      ...(args.prevPackId !== undefined ? { prevPackId: args.prevPackId } : {})
    }
  };

  const privPem = readUtf8(resolve(args.privKeyPem));
  const privKey = createPrivateKey(privPem);
  const pubKey = createPublicKey(privKey);
  const pubKeyJwk = pubKey.export({ format: "jwk" }) as NodeJsonWebKey;

  const issuerKeyId = sha256HexUtf8(canonicalize(pubKeyJwk as never));
  requireHex64("issuerSig.keyId", issuerKeyId);

  const signingPayload = canonicalize(manifestToSign as never);
  const sigDer = nodeSign("sha256", Buffer.from(signingPayload, "utf8"), privKey); // DER
  const sig_b64url = bytesToBase64Url(new Uint8Array(sigDer));

  const finalManifest: Record<string, unknown> = {
    ...manifestToSign,
    issuerSig: {
      alg: "es256",
      keyId: issuerKeyId,
      signedAt: new Date().toISOString(),
      pubKeyJwk,
      sig_b64url
    }
  };

  writeFileSync(manifestPath, JSON.stringify(finalManifest, null, 2) + "\n", "utf8");

  // Generate per-receipt proof files (NOT included in manifest.files to avoid recursive hashing)
  const manifestObj = finalManifest as unknown as Manifest;

  for (let i = 0; i < receipts.length; i++) {
    const r = receipts[i]!;
    const receiptAbs = join(dir, r.receiptPath);
    const actionAbs = join(dir, r.actionPath);
    const pubkeyAbs = join(dir, "pubkeys", `${r.credId}.jwk.json`);

    const receipt = JSON.parse(readUtf8(receiptAbs)) as PBIReceiptV1;
    const action = JSON.parse(readUtf8(actionAbs)) as PBIActionV1;

    const pubKeyU: unknown = JSON.parse(readUtf8(pubkeyAbs));
    const pubKeyJwkLeaf = toNodeJwk(pubKeyU);
    if (!pubKeyJwkLeaf) throw new Error(`Invalid pubkey for credId ${r.credId}`);

    const siblings = merkleProofSiblings(leaves, i);

    const proof: Proof = {
      ver: "pbi-proof-1.0",
      createdAt: new Date().toISOString(),
      packId: packId as HexString,
      ...(args.prevPackId !== undefined ? { prevPackId: args.prevPackId as HexString } : {}),
      merkle: {
        algo: "sha256",
        leaf: "receiptHashHex",
        root: merkleRoot as HexString,
        index: i,
        siblings: siblings as readonly HexString[]
      },
      manifest: manifestObj,
      leaf: {
        id: r.id,
        credId: r.credId,
        receiptHash: r.receiptHash,
        actionHash: r.actionHash,
        receipt,
        action,
        pubKeyJwk: pubKeyJwkLeaf
      }
    };

    const proofPath = join(proofsDir, `${r.id}.proof.json`);
    writeFileSync(proofPath, JSON.stringify(proof, null, 2) + "\n", "utf8");
  }

  console.log(`Sealed manifest: ${manifestPath}`);
  console.log(`packId: ${packId}`);
  console.log(`merkleRoot: ${merkleRoot}`);
  console.log(`proofs: ${join(proofsDir, "*.proof.json")}`);
}

const parsed = parseArgs(process.argv.slice(2));
if ("error" in parsed) {
  if (parsed.error === "help") {
    printHelp();
    process.exit(0);
  }
  console.error(parsed.error);
  printHelp();
  process.exit(2);
} else {
  try {
    mainSeal(parsed);
    process.exit(0);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(msg);
    process.exit(2);
  }
}
