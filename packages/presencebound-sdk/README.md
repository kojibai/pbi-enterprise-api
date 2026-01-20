# PresenceBound SDK

TypeScript SDK for the PresenceBound Enterprise API.

## Install

```bash
npm install presencebound-sdk
```

## Usage

```ts
import { PresenceBound } from "presencebound-sdk";

const client = new PresenceBound({
  apiKey: process.env.PRESENCEBOUND_API_KEY ?? "",
  baseUrl: "https://api.kojib.com",
  timeoutMs: 15000,
  userAgent: "my-app/1.0.0"
});

const challenge = await client.createChallenge({
  actionHashHex: "a".repeat(64),
  purpose: "ACTION_COMMIT"
});

console.log("Challenge:", challenge.data.id, "requestId:", challenge.requestId);

const receipts = client.iterateReceipts({ limit: 50 });
for await (const receipt of receipts) {
  console.log(receipt.receipt.id);
}
```

## Features

- Typed methods for challenge, verify, receipts, and billing endpoints.
- Automatic `Authorization: Bearer <apiKey>` header.
- Async iterator helper for receipt pagination.
- Typed errors with optional `requestId` when present.
