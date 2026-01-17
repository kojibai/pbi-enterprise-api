Security posture: PBI is an authorization receipt primitive built on standard WebAuthn ES256 signatures and deterministic hashing. Security properties are defined in our Threat Model (PBI-TM-1.0) and Specification (PBI-SPEC-1.0), supported by published Test Vectors (PBI-VEC-1.0) and a Reference Verifier implementation.

PBI focuses on unforgeable, action-bound receipts and used-once challenge replay resistance. It does not claim to protect against fully compromised client devices or user coercion.

We welcome coordinated disclosure; see SECURITY.md.