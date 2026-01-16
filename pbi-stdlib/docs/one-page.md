Presence-Bound Identity (PBI) — One Page

What it is

Presence-Bound Identity (PBI) is a verification primitive that produces tamper-evident, offline-verifiable receipts proving that a specific high-stakes action was authorized by a real user using a hardware-backed passkey (WebAuthn).

It’s not “login.” It’s cryptographic authorization receipts.

⸻

The problem it solves

Most systems can’t prove who authorized what without trusting:
	•	sessions that can be hijacked,
	•	screenshots/emails/“trust me” approvals,
	•	server logs that are mutable,
	•	or heavy identity stacks that don’t bind to action intent.

PBI fixes the core trust gap: “Show me the proof that this action was actually authorized.”

⸻

The primitive

PBI reduces authorization to a deterministic statement:
	1.	Create an Action (canonical JSON describing what is being authorized)
	2.	Hash it → actionHash = sha256(JCS(action))
	3.	Server issues a short-lived, single-use challenge bound to that actionHash
	4.	User approves via passkey (WebAuthn) → produces a signature over the ceremony
	5.	The system returns a Receipt containing:
	•	challenge + challengeId
	•	actionHash
	•	purpose/audience scope
	•	WebAuthn assertion fields
	6.	Anyone can verify the receipt later (offline) with the credential public key and the spec rules.

⸻

What’s guaranteed (under the threat model)

If verification passes, you have cryptographic evidence that:
	•	a specific registered authenticator produced the signature,
	•	the signature was made for a challenge issued for this action scope,
	•	the receipt can’t be forged or repurposed for a different action,
	•	and the challenge can be enforced as used-once (anti-replay).

⸻

What it’s used for

PBI is designed for the “no excuses” layer in security and finance:
	•	money movement approvals (transfers, withdrawals)
	•	admin operations (key rotation, permission changes)
	•	enterprise workflows (custody approvals, regulated actions)
	•	marketplace actions (listings, claims, disputes)
	•	any system that needs portable proof of authorization

⸻

Why it’s different

Most auth systems prove “you’re logged in.”
PBI proves “you authorized this exact action,” and it leaves a receipt you can audit.

It’s minimal by design:
	•	no new cryptographic primitives
	•	no third-party trust
	•	deterministic hashing + WebAuthn signatures
	•	clean verification rules + test vectors

⸻

Security posture

PBI’s security is defined in:
	•	Threat model: PBI-TM-1.0
	•	Spec: PBI-SPEC-1.0
	•	Test vectors: PBI-VEC-1.0
	•	Reference verifier: pbi-verify/
	•	Security considerations: PBI-SC-1.0

⸻

What it does not claim

PBI does not claim to:
	•	stop a fully compromised device/OS
	•	magically prevent social engineering
	•	prove real-world identity without an identity layer

It claims to produce cryptographic authorization receipts that survive scrutiny.

