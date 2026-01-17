#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseTrustRootsFile, parseSignedTrustBundle, verifySignedTrustBundle } from "../src/trustBundle.js";

function usage(): void {
  console.log(
    [
      "Usage:",
      "  pbi-attestor-trust-verify --bundle trust-attestors.signed.json --roots trust-roots.json [--pretty]",
      "Options:",
      "  --bundle <path>  Signed bundle JSON",
      "  --roots <path>   Root trust file JSON (pbi-trust-roots-1.0)",
      "  --pretty         Pretty output",
      ""
    ].join("\n")
  );
}

function parseArgs(argv: readonly string[]): { bundlePath: string; rootsPath: string; pretty: boolean } {
  let bundlePath: string | undefined;
  let rootsPath: string | undefined;
  let pretty = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const next = argv[i + 1];

    if (a === "--bundle" && typeof next === "string") { bundlePath = next; i++; continue; }
    if (a === "--roots" && typeof next === "string") { rootsPath = next; i++; continue; }
    if (a === "--pretty") { pretty = true; continue; }
    if (a === "-h" || a === "--help") { usage(); process.exit(0); }
    throw new Error(`Unknown arg: ${a}`);
  }

  if (!bundlePath || !rootsPath) {
    usage();
    process.exit(2);
  }

  return { bundlePath, rootsPath, pretty };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  const bundleU: unknown = JSON.parse(readFileSync(resolve(args.bundlePath), "utf8"));
  const rootsU: unknown = JSON.parse(readFileSync(resolve(args.rootsPath), "utf8"));

  const bundle = parseSignedTrustBundle(bundleU);
  if (!bundle) throw new Error("Invalid signed trust bundle");

  const roots = parseTrustRootsFile(rootsU);
  if (!roots) throw new Error("Invalid trust roots file");

  const vr = verifySignedTrustBundle({ bundle, roots });

  const out = vr.ok
    ? { ok: true, rootKeyId: vr.rootKeyId }
    : { ok: false, code: vr.code, detail: vr.detail };

  console.log(args.pretty ? JSON.stringify(out, null, 2) : JSON.stringify(out));
  process.exit(vr.ok ? 0 : 1);
}

main();
