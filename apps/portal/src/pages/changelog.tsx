// pages/changelog.tsx
import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { apiJson } from "../lib/api";

const API_DOCS = "https://api.kojib.com/docs";
const DEMO_URL = "https://demo.kojib.com";
const SITE_URL = "https://pbi.kojib.com";

type AuthState = "unknown" | "logged_out" | "logged_in";

type ChangelogEntry = {
  version: string;
  title: string;
  dateISO?: string; // "2026-01-19"
  bullets: string[];
  tags?: string[]; // optional badges for scanning
};

export default function ChangelogPage() {
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

  const pageUrl = useMemo(() => `${SITE_URL}/changelog`, []);
  const ogImage = `${SITE_URL}/pbi_1.png`;

  // Newest first (enterprise expectation)
  const entries: ChangelogEntry[] = [
    {
      version: "v1.6.0",
      title: "Console IA upgrade: dedicated Webhooks + Exports modules (clean hub + task pages)",
      dateISO: "2026-01-21",
      tags: ["Portal", "Enterprise UX", "Compliance"],
      bullets: [
        "Console refactored into a clean control-plane hub (plan/quota/usage/keys + navigation) to reduce cognitive load for enterprise users.",
        "New dedicated console module pages for enterprise workflows:",
        "• /console/webhooks — configure receipt.created delivery (create/rotate/delete with secrets shown once).",
        "• /console/exports — generate signed evidence export packs with presets + advanced filters and offline verification guidance.",
        "Navigation updated to treat Webhooks and Exports as first-class destinations (separate from the homepage).",
        "No API key exposure: exports remain cookie-auth via /v1/portal/receipts/export.",
        "Backward compatible: no changes required for existing API integrations."
      ]
    },
    {
      version: "v1.5.0",
      title: "Enterprise onboarding + CORS resilience (rollout guide, console links, origin normalization)",
      dateISO: "2026-01-21",
      tags: ["Reliability", "Portal", "Enterprise UX"],
      bullets: [
        "New public Enterprise Rollout Guide page: /enterprise/rollout (Day 0 → Day 7 production implementation sequence).",
        "Console updated to surface the rollout guide at critical touchpoints (nav, setup CTAs, mobile quick actions, enterprise controls context).",
        "CORS hardened for portal reliability: normalize origins (trim, strip quotes, remove trailing slashes) to prevent brittle exact-match failures.",
        "CORS denial logging added (cors_origin_denied) to make production misconfiguration diagnosable instantly.",
        "No breaking changes: existing portal and /v1/pbi integrations continue to work unchanged."
      ]
    },
    {
      version: "v1.4.0",
      title: "Portal enterprise controls: webhooks + signed evidence exports (self-serve)",
      dateISO: "2026-01-21",
      tags: ["Portal", "Compliance", "Enterprise UX"],
      bullets: [
        "New portal export endpoint: GET /v1/portal/receipts/export — cookie-auth evidence exports (no API keys in browser).",
        "Customer dashboard upgraded with Enterprise Controls: configure receipt.created webhooks and download signed evidence packs from the console.",
        "Portal API keys response now surfaces governance metadata (scopes, last_used_at, last_used_ip) for compliance review workflows.",
        "Webhook secrets are shown once (create + rotate) and designed for secure verifier integration.",
        "Export packs remain offline-verifiable (manifest hashes + Ed25519 signature + verification.json) with time-window enforcement for large exports."
      ]
    },
    {
      version: "v1.3.0",
      title: "Production hardening: resilient webhooks, deterministic exports, safer ops",
      dateISO: "2026-01-21",
      tags: ["Reliability", "Security", "Ops"],
      bullets: [
        "Webhook delivery worker hardened: multi-instance safe claiming, graceful DB failure handling, and no-crash interval execution.",
        "Webhook deliveries now use an explicit processing state with stale-claim reclaim to prevent stuck jobs after restarts.",
        "Webhook HTTP delivery adds a strict timeout (AbortController) and preserves exponential backoff retry semantics.",
        "Export packs upgraded for audit correctness: deterministic receipts.ndjson and canonical manifest.json bytes aligned with the signature model.",
        "Export signing now includes a stable keyId derived from the public signing key fingerprint to support pinning and rotation workflows.",
        "Export ZIP creation hardened: sanitized entry names, clearer failures when zip tooling is missing, and guaranteed temp cleanup.",
        "Postgres pool defaults made production-safe (remote SSL by default unless disabled, sane timeouts, and pool error handling).",
        "Graceful shutdown: worker stop + HTTP server close + DB pool close for predictable deploy/restart behavior."
      ]
    },
    {
      version: "v1.2.0",
      title: "Enterprise WOW pack: webhook delivery, export packs, and key governance",
      dateISO: "2026-01-20",
      tags: ["Enterprise", "Compliance", "Integrations"],
      bullets: [
        "Receipts listing upgraded with time windows, explicit ordering, opaque cursors, and higher limits (max 500).",
        "New export endpoint: GET /v1/pbi/receipts/export generates a signed, offline-verifiable zip pack (manifest + hashes + signatures).",
        "Portal webhooks: create/list/update/delete endpoints for receipt.created events, with HMAC signatures + retry semantics.",
        "Receipt and challenge payloads enriched with policy metadata, verifier context, and trace identifiers where available.",
        "API key governance upgrades: rotation endpoint, last-used fields, and optional per-key scopes (export requires pbi.export).",
        "OpenAPI and portal docs refreshed to document cursor semantics, webhooks, export pack format, and key rotation."
      ]
    },
    {
      version: "v1.1.0",
      title: "Audit-friendly receipts listing + richer receipt context",
      dateISO: "2026-01-18",
      tags: ["Audit", "Reporting"],
      bullets: [
        "New endpoint: GET /v1/pbi/receipts — customer-facing receipts listing designed for audit/export workflows.",
        "Cursor-based pagination added for receipt listings (nextCursor).",
        "Receipt listing supports filters: actionHashHex, challengeId, purpose, decision, limit.",
        "Each receipts list item returns receipt + associated challenge metadata (challenge context included when available).",
        "Receipt detail endpoints now include an embedded challenge object when available:",
        "GET /v1/pbi/challenges/{challengeId}/receipt",
        "GET /v1/pbi/receipts/{receiptId}",
        "OpenAPI updated to document receipts listing, combined receipt+challenge schemas, metering fields, and expanded error coverage (invalid requests, quota, unknown challenge IDs).",
        "README updated to include the receipts listing endpoint in the core API surface.",
        "Portal homepage updated: API Docs card now surfaces receipts endpoints for customer visibility.",
        "Internal: strengthened typing around receipt/challenge date handling to prevent invalid date parsing (no customer-facing behavior change).",
        "Backward compatible: no breaking changes; existing integrations continue to work as-is."
      ]
    },
    {
      version: "v1.0.0",
      title: "Initial public release",
      dateISO: "2026-01-15",
      tags: ["Foundation"],
      bullets: [
        "Presence-bound challenge → UP+UV verify → receipt model.",
        "Action-hash binding and non-replayable challenge semantics.",
        "Portal billing + API keys + usage metering.",
        "Optional portable proof export model for audit workflows."
      ]
    }
  ];

  function fmtDateLabel(iso: string | undefined): string {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isFinite(d.getTime())
      ? d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" })
      : iso;
  }

  return (
    <>
      <Head>
        <title>Changelog · PBI</title>
        <meta
          name="description"
          content="PBI changelog and release policy: versioning, compatibility, and breaking change discipline."
        />
        <link rel="canonical" href={pageUrl} />
        <meta name="robots" content="index,follow" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#05070e" />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Kojib" />
        <meta property="og:title" content="Changelog · PBI" />
        <meta property="og:description" content="Release policy, compatibility, and product changes." />
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
                    Changelog · release discipline
                  </div>

                  <h1 className="pbi-h1">
                    Changes are communicated with <span>versioned clarity.</span>
                  </h1>

                  <p className="pbi-lead">
                    Enterprise systems integrate only when change is predictable. This page documents compatibility
                    discipline and high-signal product updates.
                  </p>

                  <div className="pbi-ctaRow">
                    <a className="pbi-btnPrimary" href={API_DOCS} target="_blank" rel="noreferrer">
                      API docs <span aria-hidden>→</span>
                    </a>
                    <a className="pbi-btnGhost" href="/status">
                      Status
                    </a>
                    <a className="pbi-btnGhost" href="/trust">
                      Trust Center
                    </a>
                    <a className="pbi-btnGhost" href={DEMO_URL} target="_blank" rel="noreferrer">
                      Demo
                    </a>
                  </div>
                </div>

                <aside className="pbi-side">
                  <div className="pbi-sideTop">
                    <div>
                      <div className="pbi-proofLabel">Policy</div>
                      <div className="pbi-sideTitle">Stability through versioning</div>
                    </div>
                    <div className="pbi-sideTag">v1</div>
                  </div>

                  <div className="pbi-sideList">
                    <Bullet>Stable /v1 endpoints</Bullet>
                    <Bullet>Additive changes by default</Bullet>
                    <Bullet>Breaking changes only via new version</Bullet>
                  </div>

                  <pre className="pbi-code">{`Compatibility:
- /v1 contracts remain stable
- additive changes whenever possible
- breaking changes require a new version path`}</pre>
                </aside>
              </div>
            </section>

            <section className="pbi-section">
              <SectionHead
                kicker="Release policy"
                title="Compatibility expectations"
                body="Written for enterprise engineering, security, risk, and compliance review teams."
              />

              <div style={{ display: "grid", gap: 10 }}>
                <ProofRow k="Versioned API" v="Major behavioral changes require a versioned endpoint path (e.g., /v2)." />
                <ProofRow k="Additive first" v="Fields and endpoints are introduced in a backward-compatible way whenever possible." />
                <ProofRow
                  k="Explicit semantics"
                  v="Decision values, enforcement rules, replay constraints, and signature formats are documented in the API reference."
                />
                <ProofRow
                  k="Operational readiness"
                  v="Retries, timeouts, and export verification formats are designed to satisfy audit and incident workflows."
                />
              </div>
            </section>

            <section className="pbi-section">
              <SectionHead kicker="Changelog" title="Product updates" body="High-signal changes only—no noise." />

              <div style={{ display: "grid", gap: 10 }}>
                {entries.map((e) => {
                  const dateLabel = fmtDateLabel(e.dateISO);
                  return (
                    <div key={e.version} className="pbi-card" style={{ padding: 14 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          justifyContent: "space-between",
                          gap: 10,
                          flexWrap: "wrap"
                        }}
                      >
                        <div className="pbi-cardTitle" style={{ fontSize: 18 }}>
                          {e.version} · {e.title}
                          {dateLabel ? (
                            <span style={{ marginLeft: 10, fontSize: 12, color: "rgba(255,255,255,.58)" }}>
                              {dateLabel}
                            </span>
                          ) : null}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          {Array.isArray(e.tags) &&
                            e.tags.map((t) => (
                              <span key={t} className="pbi-sideTag" style={{ fontSize: 12 }}>
                                {t}
                              </span>
                            ))}
                          <div className="pbi-sideTag">Release</div>
                        </div>
                      </div>

                      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                        {e.bullets.map((b) => (
                          <div key={`${e.version}:${b}`} className="pbi-bullet" style={{ color: "rgba(255,255,255,.82)" }}>
                            <span className="pbi-bulletDot">•</span>
                            <span>{b}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pbi-card" style={{ marginTop: 14 }}>
                <div className="pbi-cardTitle">Enterprise change review</div>
                <div className="pbi-cardBody" style={{ marginTop: 6 }}>
                  Enterprises can request change review expectations, environment separation guidance, and rollout sequencing via{" "}
                  <a href="/enterprise">/enterprise</a>.
                </div>
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
      <div
        className="pbi-brand"
        role="button"
        tabIndex={0}
        onClick={onHome}
        onKeyDown={(e) => (e.key === "Enter" ? onHome() : null)}
      >
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
        <a href="/developers">Developers</a>
        <a href="/customers">Customers</a>
        <a href="/pricing">Pricing</a>
        <a href="/enterprise">Enterprise</a>
        <a href="/trust">Trust</a>
        <a href={API_DOCS} target="_blank" rel="noreferrer">
          API
        </a>
        <a href="/status">Status</a>
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

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="pbi-bullet">
      <span className="pbi-bulletDot">•</span>
      <span>{children}</span>
    </div>
  );
}

function ProofRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="pbi-card" style={{ padding: 12, borderRadius: 18 }}>
      <div className="pbi-proofLabel">{k}</div>
      <div style={{ marginTop: 6, color: "rgba(255,255,255,.82)", fontSize: 13, lineHeight: 1.45, textAlign: "right" }}>
        {v}
      </div>
    </div>
  );
}
