import type { JsonObject, PBIActionV1, VerifyErr } from "./types.js";

type PathRule = Readonly<{ type: "exact" | "prefix"; value: string }>;

type ParamRule =
  | Readonly<{
      type: "string";
      pattern?: string;
      enum?: readonly string[];
      minLength?: number;
      maxLength?: number;
      gt?: string; // decimal string compare, positive numbers only
    }>
  | Readonly<{ type: "object" }>;

type Profile = Readonly<{
  purpose: string;
  requireUV: boolean;
  methods: readonly string[]; // MUST be uppercase (e.g. "POST")
  paths: readonly PathRule[];
  requiredParams: readonly string[];
  paramRules: Readonly<Record<string, ParamRule>>;
}>;

export type ProfileSet = Readonly<{ ver: "pbi-profiles-1.0"; profiles: readonly Profile[] }>;

/**
 * Result for action/profile validation.
 * This is NOT the same as receipt verification (VerifyResult).
 */
export type ActionValidationResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; code: VerifyErr["code"]; detail?: string }>;

function err(code: VerifyErr["code"], detail?: string): ActionValidationResult {
  return {
    ok: false,
    code,
    ...(detail !== undefined ? { detail } : {})
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function getParam(params: JsonObject, k: string): unknown {
  return (params as Record<string, unknown>)[k];
}

function matchPath(path: string, rules: readonly PathRule[]): boolean {
  for (const r of rules) {
    if (r.type === "exact" && path === r.value) return true;
    if (r.type === "prefix" && path.startsWith(r.value)) return true;
  }
  return false;
}

function decimalGt(v: string, gt: string): boolean {
  // String decimal compare without floats; safe for POSITIVE decimals.
  // Normalize "0.0" -> "0", strip leading zeros in integer part, strip trailing zeros in frac.
  const norm = (s: string): { int: string; frac: string } => {
    const [iRaw, fRaw] = s.split(".");
    const i = (iRaw ?? "0").replace(/^0+(?=\d)/, "");
    const f = (fRaw ?? "").replace(/0+$/, "");
    return { int: i.length ? i : "0", frac: f };
  };

  const a = norm(v);
  const b = norm(gt);

  // Compare integer length first
  if (a.int.length !== b.int.length) return a.int.length > b.int.length;

  // Compare integer lexicographically
  if (a.int !== b.int) return a.int > b.int;

  // Compare fractional (pad to same length)
  const max = Math.max(a.frac.length, b.frac.length);
  const af = a.frac.padEnd(max, "0");
  const bf = b.frac.padEnd(max, "0");
  return af > bf;
}

/**
 * Validate that an action matches a declared profile set (purpose/method/path/params).
 * Returns ok:true on pass; otherwise ok:false with VerifyErr-compatible error codes.
 */
export function validateActionWithProfiles(action: PBIActionV1, set: ProfileSet): ActionValidationResult {
  // Version gate (optional but nice)
  if (set.ver !== "pbi-profiles-1.0") return err("invalid_version", "profiles ver mismatch");

  const prof = set.profiles.find((p) => p.purpose === action.purpose);
  if (!prof) return err("invalid_structure", `Unknown purpose profile: ${action.purpose}`);

  // Method / path allowlist
  if (!prof.methods.includes(action.method)) return err("invalid_structure", `Method not allowed for ${action.purpose}`);
  if (!matchPath(action.path, prof.paths)) return err("invalid_structure", `Path not allowed for ${action.purpose}`);

  // Required params present
  for (const k of prof.requiredParams) {
    const v = getParam(action.params, k);
    if (v === undefined) return err("invalid_structure", `Missing params.${k}`);
  }

  // Param rules
  for (const [k, rule] of Object.entries(prof.paramRules)) {
    const v = getParam(action.params, k);
    if (v === undefined) continue;

    if (rule.type === "string") {
      if (typeof v !== "string") return err("invalid_structure", `params.${k} must be string`);
      if (rule.minLength !== undefined && v.length < rule.minLength) return err("invalid_structure", `params.${k} too short`);
      if (rule.maxLength !== undefined && v.length > rule.maxLength) return err("invalid_structure", `params.${k} too long`);
      if (rule.enum && !rule.enum.includes(v)) return err("invalid_structure", `params.${k} not in enum`);
      if (rule.pattern && !new RegExp(rule.pattern).test(v)) return err("invalid_structure", `params.${k} pattern mismatch`);
      if (rule.gt !== undefined && !decimalGt(v, rule.gt)) return err("invalid_structure", `params.${k} must be > ${rule.gt}`);
    } else {
      // object
      if (!isRecord(v)) return err("invalid_structure", `params.${k} must be object`);
    }
  }

  return { ok: true };
}
