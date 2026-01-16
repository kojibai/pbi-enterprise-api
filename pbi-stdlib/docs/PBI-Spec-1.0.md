PBI Core Specification (PBI-SPEC-1.0)

Scope: This document defines the wire formats, canonicalization, and the verification algorithm for Presence-Bound Identity receipts.

0) Conventions
	•	Normative keywords MUST / SHOULD / MAY are used as in RFC-style specs.
	•	All JSON is UTF-8.
	•	base64url means URL-safe Base64 without padding (= stripped).
	•	Hex strings are lowercase, no 0x prefix.

⸻

1) Objects and versions

1.1 Action (PBI-ACTION-1.0)

An Action is the exact intent being authorized. It is hashed canonically to become actionHash.

Action JSON (required fields):

{
  "ver": "pbi-action-1.0",
  "aud": "string",
  "purpose": "string",
  "method": "string",
  "path": "string",
  "query": "string",
  "params": { "string": "string|object|array" }
}

Rules
	•	method MUST be uppercase HTTP method (e.g. "POST").
	•	path MUST be the normalized request path (leading /, no scheme/host).
	•	query MUST be either "" or a normalized query string (see §2.3).
	•	params MUST include every value needed to make the intent unambiguous (amounts, destination, resource ids, etc.).
	•	Values inside params SHOULD avoid floating numbers; represent money/precision values as strings.

⸻

1.2 Challenge record (PBI-CHAL-1.0)

A Challenge binds a future receipt to a specific Action hash and time window.

Challenge JSON (server-side concept; may be returned to clients):

{
  "ver": "pbi-chal-1.0",
  "challengeId": "string",
  "challenge": "base64url",
  "actionHash": "hex",
  "aud": "string",
  "purpose": "string",
  "expiresAt": "RFC3339 string",
  "usedAt": "RFC3339 string | null"
}

Rules
	•	challenge MUST be at least 32 bytes of CSPRNG output, encoded base64url.
	•	A verifier MUST reject challenges that are expired or already used.

⸻

1.3 Receipt (PBI-RECEIPT-1.0)

A Receipt is the offline-verifiable authorization artifact produced from a WebAuthn assertion.

Receipt JSON:

{
  "ver": "pbi-receipt-1.0",
  "challengeId": "string",
  "challenge": "base64url",
  "actionHash": "hex",
  "aud": "string",
  "purpose": "string",
  "authorSig": {
    "alg": "webauthn-es256",
    "credId": "base64url",
    "authenticatorData": "base64url",
    "clientDataJSON": "base64url",
    "signature": "base64url"
  }
}

Rules
	•	authorSig.alg MUST be "webauthn-es256" for PBI-SPEC-1.0.
	•	credId MUST identify a previously registered credential.
	•	authenticatorData, clientDataJSON, signature MUST be the raw values returned by the WebAuthn assertion, base64url encoded.
	•	Implementations MAY attach extra fields (e.g., meta, device, ipHint) but verifiers MUST ignore unknown fields when computing the receipt hash (see §2.5) unless the policy explicitly opts in.

⸻

2) Deterministic hashing + canonicalization

2.1 JSON Canonicalization (JCS)

PBI-SPEC-1.0 uses RFC 8785 JSON Canonicalization Scheme (JCS) for any object that is hashed.

Implementers MUST:
	•	serialize JSON with:
	•	lexicographically sorted object keys
	•	minimal whitespace
	•	UTF-8 encoding
	•	avoid NaN/Infinity and ambiguous number encodings

(If you already use a JCS library, use it. If not, you must exactly match RFC 8785 behavior.)

⸻

2.2 Action hash

actionHash = SHA-256( JCS(action) ) encoded as lowercase hex.

A verifier MUST recompute actionHash from the Action it believes is being authorized (or from the stored Action canonical form) and MUST require an exact match to the receipt’s actionHash.

⸻

2.3 Query normalization

If query is non-empty, it MUST be normalized to avoid ambiguity:
	•	parse into key/value pairs
	•	percent-decode then re-encode consistently
	•	sort by key, then by value
	•	join as k=v&k=v

