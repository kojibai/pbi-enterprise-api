import { b64urlToBytes, bytesToB64url, bufToBytes } from "./b64url";
import { cborDecode } from "./cbor";
import { coseEc2ToPem, type CoseEc2 } from "./pem";

export type StoredCredential = {
  credIdB64Url: string;
  pubKeyPem: string;
};

const LS_KEY = "pbi_demo_credential_v1";

export function loadStoredCredential(): StoredCredential | null {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<StoredCredential>;
    if (typeof v.credIdB64Url !== "string") return null;
    if (typeof v.pubKeyPem !== "string") return null;
    return { credIdB64Url: v.credIdB64Url, pubKeyPem: v.pubKeyPem };
  } catch {
    return null;
  }
}

export function clearStoredCredential(): void {
  localStorage.removeItem(LS_KEY);
}

function randBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u8.byteLength);
  new Uint8Array(ab).set(u8);
  return ab;
}

export async function registerPasskey(): Promise<StoredCredential> {
  if (!("PublicKeyCredential" in window)) throw new Error("webauthn_not_supported");

  const userIdU8 = randBytes(16);
  const challengeU8 = randBytes(32);

  const rpId = window.location.hostname; // "localhost" in dev

  // Type this as PublicKeyCredentialCreationOptions (not indexing into another type)
  const publicKey: PublicKeyCredentialCreationOptions = {
    rp: { id: rpId, name: "PBI Demo RP" },
    user: {
      id: toArrayBuffer(userIdU8), // ArrayBuffer satisfies BufferSource
      name: "demo-user",
      displayName: "Demo User"
    },
    challenge: toArrayBuffer(challengeU8), // ArrayBuffer satisfies BufferSource
    pubKeyCredParams: [{ type: "public-key", alg: -7 }], // ES256
    authenticatorSelection: {
      userVerification: "required",
      residentKey: "preferred"
    },
    timeout: 60_000,
    attestation: "none"
  };

  const cred = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
  if (!cred) throw new Error("create_failed");

  const resp = cred.response as AuthenticatorAttestationResponse;

  const attObj = new Uint8Array(resp.attestationObject);
  const att = cborDecode(attObj);
  if (!(att instanceof Map)) throw new Error("bad_attestation_cbor");

  const authData = att.get("authData");
  if (!(authData instanceof Uint8Array)) throw new Error("missing_authData");

  const { credId, coseKey } = parseAuthDataForCredential(authData);
  const pubKeyPem = await coseEc2ToPem(coseKey);

  const stored: StoredCredential = {
    credIdB64Url: bytesToB64url(credId),
    pubKeyPem
  };

  localStorage.setItem(LS_KEY, JSON.stringify(stored));
  return stored;
}

function parseAuthDataForCredential(authData: Uint8Array): { credId: Uint8Array; coseKey: CoseEc2 } {
  if (authData.length < 37) throw new Error("authData_too_short");

  const flags = authData[32];
  if (flags === undefined) throw new Error("missing_flags");

  const AT = (flags & 0x40) !== 0;
  if (!AT) throw new Error("attested_data_missing_AT_flag");

  let i = 37; // 32 + 1 + 4
  i += 16; // aaguid
  if (i + 2 > authData.length) throw new Error("authData_bad");

  const b0 = authData[i];
  const b1 = authData[i + 1];
  if (b0 === undefined || b1 === undefined) throw new Error("authData_bad");

  const credIdLen = (b0 << 8) | b1;
  i += 2;

  if (i + credIdLen > authData.length) throw new Error("authData_bad_credId");
  const credId = authData.slice(i, i + credIdLen);
  i += credIdLen;

  const coseBytes = authData.slice(i);
  const cose = cborDecode(coseBytes);
  if (!(cose instanceof Map)) throw new Error("bad_cose");

  const kty = cose.get(1);
  const crv = cose.get(-1);
  const x = cose.get(-2);
  const y = cose.get(-3);

  if (kty !== 2) throw new Error("cose_not_ec2");
  if (typeof crv !== "number") throw new Error("cose_bad_crv");
  if (!(x instanceof Uint8Array)) throw new Error("cose_bad_x");
  if (!(y instanceof Uint8Array)) throw new Error("cose_bad_y");

  return { credId, coseKey: { crv, x, y } };
}

export async function attestWithPasskey(
  stored: StoredCredential,
  challengeBytes: Uint8Array
): Promise<{
  authenticatorDataB64Url: string;
  clientDataJSONB64Url: string;
  signatureB64Url: string;
  credIdB64Url: string;
  pubKeyPem: string;
}> {
  const allowCredIdU8 = b64urlToBytes(stored.credIdB64Url);

  // IMPORTANT: challenge must be an ArrayBuffer (BufferSource) with strict DOM libs
  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: toArrayBuffer(challengeBytes),
    timeout: 60_000,
    userVerification: "required",
    allowCredentials: [{ type: "public-key", id: toArrayBuffer(allowCredIdU8) }]
  };

  const cred = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
  if (!cred) throw new Error("get_failed");

  const resp = cred.response as AuthenticatorAssertionResponse;

  return {
    authenticatorDataB64Url: bytesToB64url(bufToBytes(resp.authenticatorData)),
    clientDataJSONB64Url: bytesToB64url(bufToBytes(resp.clientDataJSON)),
    signatureB64Url: bytesToB64url(bufToBytes(resp.signature)),
    credIdB64Url: stored.credIdB64Url,
    pubKeyPem: stored.pubKeyPem
  };
}