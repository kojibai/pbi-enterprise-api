// pages/customers.tsx
import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { apiJson } from "../lib/api";

const API_DOCS = "https://api.kojib.com/docs";
const DEMO_URL = "https://demo.kojib.com";
const TOOL_URL = "https://tool.kojib.com";
const SITE_URL = "https://pbi.kojib.com";

type AuthState = "unknown" | "logged_out" | "logged_in";

type CaseStudy = {
  title: string;
  industry: string;
  problem: string;
  solution: string;
  result: string;
  firstEndpoint: string;
};

export default function CustomersPage() {
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

  const pageUrl = useMemo(() => `${SITE_URL}/customers`, []);
  const ogImage = `${SITE_URL}/pbi_1.png`;

  const studies: CaseStudy[] = [
    {
      title: "Treasury approvals for money-out",
      industry: "Finance / Payments",
      problem: "Approvals were inferred from sessions and admin logs, creating dispute ambiguity and replay risk.",
      solution: "Presence-gated payout execution: actionHash bound to challenge, UP+UV required, receiptHash stored for audit mapping.",
      result: "Irreversible payouts become provable approvals with durable evidence references.",
      firstEndpoint: "POST /payout/execute (gated by PBI_VERIFIED)",
    },
    {
      title: "Admin control plane for role changes",
      industry: "Enterprise SaaS",
      problem: "Privileged role grants and key rotations had large blast radius when sessions were compromised or delegated.",
      solution: "Presence-gate admin actions (grant role, rotate key) with single-use challenges and receipt logging.",
      result: "Privileged changes become intentional ceremonies, not side effects of access.",
      firstEndpoint: "POST /admin/grant-role (gated by PBI_VERIFIED)",
    },
    {
      title: "Deploy approvals and production config",
      industry: "Infrastructure / DevOps",
      problem: "Deploy and config toggles were executed under broad permissions without action-level proof of presence.",
      solution: "Bind deploy intent to actionHash and require UP+UV for release actions; store receipts for incident review.",
      result: "Production changes become dispute-ready approvals with cryptographic evidence.",
      firstEndpoint: "POST /deploy/approve (gated by PBI_VERIFIED)",
    },
  ];

  return (
    <>
      <Head>
        <title>Customers · PBI</title>
        <meta
          name="description"
          content="PBI customers and use cases: presence-bound approvals for treasury, admin control planes, governance, deploy approvals, and mission-critical operations."
        />
        <link rel="canonical" href={pageUrl} />
        <meta name="robots" content="index,follow" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#05070e" />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Kojib" />
        <meta property="og:title" content="Customers · PBI" />
        <meta property="og:description" content="Use cases for presence-bound approvals and verifiable receipts." />
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
                    Customers · use cases
                  </div>

                  <h1 className="pbi-h1">
                    Where “approved” must mean <span>provably approved.</span>
                  </h1>

                  <p className="pbi-lead">
                    PBI is adopted where irreversible actions create real liability: treasury, governance, admin control planes, deploy approvals, and
                    legal/ownership actions. These examples are written to be procurement-friendly and implementation-ready.
                  </p>

                  <div className="pbi-ctaRow">
                    <a className="pbi-btnPrimary" href="/enterprise">
                      Enterprise onboarding <span aria-hidden>→</span>
                    </a>
                    <a className="pbi-btnGhost" href="/developers">
                      Developer hub
                    </a>
                    <a className="pbi-btnGhost" href={API_DOCS} target="_blank" rel="noreferrer">
                      API docs
                    </a>
                    <a className="pbi-btnGhost" href={DEMO_URL} target="_blank" rel="noreferrer">
                      Demo
                    </a>
                  </div>

                  <div className="pbi-valueGrid" style={{ marginTop: 14 }}>
                    <ValueLine title="Fast pilots" body="Start with 1 endpoint. Prove ROI. Expand coverage." />
                    <ValueLine title="Evidence receipts" body="Store receiptHash and action context for audit and disputes." />
                    <ValueLine title="Strict guarantees" body="UP+UV occurred for a single-use, time-bounded challenge bound to actionHash." />
                    <ValueLine title="Keep existing auth" body="PBI hardens actions without replacing SSO/OAuth/JWT." />
                  </div>
                </div>

                <aside className="pbi-side">
                  <div className="pbi-sideTop">
                    <div>
                      <div className="pbi-proofLabel">Best first wins</div>
                      <div className="pbi-sideTitle">Start where blast radius is highest</div>
                    </div>
                    <div className="pbi-sideTag">pilot</div>
                  </div>

                  <div className="pbi-sideList">
                    <Bullet>Treasury / payouts</Bullet>
                    <Bullet>Role changes / key rotation</Bullet>
                    <Bullet>Deploy approvals / config</Bullet>
                    <Bullet>Governance actions</Bullet>
                    <Bullet>Legal / ownership actions</Bullet>
                  </div>

                  <pre className="pbi-code">{`Rollout:
1) pick 1 irreversible endpoint
2) actionHash + challenge
3) UP+UV verify
4) store receiptHash
5) expand coverage`}</pre>

                  <a className="pbi-btnGhost" href={TOOL_URL} target="_blank" rel="noreferrer" style={{ width: "100%", justifyContent: "center" }}>
                    Open tool →
                  </a>
                </aside>
              </div>
            </section>

            <section className="pbi-section">
              <SectionHead kicker="Case studies" title="Representative deployments" body="Written to map cleanly to engineering + security review concerns." />

              <div style={{ display: "grid", gap: 10 }}>
                {studies.map((cs) => (
                  <CaseCard key={cs.title} cs={cs} />
                ))}
              </div>
            </section>

            <section className="pbi-section">
              <SectionHead
                kicker="Vertical fit"
                title="Where PBI is typically approved fastest"
                body="These teams already understand the liability of session-based approvals."
              />

              <div className="pbi-sectionGrid3">
                <MiniCard title="Finance & custodians" body="Money movement, settlement, withdrawals, treasury approvals." />
                <MiniCard title="Enterprise SaaS" body="Admin control planes, privileged changes, key rotations." />
                <MiniCard title="Infrastructure" body="Deploy approvals, config flags, incident actions." />
                <MiniCard title="Government / regulated" body="Evidence-heavy operations, chain-of-custody, audit trails." />
                <MiniCard title="Legal workflows" body="Ownership and signature-like approvals with dispute-ready evidence." />
                <MiniCard title="AI oversight" body="Human-in-the-loop approvals where presence must be provable." />
              </div>
            </section>

            <section className="pbi-section">
              <div className="pbi-card" style={{ background: "rgba(120,255,231,.08)", borderColor: "rgba(120,255,231,.28)" }}>
                <div className="pbi-proofLabel">Next step</div>
                <div className="pbi-cardTitle" style={{ marginTop: 6 }}>
                  Pick the one action you can’t afford to dispute.
                </div>
                <div className="pbi-cardBody" style={{ marginTop: 6 }}>
                  We’ll scope a pilot that hardens it with presence verification and receipts. Once it works there, expanding coverage is straightforward.
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <a className="pbi-btnPrimary" href="/enterprise">
                    Enterprise onboarding →
                  </a>
                  <a className="pbi-btnGhost" href="/security">
                    Security →
                  </a>
                  <a className="pbi-btnGhost" href="/trust">
                    Trust Center →
                  </a>
                  <a className="pbi-btnGhost" href="/developers">
                    Developers →
                  </a>
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

function CaseCard({ cs }: { cs: CaseStudy }) {
  return (
    <div className="pbi-card" style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div className="pbi-cardTitle" style={{ fontSize: 18 }}>
          {cs.title}
        </div>
        <div className="pbi-sideTag">{cs.industry}</div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        <Row label="Problem" value={cs.problem} />
        <Row label="Solution" value={cs.solution} />
        <Row label="Result" value={cs.result} />
        <Row label="First endpoint" value={cs.firstEndpoint} mono />
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="pbi-card" style={{ padding: 12, borderRadius: 18, background: "rgba(0,0,0,.18)" }}>
      <div className="pbi-proofLabel">{label}</div>
      <div
        style={{
          marginTop: 6,
          color: "rgba(255,255,255,.84)",
          fontSize: 13,
          lineHeight: 1.5,
          fontFamily: mono
            ? "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
            : undefined,
        }}
      >
        {value}
      </div>
    </div>
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
            Console
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

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="pbi-bullet">
      <span className="pbi-bulletDot">•</span>
      <span>{children}</span>
    </div>
  );
}
