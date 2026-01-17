import { createHash, createPublicKey, verify as nodeVerify } from "node:crypto";
import type { JsonWebKey as NodeJsonWebKey } from "node:crypto";
import { canonicalize } from "./jcs.js";
import { base64UrlToBytes } from "./base64url.js";

export type RootKey = Readonly<{
  name: string;
  alg: "es256";
  keyId: string; // sha256(JCS(pubKeyJwk)) hex
  pubKeyJwk: NodeJsonWebKey;
  notBefore?: string | null;
  notAfter?: string | null;
}>;

export type RootRevocation = Readonly<{
  keyId: string;
  revokedAt: string; // RFC3339
  reason?: string;
}>;

export type TrustRootsFile = Readonly<{
  ver: "pbi-trust-roots-1.0";
  createdAt: string; // RFC3339
  trustedRoots: readonly RootKey[];
  revokedRootKeyIds?: readonly string[];
  revocations?: readonly RootRevocation[];
}>;

export type SignedTrustBundle = Readonly<{
  ver: "pbi-trust-bundle-signed-1.0";
  createdAt: string; // RFC3339
  payload: unknown; // typically AttestorTrustFile or other trust objects
  issuer: Readonly<{
    alg: "es256";
    keyId: string; // sha256(JCS(pubKeyJwk)) hex
    pubKeyJwk: unknown;
    signedAt: string; // RFC3339
    sig_b64url: string; // DER ECDSA signature bytes
  }>;
}>;

export type TrustBundleVerifyResult =
  | Readonly<{ ok: true; rootKeyId: string }>
  | Readonly<{ ok: false; code: string; detail?: string }>;

function err(code: string, detail?: string): TrustBundleVerifyResult {
  return { ok: false, code, ...(detail !== undefined ? { detail } : {}) };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseRfc3339Ms(s: string): number | null {
  const ms = Date.parse(s);
  if (!Number.isFinite(ms)) return null;
  return ms;
}

function normalizeJwk(jwk: NodeJsonWebKey): NodeJsonWebKey {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(jwk as Record<string, unknown>)) {
    if (v !== undefined) out[k] = v;
  }
  return out as unknown as NodeJsonWebKey;
}

export function keyIdFromJwk(pubKeyJwk: NodeJsonWebKey): string {
  const canon = canonicalize(normalizeJwk(pubKeyJwk) as never);
  return createHash("sha256").update(Buffer.from(canon, "utf8")).digest("hex");
}

function signingPayload(bundle: SignedTrustBundle): string {
  const b = bundle as unknown as Record<string, unknown>;
  const copy: Record<string, unknown> = { ...b };
  // issuerSig is embedded in issuer.sig_b64url. We sign bundle minus issuer.sig_b64url.
  const issuer = isRecord(copy["issuer"]) ? { ...(copy["issuer"] as Record<string, unknown>) } : null;
  if (!issuer) throw new Error("Invalid bundle.issuer");
  delete issuer["sig_b64url"];
  copy["issuer"] = issuer;
  return canonicalize(copy as never);
}

function isRevokedRootAt(trust: TrustRootsFile, keyId: string, atMs: number): string | null {
  const hard = trust.revokedRootKeyIds ?? [];
  if (hard.includes(keyId)) return `Revoked root key: ${keyId}`;

  const revs = trust.revocations ?? [];
  for (const r of revs) {
    if (r.keyId !== keyId) continue;
    const ms = Date.parse(r.revokedAt);
    if (Number.isFinite(ms) && ms <= atMs) {
      return `Revoked root key: ${keyId}${r.reason ? ` (${r.reason})` : ""}`;
    }
  }
  return null;
}

export function parseTrustRootsFile(u: unknown): TrustRootsFile | null {
  if (!isRecord(u)) return null;
  if (u["ver"] !== "pbi-trust-roots-1.0") return null;

  const createdAt = u["createdAt"];
  const trustedRootsU = u["trustedRoots"];
  if (typeof createdAt !== "string" || parseRfc3339Ms(createdAt) === null) return null;
  if (!Array.isArray(trustedRootsU)) return null;

  const revokedRootKeyIdsU = u["revokedRootKeyIds"];
  const revocationsU = u["revocations"];

  let revokedRootKeyIds: string[] | undefined;
  if (revokedRootKeyIdsU !== undefined) {
    if (!Array.isArray(revokedRootKeyIdsU) || !revokedRootKeyIdsU.every((x) => typeof x === "string")) return null;
    revokedRootKeyIds = revokedRootKeyIdsU.slice();
  }

  let revocations: RootRevocation[] | undefined;
  if (revocationsU !== undefined) {
    if (!Array.isArray(revocationsU)) return null;
    const out: RootRevocation[] = [];
    for (const r of revocationsU) {
      if (!isRecord(r)) return null;
      const keyId = r["keyId"];
      const revokedAt = r["revokedAt"];
      const reason = r["reason"];
      if (typeof keyId !== "string" || !/^[0-9a-f]{64}$/.test(keyId)) return null;
      if (typeof revokedAt !== "string" || parseRfc3339Ms(revokedAt) === null) return null;
      if (reason !== undefined && typeof reason !== "string") return null;
      out.push({ keyId, revokedAt, ...(reason !== undefined ? { reason } : {}) });
    }
    revocations = out;
  }

  const trustedRoots: RootKey[] = [];
  for (const e of trustedRootsU) {
    if (!isRecord(e)) return null;
    const name = e["name"];
    const alg = e["alg"];
    const keyId = e["keyId"];
    const pubKeyJwkU = e["pubKeyJwk"];
    const notBefore = e["notBefore"];
    const notAfter = e["notAfter"];

    if (typeof name !== "string" || name.length === 0) return null;
    if (alg !== "es256") return null;
    if (typeof keyId !== "string" || !/^[0-9a-f]{64}$/.test(keyId)) return null;
    if (!isRecord(pubKeyJwkU)) return null;

    if (notBefore !== undefined && notBefore !== null && typeof notBefore !== "string") return null;
    if (notAfter !== undefined && notAfter !== null && typeof notAfter !== "string") return null;
    if (typeof notBefore === "string" && parseRfc3339Ms(notBefore) === null) return null;
    if (typeof notAfter === "string" && parseRfc3339Ms(notAfter) === null) return null;

    const pubKeyJwk = normalizeJwk(pubKeyJwkU as unknown as NodeJsonWebKey);
    const computed = keyIdFromJwk(pubKeyJwk);
    if (computed !== keyId) return null;

    trustedRoots.push({
      name,
      alg: "es256",
      keyId,
      pubKeyJwk,
      ...(notBefore !== undefined ? { notBefore } : {}),
      ...(notAfter !== undefined ? { notAfter } : {})
    });
  }

  return {
    ver: "pbi-trust-roots-1.0",
    createdAt,
    trustedRoots,
    ...(revokedRootKeyIds !== undefined ? { revokedRootKeyIds } : {}),
    ...(revocations !== undefined ? { revocations } : {})
  };
}

