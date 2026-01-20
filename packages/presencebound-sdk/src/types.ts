export type Purpose =
  | "ACTION_COMMIT"
  | "ARTIFACT_AUTHORSHIP"
  | "EVIDENCE_SUBMIT"
  | "ADMIN_DANGEROUS_OP";

export type Decision = "PBI_VERIFIED" | "FAILED" | "EXPIRED" | "REPLAYED";

export interface ErrorResponse {
  error: string;
  issues?: Record<string, unknown>[];
}

export interface Metering {
  month: string;
  used: string;
  quota: string;
}

export interface Verifier {
  method: "webauthn";
  up: boolean;
  uv: boolean;
  rpId?: string;
}

export interface EvidenceMetadata {
  policyVer?: string;
  policyHash?: string;
  verifier?: Verifier;
  traceId?: string;
}

export interface PBIChallenge extends EvidenceMetadata {
  id: string;
  challengeB64Url: string;
  purpose: Purpose;
  actionHashHex: string;
  expiresAtIso: string;
}

export interface ChallengeRequest {
  purpose?: Purpose;
  kind?: Purpose;
  actionHashHex: string;
  ttlSeconds?: number;
}

export interface ChallengeResponse {
  id: string;
  challengeB64Url: string;
  expiresAtIso: string;
  purpose: Purpose;
  actionHashHex: string;
  challenge: PBIChallenge;
  metering?: Metering;
}

export interface WebAuthnAssertionBundle {
  authenticatorDataB64Url: string;
  clientDataJSONB64Url: string;
  signatureB64Url: string;
  credIdB64Url: string;
  pubKeyPem: string;
}

export interface VerifyRequest {
  challengeId: string;
  assertion: WebAuthnAssertionBundle;
}

export interface VerifyResponse {
  ok: boolean;
  decision: Decision;
  reason?: string | null;
  receiptId?: string | null;
  receiptHashHex?: string | null;
  challenge?: {
    id: string;
    purpose: Purpose;
    actionHashHex: string;
    policyVer?: string;
    policyHash?: string;
    verifier?: Verifier;
    traceId?: string;
  };
  metering?: Metering;
}

export interface Receipt {
  id: string;
  challengeId: string;
  receiptHashHex: string;
  decision: Decision;
  createdAt: string;
  policyVer?: string;
  policyHash?: string;
  verifier?: Verifier;
  traceId?: string;
}

export interface ChallengeStatus extends EvidenceMetadata {
  id: string;
  purpose: Purpose;
  actionHashHex: string;
  expiresAtIso: string;
  usedAtIso?: string | null;
  status: "active" | "expired" | "used";
}

export interface ChallengeStatusResponse {
  challenge: ChallengeStatus;
}

export interface ReceiptResponse {
  receipt: Receipt;
  challenge?: ChallengeStatus | null;
}

export interface ReceiptVerifyRequest {
  receiptId: string;
  receiptHashHex: string;
}

export interface ReceiptVerifyResponse {
  ok: boolean;
  receipt: {
    id: string;
    challengeId: string;
    decision: Decision;
    createdAt: string;
    policyVer?: string;
    policyHash?: string;
    verifier?: Verifier;
    traceId?: string;
  };
}

export interface ReceiptWithChallenge {
  receipt: Receipt;
  challenge?: ChallengeStatus | null;
}

export interface ReceiptListResponse {
  receipts: ReceiptWithChallenge[];
  nextCursor?: string | null;
}

export interface ReceiptListParams {
  limit?: number;
  cursor?: string;
  createdAfter?: string;
  createdBefore?: string;
  order?: "asc" | "desc";
  actionHashHex?: string;
  challengeId?: string;
  purpose?: Purpose;
  decision?: Decision;
}

export interface ReceiptExportParams {
  limit: number;
  createdAfter?: string;
  createdBefore?: string;
  order?: "asc" | "desc";
  actionHashHex?: string;
  challengeId?: string;
  purpose?: Purpose;
  decision?: Decision;
}

export interface UsageResponse {
  month: string;
  usage: {
    challenge: string;
    verify: string;
  };
}

export interface InvoicesResponse {
  invoices: Array<{
    id: string;
    month: string;
    status: "open" | "final" | "paid";
    totalCents: string;
    lineItems: Record<string, unknown>;
    createdAt: string;
    finalizedAt?: string | null;
  }>;
}

export interface ApiResponse<T> {
  data: T;
  requestId?: string;
}
