import { canonicalize } from "./jcs.js";
import { createHash } from "node:crypto";
import type { JsonWebKey as NodeJsonWebKey } from "node:crypto";

export type AttestorTrustEntry = Readonly<{
  name: string;
  alg: "ed25519";
  kid?: string; // optional: if present, must match attestation.verifier.kid
  keyId: string; // sha256(JCS(pubKeyJwk)) hex
  pubKeyJwk: NodeJsonWebKey;
  notBefore?: string | null; // RFC3339
  notAfter?: string | null; // RFC3339
}>;

export type AttestorRevocation = Readonly<{
  keyId: string; // sha256(JCS(pubKeyJwk)) hex
  revokedAt: string; // RFC3339
  reason?: string;
}>;

export type AttestorTrustFile = Readonly<{
  ver: "pbi-attestor-trust-1.0";
  createdAt: string; // RFC3339
  trustedAttestors: readonly AttestorTrustEntry[];
  /**
   * Legacy hard-revocation list (always revoked, regardless of time).
   * Keep for backwards compatibility.
   */
  revokedKeyIds?: readonly string[];
  /**
   * Time-scoped revocations. Considered revoked if revokedAt <= evaluation time.
   */
  revocations?: readonly AttestorRevocation[];
}>;

export type AttestorTrustResult =
  | Readonly<{ ok: true; keyId: string; entry: AttestorTrustEntry }>
  | Readonly<{ ok: false; code: string; detail?: string }>;

function err(code: string, detail?: string): AttestorTrustResult {
  return { ok: false, code, ...(detail !== undefined ? { detail } : {}) };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function normalizeJwk(jwk: NodeJsonWebKey): NodeJsonWebKey {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(jwk as Record<string, unknown>)) {
    if (v !== undefined) out[k] = v;
  }
  return out as unknown as NodeJsonWebKey;
}

function sha256HexUtf8(s: string): string {
  return createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex");
}

export function keyIdFromPubKeyJwk(pubKeyJwk: NodeJsonWebKey): string {
  const canon = canonicalize(normalizeJwk(pubKeyJwk) as never);
  return sha256HexUtf8(canon);
}

function parseRfc3339Ms(s: string): number | null {
  const ms = Date.parse(s);
  if (!Number.isFinite(ms)) return null;
  return ms;
}

