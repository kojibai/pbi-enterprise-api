// pages/pricing.tsx
import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { apiJson } from "../lib/api";

const API_DOCS = "https://api.kojib.com/docs";
const DEMO_URL = "https://demo.kojib.com";
const TOOL_URL = "https://tool.kojib.com";
const SITE_URL = "https://pbi.kojib.com";

type AuthState = "unknown" | "logged_out" | "logged_in";

export default function PricingPage() {
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

  const pageUrl = useMemo(() => `${SITE_URL}/pricing`, []);
  const ogImage = `${SITE_URL}/pbi_1.png`;

  // ✅ EDIT THESE to match your server-enforced quotas (same as your landing example)
  const PLAN_QUOTA = {
    starter: 10_000,
    pro: 100_000,
    scale: 1_000_000,
  } as const;

  function fmtInt(n: number) {
    return n.toLocaleString();
  }

  return (
    <>
      <Head>
        <title>Pricing · PBI · Presence-Bound Identity</title>
        <meta
          name="description"
          content="PBI pricing tiers for presence verification: Starter, Pro, Scale, and Enterprise (PBI Assured). A verification is one successful /v1/pbi/verify returning PBI_VERIFIED."
        />
        <link rel="canonical" href={pageUrl} />
        <meta name="robots" content="index,follow" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" href="/kojib.png" />
        <link rel="apple-touch-icon" href="/kojib.png" />
        <meta name="theme-color" content="#05070e" />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Kojib" />
        <meta property="og:title" content="Pricing · PBI" />
        <meta
          property="og:description"
          content="Choose verification capacity. A verification is one successful /v1/pbi/verify returning PBI_VERIFIED. Usage is metered automatically."
        />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="PBI pricing — presence verification tiers" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Pricing · PBI" />
        <meta
          name="twitter:description"
          content="Choose verification capacity. A verification is one successful /v1/pbi/verify returning PBI_VERIFIED. Usage is metered automatically."
        />
        <meta name="twitter:image" content={ogImage} />
        <meta name="twitter:image:alt" content="PBI pricing — presence verification tiers" />
      </Head>

      <div className="pbi-landing">
        <div className="pbi-bg" aria-hidden />
        <div className="pbi-shell">
          <header className="pbi-topbar">
            <div
              className="pbi-brand"
              role="button"
              tabIndex={0}
              onClick={() => router.push("/")}
              onKeyDown={(e) => (e.key === "Enter" ? router.push("/") : null)}
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
              <a href="/about">About</a>
              <a href="/enterprise">Enterprise</a>
              <a href="/security">Security</a>
              <a href="/pricing">Pricing</a>
              <a href={API_DOCS} target="_blank" rel="noreferrer">
                API
              </a>
              <a href={DEMO_URL} target="_blank" rel="noreferrer">
                Demo
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

          <main>
            {/* HERO */}
            <section className="pbi-hero" style={{ paddingBottom: 10 }}>
              <div className="pbi-heroGrid">
                <div>
                  <div className="pbi-pill">
                    <span className="pbi-pillDot" />
                    Pricing · verification capacity
                  </div>

                  <h1 className="pbi-h1">
                    Choose capacity for <span>provable approvals.</span>
                  </h1>

                  <p className="pbi-lead">
                    PBI is metered by successful verifications. A “verification” is one{" "}
                    <span
                      style={{
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                        fontSize: 12,
                      }}
                    >
                      /v1/pbi/verify
                    </span>{" "}
                    returning <b>PBI_VERIFIED</b>. You can keep your existing auth stack and presence-gate only the actions that matter.
                  </p>

                  <div className="pbi-ctaRow">
                    <a className="pbi-btnPrimary" href={auth === "logged_in" ? "/console" : "/#access"}>
                      {auth === "logged_in" ? "Go to console" : "Get access"} <span aria-hidden>→</span>
                    </a>
                    <a className="pbi-btnGhost" href={API_DOCS} target="_blank" rel="noreferrer">
                      Read API docs
                    </a>
                    <a className="pbi-btnGhost" href={DEMO_URL} target="_blank" rel="noreferrer">
                      Run demo
                    </a>
                    <a className="pbi-btnGhost" href="/enterprise">
                      Enterprise
                    </a>
                  </div>

                  <div className="pbi-valueGrid" style={{ marginTop: 14 }}>
                    <ValueLine title="Metered usage" body="Only successful PBI_VERIFIED verifications count toward capacity." />
                    <ValueLine title="Audit ready" body="Receipt hashes provide durable evidence references for disputes and forensics." />
                    <ValueLine title="No lock-in UX" body="Gate only irreversible endpoints; keep sessions for everything else." />
                    <ValueLine title="Enterprise path" body="PBI Assured supports pilots, security packets, and procurement workflows." />
                  </div>
                </div>

                <aside className="pbi-side">
                  <div className="pbi-sideTop">
                    <div>
                      <div className="pbi-proofLabel">What counts as usage</div>
                      <div className="pbi-sideTitle">Only VERIFIED is billed.</div>
                    </div>
                    <div className="pbi-sideTag">clear</div>
                  </div>

                  <div className="pbi-sideList">
                    <Bullet>
                      <b>Billed:</b> verify returns <b>PBI_VERIFIED</b>
                    </Bullet>
                    <Bullet>
                      <b>Not billed:</b> denied, expired, invalid, replay attempts
                    </Bullet>
                    <Bullet>
                      <b>Store:</b> receiptHash + decision + action context
                    </Bullet>
                  </div>

                  <pre className="pbi-code">{`POST /v1/pbi/verify
→ decision: PBI_VERIFIED | DENIED | ERROR
→ receiptHash (when verified)

Billing unit:
count(decision == PBI_VERIFIED)`}</pre>
                </aside>
              </div>
            </section>

            {/* PLANS */}
            <section className="pbi-section">
              <SectionHead
                kicker="Plans"
                title="Pricing tiers"
                body="Pick a tier based on how many irreversible actions you expect to presence-gate each month. Expand coverage over time."
              />

              <div className="pbi-sectionGrid3">
                <PlanCard
                  name="Starter"
                  price="$99"
                  period="/month"
                  tagline="Ship presence gates fast."
                  bestFor="Best for: teams shipping their first high-risk presence gates."
                  bullets={[
                    "Presence verification core",
                    `Includes ${fmtInt(PLAN_QUOTA.starter)} verifications/mo`,
                    "Receipt hash + audit trail",
                    "Overage billed per verification (shown in portal)",
                  ]}
                  ctaLabel={auth === "logged_in" ? "Open console" : "Get access"}
                  ctaHref={auth === "logged_in" ? "/console" : "/#access"}
                />

                <PlanCard
                  name="Pro"
                  price="$499"
                  period="/month"
                  tagline="Higher throughput + more automation."
                  bestFor="Best for: products scaling enforcement coverage."
                  bullets={[
                    "Everything in Starter",
                    `Includes ${fmtInt(PLAN_QUOTA.pro)} verifications/mo`,
                    "Priority processing",
                    "Overage billed per verification (shown in portal)",
                  ]}
                  featured
                  ctaLabel={auth === "logged_in" ? "Open console" : "Get access"}
                  ctaHref={auth === "logged_in" ? "/console" : "/#access"}
                />

                <PlanCard
                  name="Scale"
                  price="$1,999"
                  period="/month"
                  tagline="Authoritative human presence at scale."
                  bestFor="Best for: financial infrastructure, governance, and mission-critical control planes."
                  bullets={[
                    "Everything in Pro",
                    `Includes ${fmtInt(PLAN_QUOTA.scale)} verifications/mo`,
                    "Enterprise throughput + reliability",
                    "Optional portable proofs for audit workflows",
                    "Overage billed per verification (shown in portal)",
                  ]}
                  featured
                  ctaLabel={auth === "logged_in" ? "Open console" : "Get access"}
                  ctaHref={auth === "logged_in" ? "/console" : "/#access"}
                />

                <PlanCard
                  name="Enterprise (PBI Assured)"
                  price="Talk to Sales"
                  period=""
                  tagline="Procurement-ready. Governance support and enterprise guarantees."
                  bestFor="Best for: banks, governments, platforms, custodians, and mission-critical control planes."
                  bullets={[
                    "Paid pilot available (1 endpoint, 2 weeks)",
                    "Custom verification capacity + burst",
                    "SLA / priority support options",
                    "Security review packet on request",
                    "Trust policy + key rotation guidance",
                    "Audit export & evidence bundling",
                  ]}
                  featured
                  ctaLabel="Enterprise onboarding"
                  ctaHref="/enterprise"
                />
              </div>

              <div className="pbi-card" style={{ marginTop: 14 }}>
                <div className="pbi-cardTitle">What you get in the portal</div>
                <div className="pbi-cardBody" style={{ marginTop: 6 }}>
                  API keys, plan + quota visibility, usage metering, and invoice history — so teams can forecast capacity and auditors can trace usage.
                </div>

                <div className="pbi-sectionGrid3" style={{ marginTop: 12 }}>
                  <MiniCard title="API keys" body="Create, rotate, disable keys. Label keys per environment (dev/stage/prod)." />
                  <MiniCard title="Usage metering" body="Track verified events per month. See overage and capacity at a glance." />
                  <MiniCard title="Invoices" body="Export invoice history and usage summaries for internal accounting." />
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <a className="pbi-btnPrimary" href={auth === "logged_in" ? "/console" : "/#access"}>
                    {auth === "logged_in" ? "Go to console →" : "Get access →"}
                  </a>
                  <a className="pbi-btnGhost" href={API_DOCS} target="_blank" rel="noreferrer">
                    Docs →
                  </a>
                  <a className="pbi-btnGhost" href={TOOL_URL} target="_blank" rel="noreferrer">
                    Tool →
                  </a>
                  <a className="pbi-btnGhost" href={DEMO_URL} target="_blank" rel="noreferrer">
                    Demo →
                  </a>
                </div>
              </div>
            </section>

            {/* FAQ */}
            <section className="pbi-section">
              <SectionHead
                kicker="FAQ"
                title="Billing questions"
                body="Short answers that match how engineering and procurement teams evaluate metered APIs."
              />

              <div style={{ display: "grid", gap: 10 }}>
                <FaqItem
                  q="What exactly is a “verification”?"
                  a="One successful call to /v1/pbi/verify that returns decision = PBI_VERIFIED. Denies and errors are not billed as verifications."
                />
                <FaqItem
                  q="Do retries count?"
                  a="Only if the retry returns PBI_VERIFIED. If a challenge expired or was used, it should be denied and not count as a successful verification."
                />
                <FaqItem
                  q="Should we presence-gate every action?"
                  a="No. Gate only irreversible actions with high blast radius. Use normal sessions for low-risk operations to keep UX friction minimal."
                />
                <FaqItem
                  q="How do we estimate usage?"
                  a="Count how many irreversible approvals you execute per month (money out, admin changes, deploy approvals). Start with one endpoint and expand coverage."
                />
              </div>
            </section>

            <footer className="pbi-footer" style={{ marginTop: 6 }}>
              <div>© {new Date().getFullYear()} Kojib · PBI</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <a href="/terms">Terms</a>
                <a href="/privacy">Privacy</a>
                <a href="/enterprise">Enterprise</a>
                <a href="/security">Security</a>
                <a href={API_DOCS} target="_blank" rel="noreferrer">
                  API Docs
                </a>
                <a href={DEMO_URL} target="_blank" rel="noreferrer">
                  Demo
                </a>
              </div>
            </footer>
          </main>
        </div>
      </div>
    </>
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

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="pbi-card" style={{ padding: 14 }}>
      <div className="pbi-cardTitle" style={{ fontSize: 16 }}>
        {q}
      </div>
      <div className="pbi-cardBody" style={{ marginTop: 8 }}>
        {a}
      </div>
    </div>
  );
}

