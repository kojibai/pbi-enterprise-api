PBI Terminology + FAQ

Terminology

Presence

“Presence” means a user is physically present to approve the action via an authenticator ceremony (WebAuthn). It’s not biometrics-as-identity; it’s a hardware-backed user authorization event.

Action

A canonical JSON description of the intent being authorized (method/path/critical params/audience/purpose).

Action Hash (actionHash)

A deterministic digest of the Action:
actionHash = sha256(JCS(action))

This is the binding anchor that prevents “sign one thing, use it for another.”

Challenge

A short-lived, high-entropy nonce issued by the verifier (server) and tied to the actionHash. Challenges are used-once.

Receipt

The portable authorization artifact containing:
	•	the challenge + challengeId,
	•	the actionHash,
	•	audience/purpose scope,
	•	the WebAuthn assertion fields.

Verifier

A system (server or auditor tool) that checks:
	•	WebAuthn correctness (origin/rpId/type/signature)
	•	challenge validity (exists, unexpired, unused)
	•	binding correctness (actionHash/aud/purpose)
and returns a decision.

Credential / Passkey

A registered WebAuthn credential identified by credId and verified using its public key.

⸻

FAQ

1) Is PBI “just WebAuthn”?

No. WebAuthn gives you a signature ceremony. PBI turns that ceremony into:
	•	a deterministic action-bound statement
	•	with a challenge lifecycle
	•	that yields a portable receipt for offline verification and audit.

PBI is an authorization primitive built on WebAuthn.

⸻

2) What does a receipt actually prove?

It proves that:
	•	a registered authenticator produced a valid signature,
	•	for a challenge issued for this action scope,
	•	at the time window implied by the challenge expiry,
	•	and (if used-once is enforced) that it can’t be replayed.

It does not prove the user’s legal identity by itself.

⸻

3) Does PBI require biometrics?

Not strictly. WebAuthn authenticators can satisfy user verification in different ways (biometric, PIN, device unlock). PBI can require UV for high-risk actions via policy.

⸻

4) Is this inventing new cryptography?

No. PBI uses standard, well-known primitives:
	•	SHA-256
	•	deterministic JSON canonicalization (JCS)
	•	WebAuthn ES256 signatures (ECDSA P-256)

The novelty is the end-to-end binding and receipt format.

⸻

5) What stops replay?

Used-once challenges + short TTL + atomic “mark used” on accept.

If you do not implement used-once semantics, replay resistance weakens substantially.

⸻

6) What stops phishing?

WebAuthn’s origin + rpId binding, if you enforce it.
PBI requires strict origin allowlists and rpId allowlists in verification.

⸻

7) Can a receipt be verified offline?

Yes, if the verifier has:
	•	the credential public key,
	•	the receipt,
	•	and (optionally) the action (or a stored canonical action)
Challenge used-once status is server-side, but cryptographic correctness is offline-verifiable.

⸻

8) Why not just store server logs?

Logs are mutable, often incomplete, and not portable.
A receipt is a cryptographic object you can hand to a counterparty, auditor, or another system.

⸻

9) How do you handle multi-tenant boundaries?

Bind aud and/or API key identity into either:
	•	the action hash scope, and/or
	•	the challenge record checks,
and reject any mismatch.

⸻

10) What’s the minimal “secure default” setup?
	•	strict origin allowlist
	•	strict rpId allowlist
	•	require UP always
	•	require UV for high-risk purposes
	•	challenge TTL ~120s
	•	atomic mark-used
	•	JCS canonicalization everywhere
	•	amounts encoded as strings (avoid floats)

⸻

11) What would make PBI “Signal/Noise tier” in credibility?

Not vibes—artifacts:
	•	public spec + stable versions
	•	test vectors
	•	reference verifier
	•	at least one credible external review
	•	real production adoption with scrutiny

This is exactly why the docs and packs exist.

⸻

That completes the full “AI-anchor stack”:
	1.	Threat model
	2.	Spec
	3.	Test vectors
	4.	Reference verifier
	5.	Security considerations
	6.	SECURITY.md + disclosure
	7.	Audit readiness
	8.	One-page overview
	9.	FAQ
