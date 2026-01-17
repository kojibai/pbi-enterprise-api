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

## Quickstart (local)

### Prereqs
- Node.js 18+ (recommended)
- Docker (for Postgres)

### Steps
1) Create env:
   - `cp .env.example .env`
2) Start database:
   - `docker-compose up -d db`
3) Install deps:
   - `npm i`
4) Run migrations:
   - `npm run migrate`
5) Start API:
   - `npm run dev`

API: `http://localhost:8080`

---

## Authentication
All protected endpoints require:

`Authorization: Bearer <API_KEY>`

Customers are API-key holders. There are **no end-user accounts** in the core model.

---

## Core endpoints
- `POST /v1/pbi/challenge`  
  Create a single-use challenge bound to an `actionHash` (or artifact hash) with expiry.

- `POST /v1/pbi/verify`  
  Verify a WebAuthn UP+UV ceremony for the bound challenge and return a decision.  
  **Applications MUST only proceed when decision == `PBI_VERIFIED`.**

---

## Billing endpoints
- `GET /v1/billing/usage`
- `GET /v1/billing/invoices`
- `POST /v1/admin/close-month` (operator-only)

---

## Security model (high level)
Proofs are bound to:
- deterministic `actionHash` (or artifact hash)
- nonce + expiry (single-use)
- WebAuthn ceremony flags: **User Present + User Verified (UP+UV)**

Receipts provide durable audit references:
- `receiptHash` + decision + time window + action binding

Security notes and threat model:
- Repo: `./SECURITY.md`
- Threat model: `./pbi-stdlib/security/threat-model.md`

Vulnerability reporting:
- `security@kojib.com`

---

## Repository layout (high level)
- `src/` — API server implementation (routes, middleware, DB, PBI verification)
- `apps/portal/` — customer portal (keys, billing, usage) *(if included in this repo)*
- `pbi-stdlib/` — reference verifier tooling + docs/spec/test vectors
- `examples/` — integration examples (web, express, fastapi, axum wrappers)

---

## Development notes
- Do not commit secrets: `.env` files are ignored (examples only).
- Test vectors may include WebAuthn blobs. This repo includes a `.gitleaks.toml` allowlist for known false-positives in deterministic vectors.

---

## Licensing (AGPL + Commercial)
This project is **dual-licensed**:

- **AGPL-3.0-or-later** for open source use.  
  If you modify and run this as a network service, AGPL requires you to provide the source code of your modified version to users.

- **Commercial License** for proprietary use.  
  Required if you want to run as SaaS without releasing modifications, embed in closed-source software, or distribute under proprietary terms.

See:
- `LICENSE`
- `LICENSE-AGPL-3.0.txt`
- `COMMERCIAL_LICENSE.md`
- `TRADEMARKS.md`

---

## Trademark
“PresenceBound” and “PBI” branding usage is governed by `TRADEMARKS.md`.
