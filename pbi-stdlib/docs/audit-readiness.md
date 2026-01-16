PBI Audit Readiness (PBI-ARP-1.0)

Purpose

This document defines:
	•	the audit scope for PBI,
	•	the minimal artifacts required to review it,
	•	the checklist of security properties that must hold,
	•	and the recommended engagement path for an external reviewer.

PBI is an authorization receipt primitive. The audit focus is correctness, binding, and replay resistance.

⸻

1) What should be audited (scope)

A. Receipt Verification Core (highest priority)
	•	WebAuthn assertion verification:
	•	clientDataJSON parsing and checks
	•	rpIdHash validation
	•	origin allowlist enforcement
	•	challenge binding enforcement
	•	ES256 signature verification correctness (DER parsing handled by crypto lib)
	•	canonicalization and hashing:
	•	action hash correctness
	•	canonicalization determinism
	•	rejection of ambiguous/unsafe values (non-finite numbers)
	•	failure-mode handling:
	•	reject-on-parse-failure
	•	reject unknown versions

B. Challenge Lifecycle (anti-replay)
	•	challenge issuance entropy and length
	•	TTL enforcement
	•	atomic “mark used”
	•	idempotency behavior (if supported)
	•	database constraints that prevent double acceptance

C. Multi-tenant boundary
	•	binding of aud and API key identity to:
	•	challenge records
	•	action hash scope
	•	verification decisions
	•	ensure “tenant confusion” is impossible

D. Logging / retention safety
	•	no raw secrets in logs
	•	challenge/receipt redaction
	•	storage of receipt hash and minimal audit fields

E. Enrollment security (credential registration)
	•	ensure attacker can’t register their own credential into victim’s account
	•	ensure credential rotation flow cannot be hijacked

⸻

2) What is out of scope (unless explicitly requested)
	•	full platform/browser compromise
	•	physical attacks on authenticators
	•	vendor-specific attestation chain validation (unless attestation-required mode is enabled)
	•	general web app security unrelated to receipt verification (marketing pages, static assets)

⸻

3) Minimal artifact bundle for auditors

Required docs
	•	Threat model: PBI-TM-1.0 (docs/threat-model.md)
	•	Spec: PBI-SPEC-1.0 (docs/spec.md)
	•	Security considerations: PBI-SC-1.0 (docs/security-considerations.md)
	•	This pack: PBI-ARP-1.0

Required code
	•	Reference verifier (TypeScript or server implementation)
	•	Canonicalization implementation or library + exact configuration
	•	Challenge store implementation:
	•	schema + transaction logic
	•	uniqueness constraints

Required test artifacts
	•	Test vectors: PBI-VEC-1.0 (test-vectors/pbi-vec-1.0.json)
	•	Unit tests that:
	•	validate the vectors
	•	include negative tests for replay, substitution, origin mismatch, rpId mismatch

Required operational config
	•	allowed origins list
	•	allowed rpId list
	•	policy tiers (UP/UV requirements by purpose)
	•	TTL defaults

⸻

4) Audit checklist (what “passing” means)

Verification correctness
	•	Signature verification fails if any byte of authenticatorData/clientDataJSON/signature changes
	•	Reject if clientDataJSON.type != webauthn.get
	•	Reject if clientDataJSON.challenge != stored challenge
	•	Reject if origin not in allowlist
	•	Reject if rpIdHash not in allowlist
	•	Enforce UP always; enforce UV when policy demands it

Binding correctness
	•	actionHash recomputed from canonical Action equals receipt actionHash
	•	aud and purpose match challenge record and policy tier
	•	no optional field omission creates ambiguous intent

Anti-replay correctness
	•	Expired challenges are rejected
	•	Used challenges are rejected
	•	Mark-used is atomic with acceptance
	•	concurrent verification calls cannot double-spend a challenge

Tenant boundary correctness
	•	Receipt from tenant A cannot be accepted under tenant B
	•	API key isolation holds (no cross-key confusion)

Logging/retention
	•	raw challenges and raw WebAuthn assertion fields are not logged
	•	receiptHash is stored and sufficient for audit indexing

⸻

5) Recommended external review path (fast + high value)

Phase 1: “Verification core review” (1–3 days)

Goal: confirm the verifier is correct and tight.
Deliverables:
	•	signed report identifying any verifier weaknesses or ambiguity vectors
	•	recommended fixes

Phase 2: “Challenge + DB correctness” (1–3 days)

Goal: confirm replay resistance is real under concurrency.
Deliverables:
	•	transaction / constraint review
	•	race condition analysis

Phase 3: “Enrollment + tenant boundary review” (2–5 days)

Goal: confirm the system cannot be hijacked via registration/rotation.
Deliverables:
	•	registration flow review
	•	tenant isolation review

⸻

6) Auditor FAQ (preempt the usual questions)

Q: Is this inventing new cryptography?
A: No. PBI composes WebAuthn ES256 signatures + deterministic canonical hashing into an auditable authorization receipt format.

Q: What’s the novel part?
A: The end-to-end binding: a signed ceremony that produces a portable receipt tied to a canonical action hash and a used-once challenge lifecycle, enabling offline verification and audit trails.

Q: What does PBI guarantee?
A: Under the threat model, that a specific authenticator authorized a specific action scope at a specific time window, and that the receipt cannot be forged or repurposed.

