# Upgrade guide (v1.2.0)

This release is fully backward compatible. Existing integrations continue to work without changes. Use the steps below to adopt the new enterprise capabilities.

## Receipts time windows + ordering

Use the new filters on `GET /v1/pbi/receipts` to paginate stable time windows:

```
GET /v1/pbi/receipts?createdAfter=2026-02-01T00:00:00Z&createdBefore=2026-03-01T00:00:00Z&order=asc&limit=100
```

* `createdAfter` is inclusive, `createdBefore` is exclusive.
* `order=asc` lists oldest-first; `order=desc` lists newest-first.
* `nextCursor` is opaque and stable across inserts (ordered by `created_at, id`).

## Webhooks: register + verify signatures

1) Create a webhook endpoint in the portal:

```
POST /v1/portal/webhooks
{
  "url": "https://example.com/pbi/webhook",
  "events": ["receipt.created"],
  "enabled": true
}
```

You will receive the secret **once** on creation or rotation.

2) Verify signatures on your endpoint:

* `X-PBI-Event`, `X-PBI-Delivery-Id`, `X-PBI-Timestamp`, `X-PBI-Signature`
* Signature base string: `<timestamp>.<deliveryId>.<rawBody>`
* Compute `HMAC-SHA256(secret, baseString)` and compare against `X-PBI-Signature` (strip `v1=`).

**Operational note:** set `PBI_WEBHOOK_SECRET_KEY` (base64, 32 bytes) to enable secret encryption for webhook endpoints.

## Export pack verification (offline)

1) Request a signed export pack:

```
GET /v1/pbi/receipts/export?createdAfter=2026-02-01T00:00:00Z&createdBefore=2026-03-01T00:00:00Z&limit=500
```

2) Validate the pack:

* Compute SHA-256 of each file and compare to `manifest.json`.
* Canonicalize `manifest.json` (JSON key ordering) and verify `manifest.sig.json` with the included public key.
* Parse `receipts.ndjson` line-by-line for `{ receipt, challenge }`.

**Operational note:** set `PBI_EXPORT_SIGNING_PRIVATE_KEY_PEM` (and optional `PBI_EXPORT_SIGNING_PUBLIC_KEY_PEM`) to enable pack signing.

## API key rotation + scopes

Rotate keys via the portal:

```
POST /v1/portal/api-keys/{id}/rotate
{ "keepOldActive": false }
```

Optional scopes can be set when creating keys:

* `pbi.verify`
* `pbi.read_receipts`
* `pbi.export` (required for `/v1/pbi/receipts/export`)
