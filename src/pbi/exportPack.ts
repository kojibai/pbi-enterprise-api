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

export function signManifest(
  manifest: ExportManifest,
  privateKeyPem: string,
  publicKeyPem?: string
): ManifestSignature {
  const canonical = canonicalizeJson(manifest);
  const manifestBytes = Buffer.from(canonical, "utf8");
  const manifestHash = sha256Hex(manifestBytes);
  const privKey = createPrivateKey(privateKeyPem);
  const signature = sign(null, manifestBytes, privKey);
  const pubKeyPem = publicKeyPem ?? derivePublicKeyPem(privateKeyPem);

  return {
    algorithm: "Ed25519",
    publicKeyPem: pubKeyPem,
    signatureB64Url: bytesToB64url(signature),
    manifestSha256: manifestHash,
    signedAt: new Date().toISOString()
  };
}

export function verifyManifestSignature(manifest: ExportManifest, signature: ManifestSignature): boolean {
  const canonical = canonicalizeJson(manifest);
  const manifestBytes = Buffer.from(canonical, "utf8");
  const sigBytes = Buffer.from(b64urlToBytes(signature.signatureB64Url));
  const pubKey = createPublicKey(signature.publicKeyPem);
  return verify(null, manifestBytes, pubKey, sigBytes);
}

export function buildExportPack(input: {
  receipts: Array<Record<string, unknown>>;
  filters: Record<string, unknown>;
  policySnapshot: Record<string, unknown>;
  trustSnapshot?: Record<string, unknown>;
  signingKey: { privateKeyPem: string; publicKeyPem?: string };
}): ExportPack {
  const receiptsNdjson = input.receipts.map((entry) => JSON.stringify(entry)).join("\n") + "\n";
  const receiptsBytes = Buffer.from(receiptsNdjson, "utf8");

  const policyBytes = Buffer.from(JSON.stringify(input.policySnapshot, null, 2) + "\n", "utf8");

  const files: ExportFile[] = [
    {
      name: "receipts.ndjson",
      bytes: receiptsBytes,
      sha256: sha256Hex(receiptsBytes)
    },
    {
      name: "policy.snapshot.json",
      bytes: policyBytes,
      sha256: sha256Hex(policyBytes)
    }
  ];

  if (input.trustSnapshot) {
    const trustBytes = Buffer.from(JSON.stringify(input.trustSnapshot, null, 2) + "\n", "utf8");
    files.push({
      name: "trust.snapshot.json",
      bytes: trustBytes,
      sha256: sha256Hex(trustBytes)
    });
  }

  const manifest: ExportManifest = {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    filters: input.filters,
    totalCount: input.receipts.length,
    files: Object.fromEntries(
      files.map((file) => [file.name, { sha256: file.sha256, bytes: file.bytes.length }])
    )
  };

  const signature = signManifest(manifest, input.signingKey.privateKeyPem, input.signingKey.publicKeyPem);

  return { files, manifest, signature };
}
