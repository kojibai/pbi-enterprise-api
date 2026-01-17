import type { VerifyErr, VerifyPolicy } from "./types.js";

export type PBIPurposePolicy = Readonly<{
  purpose: string;
  rpIdAllowList: readonly string[];
  originAllowList: readonly string[];
  requireUP: boolean;
  requireUV: boolean;
}>;

export type PBIPolicyFile = Readonly<{
  ver: "pbi-policy-1.0";
  issuedAt: string; // RFC3339
  issuer?: Readonly<{ name: string }>;
  purposes: readonly PBIPurposePolicy[];
}>;

export type PolicyBuildErr = Readonly<{ ok: false; code: VerifyErr["code"]; detail?: string }>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isStringArray(v: unknown): v is readonly string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function err(code: VerifyErr["code"], detail?: string): PolicyBuildErr {
  return {
    ok: false,
    code,
    ...(detail !== undefined ? { detail } : {})
  };
}

/**
 * Parse an unsigned policy file (pbi-policy-1.0).
 * Returns null if shape is invalid.
 */
export function parsePolicyFile(u: unknown): PBIPolicyFile | null {
  if (!isRecord(u)) return null;
  if (u["ver"] !== "pbi-policy-1.0") return null;

  const issuedAt = u["issuedAt"];
  const purposes = u["purposes"];

  if (typeof issuedAt !== "string" || issuedAt.length === 0) return null;
  if (!Array.isArray(purposes)) return null;

  const issuerU = u["issuer"];
  let issuer: PBIPolicyFile["issuer"] | undefined;
  if (issuerU !== undefined) {
    if (!isRecord(issuerU)) return null;
    const name = issuerU["name"];
    if (typeof name !== "string" || name.length === 0) return null;
    issuer = { name };
  }

  const parsedPurposes: PBIPurposePolicy[] = [];
  for (const p of purposes) {
    if (!isRecord(p)) return null;

    const purpose = p["purpose"];
    const rpIdAllowList = p["rpIdAllowList"];
    const originAllowList = p["originAllowList"];
    const requireUP = p["requireUP"];
    const requireUV = p["requireUV"];

    if (typeof purpose !== "string" || purpose.length === 0) return null;
    if (!isStringArray(rpIdAllowList) || rpIdAllowList.length === 0) return null;
    if (!isStringArray(originAllowList) || originAllowList.length === 0) return null;
    if (typeof requireUP !== "boolean") return null;
    if (typeof requireUV !== "boolean") return null;

    parsedPurposes.push({
      purpose,
      rpIdAllowList,
      originAllowList,
      requireUP,
      requireUV
    });
  }

  return {
    ver: "pbi-policy-1.0",
    issuedAt,
    ...(issuer ? { issuer } : {}),
    purposes: parsedPurposes
  };
}

/**
 * Build VerifyPolicy (rpId/origin/flags requirements) for a given purpose.
 * This is what the receipt verifier consumes.
 */
export function buildVerifyPolicyFromPurpose(params: Readonly<{
  policyFile: PBIPolicyFile;
  purpose: string;
}>): VerifyPolicy | PolicyBuildErr {
  const p = params.policyFile.purposes.find((x) => x.purpose === params.purpose);
  if (!p) return err("purpose_mismatch", `No policy entry for purpose: ${params.purpose}`);

  // Defensive: ensure allowlists not empty
  if (p.rpIdAllowList.length === 0) return err("invalid_structure", "rpIdAllowList empty");
  if (p.originAllowList.length === 0) return err("invalid_structure", "originAllowList empty");

  return {
    rpIdAllowList: p.rpIdAllowList,
    originAllowList: p.originAllowList,
    requireUP: p.requireUP,
    requireUV: p.requireUV
  };
}
