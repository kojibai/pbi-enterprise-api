import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { buildExportPack, verifyManifestSignature } from "../pbi/exportPack.js";

test("export pack builds manifest with matching hashes", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();

  const pack = buildExportPack({
    receipts: [
      {
        receipt: {
          id: "a1f76ee5-5f27-4a32-b6bf-8c8bd8d3dc8f",
          challengeId: "b9f56d4d-1e2f-4e40-ae3d-62de9a09db61",
          receiptHashHex: "abcd",
          decision: "PBI_VERIFIED",
          createdAt: "2026-02-01T00:00:00Z"
        },
        challenge: null
      }
    ],
    filters: { limit: 1 },
    policySnapshot: { policyVer: "1", policyHash: "abc" },
    signingKey: { privateKeyPem, publicKeyPem }
  });

  const receiptsFile = pack.files.find((file) => file.name === "receipts.ndjson");
  assert.ok(receiptsFile);
  assert.equal(pack.manifest.files["receipts.ndjson"].sha256, receiptsFile.sha256);
});

test("export pack signature verifies with public key", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();

  const pack = buildExportPack({
    receipts: [],
    filters: { limit: 0 },
    policySnapshot: { policyVer: "1", policyHash: "abc" },
    signingKey: { privateKeyPem, publicKeyPem }
  });

  assert.ok(verifyManifestSignature(pack.manifest, pack.signature));
});
