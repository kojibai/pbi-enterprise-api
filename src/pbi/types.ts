export type PBIPurpose =
  | "ACTION_COMMIT"
  | "ARTIFACT_AUTHORSHIP"
  | "EVIDENCE_SUBMIT"
  | "ADMIN_DANGEROUS_OP";

export type PBIChallenge = {
  id: string;
  challengeB64Url: string;   // random nonce
  purpose: PBIPurpose;
  actionHashHex: string;     // hash of canonical action/artifact bytes
  expiresAtIso: string;
};

export type WebAuthnAssertionBundle = {
  // WebAuthn assertion parts (base64url strings)
  authenticatorDataB64Url: string;
  clientDataJSONB64Url: string;
  signatureB64Url: string;

  // Credential id (opaque, used for analytics / optional enrollment)
  credIdB64Url: string;

  // For deterministic verification without enrollment, provide the public key in PEM form.
  // This does NOT identify the human; it identifies the credential used for this proof.
  pubKeyPem: string;
};

export type PBIVerifyRequest = {
  challengeId: string;
  assertion: WebAuthnAssertionBundle;
};

export type PBIVerifyResult = {
  ok: boolean;
  decision: "PBI_VERIFIED" | "FAILED" | "EXPIRED" | "REPLAYED" | "BAD_ORIGIN" | "BAD_SIGNATURE" | "MISSING_UV_UP";
  receiptId?: string;
  receiptHashHex?: string;
};