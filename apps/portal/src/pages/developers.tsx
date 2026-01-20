// pages/developers.tsx
import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { apiJson } from "../lib/api";

const API_DOCS = "https://api.kojib.com/docs";
const DEMO_URL = "https://demo.kojib.com";
const TOOL_URL = "https://tool.kojib.com";
const SITE_URL = "https://pbi.kojib.com";

const SDK_PACKAGE = "presencebound-sdk";
const SDK_PAGE_URL = "/sdk";
const SDK_NPM_URL = `https://www.npmjs.com/package/${SDK_PACKAGE}`;
const SDK_EXAMPLE_URL =
  "https://github.com/kojibai/pbi-enterprise-api/tree/main/packages/presencebound-sdk/examples/node-sdk";

type AuthState = "unknown" | "logged_out" | "logged_in";

export default function DevelopersPage() {
  const router = useRouter();

  const [auth, setAuth] = useState<AuthState>("unknown");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await apiJson("/v1/portal/me");
        if (!cancelled) setAuth("logged_in");
      } catch {
        if (!cancelled) setAuth("logged_out");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pageUrl = useMemo(() => `${SITE_URL}/developers`, []);
  const ogImage = `${SITE_URL}/pbi_1.png`;

  const apiBase = useMemo(() => {
    return (process.env.NEXT_PUBLIC_PBI_API_BASE ?? "https://api.kojib.com").replace(/\/+$/, "");
  }, []);

  return (
    <>
      <Head>
        <title>Developers · PBI</title>
        <meta
          name="description"
          content="PBI Developer Hub: quickstart, enforcement patterns, canonicalization guidance, and integration examples for action-bound WebAuthn presence verification."
        />
        <link rel="canonical" href={pageUrl} />
        <meta name="robots" content="index,follow" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#05070e" />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Kojib" />
        <meta property="og:title" content="Developers · PBI" />
        <meta property="og:description" content="Quickstart, enforcement patterns, canonicalization, and integration examples." />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={ogImage} />
      </Head>

      <div className="pbi-landing">
        <div className="pbi-bg" aria-hidden />
        <div className="pbi-shell">
          <TopBar auth={auth} onHome={() => router.push("/")} />

          <main>
            <section className="pbi-hero" style={{ paddingBottom: 10 }}>
              <div className="pbi-heroGrid">
                <div>
                  <div className="pbi-pill">
                    <span className="pbi-pillDot" />
                    Developers · 5-minute quickstart
                  </div>

                  <h1 className="pbi-h1">
                    Presence verification you can <span>enforce</span> in one endpoint.
                  </h1>

                  <p className="pbi-lead">
                    PBI hardens irreversible actions. You keep SSO/OAuth/JWT. You add one strict gate: compute an action hash, issue a challenge, require
                    WebAuthn UP+UV, and execute only if verify returns <b>PBI_VERIFIED</b>.
                  </p>

                  <div className="pbi-ctaRow">
                    <a className="pbi-btnPrimary" href={auth === "logged_in" ? "/console" : "/#access"}>
                      {auth === "logged_in" ? "Open Dashboard" : "Get access"} <span aria-hidden>→</span>
                    </a>
                    <a className="pbi-btnGhost" href={SDK_PAGE_URL}>
                      SDK
                    </a>
                    <a className="pbi-btnGhost" href={SDK_NPM_URL} target="_blank" rel="noreferrer">
                      npm
                    </a>
                    <a className="pbi-btnGhost" href={API_DOCS} target="_blank" rel="noreferrer">
                      API reference
                    </a>
                    <a className="pbi-btnGhost" href={TOOL_URL} target="_blank" rel="noreferrer">
                      Tool
                    </a>
                    <a className="pbi-btnGhost" href={DEMO_URL} target="_blank" rel="noreferrer">
                      Demo
                    </a>
                  </div>

                  <div className="pbi-valueGrid" style={{ marginTop: 14 }}>
                    <ValueLine title="Strict invariant" body="Execute only on PBI_VERIFIED. Everything else is deny." />
                    <ValueLine title="Action binding" body="Challenges are bound to actionHash. Approvals can’t be repurposed." />
                    <ValueLine title="Replay resistance" body="Single-use + expiry make replays fail by construction." />
                    <ValueLine title="Receipts" body="Store receiptHash as your durable evidence reference." />
                  </div>

                  {/* NEW: SDK callout (seamless, official) */}
                  <div className="pbi-card" style={{ marginTop: 14, padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div className="pbi-cardTitle" style={{ fontSize: 18 }}>
                        Official SDK: <span style={{ opacity: 0.92 }}>{SDK_PACKAGE}</span>
                        <span style={{ marginLeft: 10, fontSize: 12, color: "rgba(255,255,255,.58)" }}>Node 18+ · ESM + CJS</span>
                      </div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <a className="pbi-btnPrimary" href={SDK_PAGE_URL}>
                          Open SDK <span aria-hidden>→</span>
                        </a>
                        <a className="pbi-btnGhost" href={SDK_NPM_URL} target="_blank" rel="noreferrer">
                          npm →
                        </a>
                        <a className="pbi-btnGhost" href={SDK_EXAMPLE_URL} target="_blank" rel="noreferrer">
                          Example →
                        </a>
                      </div>
                    </div>

                    <div className="pbi-cardBody" style={{ marginTop: 8 }}>
                      Recommended path for most teams: use the SDK for typed integration, consistent error semantics, and receipts pagination. The SDK page
                      includes install, quickstart, error handling, compatibility, and an end-to-end WebAuthn ceremony example.
                    </div>
                  </div>
                </div>

                <aside className="pbi-side">
                  <div className="pbi-sideTop">
                    <div>
                      <div className="pbi-proofLabel">Base URL</div>
                      <div className="pbi-sideTitle">{apiBase}</div>
                    </div>
                    <div className="pbi-sideTag">v1</div>
                  </div>

                  <pre className="pbi-code">{`Core endpoints:
POST /v1/pbi/challenge
POST /v1/pbi/verify

Fast path:
- install SDK
- challenge -> WebAuthn -> verify
- store receiptHashHex`}</pre>
                </aside>
              </div>
            </section>

            <section className="pbi-section">
              <SectionHead
                kicker="Quickstart"
                title="5 minutes to first verification"
                body="Use the SDK for the fastest path, or wire directly into your endpoint. The only requirement is strict enforcement on VERIFIED."
              />

              <div className="pbi-card">
                <div className="pbi-cardTitle">1) Canonicalize the action, then hash it</div>
                <div className="pbi-cardBody" style={{ marginTop: 6 }}>
                  The action hash must represent the exact irreversible operation you are about to execute. Deterministic serialization matters.
                </div>
                <pre className="pbi-code" style={{ marginTop: 10 }}>{`// Example canonical action (conceptual)
{
  "kind": "treasury_payout",
  "to": "acct_123",
  "amount": "100000",
  "currency": "USD",
  "nonce": "server_generated_nonce",
  "ts": "server_time_iso"
}

// actionHash = SHA-256(canonical_json_bytes)`}</pre>
              </div>

              <div className="pbi-card" style={{ marginTop: 14 }}>
                <div className="pbi-cardTitle">2) Issue a challenge bound to actionHash</div>
                <div className="pbi-cardBody" style={{ marginTop: 6 }}>
                  Use your API key. Challenges must be single-use and time-bounded.
                </div>
                <pre className="pbi-code" style={{ marginTop: 10 }}>{`curl -X POST "${apiBase}/v1/pbi/challenge" \\
  -H "authorization: Bearer $PBI_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{ "actionHashHex": "<32-byte sha256 hex>" }'`}</pre>
              </div>

              <div className="pbi-card" style={{ marginTop: 14 }}>
                <div className="pbi-cardTitle">3) Perform WebAuthn UP+UV ceremony</div>
                <div className="pbi-cardBody" style={{ marginTop: 6 }}>
                  The client completes WebAuthn on-device. The server verifies the assertion and emits a receipt.
                </div>
                <pre className="pbi-code" style={{ marginTop: 10 }}>{`POST ${apiBase}/v1/pbi/verify
Authorization: Bearer $PBI_API_KEY
Content-Type: application/json

{
  "challengeId": "<server-issued>",
  "assertion": { /* WebAuthn assertion bundle */ }
}

→ { decision: "PBI_VERIFIED", receiptHashHex: "..." }`}</pre>
              </div>

              <div className="pbi-card" style={{ marginTop: 14, background: "rgba(120,255,231,.08)", borderColor: "rgba(120,255,231,.28)" }}>
                <div className="pbi-cardTitle">4) Enforce</div>
                <div className="pbi-cardBody" style={{ marginTop: 6 }}>
                  This is the whole point: if not VERIFIED, do not execute. Store the receipt hash as your evidence reference.
                </div>
                <pre className="pbi-code" style={{ marginTop: 10 }}>{`if (verify.decision !== "PBI_VERIFIED") {
  throw new Error("Presence verification required");
}

// execute irreversible action now
// store receiptHashHex with action context`}</pre>
              </div>
            </section>

            <section className="pbi-section">
              <SectionHead
                kicker="Export packs + webhooks"
                title="Verify receipts offline & validate webhook signatures"
                body="Enterprise exports ship as a signed zip pack. Webhooks are signed per-delivery for tamper-evidence."
              />

              <div className="pbi-card">
                <div className="pbi-cardTitle">1) Verify file hashes</div>
                <div className="pbi-cardBody" style={{ marginTop: 6 }}>
                  Compute SHA-256 for each file in the pack and compare to the manifest entries.
                </div>
                <pre className="pbi-code" style={{ marginTop: 10 }}>{`sha256sum receipts.ndjson
sha256sum policy.snapshot.json
sha256sum trust.snapshot.json # optional`}</pre>
              </div>

              <div className="pbi-card" style={{ marginTop: 14 }}>
                <div className="pbi-cardTitle">2) Verify the manifest signature</div>
                <div className="pbi-cardBody" style={{ marginTop: 6 }}>
                  Canonicalize manifest.json (sorted JSON keys) and verify the Ed25519 signature in manifest.sig.json using the included public key.
                </div>
                <pre className="pbi-code" style={{ marginTop: 10 }}>{`signature = ed25519_verify(publicKeyPem, canonical_manifest_bytes)
assert(signature === manifestSig.signatureB64Url)`}</pre>
              </div>

              <div className="pbi-card" style={{ marginTop: 14 }}>
                <div className="pbi-cardTitle">3) Parse receipts.ndjson</div>
                <div className="pbi-cardBody" style={{ marginTop: 6 }}>
                  Each line is one JSON object of the form: <code>{"{ receipt, challenge }"}</code>.
                </div>
                <pre className="pbi-code" style={{ marginTop: 10 }}>{`for line in receipts.ndjson:
  obj = JSON.parse(line)
  receipt = obj.receipt
  challenge = obj.challenge`}</pre>
              </div>

              <div className="pbi-card" style={{ marginTop: 14 }}>
                <div className="pbi-cardTitle">Webhook signature verification</div>
                <div className="pbi-cardBody" style={{ marginTop: 6 }}>
                  Use the secret from the portal to compute HMAC-SHA256 over <code>{"<timestamp>.<deliveryId>.<rawBody>"}</code>.
                </div>
                <pre className="pbi-code" style={{ marginTop: 10 }}>{`base = timestamp + "." + deliveryId + "." + rawBody
expected = hmac_sha256(secret, base)
assert("v1=" + expected === headers["X-PBI-Signature"])`}</pre>
              </div>
            </section>

            <section className="pbi-section">
              <SectionHead
                kicker="Patterns"
                title="Where PBI belongs (and where it doesn’t)"
                body="Large companies keep UX clean by gating only high-blast-radius actions."
              />

              <div className="pbi-sectionGrid3">
                <MiniCard title="Gate" body="Money movement, role changes, key rotation, deploy approvals, legal/ownership actions." />
                <MiniCard title="Do not gate" body="Low-risk browsing, list endpoints, harmless preference changes." />
                <MiniCard title="Roll out" body="Start with 1 endpoint, prove stability, then expand coverage." />
              </div>
            </section>

            <section className="pbi-section">
              <SectionHead
                kicker="Canonicalization"
                title="Canonical action hashing guidance"
                body="To prevent ambiguity and disputes, action hashes must be deterministic and represent the exact operation."
              />

              <div style={{ display: "grid", gap: 10 }}>
                <ProofRow k="Stable field set" v="Hash only fields that define the irreversible effect (amount, destination, policy, nonce, etc.)." />
                <ProofRow k="Deterministic serialization" v="Use stable ordering and encoding. Avoid locale/float ambiguity." />
                <ProofRow k="Server-minted nonce" v="Include a server nonce to prevent re-submission of identical actions." />
                <ProofRow k="Bind to execution" v="Compute hash from the exact request that will execute, not an earlier preview." />
              </div>
            </section>

            <section className="pbi-section">
              <SectionHead kicker="Next" title="Go deeper" body="For the most complete integration path, use the SDK page or the API reference." />
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <a className="pbi-btnPrimary" href={SDK_PAGE_URL}>
                  SDK page →
                </a>
                <a className="pbi-btnGhost" href={SDK_NPM_URL} target="_blank" rel="noreferrer">
                  npm →
                </a>
                <a className="pbi-btnGhost" href={API_DOCS} target="_blank" rel="noreferrer">
                  API reference →
                </a>
                <a className="pbi-btnGhost" href="/security">
                  Security →
                </a>
                <a className="pbi-btnGhost" href="/trust">
                  Trust Center →
                </a>
                <a className="pbi-btnGhost" href="/enterprise">
                  Enterprise →
                </a>
              </div>
            </section>

            <Footer />
          </main>
        </div>
      </div>
    </>
  );
}

