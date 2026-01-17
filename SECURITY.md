# Security Policy

We take security seriously. Please report vulnerabilities privately and give us a chance to investigate and remediate before any public disclosure.

## Reporting a Vulnerability

**Email:** security@kojib.com  
**Subject:** `Security report — PBI Enterprise API`

Please include:

- **Summary** (what is affected and why it matters)
- **Impact** (what an attacker can do, worst-case scenario)
- **Reproduction steps** (exact steps, commands, requests, payloads)
- **Affected components** (API, portal, pbi-stdlib, verifier tooling, examples)
- **Affected versions / commit SHA** (or release tag)
- **Environment** (OS, Node version, browser if relevant)
- **Logs / request IDs / timestamps** (redact sensitive data)
- **Proof of concept** (if available)
- **Suggested fix** (optional)

If the issue involves authentication or receipts, include the **minimum** data needed to reproduce. Do **not** send secrets, private keys, or full production datasets.

## What Not To Do

- **Do not** file public GitHub issues for security reports.
- **Do not** publish exploit details before we’ve shipped a fix.
- **Do not** attempt to access data that is not yours.

## Response & Remediation

We aim to respond quickly:

- **Acknowledgement:** within **72 hours**
- **Initial assessment:** within **7 days** (severity + scope + mitigation plan)
- **Fix timeline:** depends on severity, but critical issues are prioritized immediately

We may request additional information or a call for coordinated reproduction.

## Coordinated Disclosure

We support coordinated disclosure. Once a fix is ready (or mitigations are in place), we will coordinate a reasonable disclosure timeline with you.

## Scope

This policy covers:

- `pbi-enterprise-api` server and routes
- `apps/portal` (if included in this repository)
- `pbi-stdlib` reference verifier tooling and published artifacts
- Build and deployment configurations included in this repo

Out of scope:

- Social engineering attempts
- Denial of service against public endpoints (unless you can demonstrate a novel vulnerability)
- Issues requiring physical access to a device (unless you can demonstrate a practical remote impact)

## Safe Harbor

If you:

- act in good faith,
- avoid privacy violations and data exfiltration,
- and report vulnerabilities privately to **security@kojib.com**,

we will treat your research as authorized and will not pursue legal action for good-faith security testing.

Thank you for helping keep Presence-Bound Identity (PBI) safe.
