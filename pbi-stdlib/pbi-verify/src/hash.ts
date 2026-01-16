import { createHash } from "node:crypto";
import { bytesToHex } from "./base64url.js";
import { canonicalize } from "./jcs.js";
import type { JsonValue } from "./types.js";

export function sha256Bytes(data: Uint8Array): Uint8Array {
  const h = createHash("sha256");
  h.update(Buffer.from(data));
  return new Uint8Array(h.digest());
}

export function sha256HexFromUtf8(s: string): string {
  const h = createHash("sha256");
  h.update(Buffer.from(s, "utf8"));
  return h.digest("hex");
}

export function sha256HexFromCanonicalJson(v: JsonValue): string {
  const canon = canonicalize(v);
  const h = createHash("sha256");
  h.update(Buffer.from(canon, "utf8"));
  return h.digest("hex");
}

export function sha256B64Url(data: Uint8Array): string {
  const h = sha256Bytes(data);
  // inline base64url to avoid browser/global differences
  return Buffer.from(h).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function sha256Hex(data: Uint8Array): string {
  return bytesToHex(sha256Bytes(data));
}