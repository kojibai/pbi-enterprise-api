#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash, createPrivateKey, createPublicKey, sign as nodeSign } from "node:crypto";
import type { JsonWebKey as NodeJsonWebKey } from "node:crypto";

import { canonicalize } from "../src/jcs.js";

type SignedAttestorTrustBundle = Readonly<{
  ver: "pbi-attestor-trust-signed-1.0";
  createdAt: string;
  payload: unknown;
  sig: Readonly<{
    alg: "es256";
    keyId: string; // sha256(canonicalJwk)
    signedAt: string; // RFC3339
    pubKeyJwk: NodeJsonWebKey;
    sig_b64url: string; // DER ECDSA signature bytes
  }>;
}>;

function usage(): void {
  console.log(
    [
      "Usage:",
      "  pbi-attestor-trust-sign --in trust-attestors.json --out trust-attestors.signed.json --privkey issuer-es256-private.pem [--pubkey issuer-pubkey.jwk.json]",
      "",
      "Options:",
      "  --in <path>       Input trust file (pbi-attestor-trust-1.0 JSON)",
      "  --out <path>      Output signed bundle JSON",
      "  --privkey <path>  ES256 private key PEM (P-256)",
      "  --pubkey <path>   ES256 public key JWK (optional; derived from privkey if omitted)",
      "  --pretty          Pretty-print JSON output",
      "  -h, --help        Show help",
      ""
    ].join("\n")
  );
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readJson(p: string): unknown {
  return JSON.parse(readFileSync(p, "utf8")) as unknown;
}

function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/** Strip undefined-valued properties (exactOptionalPropertyTypes-safe) */
function normalizeJwk(u: unknown): NodeJsonWebKey {
  if (!isRecord(u)) throw new Error("Invalid JWK: expected object");
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(u)) if (v !== undefined) out[k] = v;

  const kty = out["kty"];
  if (typeof kty !== "string" || kty.length === 0) throw new Error("Invalid JWK: missing kty");

  // We only support ES256 roots here
  if (kty !== "EC") throw new Error(`Unsupported JWK kty: ${String(kty)} (expected EC)`);

  const crv = out["crv"];
  const x = out["x"];
  const y = out["y"];
  if (typeof crv !== "string" || crv !== "P-256") throw new Error("Invalid JWK: expected crv=P-256");
  if (typeof x !== "string" || x.length === 0) throw new Error("Invalid JWK: missing x");
  if (typeof y !== "string" || y.length === 0) throw new Error("Invalid JWK: missing y");

  return out as unknown as NodeJsonWebKey;
}

function sha256HexUtf8(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function keyIdFromPubJwk(pubKeyJwk: NodeJsonWebKey): string {
  // keyId = sha256(canonicalize(pubJwk))
  const canon = canonicalize(pubKeyJwk as never);
  return sha256HexUtf8(canon);
}

type Args = Readonly<{
  inPath: string;
  outPath: string;
  privKeyPath: string;
  pubKeyPath?: string;
  pretty: boolean;
}>;

function parseArgs(argv: readonly string[]): Args {
  let inPath: string | undefined;
  let outPath: string | undefined;
  let privKeyPath: string | undefined;
  let pubKeyPath: string | undefined;
  let pretty = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const next = argv[i + 1];

    if (a === "--in" && typeof next === "string") {
      inPath = next;
      i++;
      continue;
    }
    if (a === "--out" && typeof next === "string") {
      outPath = next;
      i++;
      continue;
    }
    if (a === "--privkey" && typeof next === "string") {
      privKeyPath = next;
      i++;
      continue;
    }
    if (a === "--pubkey" && typeof next === "string") {
      pubKeyPath = next;
      i++;
      continue;
    }
    if (a === "--pretty") {
      pretty = true;
      continue;
    }
    if (a === "-h" || a === "--help") {
      usage();
      process.exit(0);
    }

    throw new Error(`Unknown arg: ${a}`);
  }

  if (!inPath || !outPath || !privKeyPath) {
    usage();
    process.exit(2);
  }

  return {
    inPath,
    outPath,
    privKeyPath,
    ...(pubKeyPath !== undefined ? { pubKeyPath } : {}),
    pretty
  };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  const inAbs = resolve(args.inPath);
  const outAbs = resolve(args.outPath);
  const privAbs = resolve(args.privKeyPath);
  const pubAbs = args.pubKeyPath ? resolve(args.pubKeyPath) : undefined;

  const payloadU = readJson(inAbs);
  if (!isRecord(payloadU)) throw new Error("Invalid trust file: expected JSON object");
  if (payloadU["ver"] !== "pbi-attestor-trust-1.0") {
    throw new Error(`Invalid trust file ver: expected pbi-attestor-trust-1.0, got ${String(payloadU["ver"])}`);
  }

  const privPem = readFileSync(privAbs, "utf8");
  const privKeyObj = createPrivateKey(privPem);

  // Determine public key JWK
  const pubKeyJwk: NodeJsonWebKey = (() => {
    if (pubAbs) return normalizeJwk(readJson(pubAbs));
    const pubKeyObj = createPublicKey(privKeyObj);
    const jwk = pubKeyObj.export({ format: "jwk" }) as unknown;
    return normalizeJwk(jwk);
  })();

  const keyId = keyIdFromPubJwk(pubKeyJwk);

  // Sign canonical payload string (payload only — no circular signature)
  const payloadCanon = canonicalize(payloadU as never);
  const sigDer = nodeSign("sha256", Buffer.from(payloadCanon, "utf8"), privKeyObj);
  const sig_b64url = b64url(new Uint8Array(sigDer));

  const bundle: SignedAttestorTrustBundle = {
    ver: "pbi-attestor-trust-signed-1.0",
    createdAt: new Date().toISOString(),
    payload: payloadU,
    sig: {
      alg: "es256",
      keyId,
      signedAt: new Date().toISOString(),
      pubKeyJwk,
      sig_b64url
    }
  };

  const outText = args.pretty ? JSON.stringify(bundle, null, 2) + "\n" : JSON.stringify(bundle) + "\n";
  writeFileSync(outAbs, outText, "utf8");

  console.log(`Wrote signed bundle: ${outAbs}`);
  console.log(`rootKeyId: ${keyId}`);
}

main();
