# Security Policy

PBI is a cryptographic authorization primitive. We take security reports seriously and respond quickly.

## Supported Versions
We support security fixes for:
- The current production release
- The most recent minor release line (if applicable)

If you are running an older version, upgrade first and re-test.

## Reporting a Vulnerability
Please report security issues privately.

**Preferred contact**
- Email: security@kojib.com (replace if different)
- Subject: `[PBI SECURITY] <short summary>`

**What to include**
- Impact summary (what can an attacker do?)
- Reproduction steps or proof-of-concept
- Affected endpoint(s) / component(s)
- Any logs/screenshots that help (redact secrets)
- Your suggested fix, if you have one

If you’d like encrypted email, include a PGP key link here:
- PGP: (add public key URL or fingerprint)

## Our Response Process
We aim to:
- Acknowledge receipt within **72 hours**
- Provide an initial assessment within **7 days**
- Ship a fix as soon as feasible based on severity

## Coordinated Disclosure
We support coordinated disclosure. Please do not publicly disclose details until a fix is available or we’ve agreed on a timeline.

Default timeline:
- Up to **90 days** for public disclosure, adjusted by severity and exploitability.

## Safe Harbor
We consider security research authorized under this policy if you:
- Make a good-faith effort to avoid privacy violations and data destruction
- Do not exploit the issue beyond what’s necessary to demonstrate impact
- Do not use social engineering, phishing, or physical attacks
- Report the issue promptly and keep details private until disclosure

We will not pursue legal action against researchers who follow this policy.

## Out of Scope
- Denial of service (DoS) without a clear security impact
- Spam / rate-limit bypass without account/tenant boundary impact
- Missing best-practice headers unless tied to an exploit path
- Vulnerabilities in third-party providers outside our control (unless there’s a direct integration exploit)

Thank you for helping keep PBI secure.