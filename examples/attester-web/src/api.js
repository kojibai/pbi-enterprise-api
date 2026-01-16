import { b64urlToBytes, bytesToB64url, bufToBytes } from "./b64url";
export async function apiChallenge(base, apiKey, purpose, actionHashHex) {
    const r = await fetch(`${base}/v1/pbi/challenge`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({ purpose, actionHashHex, ttlSeconds: 120 })
    });
    if (!r.ok)
        throw new Error(`challenge_failed_${r.status}`);
    const json = (await r.json());
    return json.challenge;
}
export async function apiVerify(base, apiKey, payload) {
    const r = await fetch(`${base}/v1/pbi/verify`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
    });
    const json = (await r.json());
    return json;
}
// helpers to format WebAuthn pieces to what your API expects
export function abToB64Url(ab) {
    return bytesToB64url(bufToBytes(ab));
}
export function challengeToBytes(challengeB64Url) {
    return b64urlToBytes(challengeB64Url);
}
