# PBI Enterprise API (v1)

[![Version](https://img.shields.io/badge/version-v1-0ea5e9.svg)](https://github.com/kojibai/pbi-enterprise-api)
[![Status](https://img.shields.io/badge/status-operational-22c55e.svg)](https://pbi.kojib.com/status)
[![CI](https://github.com/kojibai/pbi-enterprise-api/actions/workflows/ci.yml/badge.svg)](https://github.com/kojibai/pbi-enterprise-api/actions/workflows/ci.yml)
[![gitleaks](https://github.com/kojibai/pbi-enterprise-api/actions/workflows/gitleaks.yml/badge.svg)](https://github.com/kojibai/pbi-enterprise-api/actions/workflows/gitleaks.yml)
[![License: AGPL-3.0-or-later](https://img.shields.io/badge/License-AGPL--3.0--or--later-2ea44f.svg)](./LICENSE-AGPL-3.0.txt)
[![Commercial License](https://img.shields.io/badge/License-Commercial-blueviolet.svg)](./COMMERCIAL_LICENSE.md)

Enterprise-grade API for **Presence-Bound Identity (PBI)** — a strict trust primitive for **irreversible actions**.

**What it does**
- Issues **action/artifact-bound challenges** (single-use + expiry)
- Verifies **presence attestation bundles** (WebAuthn assertion + UP+UV)
- Emits **receipts** (`receiptHash`) for audit, disputes, and chain-of-custody
- Tracks **usage** and supports **monthly invoicing** workflows

**What it does NOT do**
- No KYC
- No biometric storage
- No end-user account database (unless you build mapping on top)
- No “soft approvals” — you must enforce `PBI_VERIFIED` in your app

---

## Links

- Category site: https://presencebound.com
- Product: https://pbi.kojib.com
- Trust Center: https://pbi.kojib.com/trust
- Status: https://pbi.kojib.com/status
- API Docs: https://api.kojib.com/docs
- OpenAPI (repo): `./openapi.yaml`

---

## Client SDK (Node / TypeScript)

If you’re integrating PBI into an application, use the official SDK:

- npm: `presencebound-sdk`

### Install

```bash
npm install presencebound-sdk
````

### SDK compatibility

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
  baseUrl: "https://api.kojib.com", // optional (defaults to api.kojib.com)
  timeoutMs: 15000,                 // optional
  userAgent: "my-app/1.0.0"         // optional
});

async function run() {
  const challenge = await client.createChallenge({
    actionHashHex: "a".repeat(64),
    purpose: "ACTION_COMMIT"
  });

  // Pass challenge.data.challengeB64Url to your WebAuthn client ceremony.
  console.log("challengeId:", challenge.data.id, "requestId:", challenge.requestId);

  // Example: iterate receipts (auto-pagination)
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

End-to-end Node + Express + WebAuthn demo (SDK + browser assertion + verify):

* `./packages/presencebound-sdk/examples/node-sdk/`

---

## Quickstart (local API server)

### Prereqs

* Node.js 18+ (recommended)
* Docker (for Postgres)

### Steps

1. Create env:

   * `cp .env.example .env`
2. Start database:

   * `docker-compose up -d db`
3. Install deps:

   * `npm i`
4. Run migrations:

   * `npm run migrate`
5. Start API:

   * `npm run dev`

API: `http://localhost:8080`

---

## Authentication

All protected endpoints require:

`Authorization: Bearer <API_KEY>`

Customers are API-key holders. There are **no end-user accounts** in the core model.

---

## Core endpoints

* `POST /v1/pbi/challenge`
  Create a single-use challenge bound to an `actionHash` (or artifact hash) with expiry.

* `POST /v1/pbi/verify`
  Verify a WebAuthn UP+UV ceremony for the bound challenge and return a decision.
  **Applications MUST only proceed when decision == `PBI_VERIFIED`.**

* `GET /v1/pbi/receipts`
  List receipts with challenge metadata for audit/export workflows.

---

## Billing endpoints

* `GET /v1/billing/usage`
* `GET /v1/billing/invoices`

---

## Security model (high level)

Proofs are bound to:

* deterministic `actionHash` (or artifact hash)
* nonce + expiry (single-use)
* WebAuthn ceremony flags: **User Present + User Verified (UP+UV)**

Receipts provide durable audit references:

* `receiptHash` + decision + time window + action binding

Security notes and threat model:

* `./SECURITY.md`
* `./pbi-stdlib/security/threat-model.md`

Vulnerability reporting:

* `security@kojib.com`

---

## Operational notes (production)

### Logging / request correlation

The API may return a `requestId` header. Persist it in application logs for support/debugging.

### Timeouts

Clients should set reasonable timeouts (15s default in the official SDK) and treat timeouts as retriable only when your business action is idempotent.

### Enforcing decisions

Your application must enforce:

* **Only proceed when** `decision === "PBI_VERIFIED"`
* Treat all other decisions as “do not execute” (FAILED/EXPIRED/REPLAYED)

### Hashing actions correctly

Your `actionHashHex` must be a deterministic hash of the *exact* irreversible action you are about to execute (amount + recipient + operation + policy + metadata). If the action changes, the hash must change.

---

## Repository layout (high level)

* `src/` — API server implementation (routes, middleware, DB, PBI verification)
* `apps/portal/` — customer portal (keys, billing, usage) *(if included in this repo)*
* `pbi-stdlib/` — reference verifier tooling + docs/spec/test vectors
* `packages/presencebound-sdk/` — official TypeScript SDK (published to npm)
* `examples/` — integration examples (web, express, fastapi, axum wrappers)

---

## Development

### Commands

```bash
npm i
npm run dev
npm run test
npm run typecheck
```

### Notes

* Do not commit secrets: `.env` files are ignored (examples only).
* Test vectors may include WebAuthn blobs. This repo includes a `.gitleaks.toml` allowlist for known false-positives in deterministic vectors.

---

## Licensing (AGPL + Commercial)

This project is **dual-licensed**:

* **AGPL-3.0-or-later** for open source use.
  If you modify and run this as a network service, AGPL requires you to provide the source code of your modified version to users.

* **Commercial License** for proprietary use.
  Required if you want to run as SaaS without releasing modifications, embed in closed-source software, or distribute under proprietary terms.

See:

* `LICENSE`
* `LICENSE-AGPL-3.0.txt`
* `COMMERCIAL_LICENSE.md`
* `TRADEMARKS.md`

---

## Trademark

“PresenceBound” and “PBI” branding usage is governed by `TRADEMARKS.md`.