export function parseSignedTrustBundle(u: unknown): SignedTrustBundle | null {
  if (!isRecord(u)) return null;
  if (u["ver"] !== "pbi-trust-bundle-signed-1.0") return null;

  const createdAt = u["createdAt"];
  const payload = u["payload"];
  const issuerU = u["issuer"];

  if (typeof createdAt !== "string" || parseRfc3339Ms(createdAt) === null) return null;
  if (!isRecord(issuerU)) return null;

  const alg = issuerU["alg"];
  const keyId = issuerU["keyId"];
  const pubKeyJwk = issuerU["pubKeyJwk"];
  const signedAt = issuerU["signedAt"];
  const sig_b64url = issuerU["sig_b64url"];

  if (alg !== "es256") return null;
  if (typeof keyId !== "string" || !/^[0-9a-f]{64}$/.test(keyId)) return null;
  if (typeof signedAt !== "string" || parseRfc3339Ms(signedAt) === null) return null;
  if (typeof sig_b64url !== "string" || sig_b64url.length === 0) return null;
  if (!isRecord(pubKeyJwk)) return null;

  return {
    ver: "pbi-trust-bundle-signed-1.0",
    createdAt,
    payload,
    issuer: {
      alg: "es256",
      keyId,
      pubKeyJwk,
      signedAt,
      sig_b64url
    }
  };
}

export function verifySignedTrustBundle(params: Readonly<{
  bundle: SignedTrustBundle;
  roots: TrustRootsFile;
  nowIso?: string;
}>): TrustBundleVerifyResult {
  const nowIso = params.nowIso ?? new Date().toISOString();
  const nowMs = parseRfc3339Ms(nowIso);
  if (nowMs === null) return err("invalid_structure", "nowIso not RFC3339");

  const issuerPub = normalizeJwk(params.bundle.issuer.pubKeyJwk as unknown as NodeJsonWebKey);
  const computedIssuerKeyId = keyIdFromJwk(issuerPub);

  if (computedIssuerKeyId !== params.bundle.issuer.keyId) {
    return err("issuer_keyid_mismatch", "bundle.issuer.keyId does not match bundle.issuer.pubKeyJwk");
  }

  // Root trust lookup
  const root = params.roots.trustedRoots.find((r) => r.keyId === computedIssuerKeyId);
  if (!root) return err("untrusted_root", `Untrusted root key: ${computedIssuerKeyId}`);

  const revokedMsg = isRevokedRootAt(params.roots, computedIssuerKeyId, nowMs);
  if (revokedMsg) return err("root_revoked", revokedMsg);

  if (root.notBefore) {
    const nb = parseRfc3339Ms(root.notBefore);
    if (nb === null) return err("invalid_structure", "root.notBefore not RFC3339");
    if (nowMs < nb) return err("root_not_yet_valid", `Root not valid until: ${root.notBefore}`);
  }
  if (root.notAfter) {
    const na = parseRfc3339Ms(root.notAfter);
    if (na === null) return err("invalid_structure", "root.notAfter not RFC3339");
    if (nowMs > na) return err("root_expired", `Root key expired: ${computedIssuerKeyId}`);
  }

  // Verify signature over canonical payload
  const payload = signingPayload(params.bundle);
  const sig = base64UrlToBytes(params.bundle.issuer.sig_b64url);
  const keyObj = createPublicKey({ key: issuerPub, format: "jwk" });

  const ok = nodeVerify("sha256", Buffer.from(payload, "utf8"), keyObj, Buffer.from(sig));
  if (!ok) return err("bundle_sig_invalid", "Signed trust bundle signature invalid");

  return { ok: true, rootKeyId: computedIssuerKeyId };
}
