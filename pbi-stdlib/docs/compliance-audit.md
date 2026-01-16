## Compliance / Audit (Offline Verification)

PBI Packs are portable proof bundles that can be verified **offline** (no servers, no databases, no “trust me”).

A pack contains:
- **WebAuthn receipt(s)** (`receipts/*.json`)
- **Action(s)** the user authorized (`actions/*.json`)
- **Credential public key(s)** (`pubkeys/<credId>.jwk.json`)
- **Manifest** (`manifest.json`) describing:
  - file hashes (tamper-evident)
  - deterministic **packId** (content-addressable)
  - **Merkle root** over receipt hashes (scales to many receipts)
  - optional **prevPackId** (chain-of-custody)
  - **issuer signature** (publisher attestation)

### Verify a full pack

```bash
node dist/bin/pbi-pack-verify.js ../pbi-pack --trust ./trust.json
