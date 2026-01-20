// pages/sdk.tsx
import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { apiJson } from "../lib/api";

const API_DOCS = "https://api.kojib.com/docs";
const DEMO_URL = "https://demo.kojib.com";
const TOOL_URL = "https://tool.kojib.com";
const SITE_URL = "https://pbi.kojib.com";

const SDK_PACKAGE = "presencebound-sdk";
const SDK_VERSION = "1.0.2";
const SDK_NPM_URL = `https://www.npmjs.com/package/${SDK_PACKAGE}`;
const SDK_EXAMPLE_URL =
  "https://github.com/kojibai/pbi-enterprise-api/tree/main/packages/presencebound-sdk/examples/node-sdk";
const SDK_REPO_URL = "https://github.com/kojibai/pbi-enterprise-api/tree/main/packages/presencebound-sdk";
const SDK_RELEASES_URL = "https://github.com/kojibai/pbi-enterprise-api/releases";

type AuthState = "unknown" | "logged_out" | "logged_in";

function buildSdkQuickstart(baseUrl: string): string {
  return `import { PresenceBound, PresenceBoundError } from "${SDK_PACKAGE}";

const client = new PresenceBound({
  apiKey: process.env.PRESENCEBOUND_API_KEY ?? "",
  baseUrl: "${baseUrl}",
  timeoutMs: 15000,
  userAgent: "your-app/1.0.0"
});

async function run() {
  const challenge = await client.createChallenge({
    actionHashHex: "a".repeat(64),
    purpose: "ACTION_COMMIT"
  });

  console.log("challengeId:", challenge.data.id, "requestId:", challenge.requestId);

  // Auto-pagination
  for await (const item of client.iterateReceipts({ limit: 100, order: "desc" })) {
    console.log(item.receipt.id, item.receipt.decision);
  }
}

run().catch((err) => {
  if (err instanceof PresenceBoundError) {
    console.error({ status: err.status, requestId: err.requestId, details: err.details });
    process.exit(1);
  }
  throw err;
});`;
}

function buildCjsExample(): string {
  return `const { PresenceBound, PresenceBoundError } = require("${SDK_PACKAGE}");

const client = new PresenceBound({
  apiKey: process.env.PRESENCEBOUND_API_KEY || "",
  timeoutMs: 15000,
  userAgent: "your-app/1.0.0"
});

(async () => {
  try {
    const r = await client.createChallenge({
      actionHashHex: "a".repeat(64),
      purpose: "ACTION_COMMIT"
    });
    console.log("challengeId:", r.data.id, "requestId:", r.requestId);
  } catch (err) {
    if (err instanceof PresenceBoundError) {
      console.error({ status: err.status, requestId: err.requestId, details: err.details });
      process.exit(1);
    }
    throw err;
  }
})();`;
}

function buildInstall(): string {
  return `npm i ${SDK_PACKAGE}`;
}

function buildEnvExample(): string {
  return `# Required
PRESENCEBOUND_API_KEY=replace_me

# Optional
PRESENCEBOUND_BASE_URL=https://api.kojib.com`;
}

function buildErrorShape(): string {
  return `try {
  await client.verifyChallenge({ challengeId, assertion });
} catch (err) {
  if (err instanceof PresenceBoundError) {
    // Correlate incidents via requestId when present
    console.error({
      status: err.status,
      requestId: err.requestId,
      message: err.message,
      details: err.details
    });
  }
}`;
}

