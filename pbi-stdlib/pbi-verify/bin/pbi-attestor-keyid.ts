#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { JsonWebKey as NodeJsonWebKey } from "node:crypto";
import { keyIdFromJwk } from "../src/trustBundle.js";

function usage(): void {
  console.log("Usage: pbi-attestor-keyid <path/to/pubkey.jwk.json>");
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function main(): void {
  const p = process.argv[2];
  if (!p || p === "-h" || p === "--help") {
    usage();
    process.exit(p ? 0 : 2);
    return;
  }

  const u: unknown = JSON.parse(readFileSync(resolve(p), "utf8"));
  if (!isRecord(u)) throw new Error("Invalid JWK JSON (expected object)");

  const jwk = u as unknown as NodeJsonWebKey;
  const keyId = keyIdFromJwk(jwk);

  process.stdout.write(keyId + "\n");
}

main();
