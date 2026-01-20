# PBI Enterprise Rollout — 1-Page Implementation Guide (Day 0 → Day 7)

## What you’re deploying

**PBI (Presence-Bound Identity)** is a presence-bound verification primitive that:

* Issues **single-use challenges** tied to an **`actionHashHex`**
* Verifies **UP + UV** (User Presence + User Verification) via **WebAuthn**
* Mints **receipts** as durable, auditable evidence

**v1.4.0** adds:

* **Self-serve portal webhooks**
* **Portal evidence exports** for audit/compliance

---

## Day 0 (30–60 minutes): Get to first verified receipt

**Goal:** produce a real receipt and prove the evidence chain works end-to-end.

### 1) Create an API key

* **Portal → Console → Create API key**
* Store it securely (it’s **shown once**)

### 2) Run the attestation flow

Use:

* Your existing client, **or**
* The **Attester Tool**

Call:

```http
POST /v1/pbi/challenge
POST /v1/pbi/verify
```

Confirm you receive:

* `decision: PBI_VERIFIED`
* `receiptId`
* `receiptHashHex`

### 3) Confirm basic audit retrieval

```http
GET /v1/pbi/receipts              # list
GET /v1/pbi/receipts/{receiptId}  # detail
```

✅ **Done when:** a receipt exists that can be retrieved and validated.

---

## Day 1 (1–2 hours): Wire it into a real high-risk action

**Goal:** stop fraud on one high-value workflow immediately.

### Pick one critical action (start with the one bleeding now)

* Password reset
* Payout change
* Bank account update
* Admin role escalation
* Large transfer / withdrawal
* Device/session binding

### Implementation pattern

#### 1) Compute a stable `actionHashHex`

Compute from what matters (canonical JSON → SHA-256):

**Recommended fields**

* `userId`
* `actionType`
* Target identifiers (accountId, payoutId, etc.)
* Amount (if relevant)
* Risk metadata
* Timestamp bucket *(optional)*

Example shape (conceptual):

```json
{
  "userId": "u_123",
  "actionType": "payout_change",
  "target": { "payoutId": "po_789" },
  "risk": { "ip": "…", "device": "…", "riskScore": 72 },
  "bucket": "2026-01-19T00:00Z"
}
```

#### 2) Gate the action on PBI verification

* **Issue challenge**
* **Verify presence**
* **Commit action only when** `decision === PBI_VERIFIED`
* Persist `receiptId` in your audit trail for that action

✅ **Done when:** that high-risk operation is blocked unless PBI verifies.

---

## Day 3 (1–3 hours): Turn on Webhooks (real-time audit stream)

**Goal:** feed receipts into your security/ops stack automatically.

### 1) Configure webhook in Portal

* **Portal → Enterprise Controls → Webhooks**
* Add your endpoint URL
* Event: `receipt.created`
* Copy the secret (**shown once**)

### 2) Verify signature in your webhook receiver

**Headers**

* `X-PBI-Event`
* `X-PBI-Delivery-Id`
* `X-PBI-Timestamp`
* `X-PBI-Signature: v1=<hmac>`

**Signature base string**

```text
<timestamp>.<deliveryId>.<rawBody>
```

**HMAC**

```text
HMAC_SHA256(secret, baseString)
```

**Operational requirement**

* Store `deliveryId` and enforce **idempotency** (ignore duplicates safely)

✅ **Done when:** receipts arrive in your system in real time and verify correctly.

---

## Day 5 (30–90 minutes): Evidence exports for compliance / investigations

**Goal:** produce offline-verifiable evidence packs for auditors or incident response.

### Export from Portal

* **Portal → Compliance → Export evidence pack**
* Download last **24h** export (or specify a time window for large exports)

### Export pack includes

* `receipts.ndjson`
* `policy.snapshot.json`
* `manifest.json` *(canonical)*
* `manifest.sig.json` *(Ed25519)*
* `verification.json`
* `trust.snapshot.json` *(optional)*

✅ **Done when:** your team can export a signed pack and archive it for offline verification.

---

## Day 7 (half-day): Governance hardening

**Goal:** match enterprise policy expectations (least privilege + auditability).

### Scopes (least privilege)

Create keys scoped to purpose:

* `pbi.verify` *(runtime)*
* `pbi.read_receipts` *(audit readers)*
* `pbi.export` *(compliance only)*

### Key rotation

* **Portal → API Keys → Rotate**
* Replace old keys in your secrets manager
* Confirm **last-used tracking** updates

### Operational posture

* Rotate webhook secrets on schedule
* Confirm webhook retries succeed during endpoint downtime
* Confirm exports require time windows at large limits

✅ **Done when:** keys and exports are least-privilege, rotated, and audit-friendly.

---

## What “production complete” looks like

* ✅ One high-risk action gated by **PBI**
* ✅ Webhooks delivering `receipt.created` into your audit pipeline
* ✅ Regular evidence exports (daily/weekly) archived for compliance
* ✅ Scoped keys + rotation + last-used governance tracked
