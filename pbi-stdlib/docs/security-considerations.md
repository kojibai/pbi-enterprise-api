PBI Security Considerations (PBI-SC-1.0)

This document lists the real-world security pitfalls and the recommended defaults for deploying PBI safely in production. It’s written to be blunt and operational.

1) WebAuthn is the root of trust

PBI receipts are only as strong as:
	•	the platform’s WebAuthn implementation,
	•	the authenticator’s key protection,
	•	your RP ID / origin validation.

You MUST validate:
	•	clientDataJSON.type == "webauthn.get"
	•	clientDataJSON.challenge equals the server-issued challenge
	•	clientDataJSON.origin is allowlisted
	•	authenticatorData.rpIdHash == sha256(rpId) for an allowlisted rpId
	•	WebAuthn ES256 signature verifies for the registered credential public key

If any of these checks are weakened, the system becomes “sign-anything” theater.

⸻

2) Phishing: origin + rpId checks are non-negotiable

A common failure mode is verifying signatures but not enforcing origin/rpId properly.

Default stance (recommended):
	•	Allowlist exact origins (no wildcards), e.g. https://pbi.kojib.com
	•	Allowlist exact RP IDs you control, e.g. api.kojib.com
	•	Reject crossOrigin: true unless you have a very specific reason

This is the primary defense against lookalike sites tricking users into signing.

⸻

3) Replay prevention must be atomic

PBI is strongest when a receipt is used-once.

You MUST implement:
	•	challenge TTL (short; e.g. 60–300 seconds)
	•	“mark used” atomically with verification success (single DB transaction / compare-and-set)
	•	reject if usedAt != null

If you don’t mark used atomically, a race can allow multiple acceptances of the same receipt.

⸻

4) Canonicalization ambiguity will wreck action binding

Your security guarantee depends on every verifier computing the same actionHash.

Rules:
	•	Use one canonicalization scheme (JCS/RFC 8785) and document it.
	•	Avoid floating numbers in intent payloads. Represent amounts as strings.
	•	Normalize query strings (or set query: "" and keep intent entirely in params).
	•	Version your action schema (ver: "pbi-action-1.0") and bump on changes.

If the hash is ambiguous, attackers can sign one meaning and replay it as another.

⸻

5) “What exactly is being authorized?” must be obvious

Your strongest defense against consent confusion is making the signed statement unambiguous.

Recommended action scope includes:
	•	tenant/audience (aud)
	•	purpose (purpose)
	•	method + path
	•	critical parameters (amount, destination, permission set, resource ID)
	•	nonce or deterministic idempotency key (when applicable)

If you omit a field that changes the meaning, you created a substitution vector.

⸻

6) Flags policy: UP/UV tradeoffs

WebAuthn authenticatorData.flags:
	•	UP = user presence
	•	UV = user verification (PIN/biometric, depending on platform)

Recommended defaults:
	•	Require UP always.
	•	Require UV for high-risk actions (money movement, key export, admin operations).
	•	Log (but don’t expose) whether UV was present for auditing.

Don’t require UV for everything if you’ll break legitimate flows; treat it as a policy tier.

⸻

7) Attestation: powerful but privacy-costly

Attestation can constrain allowed devices, but it introduces:
	•	privacy leakage (device model/attestation chain patterns),
	•	policy complexity,
	•	availability risks (vendor quirks).

Recommended stance:
	•	Default: no attestation requirement.
	•	Optional: allow enterprise customers to enable an “attestation-required” policy for specific purposes.

Treat attestation as a deployment mode, not a core requirement.

⸻

8) Enrollment is where many systems actually break

If an attacker can register their own credential into a victim’s account, PBI will faithfully verify the attacker.

Enrollment best practices:
	•	Rate limit registration and link it to an authenticated session
	•	Require a second factor / verified channel (email link, existing device, admin approval) for sensitive accounts
	•	Store credential public keys and metadata immutably (append-only audit)
	•	Consider “credential rotation” flows with explicit ceremony + receipt

⸻

9) Logging and data retention: don’t leak challenges/receipts

Challenges and receipts are sensitive. Leaks enable replay attempts, correlation, and forensic confusion.

Do NOT log:
	•	raw challenges
	•	raw clientDataJSON
	•	raw authenticator assertions
	•	raw receipts

Do log (safe):
	•	challengeId
	•	receiptHash (sha256 of canonical receipt)
	•	decision code
	•	timestamps
	•	tenant + purpose
	•	high-level flags (UP/UV) if helpful

Retention: keep full receipts only if you truly need long-term audit. Prefer storing hashes plus minimal audit fields.

⸻

10) Multi-tenant and API key boundary issues

Many real attacks are “confusion” bugs across tenants.

You MUST bind and verify:
	•	aud (tenant/customer)
	•	purpose (policy bucket)
	•	API key identity (if multi-tenant API)
inside the actionHash scope or via strict challenge record checks (or both).

⸻

11) Time handling

Expiration is security logic. Treat time carefully:
	•	use server time, not client time
	•	store expiresAt as RFC3339 with timezone
	•	reject invalid dates (don’t “best effort” parse)
	•	keep TTL short

⸻

12) Availability / abuse controls

PBI endpoints are valuable targets for:
	•	DoS (challenge flooding),
	•	enumeration (account/email probing),
	•	cost attacks.

Recommended controls:
	•	per-IP + per-API-key rate limits
	•	generic error messages for existence checks
	•	quotas and metering for issuance + verification
	•	strict payload size limits (especially clientDataJSON / authenticatorData)

⸻

13) What PBI does NOT protect you from

Be explicit to avoid false security assumptions:
	•	fully compromised client device/OS
	•	coercion/social engineering (“sign this or else”)
	•	a user intentionally authorizing the wrong thing
	•	server-side policy bugs that accept wrong actions

PBI reduces ambiguity and raises the cryptographic bar; it doesn’t replace product security hygiene.

⸻

14) Recommended default policy (good baseline)
	•	origins: exact allowlist
	•	rpIds: exact allowlist
	•	requireUP: true
	•	requireUV: false by default, true for high-risk purposes
	•	challenge TTL: 120s
	•	used-once: atomic mark-used
	•	canonicalization: JCS everywhere
	•	amounts/precision values: strings
	•	no attestation by default

⸻

15) Versioning

This document applies to PBI-SC-1.0. Any change to:
	•	canonicalization rules,
	•	action scoping,
	•	rpId/origin policy,
	•	challenge lifecycle,
requires a version bump.
