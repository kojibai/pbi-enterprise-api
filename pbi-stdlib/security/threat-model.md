PBI Threat Model (PBI-TM-1.0)

What PBI is

Presence-Bound Identity (PBI) is a verification primitive that produces tamper-evident, offline-verifiable receipts proving that a specific action was authorized by a real user using a hardware-backed authenticator (passkey/WebAuthn), under a clearly scoped challenge and policy.

PBI’s goal is not “account login.” It is action authorization with cryptographic receipts.

⸻

Security goals

G1 — Unforgeable authorization receipts

An attacker must not be able to create a valid receipt without a legitimate user’s authenticator signing the correct challenge for the correct action scope.

G2 — Binding to action intent

A receipt must be bound to an action hash (and any required context) so it cannot be replayed to authorize a different action.

G3 — Freshness + replay resistance

A receipt must be tied to a unique, expiring challenge and (optionally) server-side used-once tracking so a captured receipt can’t be replayed indefinitely.

G4 — Minimal trust surface

PBI should introduce no new trusted third parties beyond:
	•	the user’s authenticator (hardware/secure enclave),
	•	the platform WebAuthn implementation,
	•	the relying party server that issues challenges and verifies receipts.

G5 — Auditability

Receipts should be independently verifiable later (by the issuer, a counterparty, or an auditor) using public keys + canonicalized payload rules.

⸻

Non-goals (explicit)

N1 — Device compromise

If the user’s device/OS/browser is fully compromised, PBI cannot guarantee intent. Malware can trick users or trigger signing flows.

N2 — Social engineering prevention

PBI does not magically stop consent to the wrong thing. It reduces ambiguity by binding the signed statement to an action hash, but UX and policy still matter.

N3 — Identity “truth”

PBI proves “this authenticator authorized this action,” not “this human’s real-world identity is X.” (That’s a separate layer.)

N4 — Perfect privacy

Depending on deployment choices (attestation, metadata, logs), PBI may leak some device or usage information. Privacy is configurable but not absolute by default.

⸻

Assets to protect
	•	Challenge (random, single-use, expiring)
	•	Action hash (canonical digest of what’s being authorized)
	•	Authenticator public key (registered credential)
	•	Receipt (signed statement + verification context)
	•	Server state (challenge issuance + “used” marking + rate limiting)
	•	API key/customer boundary (multi-tenant separation)

⸻

Actors
	•	Legitimate user with a registered passkey
	•	Relying party (RP) issuing challenges and verifying receipts
	•	Attacker (remote, phishing, bot, insider, or network adversary)
	•	Auditor/verifier (optional third party verifying receipts later)

⸻

Attacker capabilities assumed

PBI assumes attackers may:
	•	intercept or modify network traffic (MITM) unless TLS is properly used,
	•	scrape client-side code and simulate clients,
	•	obtain leaked receipts/challenges from logs/screenshots/user error,
	•	spam endpoints (DoS / credential stuffing / enumeration),
	•	attempt replay, substitution, and cross-tenant abuse,
	•	attempt to register rogue credentials if enrollment is weak.

PBI does not assume attackers can:
	•	extract private keys from secure authenticators at scale (hardware-backed keys),
	•	forge WebAuthn signatures without the authenticator.

⸻

Trust assumptions

PBI relies on:
	•	WebAuthn signature correctness for the registered credential public key,
	•	the RP challenge generator producing high-entropy challenges,
	•	correct canonicalization rules for action hashing (no ambiguity),
	•	the RP correctly scoping and validating the action context,
	•	TLS being used correctly between client and RP.

Optional trust assumptions (deployment-dependent):
	•	Attestation (if used) is only as strong as your policy; it can exclude devices but can also reduce privacy.

⸻

Primary threats and mitigations

T1 — Receipt forgery

Threat: attacker generates a “valid-looking” receipt without a real authenticator.
Mitigation: verify WebAuthn signature against stored credential public key; reject unknown cred IDs; enforce origin/rpId checks; strict parsing.

⸻

T2 — Action substitution (“sign this, use it for that”)

Threat: user signs something, attacker tries to apply it to a different action.
Mitigation: bind receipt to an action_hash derived from a canonical payload (method, path, critical params, amounts, audience, tenant, expiry). Verification recomputes and must match.

⸻

T3 — Replay of receipts/challenges

Threat: attacker reuses a valid receipt to repeat the same action (or later).
Mitigation: challenge includes expiration; server marks challenge as used; store receipt hash; enforce nonce/used-once semantics; optionally include server-issued “receipt id” and strict TTL.

⸻

T4 — Cross-tenant replay / confusion

Threat: receipt from tenant A used against tenant B or different API key.
Mitigation: include aud / tenant_id / api_key_id in action hash scope; enforce at verification time.

⸻

T5 — Phishing / wrong-origin ceremony

Threat: attacker tricks user into signing on a lookalike site.
Mitigation: WebAuthn binds to RP ID/origin; enforce rpId/origin validation; keep UX showing explicit action intent; avoid embedding “sign anything” flows.

⸻

T6 — Canonicalization ambiguity

Threat: different JSON/param order leads to different hashes; attacker exploits alternate encoding.
Mitigation: define one canonicalization method (e.g., JCS-style) and treat any non-canonical input as invalid; include test vectors.

⸻

T7 — Challenge prediction / weak entropy

Threat: attacker predicts challenges, precomputes receipts, or races.
Mitigation: cryptographically secure random challenges; minimum length; rotate secrets; rate-limit issuance.

⸻

T8 — Abuse / DoS / enumeration

Threat: attackers flood challenge issuance, probe emails/tenants, or brute endpoints.
Mitigation: rate limit by IP + API key; require API key for issuance; generic error messages; usage metering; captcha only if needed (prefer not).

⸻

T9 — Insider / log leakage

Threat: internal logs leak challenges/receipts.
Mitigation: never log raw challenges/credential assertions; redact; store hashes; least-privilege access; short TTL.

⸻

Security invariants (must always be true)
	•	A receipt is valid only if:
	1.	signature verifies for the registered credential public key,
	2.	origin/rpId checks pass,
	3.	challenge exists, is unexpired, and unused,
	4.	action_hash recomputes exactly and matches receipt scope,
	5.	tenant/audience match,
	6.	policy checks pass (rate limits, allowlists, etc.).

⸻

What to monitor
	•	invalid signature rate spikes (forgery attempts)
	•	replay attempts / used challenge hits
	•	unusual issuance volume (DoS)
	•	cross-tenant mismatch attempts
	•	canonicalization mismatch errors (possible client tampering)

⸻

Versioning

This threat model applies to PBI-TM-1.0. Any change to:
	•	action hashing scope,
	•	canonicalization rules,
	•	challenge lifecycle,
	•	rpId/origin policy,
must bump the version.

⸻