export function parseAttestorTrustFile(u: unknown): AttestorTrustFile | null {
  if (!isRecord(u)) return null;
  if (u["ver"] !== "pbi-attestor-trust-1.0") return null;

  const createdAt = u["createdAt"];
  const trustedAttestorsU = u["trustedAttestors"];
  const revokedKeyIdsU = u["revokedKeyIds"];
  const revocationsU = u["revocations"];

  if (typeof createdAt !== "string" || createdAt.length === 0) return null;
  if (parseRfc3339Ms(createdAt) === null) return null;
  if (!Array.isArray(trustedAttestorsU)) return null;

  let revokedKeyIds: string[] | undefined;
  if (revokedKeyIdsU !== undefined) {
    if (!Array.isArray(revokedKeyIdsU) || !revokedKeyIdsU.every((x) => typeof x === "string")) return null;
    revokedKeyIds = revokedKeyIdsU.slice();
  }

  let revocations: AttestorRevocation[] | undefined;
  if (revocationsU !== undefined) {
    if (!Array.isArray(revocationsU)) return null;
    const out: AttestorRevocation[] = [];
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

  const entries: AttestorTrustEntry[] = [];

  for (const e of trustedAttestorsU) {
    if (!isRecord(e)) return null;

    const name = e["name"];
    const alg = e["alg"];
    const kid = e["kid"];
    const keyId = e["keyId"];
    const pubKeyJwkU = e["pubKeyJwk"];
    const notBefore = e["notBefore"];
    const notAfter = e["notAfter"];

    if (typeof name !== "string" || name.length === 0) return null;
    if (alg !== "ed25519") return null;
    if (kid !== undefined && typeof kid !== "string") return null;
    if (typeof keyId !== "string" || !/^[0-9a-f]{64}$/.test(keyId)) return null;
    if (!isRecord(pubKeyJwkU)) return null;

    if (notBefore !== undefined && notBefore !== null && typeof notBefore !== "string") return null;
    if (notAfter !== undefined && notAfter !== null && typeof notAfter !== "string") return null;
    if (typeof notBefore === "string" && parseRfc3339Ms(notBefore) === null) return null;
    if (typeof notAfter === "string" && parseRfc3339Ms(notAfter) === null) return null;

    const pubKeyJwk = normalizeJwk(pubKeyJwkU as unknown as NodeJsonWebKey);

    // Ensure declared keyId matches computed keyId (prevents tampering / mismatch)
    const computed = keyIdFromPubKeyJwk(pubKeyJwk);
    if (computed !== keyId) return null;

    entries.push({
      name,
      alg: "ed25519",
      ...(kid ? { kid } : {}),
      keyId,
      pubKeyJwk,
      ...(notBefore !== undefined ? { notBefore } : {}),
      ...(notAfter !== undefined ? { notAfter } : {})
    });
  }

  return {
    ver: "pbi-attestor-trust-1.0",
    createdAt,
    trustedAttestors: entries,
    ...(revokedKeyIds !== undefined ? { revokedKeyIds } : {}),
    ...(revocations !== undefined ? { revocations } : {})
  };
}

function isRevokedAt(trust: AttestorTrustFile, keyId: string, atMs: number): string | null {
  const hard = trust.revokedKeyIds ?? [];
  if (hard.includes(keyId)) return `Revoked attestor key: ${keyId}`;

  const revs = trust.revocations ?? [];
  for (const r of revs) {
    if (r.keyId !== keyId) continue;
    const ms = Date.parse(r.revokedAt);
    if (Number.isFinite(ms) && ms <= atMs) {
      return `Revoked attestor key: ${keyId}${r.reason ? ` (${r.reason})` : ""}`;
    }
  }

  return null;
}

/**
 * Verify an attestor is trusted AT a specific time.
 * - Use atIso = attestation.verifiedAt for “as-of” validation.
 * - Use atIso = now for “strict/current” validation.
 */
export function verifyAttestorTrustAt(params: Readonly<{
  trust: AttestorTrustFile;
  attestorKid: string;
  attestorPubKeyJwk: NodeJsonWebKey;
  atIso: string;
}>): AttestorTrustResult {
  const atMs = parseRfc3339Ms(params.atIso);
  if (atMs === null) return err("invalid_structure", "atIso not RFC3339");

  const keyId = keyIdFromPubKeyJwk(params.attestorPubKeyJwk);

  const revokedMsg = isRevokedAt(params.trust, keyId, atMs);
  if (revokedMsg) return err("attestor_revoked", revokedMsg);

  const entry = params.trust.trustedAttestors.find((x) => x.keyId === keyId);
  if (!entry) return err("attestor_untrusted", `Untrusted attestor key: ${keyId}`);

  if (entry.kid !== undefined && entry.kid !== params.attestorKid) {
    return err("attestor_kid_mismatch", `kid mismatch: trust=${entry.kid} attestation=${params.attestorKid}`);
  }

  if (entry.notBefore) {
    const nb = parseRfc3339Ms(entry.notBefore);
    if (nb === null) return err("invalid_structure", "notBefore not RFC3339");
    if (atMs < nb) return err("attestor_not_yet_valid", `Attestor key not valid until: ${entry.notBefore}`);
  }

  if (entry.notAfter) {
    const na = parseRfc3339Ms(entry.notAfter);
    if (na === null) return err("invalid_structure", "notAfter not RFC3339");
    if (atMs > na) return err("attestor_expired", `Attestor key expired: ${keyId}`);
  }

  return { ok: true, keyId, entry };
}