(If you don’t need query in your action intent, set query to "".)

⸻

2.4 WebAuthn client data hash

Let:
	•	clientDataBytes = base64url_decode(receipt.authorSig.clientDataJSON)
	•	clientDataHash = SHA-256(clientDataBytes) (raw bytes)

WebAuthn signature base is:
	•	sigBase = authenticatorDataBytes || clientDataHash

⸻

2.5 Receipt hash (for storage / dedupe / audit)

receiptHash = SHA-256( JCS(receiptCore) ) as lowercase hex, where receiptCore is:
	•	the Receipt object excluding any non-core extension fields not defined in §1.3 (unless your verifier policy opts in).

This allows consistent dedupe and audit indexing even if implementations add optional metadata.

⸻

3) WebAuthn verification requirements

3.1 Parse + structural checks

Verifier MUST:
	•	base64url-decode authenticatorData, clientDataJSON, signature
	•	validate length constraints (e.g., authenticatorData MUST be ≥ 37 bytes for rpIdHash+flags+signCount)
	•	reject unknown ver or alg

3.2 clientDataJSON checks

After decoding JSON, verifier MUST enforce:
	•	type MUST equal "webauthn.get"
	•	challenge MUST equal the Receipt’s challenge exactly (string match)
	•	origin MUST be an allowed origin for the relying party (policy-defined)
	•	crossOrigin MUST be false unless explicitly allowed (default reject true)

3.3 authenticatorData checks

From authenticatorDataBytes:
	•	rpIdHash = bytes[0..32)
	•	flags = bytes[32]
	•	signCount = bytes[33..37) (big-endian u32)

Verifier policy SHOULD require:
	•	UP (User Presence) flag set
	•	optionally UV (User Verification) flag set (stronger)

Verifier MUST validate rpIdHash == SHA-256(rpId) for an allowed rpId (policy-defined).

3.4 Signature verification
	•	Algorithm: ECDSA P-256 with SHA-256
	•	Input: sigBase = authenticatorDataBytes || SHA-256(clientDataBytes)
	•	Signature: WebAuthn provides DER-encoded ECDSA signature bytes (base64url field)

Verifier MUST:
	•	look up the credential public key associated with credId (or otherwise obtain it via trusted enrollment)
	•	verify the DER signature over sigBase

⸻

4) Challenge lifecycle rules (anti-replay)

Verifier MUST enforce:
	•	challenge exists and matches challengeId
	•	challenge not expired (now < expiresAt)
	•	challenge unused (usedAt == null)
	•	stored actionHash, aud, and purpose for that challenge match the receipt’s values
	•	mark challenge used (set usedAt) atomically with accepting the receipt

⸻

5) API surface (minimal reference)

This spec does not force endpoints, but an interoperable minimal API typically has:
	•	POST /v1/pbi/challenge
	•	Input: Action
	•	Output: Challenge record (or the fields needed to run WebAuthn)
	•	POST /v1/pbi/verify
	•	Input: Receipt
	•	Output: decision + receiptHash + optional signed server attestation

⸻

6) Error codes (recommended)
	•	invalid_version
	•	invalid_encoding
	•	invalid_structure
	•	challenge_not_found
	•	challenge_expired
	•	challenge_used
	•	action_hash_mismatch
	•	aud_mismatch
	•	purpose_mismatch
	•	origin_not_allowed
	•	rpId_not_allowed
	•	webauthn_type_mismatch
	•	signature_invalid
	•	flags_policy_violation

⸻

7) Test vectors (format only; actual vectors next)

PBI-SPEC-1.0 test vectors will be published as JSON objects with:
	•	action + expected.actionHash
	•	challenge + expected.challengeB64url
	•	clientDataJSON (decoded JSON and base64url) + expected.clientDataHash
	•	rpId + expected.rpIdHash
	•	authenticatorData (bytes/base64url) + expected.flags + expected.signCount
	•	pubKeyJwk + signature + expected.signatureValid
	•	receipt + expected.receiptHash

