import { bytesToB64url } from "./b64url";

export type CoseEc2 = {
  crv: number; // 1 = P-256
  x: Uint8Array;
  y: Uint8Array;
};

export async function coseEc2ToPem(cose: CoseEc2): Promise<string> {
  if (cose.crv !== 1) throw new Error("Only P-256 supported in demo");

  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: bytesToB64url(cose.x),
    y: bytesToB64url(cose.y),
    ext: true
  };

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"]
  );

  const spki = await crypto.subtle.exportKey("spki", key);
  return spkiToPem(new Uint8Array(spki));
}

function spkiToPem(spki: Uint8Array): string {
  const b64 = btoa(String.fromCharCode(...spki));
  const lines = b64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join("\n")}\n-----END PUBLIC KEY-----\n`;
}