function PlanCard({
  name,
  price,
  period,
  tagline,
  bestFor,
  bullets,
  featured,
  ctaLabel,
  ctaHref,
}: {
  name: string;
  price: string;
  period: string;
  tagline: string;
  bestFor: string;
  bullets: string[];
  featured?: boolean;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  const hasHref = typeof ctaHref === "string" && ctaHref.length > 0;

  return (
    <div
      className="pbi-card"
      style={{
        background: featured ? "rgba(120,255,231,.08)" : "rgba(255,255,255,.06)",
        borderColor: featured ? "rgba(120,255,231,.32)" : "rgba(255,255,255,.12)",
      }}
    >
      {featured ? (
        <div className="pbi-sideTag" style={{ float: "right" }}>
          Recommended
        </div>
      ) : null}

      <div className="pbi-proofLabel">Plan</div>
      <div className="pbi-cardTitle" style={{ marginTop: 6 }}>
        {name}
      </div>

      <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 950, fontSize: 28, letterSpacing: "-0.02em" }}>{price}</div>
        <div style={{ color: "rgba(255,255,255,.70)", fontSize: 13 }}>{period}</div>
      </div>

      <div className="pbi-cardBody" style={{ marginTop: 10 }}>
        {tagline}
      </div>
      <div className="pbi-proofLabel" style={{ marginTop: 8 }}>
        {bestFor}
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
        {bullets.map((b) => (
          <div key={b} className="pbi-bullet" style={{ color: "rgba(255,255,255,.82)" }}>
            <span className="pbi-bulletDot">•</span>
            <span>{b}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14 }}>
        {hasHref ? (
          <a
            className={featured ? "pbi-btnPrimary" : "pbi-btnGhost"}
            href={ctaHref}
            rel="noreferrer"
            target={ctaHref.startsWith("http") ? "_blank" : undefined}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {ctaLabel || "Start"}
          </a>
        ) : (
          <a className={featured ? "pbi-btnPrimary" : "pbi-btnGhost"} href="/#access" style={{ width: "100%", justifyContent: "center" }}>
            {ctaLabel || "Get access"}
          </a>
        )}
      </div>
    </div>
  );
}