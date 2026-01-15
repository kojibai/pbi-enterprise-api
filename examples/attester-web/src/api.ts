import { b64urlToBytes, bytesToB64url, bufToBytes } from "./b64url";

export type PbiChallenge = {
  id: string;
  challengeB64Url: string;
  purpose: "ACTION_COMMIT" | "ARTIFACT_AUTHORSHIP" | "EVIDENCE_SUBMIT" | "ADMIN_DANGEROUS_OP";
  actionHashHex: string;
  expiresAtIso: string;
};

export type PbiVerifyOk = {
  ok: true;
  decision: "PBI_VERIFIED";
  receiptId: string;
  receiptHashHex: string;
  challenge: { id: string; purpose: string; actionHashHex: string };
};

export type PbiVerifyFail = {
  ok: boolean;
  decision: "FAILED" | "EXPIRED" | "REPLAYED";
  reason?: string;
};

export type PbiVerifyResp = PbiVerifyOk | PbiVerifyFail;

export async function apiChallenge(
  base: string,
  apiKey: string,
  purpose: PbiChallenge["purpose"],
  actionHashHex: string
): Promise<PbiChallenge> {
  const r = await fetch(`${base}/v1/pbi/challenge`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ purpose, actionHashHex, ttlSeconds: 120 })
  });

  if (!r.ok) throw new Error(`challenge_failed_${r.status}`);
  const json = (await r.json()) as { challenge: PbiChallenge };
  return json.challenge;
}

export async function apiVerify(
  base: string,
  apiKey: string,
  payload: unknown
): Promise<PbiVerifyResp> {
  const r = await fetch(`${base}/v1/pbi/verify`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  const json = (await r.json()) as PbiVerifyResp;
  return json;
}

// helpers to format WebAuthn pieces to what your API expects
export function abToB64Url(ab: ArrayBuffer): string {
  return bytesToB64url(bufToBytes(ab));
}

export function challengeToBytes(challengeB64Url: string): Uint8Array {
  return b64urlToBytes(challengeB64Url);
}