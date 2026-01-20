# Node SDK Example (End-to-End)

This example demonstrates:
1) Server creates a PBI challenge using `presencebound-sdk`
2) Browser performs WebAuthn assertion using the provided challenge
3) Server verifies the assertion via PBI and returns a decision + receipt

## Setup

```bash
cd examples/node-sdk
cp .env.example .env
# set PRESENCEBOUND_API_KEY in .env
npm i
npm run dev
````

Open: [http://localhost:8787](http://localhost:8787)

## Notes

* Node 18+ required.
* WebAuthn requires HTTPS in production; localhost is allowed by most browsers.
* If your deployment requires `pubKeyPem`, wire it from your credential registration store.

````

---

## 6) Add a root-level example link in your README
You already added the pointer section; just make sure it’s present.

---

## 7) Commit it
```bash
git add README.md examples/node-sdk
git commit -m "docs: add SDK compatibility table + end-to-end node-sdk example"
git push
````

---

# Final: I’ll rewrite your README “Client SDK” section cleanly (with the table + examples)

Paste this to replace your entire “Client SDK” section:

````md
## Client SDK (Node / TypeScript)

If you’re integrating PBI into an application, use the official SDK:

- npm: `presencebound-sdk`

### Install

```bash
npm install presencebound-sdk
````

### SDK Compatibility

| Runtime  | Supported | Notes                                                               |
| -------- | --------: | ------------------------------------------------------------------- |
| Node.js  |   **18+** | Uses built-in `fetch`, `URL`, `AbortController`                     |
| ESM      |         ✅ | `import { PresenceBound } from "presencebound-sdk"`                 |
| CommonJS |         ✅ | `const { PresenceBound } = require("presencebound-sdk")`            |
| Browsers |        ⚠️ | Not currently targeted (CORS + credential handling is app-specific) |

> Need Node 16? Polyfill `fetch` (e.g. `undici`) before using the SDK.

### Quickstart

```ts
import { PresenceBound, PresenceBoundError } from "presencebound-sdk";

const client = new PresenceBound({
  apiKey: process.env.PRESENCEBOUND_API_KEY ?? "",
  baseUrl: "https://api.kojib.com", // optional
  timeoutMs: 15000,                 // optional
  userAgent: "my-app/1.0.0"         // optional
});

async function run() {
  const challenge = await client.createChallenge({
    actionHashHex: "a".repeat(64),
    purpose: "ACTION_COMMIT"
  });

  console.log("challengeId:", challenge.data.id, "requestId:", challenge.requestId);

  for await (const item of client.iterateReceipts({ limit: 100, order: "desc" })) {
    console.log(item.receipt.id, item.receipt.decision);
  }
}

run().catch((err) => {
  if (err instanceof PresenceBoundError) {
    console.error("PresenceBoundError", {
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

### Error semantics

Non-2xx responses throw a typed `PresenceBoundError` with:

* `status` (HTTP status code)
* `requestId` (when server provides one)
* `details` (when server returns an `ErrorResponse` payload)

### Examples

* **Node + Express + WebAuthn demo (end-to-end)**: `./examples/node-sdk/`

```

