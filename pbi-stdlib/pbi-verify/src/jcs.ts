import type { JsonValue, JsonObject } from "./types.js";

/**
 * RFC8785-ish JSON Canonicalization:
 * - Object keys sorted lexicographically
 * - No whitespace
 * - Strings/numbers/bools/null use JSON.stringify
 * - Reject non-finite numbers
 *
 * This matches the test vectors (all-string params) and is suitable as a reference verifier.
 */
export function canonicalize(value: JsonValue): string {
  if (value === null) return "null";

  const t = typeof value;
  if (t === "string") return JSON.stringify(value);
  if (t === "boolean") return value ? "true" : "false";
  if (t === "number") {
    if (!Number.isFinite(value)) throw new Error("nonfinite_number");
    // JSON.stringify enforces JSON number formatting
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    let out = "[";
    for (let i = 0; i < value.length; i++) {
      if (i) out += ",";
      out += canonicalize(value[i] as JsonValue);
    }
    out += "]";
    return out;
  }

  // object
  const obj = value as JsonObject;
  const keys = Object.keys(obj).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  let out = "{";
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]!;
    if (i) out += ",";
    out += JSON.stringify(k) + ":" + canonicalize(obj[k] as JsonValue);
  }
  out += "}";
  return out;
}