function TopBar({ auth, onHome }: { auth: AuthState; onHome: () => void }) {
  return (
    <header className="pbi-topbar">
      <div className="pbi-brand" role="button" tabIndex={0} onClick={onHome} onKeyDown={(e) => (e.key === "Enter" ? onHome() : null)}>
        <div className="pbi-mark" aria-hidden>
          <span className="pbi-markDot" />
        </div>
        <div>
          <div className="pbi-brandTitle">PBI</div>
          <div className="pbi-brandSub">Presence-Bound Identity</div>
        </div>
      </div>

      <nav className="pbi-nav" aria-label="Primary">
        <a href="/why">Why</a>
        <a href="/developers" aria-current="page">
          Developers
        </a>
        <a href="/customers">Customers</a>
        <a href="/pricing">Pricing</a>
        <a href="/enterprise">Enterprise</a>
        <a href="/trust">Trust</a>
        <a href={API_DOCS} target="_blank" rel="noreferrer">
          API
        </a>
        <a href="/status">Status</a>
        <a href={SDK_PAGE_URL}>SDK</a>
        {auth === "logged_in" ? (
          <a className="pbi-navCta" href="/console">
            Dashboard
          </a>
        ) : (
          <a className="pbi-navCta" href="/#access">
            Get access
          </a>
        )}
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="pbi-footer" style={{ marginTop: 6 }}>
      <div>© {new Date().getFullYear()} Kojib · PBI</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a href="/trust">Trust</a>
        <a href="/security">Security</a>
        <a href="/status">Status</a>
        <a href="/changelog">Changelog</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
      </div>
    </footer>
  );
}

function SectionHead({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="pbi-proofLabel">{kicker}</div>
      <div className="pbi-cardTitle" style={{ marginTop: 6 }}>
        {title}
      </div>
      <div className="pbi-cardBody" style={{ marginTop: 6, maxWidth: 920 }}>
        {body}
      </div>
    </div>
  );
}

function ValueLine({ title, body }: { title: string; body: string }) {
  return (
    <div className="pbi-value">
      <div className="pbi-valueTitle">{title}</div>
      <div className="pbi-valueBody">{body}</div>
    </div>
  );
}

function MiniCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="pbi-card" style={{ background: "rgba(0,0,0,.22)" }}>
      <div className="pbi-cardTitle">{title}</div>
      <div className="pbi-cardBody">{body}</div>
    </div>
  );
}

function ProofRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="pbi-card" style={{ padding: 12, borderRadius: 18 }}>
      <div className="pbi-proofLabel">{k}</div>
      <div style={{ marginTop: 6, color: "rgba(255,255,255,.82)", fontSize: 13, lineHeight: 1.45, textAlign: "right" }}>{v}</div>
    </div>
  );
}