export default function SdkPage() {
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

  const pageUrl = useMemo(() => `${SITE_URL}/sdk`, []);
  const ogImage = `${SITE_URL}/pbi_1.png`;

  const baseUrl = useMemo(() => "https://api.kojib.com", []);
  const installCmd = useMemo(() => buildInstall(), []);
  const envExample = useMemo(() => buildEnvExample(), []);
  const quickstart = useMemo(() => buildSdkQuickstart(baseUrl), [baseUrl]);
  const cjsExample = useMemo(() => buildCjsExample(), []);
  const errorShape = useMemo(() => buildErrorShape(), []);

  async function copy(text: string, key: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(""), 1200);
    } catch {
      // ignore
    }
  }

  return (
    <>
      <Head>
        <title>SDK · PresenceBound</title>
        <meta
          name="description"
          content="Official Node/TypeScript SDK for PresenceBound (PBI): typed methods, consistent errors, ESM+CJS support, and an end-to-end WebAuthn example."
        />
        <link rel="canonical" href={pageUrl} />
        <meta name="robots" content="index,follow" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#05070e" />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Kojib" />
        <meta property="og:title" content="SDK · PresenceBound" />
        <meta property="og:description" content="Official SDK for integrating PresenceBound Identity (PBI) in Node/TypeScript." />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={ogImage} />
      </Head>

      <div className="pbi-landing">
        <div className="pbi-bg" aria-hidden />
        <div className="pbi-shell">
          <TopBar auth={auth} onHome={() => router.push("/")} />

          <main>
            {/* HERO */}
            <section className="pbi-hero" style={{ paddingBottom: 10 }}>
              <div className="pbi-heroGrid">
                <div>
                  <div className="pbi-pill">
                    <span className="pbi-pillDot" />
                    Official SDK · Node/TypeScript
                  </div>

                  <h1 className="pbi-h1">
                    Integrate PBI in minutes with <span>{SDK_PACKAGE}</span>.
                  </h1>

                  <p className="pbi-lead">
                    A production-grade client for PresenceBound Identity (PBI): typed methods, consistent error semantics, and a clean, audit-friendly
                    integration surface. Built for enterprise systems where correctness and traceability matter.
                  </p>

                  <div className="pbi-ctaRow">
                    <a className="pbi-btnPrimary" href={SDK_NPM_URL} target="_blank" rel="noreferrer">
                      npm package <span aria-hidden>→</span>
                    </a>
                    <a className="pbi-btnGhost" href={SDK_EXAMPLE_URL} target="_blank" rel="noreferrer">
                      End-to-end example
                    </a>
                    <a className="pbi-btnGhost" href={API_DOCS} target="_blank" rel="noreferrer">
                      API docs
                    </a>
                    <a className="pbi-btnGhost" href="/console">
                      Client portal
                    </a>
                  </div>
                </div>

                <aside className="pbi-side">
                  <div className="pbi-sideTop">
                    <div>
                      <div className="pbi-proofLabel">Latest</div>
                      <div className="pbi-sideTitle">{SDK_PACKAGE}</div>
                    </div>
                    <div className="pbi-sideTag">v{SDK_VERSION}</div>
                  </div>

                  <div className="pbi-sideList">
                    <Bullet>Typed client + strict runtime behavior</Bullet>
                    <Bullet>ESM + CommonJS support</Bullet>
                    <Bullet>Receipt pagination iterator</Bullet>
                    <Bullet>Typed errors w/ requestId correlation</Bullet>
                  </div>

                  <pre className="pbi-code">{`Install:
${installCmd}

Runtime:
- Node.js 18+
- fetch + AbortController`}</pre>
                </aside>
              </div>
            </section>

            {/* COMPAT */}
            <section className="pbi-section">
              <SectionHead kicker="Compatibility" title="Runtime + module support" body="Designed for modern server runtimes and enterprise deploy pipelines." />

              <div style={{ display: "grid", gap: 10 }}>
                <div className="pbi-card" style={{ padding: 14 }}>
                  <div className="pbi-cardTitle">Supported environments</div>
                  <div style={{ marginTop: 10, overflowX: "auto" }}>
                    <table className="pbi-table" aria-label="SDK compatibility">
                      <thead>
                        <tr>
                          <th>Runtime</th>
                          <th>Supported</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Node.js</td>
                          <td>
                            <span className="pbi-badgeOk">18+</span>
                          </td>
                          <td>Uses built-in fetch / URL / AbortController</td>
                        </tr>
                        <tr>
                          <td>ESM</td>
                          <td>
                            <span className="pbi-badgeOk">Yes</span>
                          </td>
                          <td>Standard import syntax</td>
                        </tr>
                        <tr>
                          <td>CommonJS</td>
                          <td>
                            <span className="pbi-badgeOk">Yes</span>
                          </td>
                          <td>require() supported via CJS build</td>
                        </tr>
                        <tr>
                          <td>Browsers</td>
                          <td>
                            <span className="pbi-badgeWarn">Not targeted</span>
                          </td>
                          <td>CORS + credential ceremony is application-specific</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="pbi-cardBody" style={{ marginTop: 10 }}>
                    Need Node 16? Polyfill fetch (e.g. undici) before importing the SDK.
                  </div>
                </div>
              </div>
            </section>

            {/* INSTALL */}
            <section className="pbi-section">
              <SectionHead kicker="Install" title="Start here" body="Copy/paste paths that work in real production repos." />

              <div style={{ display: "grid", gap: 10 }}>
                <div className="pbi-card" style={{ padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div className="pbi-cardTitle">Install the SDK</div>
                    <button className="pbi-btnGhost" type="button" onClick={() => void copy(installCmd, "install")}>
                      {copied === "install" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <pre className="pbi-code" style={{ marginTop: 10 }}>
{installCmd}
                  </pre>
                </div>

                <div className="pbi-card" style={{ padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div className="pbi-cardTitle">Configure environment</div>
                    <button className="pbi-btnGhost" type="button" onClick={() => void copy(envExample, "env")}>
                      {copied === "env" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <pre className="pbi-code" style={{ marginTop: 10 }}>
{envExample}
                  </pre>
                  <div className="pbi-cardBody" style={{ marginTop: 8 }}>
                    Create API keys in the <a href="/console">client portal</a>. Keys are shown once.
                  </div>
                </div>
              </div>
            </section>

            {/* QUICKSTART */}
            <section className="pbi-section">
              <SectionHead kicker="Quickstart" title="Minimal client" body="Create a challenge, verify presence, and persist receipts for audit." />

              <div style={{ display: "grid", gap: 10 }}>
                <div className="pbi-card" style={{ padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div className="pbi-cardTitle">ESM (recommended)</div>
                    <button className="pbi-btnGhost" type="button" onClick={() => void copy(quickstart, "qs")}>
                      {copied === "qs" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <pre className="pbi-code" style={{ marginTop: 10, maxHeight: 420, overflow: "auto" }}>
{quickstart}
                  </pre>
                </div>

                <div className="pbi-card" style={{ padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div className="pbi-cardTitle">CommonJS</div>
                    <button className="pbi-btnGhost" type="button" onClick={() => void copy(cjsExample, "cjs")}>
                      {copied === "cjs" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <pre className="pbi-code" style={{ marginTop: 10, maxHeight: 360, overflow: "auto" }}>
{cjsExample}
                  </pre>
                </div>
              </div>
            </section>

            {/* ERROR SEMANTICS */}
            <section className="pbi-section">
              <SectionHead kicker="Errors" title="Consistent semantics (enterprise friendly)" body="Non-2xx responses throw a typed PresenceBoundError." />

              <div style={{ display: "grid", gap: 10 }}>
                <div className="pbi-card" style={{ padding: 14 }}>
                  <div className="pbi-cardTitle">PresenceBoundError</div>
                  <div className="pbi-cardBody" style={{ marginTop: 8 }}>
                    Use <code className="pbi-inlineCode">requestId</code> to correlate incidents across app logs, webhook deliveries, and support.
                    Structured server errors are available under <code className="pbi-inlineCode">details</code> when present.
                  </div>

                  <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <button className="pbi-btnGhost" type="button" onClick={() => void copy(errorShape, "err")}>
                      {copied === "err" ? "Copied" : "Copy snippet"}
                    </button>
                  </div>

                  <pre className="pbi-code" style={{ marginTop: 10 }}>
{errorShape}
                  </pre>

                  <pre className="pbi-code" style={{ marginTop: 10 }}>{`Fields:
- status: number
- requestId?: string
- details?: { error: string; issues?: Record<string, unknown>[] }`}</pre>
                </div>
              </div>
            </section>

            {/* FEATURE SURFACE */}
            <section className="pbi-section">
              <SectionHead
                kicker="Surface area"
                title="What the SDK covers"
                body="A single client that cleanly maps to the PBI API surface without hiding semantics."
              />

              <div style={{ display: "grid", gap: 10 }}>
                <div className="pbi-card" style={{ padding: 14 }}>
                  <div className="pbi-cardTitle">Core PBI</div>
                  <div className="pbi-cardBody" style={{ marginTop: 8 }}>
                    Challenge issuance, verification, receipts listing, and receipt verification.
                  </div>
                  <pre className="pbi-code" style={{ marginTop: 10 }}>{`client.createChallenge(...)
client.verifyChallenge(...)
client.listReceipts(...)
client.iterateReceipts(...)
client.getReceipt(...)
client.verifyReceipt(...)`}</pre>
                </div>

                <div className="pbi-card" style={{ padding: 14 }}>
                  <div className="pbi-cardTitle">Compliance / Evidence</div>
                  <div className="pbi-cardBody" style={{ marginTop: 8 }}>
                    Export signed evidence packs (ZIP) for offline audit and investigation workflows.
                  </div>
                  <pre className="pbi-code" style={{ marginTop: 10 }}>{`client.exportReceipts(...) -> Uint8Array (zip)`}</pre>
                </div>

                <div className="pbi-card" style={{ padding: 14 }}>
                  <div className="pbi-cardTitle">Billing</div>
                  <div className="pbi-cardBody" style={{ marginTop: 8 }}>
                    Retrieve usage and invoices for governance and finance workflows.
                  </div>
                  <pre className="pbi-code" style={{ marginTop: 10 }}>{`client.getUsage(month?)
client.listInvoices()`}</pre>
                </div>
              </div>
            </section>

            {/* EXAMPLES */}
            <section className="pbi-section">
              <SectionHead kicker="Examples" title="End-to-end demo" body="The fastest route to first verified receipt." />

              <div style={{ display: "grid", gap: 10 }}>
                <div className="pbi-card" style={{ padding: 14 }}>
                  <div className="pbi-cardTitle">Node + Express + WebAuthn</div>
                  <div className="pbi-cardBody" style={{ marginTop: 8 }}>
                    A complete example that creates challenges on the server, performs WebAuthn in the browser, and verifies via PBI.
                  </div>
                  <pre className="pbi-code" style={{ marginTop: 10 }}>{`./packages/presencebound-sdk/examples/node-sdk/`}</pre>
                  <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <a className="pbi-btnPrimary" href={SDK_EXAMPLE_URL} target="_blank" rel="noreferrer">
                      Open example <span aria-hidden>→</span>
                    </a>
                    <a className="pbi-btnGhost" href={SDK_REPO_URL} target="_blank" rel="noreferrer">
                      SDK source
                    </a>
                    <a className="pbi-btnGhost" href={SDK_RELEASES_URL} target="_blank" rel="noreferrer">
                      Releases
                    </a>
                  </div>
                </div>
              </div>
            </section>

            {/* OPERATIONAL NOTES */}
            <section className="pbi-section">
              <SectionHead
                kicker="Operational guidance"
                title="Production notes"
                body="What enterprise reviewers expect: decision gating, hashing discipline, and traceable operations."
              />

              <div style={{ display: "grid", gap: 10 }}>
                <ProofRow k="Decision gate" v='Proceed only when decision === "PBI_VERIFIED". Treat all other decisions as “do not execute”.' />
                <ProofRow
                  k="Action hashing"
                  v="Hash the exact irreversible action (actor, target, amounts, policy). Canonicalize encoding and version your action schema."
                />
                <ProofRow
                  k="Request correlation"
                  v="Log requestId and attach it to incident tickets. It’s the fastest route to root-cause and audit reconstruction."
                />
                <ProofRow k="Timeouts" v="Use timeouts in all clients and treat retries as idempotent-only unless your action is designed for retry." />
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
        <a href="/sdk" aria-current="page">
          SDK
        </a>
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

