// pages/enterprise/rollout.tsx
import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { apiJson } from "../../lib/api";

const API_DOCS = "https://api.kojib.com/docs";
const DEMO_URL = "https://demo.kojib.com";
const TOOL_URL = "https://tool.kojib.com";
const SITE_URL = "https://pbi.kojib.com";

type AuthState = "unknown" | "logged_out" | "logged_in";

type Step = {
  day: string;
  time: string;
  goal: string;
  bullets: string[];
};

export default function RolloutGuidePage() {
  const router = useRouter();

  const [auth, setAuth] = useState<AuthState>("unknown");
  const [copied, setCopied] = useState<string>("");

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

  const pageUrl = useMemo(() => `${SITE_URL}/enterprise/rollout`, []);
  const ogImage = `${SITE_URL}/pbi_1.png`;

  const steps: Step[] = [
    {
      day: "Day 0",
      time: "30–60 min",
      goal: "First verified receipt",
      bullets: [
        "Create an API key in the Portal (shown once).",
        "Run the ceremony end-to-end: challenge → verify → receipt.",
        "Confirm receipt retrieval works via receipts list/detail endpoints."
      ]
    },
    {
      day: "Day 1",
      time: "1–2 hours",
      goal: "Gate one high-risk action",
      bullets: [
        "Choose one critical action (password reset, payout change, admin escalation, large transfer).",
        "Compute a stable actionHashHex and require PBI_VERIFIED before commit.",
        "Store receiptId on the action record for audit and dispute handling."
      ]
    },
    {
      day: "Day 3",
      time: "1–3 hours",
      goal: "Real-time audit stream (webhooks)",
      bullets: [
        "Portal → Enterprise Controls → create receipt.created webhook endpoint.",
        "Verify HMAC signature in your receiver and store deliveryId for idempotency.",
        "Forward to SIEM / audit pipeline / incident tooling."
      ]
    },
    {
      day: "Day 5",
      time: "30–90 min",
      goal: "Compliance evidence exports",
      bullets: [
        "Portal → Export evidence pack (cookie-auth, no API keys in browser).",
        "Archive signed export packs for investigations and audits.",
        "Use time windows for large exports (designed for predictable load)."
      ]
    },
    {
      day: "Day 7",
      time: "Half-day",
      goal: "Governance hardening",
      bullets: [
        "Create scoped keys: pbi.verify (runtime), pbi.read_receipts (audit), pbi.export (compliance).",
        "Rotate keys and webhook secrets on schedule.",
        "Confirm last-used metadata (time/IP) supports internal controls and reviews."
      ]
    }
  ];

  async function copy(text: string, key: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(""), 1200);
    } catch {
      // ignore
    }
  }

  const signatureBase = "<timestamp>.<deliveryId>.<rawBody>";

  return (
    <>
      <Head>
        <title>Enterprise Rollout Guide · PBI</title>
        <meta
          name="description"
          content="A 1-page enterprise rollout guide for Presence-Bound Identity: Day 0 to Day 7 implementation, webhooks, exports, and governance."
        />
        <link rel="canonical" href={pageUrl} />
        <meta name="robots" content="index,follow" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#05070e" />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Kojib" />
        <meta property="og:title" content="Enterprise Rollout Guide · PBI" />
        <meta property="og:description" content="Day 0 → Day 7 implementation plan: first receipt, gating, webhooks, exports, governance." />
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
                    Enterprise rollout · one-page guide
                  </div>

                  <h1 className="pbi-h1">
                    Day 0 → Day 7: <span>Production rollout for PBI.</span>
                  </h1>

                  <p className="pbi-lead">
                    A pragmatic implementation sequence designed for banks, marketplaces, enterprises, and public-sector systems:
                    fast time-to-value, clean audit trails, and predictable operations.
                  </p>

                  <div className="pbi-ctaRow">
                    <a className="pbi-btnPrimary" href={API_DOCS} target="_blank" rel="noreferrer">
                      API docs <span aria-hidden>→</span>
                    </a>
                    <a className="pbi-btnGhost" href="/console">
                      Client portal
                    </a>
                    <a className="pbi-btnGhost" href={DEMO_URL} target="_blank" rel="noreferrer">
                      Demo
                    </a>
                    <a className="pbi-btnGhost" href={TOOL_URL} target="_blank" rel="noreferrer">
                      Attester tool
                    </a>
                  </div>
                </div>

                <aside className="pbi-side">
                  <div className="pbi-sideTop">
                    <div>
                      <div className="pbi-proofLabel">Outcome</div>
                      <div className="pbi-sideTitle">Deployed control, not a demo</div>
                    </div>
                    <div className="pbi-sideTag">v1</div>
                  </div>

                  <div className="pbi-sideList">
                    <Bullet>Gate one high-risk action</Bullet>
                    <Bullet>Real-time receipt stream (webhooks)</Bullet>
                    <Bullet>Offline-verifiable evidence exports</Bullet>
                  </div>

                  <pre className="pbi-code">{`Success criteria:
- one high-risk action gated
- receipt.created ingested
- exports archived + verifiable
- scoped keys + rotation`}</pre>
                </aside>
              </div>
            </section>

            <section className="pbi-section">
              <SectionHead
                kicker="Implementation sequence"
                title="Day-by-day rollout"
                body="Each step is designed to be independently valuable, with clear success criteria and minimal integration overhead."
              />

              <div style={{ display: "grid", gap: 10 }}>
                {steps.map((s) => (
                  <div key={s.day} className="pbi-card" style={{ padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div className="pbi-cardTitle" style={{ fontSize: 18 }}>
                        {s.day} · {s.goal}
                        <span style={{ marginLeft: 10, fontSize: 12, color: "rgba(255,255,255,.58)" }}>{s.time}</span>
                      </div>
                      <div className="pbi-sideTag">Step</div>
                    </div>

                    <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                      {s.bullets.map((b) => (
                        <div key={`${s.day}:${b}`} className="pbi-bullet" style={{ color: "rgba(255,255,255,.82)" }}>
                          <span className="pbi-bulletDot">•</span>
                          <span>{b}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="pbi-section">
              <SectionHead
                kicker="Enterprise integration notes"
                title="Action hashing, webhooks, exports"
                body="These are the three implementation details security and compliance teams will ask about first."
              />

              <div style={{ display: "grid", gap: 10 }}>
                <div className="pbi-card" style={{ padding: 14 }}>
                  <div className="pbi-cardTitle">Action hash (actionHashHex)</div>
                  <div className="pbi-cardBody" style={{ marginTop: 8 }}>
                    Compute actionHashHex from a canonical representation of the action you are protecting (actor, action type, target identifiers,
                    amount/limits, and any risk-relevant fields). This binds presence verification to the exact operation being committed.
                  </div>

                  <pre className="pbi-code" style={{ marginTop: 10 }}>{`Recommended fields:
- actorId, actionType
- targetId / resourceId
- amount + currency (if applicable)
- risk context (optional)
- timestamp bucket (optional)`}</pre>
                </div>

                <div className="pbi-card" style={{ padding: 14 }}>
                  <div className="pbi-cardTitle">Webhook signature verification</div>
                  <div className="pbi-cardBody" style={{ marginTop: 8 }}>
                    Deliveries are signed (HMAC-SHA256) with replay-safe metadata. Store deliveryId for idempotency and enforce a timestamp tolerance
                    window.
                  </div>

                  <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <pre className="pbi-code" style={{ flex: "1 1 520px", margin: 0 }}>{signatureBase}</pre>
                    <button
                      className="pbi-btnGhost"
                      type="button"
                      onClick={() => void copy(signatureBase, "sigbase")}
                      aria-label="Copy signature base string"
                    >
                      {copied === "sigbase" ? "Copied" : "Copy"}
                    </button>
                  </div>

                  <pre className="pbi-code" style={{ marginTop: 10 }}>{`Headers:
- X-PBI-Event
- X-PBI-Delivery-Id
- X-PBI-Timestamp
- X-PBI-Signature: v1=<hex_hmac>`}</pre>
                </div>

                <div className="pbi-card" style={{ padding: 14 }}>
                  <div className="pbi-cardTitle">Evidence export packs</div>
                  <div className="pbi-cardBody" style={{ marginTop: 8 }}>
                    Exports are designed for offline verification: receipts NDJSON, policy snapshot, manifest hashes, Ed25519 signature, and a
                    verification note. Use portal exports for compliance workflows (cookie-auth, no API keys in browser).
                  </div>

                  <pre className="pbi-code" style={{ marginTop: 10 }}>{`Portal export:
GET /v1/portal/receipts/export

API export:
GET /v1/pbi/receipts/export`}</pre>
                </div>
              </div>
            </section>

            <section className="pbi-section">
              <SectionHead
                kicker="Security & governance"
                title="Least privilege, rotation, audit posture"
                body="What top-tier orgs expect to see before production approval."
              />

              <div style={{ display: "grid", gap: 10 }}>
                <ProofRow k="Scoped keys" v="Use pbi.verify for runtime, pbi.read_receipts for audit, and pbi.export for compliance-only exports." />
                <ProofRow k="Key rotation" v="Rotate API keys and webhook secrets on schedule and after incidents; secrets are shown once." />
                <ProofRow k="Audit posture" v="Use webhook stream for real-time monitoring and export packs for offline audit and archival." />
                <ProofRow k="Separation" v="Keep production and staging isolated: separate keys, endpoints, and webhook secrets per environment." />
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
