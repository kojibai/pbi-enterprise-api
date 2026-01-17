# PBI Conformance (pbi-conf-1.0)

This folder contains the **PBI conformance suite**: a portable set of test vectors and a runner that proves whether a PBI receipt verifier is correct.

It is designed for:
- security reviewers
- partners integrating PBI receipts
- auditors verifying evidence outside your infrastructure
- third-party implementers building independent verifiers

The suite supports two modes:
1) **Internal**: runs against the reference verifier in this repo  
2) **External**: runs against any verifier that implements the stdin/stdout JSON contract (language-agnostic)

---

## What this conformance suite proves

For each test case, a correct verifier must:
- enforce **origin allowlisting**
- enforce **rpId allowlisting** (rpIdHash in authenticatorData)
- enforce `clientDataJSON.type === "webauthn.get"`
- enforce **challenge binding** (receipt.challenge must match clientData.challenge)
- enforce **flags policy** (UP/UV requirements)
- optionally recompute and enforce **actionHash**
- verify **WebAuthn ES256 signature** (DER ECDSA) over:
  `authenticatorData || sha256(clientDataJSON_bytes)`

A verifier passes conformance if it returns the expected decision code for all cases.

---

## Files

- `generate-vectors.ts`  
  Generates `pbi-conf-1.0.json` test vectors

- `run.ts`  
  Runs the conformance suite against:
  - internal verifier (default)
  - external verifier command (`--external`)

- `external-adapter.ts`  
  Reference external-verifier adapter implementing the stdin/stdout contract (useful for partners)

- `types.ts`  
  Vector + harness types

---

## Quickstart (recommended)

From the repo root:

```bash
rm -rf dist && npm run build
node dist/conformance/generate-vectors.js pbi-conf-1.0.json api.kojib.com https://pbi.kojib.com
node dist/conformance/run.js pbi-conf-1.0.json
node dist/conformance/run.js pbi-conf-1.0.json --external "node dist/conformance/external-adapter.js"
