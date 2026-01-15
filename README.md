# PBI Enterprise API (v1)

A minimal, enterprise-grade API for **Presence-Bound Identity**:
- Issues **action/artifact-bound challenges**
- Verifies **presence attestation bundles** (WebAuthn assertion proof)
- Emits **receipts** for audit/courts
- Tracks **usage** and generates **monthly invoices**

## Run locally
1) `cp .env.example .env`
2) `docker-compose up -d db`
3) `npm i`
4) `npm run migrate`
5) `npm run dev`

API: http://localhost:8080

## Auth
All endpoints require:
`Authorization: Bearer <API_KEY>`

## Core endpoints
- `POST /v1/pbi/challenge`
- `POST /v1/pbi/verify`

## Billing endpoints
- `GET /v1/billing/usage`
- `GET /v1/billing/invoices`
- `POST /v1/admin/close-month` (operator-only)

## Model
No end-user accounts. Customers are API-key holders. Proofs are bound to:
- action payload hash OR artifact hash
- nonce + expiry
- WebAuthn “user present + user verified” flags