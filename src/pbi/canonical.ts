import { sha256Hex } from "../util/crypto.js";

export type CanonicalAction = {
  purpose: string;
  // This should include any fields that make the action binding:
  // amount, to, resourceId, artifactHash, etc.
  payload: Record<string, string>;
};

export function canonicalizeAction(action: CanonicalAction): Uint8Array {
  // Deterministic JSON canonicalization (minimal, strict):
  // - keys sorted
  // - string-only values (enterprise uses typed fields upstream)
  const sortedPayloadKeys = Object.keys(action.payload).sort();
  const payloadEntries = sortedPayloadKeys.map((k) => [k, action.payload[k]] as const);

  const obj = {
    purpose: action.purpose,
    payload: Object.fromEntries(payloadEntries)
  };

  const text = JSON.stringify(obj);
  return new TextEncoder().encode(text);
}

export function actionHashHex(action: CanonicalAction): string {
  return sha256Hex(canonicalizeAction(action));
}