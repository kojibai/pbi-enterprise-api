# PresenceBound SDK (`presencebound-sdk`)

TypeScript/JavaScript SDK for the **PresenceBound Enterprise API** (PBI).  
Works in **Node.js (ESM + CJS)** and ships fully-typed `.d.ts` definitions.

- ✅ Dual build: ESM + CommonJS
- ✅ Typed request/response models
- ✅ Built-in pagination iterator for receipts
- ✅ Structured errors (`PresenceBoundError`) with optional `requestId`
- ✅ No runtime dependencies

---

## Install

```bash
npm install presencebound-sdk
````

---

## Requirements

* **Node.js 18+** (uses built-in `fetch`, `URL`, `AbortController`)

> If you need Node 16 support, you can polyfill fetch (e.g. `undici`) before using the client.

---

## Quick Start

```ts
import { PresenceBound, PresenceBoundError } from "presencebound-sdk";

const client = new PresenceBound({
  apiKey: process.env.PRESENCEBOUND_API_KEY ?? "",
  baseUrl: "https://api.kojib.com",
  timeoutMs: 15000,
  userAgent: "my-app/1.0.0"
});

async function main() {
  const challenge = await client.createChallenge({
    actionHashHex: "a".repeat(64),
    purpose: "ACTION_COMMIT"
  });

  console.log("Challenge ID:", challenge.data.id);
  console.log("requestId:", challenge.requestId);

  // ...use the challenge in WebAuthn verification flow...
}

main().catch((err) => {
  if (err instanceof PresenceBoundError) {
    console.error("PresenceBoundError:", {
      status: err.status,
      requestId: err.requestId,
      message: err.message,
      details: err.details
    });
    process.exit(1);
  }
  throw err;
});
```

---

## API Overview

The SDK exposes a single client:

```ts
import { PresenceBound } from "presencebound-sdk";
```

### Constructor

```ts
const client = new PresenceBound({
  apiKey: "YOUR_API_KEY",
  baseUrl: "https://api.kojib.com", // optional
  timeoutMs: 15000,                 // optional
  userAgent: "my-app/1.0.0"         // optional
});
```

**Options**

* `apiKey` *(required)*: Your PresenceBound API key.
* `baseUrl` *(optional)*: Defaults to `https://api.kojib.com`.
* `timeoutMs` *(optional)*: Request timeout (default `15000`).
* `userAgent` *(optional)*: Adds a `User-Agent` header when provided.

---

## Endpoints

### Create Challenge

```ts
const res = await client.createChallenge({
  actionHashHex: "a".repeat(64),
  purpose: "ACTION_COMMIT"
});

console.log(res.data.id, res.data.challengeB64Url, res.data.expiresAtIso);
```

**Request type:** `ChallengeRequest`
**Response type:** `ApiResponse<ChallengeResponse>`

---

### Verify Challenge

After completing WebAuthn in your app, send the assertion bundle:

```ts
const res = await client.verifyChallenge({
  challengeId: "ch_...",
  assertion: {
    authenticatorDataB64Url: "...",
    clientDataJSONB64Url: "...",
    signatureB64Url: "...",
    credIdB64Url: "...",
    pubKeyPem: "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
  }
});

console.log(res.data.ok, res.data.decision, res.data.receiptId);
```

**Request type:** `VerifyRequest`
**Response type:** `ApiResponse<VerifyResponse>`

---

### List Receipts (paged)

```ts
const res = await client.listReceipts({
  limit: 50,
  order: "desc",
  purpose: "ACTION_COMMIT"
});

console.log("count:", res.data.receipts.length);
console.log("nextCursor:", res.data.nextCursor);
```

**Params type:** `ReceiptListParams`
**Response type:** `ApiResponse<ReceiptListResponse>`

---

### Iterate Receipts (auto-pagination)

Use the async generator to stream through pages:

```ts
for await (const item of client.iterateReceipts({ limit: 100, order: "desc" })) {
  console.log(item.receipt.id, item.receipt.decision);
}
```

**Yields:** `ReceiptWithChallenge`

---

### Get Receipt by ID

```ts
const res = await client.getReceipt("rcpt_...");
console.log(res.data.receipt.id, res.data.receipt.receiptHashHex);
```

**Response type:** `ApiResponse<ReceiptResponse>`

---

### Verify Receipt (integrity check)

```ts
const res = await client.verifyReceipt({
  receiptId: "rcpt_...",
  receiptHashHex: "..." // expected hash
});

console.log(res.data.ok, res.data.receipt.decision);
```

**Request type:** `ReceiptVerifyRequest`
**Response type:** `ApiResponse<ReceiptVerifyResponse>`

---

### Export Receipts (ZIP)

```ts
const res = await client.exportReceipts({
  limit: 5000,
  createdAfter: "2026-01-01T00:00:00.000Z",
  order: "asc"
});

await Bun.write("pbi-export.zip", res.data); // Bun example
// or Node:
import { writeFileSync } from "node:fs";
writeFileSync("pbi-export.zip", Buffer.from(res.data));
```

**Params type:** `ReceiptExportParams`
**Response type:** `ApiResponse<Uint8Array>`

---

### Billing: Usage

```ts
// month is optional, format "YYYY-MM"
const res = await client.getUsage("2026-01");
console.log(res.data.month, res.data.usage);
```

**Response type:** `ApiResponse<UsageResponse>`

---

### Billing: Invoices

```ts
const res = await client.listInvoices();
console.log(res.data.invoices.length);
```

**Response type:** `ApiResponse<InvoicesResponse>`

---

## Errors

All non-2xx responses throw `PresenceBoundError`.

```ts
import { PresenceBoundError } from "presencebound-sdk";

try {
  await client.listReceipts({ limit: 10 });
} catch (e) {
  if (e instanceof PresenceBoundError) {
    console.error("status:", e.status);
    console.error("requestId:", e.requestId);
    console.error("message:", e.message);
    console.error("details:", e.details); // { error: string; issues?: ... } when available
  }
}
```

---

## Type Exports

The SDK re-exports all public types from `types.ts`:

```ts
import type { ReceiptListParams, VerifyResponse, Purpose } from "presencebound-sdk";
```

---

## Development

```bash
npm run build
npm run test
npm run typecheck
```

Build output is emitted to `dist/` via `tsup` (ESM + CJS + `.d.ts`).


