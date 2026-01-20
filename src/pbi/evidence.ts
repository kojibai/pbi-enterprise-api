import { config } from "../config.js";

export type VerifierInfo = {
  method: "webauthn";
  up: boolean;
  uv: boolean;
  rpId?: string;
};

export type EvidenceMetadata = {
  policyVer?: string;
  policyHash?: string;
  verifier?: VerifierInfo;
  traceId?: string;
};

export function buildEvidenceMetadata(params: { traceId?: string; verifier?: VerifierInfo }): EvidenceMetadata {
  const metadata: EvidenceMetadata = {};

  if (config.policyVersion) metadata.policyVer = config.policyVersion;
  if (config.policyHash) metadata.policyHash = config.policyHash;
  if (params.verifier) metadata.verifier = params.verifier;
  if (params.traceId) metadata.traceId = params.traceId;

  return metadata;
}

export function withEvidenceMetadata<T extends object>(base: T, metadata: EvidenceMetadata): T & EvidenceMetadata {
  return { ...base, ...metadata };
}
