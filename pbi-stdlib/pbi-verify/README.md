# pbi-verify

Offline verification tooling for **PBI Packs** (Presence-Bound Identity proof bundles).

This package ships CLIs that can:
- verify a full pack folder (`pbi-pack-verify`)
- verify a single portable proof file (`pbi-pack-verify --proof ...`)
- seal/refresh a pack manifest + issuer signature + proofs (`pbi-pack-seal`)
- run an end-to-end compliance demo (`pbi-pack-demo`)

Everything is verifiable **offline**. No servers, no database, no “trust me”.

---

## What is a PBI Pack?

A **PBI Pack** is a portable folder containing:
- WebAuthn receipt(s) (ES256) proving user presence/verification
- the action(s) the user authorized
- the credential public key(s)
- a `manifest.json` that provides:
  - file hashes (tamper evidence)
  - deterministic **packId** (content addressing)
  - **Merkle root** for scalable inclusion proofs
  - optional `prevPackId` for chain-of-custody
  - **issuer signature** verified against a trust policy (`trust.json`)

### Why it matters

You can hand a pack (or a single proof file) to:
- compliance/audit
- a partner organization
- an air-gapped reviewer
- legal/dispute resolution

…and they can verify cryptographic truth without trusting your infrastructure.

---

## Install / Build

```bash
npm install
npm run build
````

Node: `>=18`

---

## Verify a full pack

```bash
node dist/bin/pbi-pack-verify.js ../pbi-pack --trust ./trust.json
```

Output includes:

* `trustMode`
* `issuerKeyId`
* `issuerSigVerified`
* `packId`
* `prevPackId`
* `merkleRoot`
* per-receipt verification results

---

## Verify a single portable proof

PBI Packs include `proofs/<id>.proof.json` which contains:

* receipt + action + pubkey
* Merkle inclusion path (leaf→root)
* the signed manifest

Verify offline:

```bash
node dist/bin/pbi-pack-verify.js --proof ../pbi-pack/proofs/0001.proof.json --trust ./trust.json
```

---

## Seal a pack

```bash
node dist/bin/pbi-pack-seal.js --dir ../pbi-pack --privkey ./issuer-es256-private.pem
```

Chain-of-custody successor:

```bash
# zsh note: do NOT paste <PACK_1_ID> literally (it's shell redirection)
node dist/bin/pbi-pack-seal.js --dir ../pbi-pack-2 --privkey ./issuer-es256-private.pem --prevPackId PACK_1_ID_HEX
```

---

## Trust policy

Verification trust is controlled by `trust.json` (`pbi-trust-1.0`):

* multiple issuer keys (rotation)
* revocation by keyId
* validity windows (notBefore/notAfter)
* optional issuer constraints (name/aud)

If an issuer key is revoked or expired, verification fails hard.

---

## One-command compliance demo

This runs:

* pack-1 seal + verify
* pack-2 seal with prevPackId (chain) + verify
* proof verification
* negative controls:

  * revocation fails
  * expiry fails

```bash
npm run demo
```

---

## Pack folder layout (pbi-pack-1.1)

```text
pbi-pack/
  manifest.json

  receipts/
    0001.json
    0002.json

  actions/
    0001.json
    0002.json

  pubkeys/
    <credId>.jwk.json

  proofs/
    0001.proof.json
    0002.proof.json
```
