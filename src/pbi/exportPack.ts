import { createHash, createPublicKey, createPrivateKey, sign, verify } from "node:crypto";
import { b64urlToBytes, bytesToB64url } from "../util/base64url.js";
import { canonicalizeJson } from "../util/jsonCanonical.js";

export type ExportFile = {
  name: string;
  bytes: Buffer;
  sha256: string;
};

export type ExportManifest = {
  version: string;
  generatedAt: string;
  filters: Record<string, unknown>;
  totalCount: number;
  files: Record<string, { sha256: string; bytes: number }>;
};

export type ManifestSignature = {
  algorithm: "Ed25519";
  /**
   * Key identifier for pinning / rotation.
   * Verifiers MUST pin this (and/or the public key) out-of-band.
   */
  keyId: string;
  /**
   * Convenience copy of the public key used.
   * Do NOT treat this as a trust anchor by itself — pin keyId/publicKey out-of-band.
   */
  publicKeyPem: string;
  signatureB64Url: string;
  manifestSha256: string;
  signedAt: string;
};

export type ExportPack = {
  files: ExportFile[];
  manifest: ExportManifest;
  signature: ManifestSignature;
};

function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function derivePublicKeyPem(privateKeyPem: string): string {
  const pub = createPublicKey(privateKeyPem);
  return pub.export({ type: "spki", format: "pem" }).toString();
}

function normalizeKeyId(keyId: string | undefined): string {
  const v = typeof keyId === "string" ? keyId.trim() : "";
  return v.length > 0 ? v : "pbi-export-signing-1";
}

export function signManifest(
  manifest: ExportManifest,
  input: { privateKeyPem: string; publicKeyPem?: string; keyId?: string }
): ManifestSignature {
  const canonical = canonicalizeJson(manifest);
  const manifestBytes = Buffer.from(canonical, "utf8");
  const manifestHash = sha256Hex(manifestBytes);

  const privKey = createPrivateKey(input.privateKeyPem);
  const signatureBytes = sign(null, manifestBytes, privKey);

  const pubKeyPem = input.publicKeyPem ?? derivePublicKeyPem(input.privateKeyPem);

  return {
    algorithm: "Ed25519",
    keyId: normalizeKeyId(input.keyId),
    publicKeyPem: pubKeyPem,
    signatureB64Url: bytesToB64url(signatureBytes),
    manifestSha256: manifestHash,
    signedAt: new Date().toISOString()
  };
}

/**
 * Verify signature cryptographically.
 * NOTE: Authenticity requires pinning the expected keyId and/or public key out-of-band.
 */
export function verifyManifestSignature(
  manifest: ExportManifest,
  signature: ManifestSignature,
  pinned?: { keyId?: string; publicKeyPem?: string }
): boolean {
  if (pinned?.keyId && pinned.keyId !== signature.keyId) return false;
  if (pinned?.publicKeyPem && pinned.publicKeyPem.trim() !== signature.publicKeyPem.trim()) return false;

  const canonical = canonicalizeJson(manifest);
  const manifestBytes = Buffer.from(canonical, "utf8");
  const sigBytes = Buffer.from(b64urlToBytes(signature.signatureB64Url));
  const pubKey = createPublicKey(signature.publicKeyPem);
  return verify(null, manifestBytes, pubKey, sigBytes);
}

function buildSigningInput(input: {
  privateKeyPem: string;
  publicKeyPem?: string;
  keyId?: string;
}): { privateKeyPem: string; publicKeyPem?: string; keyId?: string } {
  const out: { privateKeyPem: string; publicKeyPem?: string; keyId?: string } = {
    privateKeyPem: input.privateKeyPem
  };

  if (typeof input.publicKeyPem === "string" && input.publicKeyPem.length > 0) {
    out.publicKeyPem = input.publicKeyPem;
  }
  if (typeof input.keyId === "string" && input.keyId.trim().length > 0) {
    out.keyId = input.keyId;
  }

  return out;
}

export function buildExportPack(input: {
  receipts: Array<Record<string, unknown>>;
  filters: Record<string, unknown>;
  policySnapshot: Record<string, unknown>;
  trustSnapshot?: Record<string, unknown>;
  signingKey: { privateKeyPem: string; publicKeyPem?: string; keyId?: string };
}): ExportPack {
  // Deterministic NDJSON: canonicalize each entry so byte output is stable.
  const receiptsNdjson = input.receipts.map((entry) => canonicalizeJson(entry)).join("\n") + "\n";
  const receiptsBytes = Buffer.from(receiptsNdjson, "utf8");

  // Keep pretty JSON for human readability; hash is over exact bytes shipped.
  const policyBytes = Buffer.from(JSON.stringify(input.policySnapshot, null, 2) + "\n", "utf8");

  const files: ExportFile[] = [
    { name: "receipts.ndjson", bytes: receiptsBytes, sha256: sha256Hex(receiptsBytes) },
    { name: "policy.snapshot.json", bytes: policyBytes, sha256: sha256Hex(policyBytes) }
  ];

  if (input.trustSnapshot) {
    const trustBytes = Buffer.from(JSON.stringify(input.trustSnapshot, null, 2) + "\n", "utf8");
    files.push({ name: "trust.snapshot.json", bytes: trustBytes, sha256: sha256Hex(trustBytes) });
  }

  const manifest: ExportManifest = {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    filters: input.filters,
    totalCount: input.receipts.length,
    files: Object.fromEntries(files.map((file) => [file.name, { sha256: file.sha256, bytes: file.bytes.length }]))
  };

  const signature = signManifest(manifest, buildSigningInput(input.signingKey));

  return { files, manifest, signature };
}

export function verifyExportPack(
  pack: ExportPack,
  opts?: { pinned?: { keyId?: string; publicKeyPem?: string }; requirePin?: boolean }
): boolean {
  // If you want authenticity (not just integrity), require a pinned keyId/publicKey.
  const requirePin = opts?.requirePin === true;
  const pinned = opts?.pinned;

  if (requirePin && (!pinned || (!pinned.keyId && !pinned.publicKeyPem))) return false;

  // 1) Verify manifest signature (cryptographic integrity of manifest)
  const sigValid = verifyManifestSignature(pack.manifest, pack.signature, pinned);
  if (!sigValid) return false;

  // 2) Verify signature.manifestSha256 matches computed hash of canonical manifest
  const canonicalManifest = canonicalizeJson(pack.manifest);
  const computedManifestSha = sha256Hex(Buffer.from(canonicalManifest, "utf8"));
  if (computedManifestSha !== pack.signature.manifestSha256) return false;

  // 3) Ensure the manifest file set exactly matches the pack file set (no extras, no missing)
  const manifestNames = Object.keys(pack.manifest.files).sort();
  const packNames = pack.files.map((f) => f.name).sort();

  if (manifestNames.length !== packNames.length) return false;
  for (let i = 0; i < manifestNames.length; i += 1) {
    if (manifestNames[i] !== packNames[i]) return false;
  }

  // 4) Verify each file’s sha256 and bytes match the manifest declaration
  for (const file of pack.files) {
    const manifestFile = pack.manifest.files[file.name];
    if (!manifestFile) return false;

    const fileHash = sha256Hex(file.bytes);
    if (fileHash !== manifestFile.sha256) return false;

    if (file.bytes.length !== manifestFile.bytes) return false;
  }

  return true;
}
