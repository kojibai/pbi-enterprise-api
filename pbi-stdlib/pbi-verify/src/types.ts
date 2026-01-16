export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { readonly [k: string]: JsonValue };

export type Base64UrlString = string;
export type HexString = string;

export type PBIActionV1 = Readonly<{
  ver: "pbi-action-1.0";
  aud: string;
  purpose: string;
  method: string; // MUST be uppercase
  path: string;   // normalized path
  query: string;  // normalized query or ""
  params: JsonObject;
}>;

export type KASAuthorSigWebAuthnES256 = Readonly<{
  alg: "webauthn-es256";
  credId: Base64UrlString;
  authenticatorData: Base64UrlString;
  clientDataJSON: Base64UrlString;
  signature: Base64UrlString; // DER bytes, base64url
}>;

export type PBIReceiptV1 = Readonly<{
  ver: "pbi-receipt-1.0";
  challengeId: string;
  challenge: Base64UrlString;
  actionHash: HexString;
  aud: string;
  purpose: string;
  authorSig: KASAuthorSigWebAuthnES256;
}>;

export type ChallengeRecordV1 = Readonly<{
  ver: "pbi-chal-1.0";
  challengeId: string;
  challenge: Base64UrlString;
  actionHash: HexString;
  aud: string;
  purpose: string;
  expiresAt: string; // RFC3339
  usedAt: string | null;
}>;

export type VerifyErrorCode =
  | "invalid_version"
  | "invalid_encoding"
  | "invalid_structure"
  | "challenge_not_found"
  | "challenge_expired"
  | "challenge_used"
  | "action_hash_mismatch"
  | "aud_mismatch"
  | "purpose_mismatch"
  | "origin_not_allowed"
  | "rpId_not_allowed"
  | "webauthn_type_mismatch"
  | "challenge_mismatch"
  | "signature_invalid"
  | "flags_policy_violation"
  | "nonfinite_number";

export type VerifyOk = Readonly<{
  ok: true;
  receiptHash: HexString;
  actionHash: HexString;
  rpIdHash_b64url: Base64UrlString;
  clientDataHash_b64url: Base64UrlString;
  flags_hex: string;
  signCount: number;
}>;

export type VerifyErr = Readonly<{
  ok: false;
  code: VerifyErrorCode;
  detail?: string;
}>;

export type VerifyResult = VerifyOk | VerifyErr;

export type VerifyPolicy = Readonly<{
  rpIdAllowList: readonly string[];
  originAllowList: readonly string[];
  requireUP: boolean;
  requireUV: boolean;
}>;

export type ChallengeStore = Readonly<{
  getChallenge: (challengeId: string) => Promise<ChallengeRecordV1 | null>;
  markUsed: (challengeId: string, receiptHash: HexString) => Promise<void>;
}>;

export type CredentialStore = Readonly<{
  // Return the registered credential public key as JWK (P-256)
  getPublicKeyJwk: (credId_b64url: string) => Promise<JsonWebKey | null>;
}>;