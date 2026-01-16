#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

type Args = Readonly<{
  packSrc: string;
  outDir: string;
  privKeyPem: string;
  trustJson: string;
}>;

function readUtf8(p: string): string {
  return readFileSync(p, "utf8");
}

function readJson<T>(p: string): T {
  return JSON.parse(readUtf8(p)) as T;
}

function writeJson(p: string, v: unknown): void {
  writeFileSync(p, JSON.stringify(v, null, 2) + "\n", "utf8");
}

function runNode(scriptPath: string, args: readonly string[]): void {
  execFileSync(process.execPath, [scriptPath, ...args], { stdio: "inherit" });
}

function parseArgs(argv: readonly string[]): Args {
  // defaults match your current layout
  let packSrc = "../pbi-pack";
  let outDir = "../pbi-pack-demo";
  let privKeyPem = "./issuer-es256-private.pem";
  let trustJson = "./trust.json";

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const next = argv[i + 1];
    if (a === "--packSrc" && typeof next === "string") { packSrc = next; i++; continue; }
    if (a === "--outDir" && typeof next === "string") { outDir = next; i++; continue; }
    if (a === "--privkey" && typeof next === "string") { privKeyPem = next; i++; continue; }
    if (a === "--trust" && typeof next === "string") { trustJson = next; i++; continue; }
    if (a === "--help" || a === "-h") {
      console.log(`
Usage:
  pbi-pack-demo [options]

Options:
  --packSrc <path>      Source pack folder to copy from (default: ../pbi-pack)
  --outDir <path>       Output base folder (default: ../pbi-pack-demo)
  --privkey <pem>       Issuer ES256 private key (default: ./issuer-es256-private.pem)
  --trust <json>        trust.json path (default: ./trust.json)
`.trim());
      process.exit(0);
    }
    throw new Error(`Unknown arg: ${a}`);
  }

  return { packSrc, outDir, privKeyPem, trustJson };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  const root = resolve(args.outDir);
  const packSrc = resolve(args.packSrc);
  const pack1 = resolve(join(root, "pack-1"));
  const pack2 = resolve(join(root, "pack-2"));

  const privKeyPem = resolve(args.privKeyPem);
  const trustJson = resolve(args.trustJson);

  const sealBin = resolve("dist/bin/pbi-pack-seal.js");
  const verifyBin = resolve("dist/bin/pbi-pack-verify.js");

  if (!existsSync(sealBin) || !existsSync(verifyBin)) {
    throw new Error("Missing dist binaries. Run: npm run build");
  }
  if (!existsSync(packSrc)) throw new Error(`packSrc not found: ${packSrc}`);
  if (!existsSync(privKeyPem)) throw new Error(`privkey not found: ${privKeyPem}`);
  if (!existsSync(trustJson)) throw new Error(`trust.json not found: ${trustJson}`);

  // fresh output
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });

  // --- Build pack-1 ---
  cpSync(packSrc, pack1, { recursive: true });

  console.log("\n=== Seal pack-1 ===");
  runNode(sealBin, ["--dir", pack1, "--privkey", privKeyPem]);

  console.log("\n=== Verify pack-1 (trust) ===");
  runNode(verifyBin, [pack1, "--trust", trustJson]);

  const m1 = readJson<{ pack: { packId: string } }>(join(pack1, "manifest.json"));
  const pack1Id = m1.pack.packId;

  // --- Build pack-2 as chain successor ---
  cpSync(pack1, pack2, { recursive: true });

  // create a second receipt/action by duplicating 0001 -> 0002 (valid for format demo)
  cpSync(join(pack2, "receipts", "0001.json"), join(pack2, "receipts", "0002.json"));
  cpSync(join(pack2, "actions", "0001.json"), join(pack2, "actions", "0002.json"));

  console.log("\n=== Seal pack-2 (prevPackId -> pack-1) ===");
  runNode(sealBin, ["--dir", pack2, "--privkey", privKeyPem, "--prevPackId", pack1Id]);

  console.log("\n=== Verify pack-2 (trust) ===");
  runNode(verifyBin, [pack2, "--trust", trustJson]);

  console.log("\n=== Verify proof pack-2 / 0002 (trust) ===");
  runNode(verifyBin, ["--proof", join(pack2, "proofs", "0002.proof.json"), "--trust", trustJson]);

  const m2 = readJson<{ pack: { packId: string; prevPackId?: string }, merkle: { root: string; count: number } }>(
    join(pack2, "manifest.json")
  );

  console.log("\n=== Chain summary ===");
  console.log(JSON.stringify({
    pack1: { packId: pack1Id },
    pack2: { packId: m2.pack.packId, prevPackId: m2.pack.prevPackId ?? null, merkleRoot: m2.merkle.root, count: m2.merkle.count }
  }, null, 2));

  // --- Negative tests: revocation and expiry ---
  console.log("\n=== Negative test: revoke issuer key and verify fails ===");
  const trust = readJson<any>(trustJson);
  const issuerKeyId = (() => {
    // issuerKeyId is already in trust.json trustedIssuers[0].keyId by your prior flow
    const kid = trust?.trustedIssuers?.[0]?.keyId;
    if (typeof kid !== "string") throw new Error("trust.json missing trustedIssuers[0].keyId");
    return kid;
  })();

  const trustRevPath = join(root, "trust-revoked.json");
  const trustRev = structuredClone(trust);
  trustRev.revokedKeyIds = Array.isArray(trustRev.revokedKeyIds) ? trustRev.revokedKeyIds : [];
  if (!trustRev.revokedKeyIds.includes(issuerKeyId)) trustRev.revokedKeyIds.push(issuerKeyId);
  writeJson(trustRevPath, trustRev);

  try {
    runNode(verifyBin, [pack1, "--trust", trustRevPath]);
    throw new Error("Expected revocation to fail, but it succeeded");
  } catch {
    // expected
  }

  console.log("\n=== Negative test: expire issuer key and verify fails ===");
  const trustExpPath = join(root, "trust-expired.json");
  const trustExp = structuredClone(trust);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  trustExp.trustedIssuers[0].notAfter = yesterday;
  writeJson(trustExpPath, trustExp);

  try {
    runNode(verifyBin, [pack1, "--trust", trustExpPath]);
    throw new Error("Expected expiry to fail, but it succeeded");
  } catch {
    // expected
  }

  console.log("\nDONE: pack demo complete.");
}

main();
