import { bytesToB64url } from "./b64url";
export async function coseEc2ToPem(cose) {
    if (cose.crv !== 1)
        throw new Error("Only P-256 supported in demo");
    const jwk = {
        kty: "EC",
        crv: "P-256",
        x: bytesToB64url(cose.x),
        y: bytesToB64url(cose.y),
        ext: true
    };
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, true, ["verify"]);
    const spki = await crypto.subtle.exportKey("spki", key);
    return spkiToPem(new Uint8Array(spki));
}
function spkiToPem(spki) {
    const b64 = btoa(String.fromCharCode(...spki));
    const lines = b64.match(/.{1,64}/g) ?? [];
    return `-----BEGIN PUBLIC KEY-----\n${lines.join("\n")}\n-----END PUBLIC KEY-----\n`;
}
