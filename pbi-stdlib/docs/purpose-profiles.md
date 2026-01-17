 (PBI-PROFILES-1.0)

PBI Purpose Profiles (PBI-PROFILES-1.0)

Why this exists

actionHash only protects you if the Action is complete and normalized. Purpose Profiles define required fields + formats + constraints so:
	•	you never forget to bind a critical value (amount, destination, tenant)
	•	your verifier can reject ambiguous actions before hashing/verifying
	•	policy tiers (UV required, tighter TTL, extra checks) become deterministic

⸻

Profile contract

A Purpose Profile defines:
	•	purpose: string (matches action.purpose)
	•	methods: allowed HTTP methods
	•	paths: allowed request paths (exact or pattern)
	•	requireUV: boolean (policy tier)
	•	requiredParams: exact keys that MUST exist in action.params
	•	paramRules: per-key rules (regex, min/max, enums)
	•	optional: normalize: how to normalize fields before hashing (if any)

Verifier rule: reject if Action fails profile validation, then compute actionHash.

⸻

Recommended default profiles

1) transfer (high-stakes)

Use for money/value movement.

Constraints
	•	requireUV: true
	•	method: POST
	•	path: /v1/phi/transfer (exact)
	•	requiredParams: to, amountPhi, nonce

Param rules
	•	to: ^phi_[a-zA-Z0-9]{6,128}$
	•	amountPhi: decimal string, no floats
	•	regex: ^(0|[1-9][0-9]*)(\.[0-9]{1,18})?$
	•	additional: > 0
	•	nonce: fixed-width or monotonic string
	•	recommended regex: ^[0-9]{8,32}$

⸻

2) withdraw (very high-stakes)

Constraints
	•	requireUV: true
	•	method: POST
	•	path: /v1/phi/withdraw
	•	required: to, amountPhi, nonce, network

Param rules
	•	network: enum, e.g. ["phi", "eth", "btc"] (whatever you support)
	•	to: network-specific pattern
	•	amount + nonce as above

⸻

3) admin_change (very high-stakes)

For role changes, permissions, key rotation approvals.

Constraints
	•	requireUV: true
	•	method: POST
	•	path: ^/v1/admin/
	•	required: targetId, changeType, change

Param rules
	•	changeType: enum (e.g. grant_role, revoke_role, rotate_key, set_limits)
	•	change: object (must be canonical JSON; avoid floats)

⸻

4) session_link (lower-stakes)

For linking devices, confirming sessions, non-monetary actions.

Constraints
	•	requireUV: optional
	•	method: POST
	•	path: /v1/portal/session/link
	•	required: sessionId, nonce

⸻

Canonical encoding rules (profiles)

Profiles SHOULD also specify:
	•	amounts as strings (never floats)
	•	normalized path (no trailing /)
	•	normalized query (or require query: "" and put everything in params)
	•	explicit aud always required

⸻

Verifier invariants updated

Receipt acceptance requires:
	1.	Action passes Purpose Profile validation
	2.	actionHash = sha256(JCS(action))
	3.	receipt.actionHash matches
	4.	WebAuthn checks pass
	5.	challenge lifecycle checks pass
	6.	UV/UP flags satisfy the profile tier