import { createHash, createHmac, createVerify } from "node:crypto";

export function sha256Bytes(data: Uint8Array): Uint8Array {
  const h = createHash("sha256").update(Buffer.from(data)).digest();
  return new Uint8Array(h);
}

export function sha256Hex(data: Uint8Array): string {
  return createHash("sha256").update(Buffer.from(data)).digest("hex");
}

export function hmacHex(secret: string, msg: string): string {
  return createHmac("sha256", secret).update(msg, "utf8").digest("hex");
}

export type ES256Jwk = {
  kty: "EC";
  crv: "P-256";
  x: string;
  y: string;
  ext?: boolean;
  key_ops?: readonly string[];
};

export function verifyEs256JwsLike(
  jwk: ES256Jwk,
  signedData: Uint8Array,
  signatureDer: Uint8Array
): boolean {
  // Convert JWK to PEM for Node verify (simple and dependable).
  // P-256 uncompressed point: 0x04 || X || Y
  const x = Buffer.from(jwk.x.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const y = Buffer.from(jwk.y.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const uncompressed = Buffer.concat([Buffer.from([0x04]), x, y]);

  // Minimal SubjectPublicKeyInfo for prime256v1
  // Using Node's 'createVerify' with a constructed PEM via ASN.1 is heavy;
  // so we use a simpler approach: import as "raw" is not supported by createVerify.
  // Instead, we require PEM to be provided OR we store PEM server-side.
  // For enterprise launch: store PEM at registration, or provide PEM in bundle.
  // To keep this API minimal + correct, we accept `pubKeyPem` in bundle and verify against it.
  void uncompressed;
  void jwk;
  void signedData;
  void signatureDer;
  return false;
}

export function verifyEs256Pem(
  pubKeyPem: string,
  signedData: Uint8Array,
  signatureDer: Uint8Array
): boolean {
  const v = createVerify("SHA256");
  v.update(Buffer.from(signedData));
  v.end();
  return v.verify(pubKeyPem, Buffer.from(signatureDer));
}