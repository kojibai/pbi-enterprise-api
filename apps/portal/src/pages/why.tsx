// pages/why.tsx
import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { apiJson } from "../lib/api";

// Prefer linking directly to docs (Interactive / Reference) vs root.
const API_DOCS = "https://api.kojib.com/docs";

// Public tools
const DEMO_URL = "https://demo.kojib.com";
const TOOL_URL = "https://tool.kojib.com";

// SEO / OG base
const SITE_URL = "https://pbi.kojib.com";

type AuthState = "unknown" | "logged_out" | "logged_in";

export default function WhyPage() {
  const router = useRouter();

  // Optional: detect auth to show a "Go to console" button (no forced redirect on /why).
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

  const ogImage = `${SITE_URL}/pbi_1.png`;

  const pageUrl = useMemo(() => `${SITE_URL}/why`, []);

  return (
    <>
      <Head>
        <title>Why PBI · Presence-Bound Identity</title>
        <meta
          name="description"
          content="Why PBI exists: sessions prove access, not presence. PBI binds WebAuthn UP+UV to an action hash and emits signed, non-replayable receipts for audit, forensics, and disputes."
        />
        <link rel="canonical" href={pageUrl} />
        <meta name="robots" content="index,follow" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" href="/kojib.png" />
        <link rel="apple-touch-icon" href="/kojib.png" />
        <meta name="theme-color" content="#05070e" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Kojib" />
        <meta property="og:title" content="Why PBI · Presence-Bound Identity" />
        <meta
          property="og:description"
          content="Sessions prove access; PBI proves a human was present for this exact irreversible action. Action-bound WebAuthn UP+UV with signed, non-replayable receipts."
        />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="PBI Presence-Bound Identity — action-bound proof bundles" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Why PBI · Presence-Bound Identity" />
        <meta
          name="twitter:description"
          content="Sessions prove access; PBI proves presence for the exact action. WebAuthn UP+UV bound to an action hash, receipts emitted as cryptographic evidence."
        />
        <meta name="twitter:image" content={ogImage} />
        <meta name="twitter:image:alt" content="PBI Presence-Bound Identity — action-bound proof bundles" />
      </Head>

      <div className="pbi-landing">
        <div className="pbi-bg" aria-hidden />
        <div className="pbi-shell">
          <header className="pbi-topbar">
            <div className="pbi-brand" role="button" tabIndex={0} onClick={() => router.push("/")} onKeyDown={(e) => (e.key === "Enter" ? router.push("/") : null)}>
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
            <section className="pbi-hero" style={{ paddingBottom: 8 }}>
              <div className="pbi-heroGrid">
                <div>
                  <div className="pbi-pill">
                    <span className="pbi-pillDot" />
                    Why PBI exists · evidence, not “logs”
                  </div>

                  <h1 className="pbi-h1">
                    Sessions prove access. <span>They don’t prove presence.</span>
                  </h1>

                  <p className="pbi-lead">
                    The modern web assumes: “if the session is valid, the user approved the action.” That assumption is where irreversible damage happens:
                    stolen tokens, replay, automation, insider edits, and dispute chaos. PBI exists to replace that assumption with a strict ceremony:
                    bind intent to an <b>action hash</b>, require a live <b>UP+UV</b> WebAuthn presence check, and mint a <b>signed, non-replayable receipt</b>.
                  </p>

                  <div className="pbi-ctaRow">
                    <a className="pbi-btnPrimary" href="/#access">
                      Get access <span aria-hidden>→</span>
                    </a>
                    <a className="pbi-btnGhost" href={API_DOCS} target="_blank" rel="noreferrer">
                      Read API docs
                    </a>
                    <a className="pbi-btnGhost" href={DEMO_URL} target="_blank" rel="noreferrer">
                      Run demo
                    </a>
                    <a className="pbi-btnGhost" href="/enterprise">
                      Enterprise use
                    </a>
                  </div>

                  <div className="pbi-valueGrid" style={{ marginTop: 14 }}>
                    <ValueLine title="Replace “trust” with proof" body="Receipts are cryptographic evidence tied to a ceremony, not mutable rows in a database." />
                    <ValueLine title="Eliminate silent approvals" body="High-risk actions must pass UP+UV and single-use challenge constraints." />
                    <ValueLine title="Win disputes fast" body="Receipts and optional portable proofs are verifiable later by hash, even offline." />
                    <ValueLine title="Keep your existing auth" body="PBI hardens actions; it doesn’t replace SSO/OAuth/JWT." />
                  </div>
                </div>

                <aside className="pbi-side">
                  <div className="pbi-sideTop">
                    <div>
                      <div className="pbi-proofLabel">Core claim</div>
                      <div className="pbi-sideTitle">If it can’t be undone, it must be presence-verified.</div>
                    </div>
                    <div className="pbi-sideTag">strict · auditable</div>
                  </div>

                  <div className="pbi-sideList">
                    <Bullet>Sessions can be stolen.</Bullet>
                    <Bullet>Logs can be edited.</Bullet>
                    <Bullet>Approvals can be replayed.</Bullet>
                    <Bullet>Admins can erase trails.</Bullet>
                    <Bullet>
                      PBI replaces all of that with: <b>challenge → UP+UV → receipt</b>.
                    </Bullet>
                  </div>

                  <pre className="pbi-code">{`1) actionHash = SHA-256(canonical_action)
2) POST /v1/pbi/challenge { actionHash }
3) WebAuthn UP+UV ceremony
4) POST /v1/pbi/verify { assertion }
5) enforce only if PBI_VERIFIED
6) store receiptHash (+ optional pack/proof)`}</pre>

                  <div className="pbi-section">
                    <FlowRow a="actionHash" b="challenge" />
                    <FlowRow a="UP+UV" b="verify" />
                    <FlowRow a="receiptHash" b="audit" />
                    <FlowRow a="portable proof" b="custody" />
                  </div>
                </aside>
              </div>
            </section>

            {/* WHAT FAILS TODAY */}
            <section className="pbi-section">
              <SectionHead
                kicker="The failure mode"
                title="Why “logged in” is not the same as “approved”"
                body="Enterprise breaches and fraud often share a boring root cause: a valid session was treated as a valid approval. Tokens travel; humans don’t."
              />

              <div className="pbi-sectionGrid3">
                <InfoCard title="Session theft" body="Phishing, malware, token replay, leaked cookies. The server sees a valid token and executes irreversible actions." />
                <InfoCard title="Automation & delegated scripts" body="Bots can act inside a session. “Approved” becomes a side effect, not an intentional act." />
                <InfoCard title="Dispute chaos" body="Weeks later, you have logs and screenshots—no cryptographic evidence that a human was present for that exact action." />
              </div>

              <div className="pbi-card" style={{ marginTop: 14 }}>
                <div className="pbi-cardTitle">The real question security teams can’t answer</div>
                <div className="pbi-cardBody" style={{ marginTop: 6 }}>
                  Not “who had access?” — but: <b>“Was a human physically present and knowingly authorizing this exact operation?”</b>
                </div>
              </div>
            </section>

            {/* LOGS ARE NOT PROOF */}
            <section className="pbi-section">
              <SectionHead
                kicker="Audit reality"
                title="Logs are not receipts"
                body="Most audit trails are mutable by insiders, vulnerable to post-incident edits, and hard to dispute. PBI receipts are evidence: action-bound, single-use, time-bounded, and verifiable later."
              />

              <div className="pbi-card">
                <div className="pbi-cardTitle">Legacy vs PBI (what changes)</div>
                <div className="pbi-cardBody" style={{ marginTop: 6 }}>
                  Legacy stacks stitch together identity + sessions + logs. PBI adds one missing primitive: <b>presence proof for the action itself</b>.
                </div>

                <CompareGrid
                  leftTitle="Legacy (common today)"
                  rightTitle="PBI (presence-bound)"
                  rows={[
                    ["Login proves access", "Presence ceremony proves approval for this action hash (UP+UV)"],
                    ["Session token authorizes everything", "Single-use challenge authorizes exactly one intended operation"],
                    ["Audit log row is editable", "Receipt is cryptographic evidence tied to a signed verification decision"],
                    ["Disputes rely on screenshots", "Disputes rely on verifiable receipt hash (and optional portable proofs)"],
                    ["Admins can erase trails", "Offline verification + trust policy can be designed to be tamper-evident"],
                  ]}
                />
              </div>
            </section>

            {/* MECHANISM */}
            <section className="pbi-section">
              <SectionHead
                kicker="The fix"
                title="Presence becomes a strict, enforceable gate"
                body="PBI is intentionally narrow: it hardens irreversible actions. You keep your identity stack. You add PBI only where “maybe” is unacceptable."
              />

              <div className="pbi-figGrid">
                <FigureCard img="/pbi_4.png" alt="From Account Trust to Human Presence Proof — Legacy Authentication vs PBI" />
                <FigureCard img="/pbi_2.png" alt="PBI Integration into a Sensitive Endpoint" />
                <FigureCard img="/pbi_6.png" alt="PBI Receipt Anatomy: Proof, Not Logs" />
              </div>

              <div className="pbi-sectionGrid3" style={{ marginTop: 14 }}>
                <MiniCard title="Bind intent" body="Canonicalize the action and hash it. The challenge is bound to that action hash." />
                <MiniCard title="Require UP+UV" body="FaceID/TouchID proves a human is present. No passwords. No biometrics stored by you." />
                <MiniCard title="Mint evidence" body="Receipt hash becomes your durable reference for audit, forensics, and disputes." />
              </div>
            </section>

            {/* WHAT PBI GUARANTEES */}
            <section className="pbi-section">
              <SectionHead
                kicker="Guarantees"
                title="What PBI proves (and what it does not)"
                body="This is critical for enterprise trust: we state guarantees precisely and avoid unverifiable claims."
              />

              <div className="pbi-sectionGrid3">
                <InfoCard
                  title="PBI proves"
                  body="A UP+UV WebAuthn ceremony occurred for a single-use, time-bounded challenge bound to this action hash; the server verified it and minted a receipt."
                />
                <InfoCard
                  title="PBI does not prove"
                  body="Who the user is in the real world (KYC), or their role/identity beyond the credential used. PBI is presence + intent evidence, not identity resolution."
                />
                <InfoCard
                  title="You control enforcement"
                  body="PBI is only powerful if you gate the action. Rule: if verify doesn’t return PBI_VERIFIED, you do not proceed."
                />
              </div>

              <div className="pbi-card" style={{ marginTop: 14 }}>
                <div className="pbi-cardTitle">Where teams deploy PBI first</div>
                <div className="pbi-cardBody" style={{ marginTop: 6 }}>
                  Start with one endpoint where the blast radius is highest. Prove ROI in a week. Expand coverage across your irreversible operations.
                </div>

                <div className="pbi-sectionGrid3" style={{ marginTop: 12 }}>
                  <MiniCard title="Treasury & payouts" body="Wires, payouts, escrow release, withdrawals, settlement actions." />
                  <MiniCard title="Admin control plane" body="Role grants, key rotation, production config, incident actions." />
                  <MiniCard title="Governance actions" body="Proposal approval, policy changes, privileged operations." />
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <a className="pbi-btnPrimary" href="/#access">
                    Get access →
                  </a>
                  <a className="pbi-btnGhost" href={API_DOCS} target="_blank" rel="noreferrer">
                    Review endpoints →
                  </a>
                  <a className="pbi-btnGhost" href={TOOL_URL} target="_blank" rel="noreferrer">
                    Open tool →
                  </a>
                  <a className="pbi-btnGhost" href={DEMO_URL} target="_blank" rel="noreferrer">
                    Run demo →
                  </a>
                </div>
              </div>
            </section>

            {/* FAQ */}
            <section className="pbi-section">
              <SectionHead
                kicker="FAQ"
                title="Common questions"
                body="These are the questions enterprise teams ask in the first 10 minutes. Answering them clearly speeds procurement and integration."
              />

              <div style={{ display: "grid", gap: 10 }}>
                <FaqItem
                  q="Is this just MFA?"
                  a="No. MFA is typically a login/session step. PBI is action-level presence proof bound to a specific action hash, emitting a receipt as evidence."
                />
                <FaqItem
                  q="Does PBI replace SSO / OAuth / JWT?"
                  a="No. Keep your existing identity. PBI hardens specific irreversible actions by requiring a UP+UV presence ceremony at execution time."
                />
                <FaqItem
                  q="Do you store biometrics?"
                  a="No. WebAuthn biometrics never leave the device. PBI verifies the WebAuthn assertion and stores receipt metadata and hashes."
                />
                <FaqItem
                  q="What do we store to be audit-ready?"
                  a="At minimum: receiptHash + decision + actionHash reference + timestamps. For offline workflows: optional portable proof bundles under a trust policy."
                />
                <FaqItem
                  q="How do we roll this out without breaking UX?"
                  a="Gate only 1–3 irreversible endpoints first. Keep all other operations session-based. Users only see the presence ceremony when it truly matters."
                />
              </div>
            </section>

            <footer className="pbi-footer" style={{ marginTop: 6 }}>
              <div>© {new Date().getFullYear()} Kojib · PBI</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <a href="/terms">Terms</a>
                <a href="/privacy">Privacy</a>
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

function FigureCard({ img, alt, caption }: { img: string; alt: string; caption?: string }) {
  const { basePath } = useRouter();
  const src = (basePath || "") + img;

  return (
    <div className="pbi-figure">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="pbi-figureImg" src={src} alt={alt} loading="lazy" />
      {caption ? <div className="pbi-figureCap">{caption}</div> : null}
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

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="pbi-card">
      <div className="pbi-cardTitle">{title}</div>
      <div className="pbi-cardBody">{body}</div>
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

function FlowRow({ a, b }: { a: string; b: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,.12)",
        background: "rgba(255,255,255,.06)",
        padding: "10px 12px",
        marginTop: 8,
        color: "rgba(255,255,255,.80)",
        fontSize: 12,
      }}
    >
      <span
        style={{
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
          fontSize: 11,
        }}
      >
        {a}
      </span>
      <span style={{ opacity: 0.55 }}>→</span>
      <span
        style={{
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
          fontSize: 11,
        }}
      >
        {b}
      </span>
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

function CompareGrid({
  leftTitle,
  rightTitle,
  rows,
}: {
  leftTitle: string;
  rightTitle: string;
  rows: Array<[string, string]>;
}) {
  return (
    <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
      <div
        className="pbi-card"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          padding: 12,
          background: "rgba(0,0,0,.18)",
        }}
      >
        <div className="pbi-proofLabel">{leftTitle}</div>
        <div className="pbi-proofLabel" style={{ textAlign: "right" }}>
          {rightTitle}
        </div>
      </div>

      {rows.map(([l, r]) => (
        <div
          key={`${l}__${r}`}
          className="pbi-card"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            padding: 12,
          }}
        >
          <div style={{ color: "rgba(255,255,255,.82)", fontSize: 13, lineHeight: 1.45 }}>{l}</div>
          <div style={{ color: "rgba(255,255,255,.82)", fontSize: 13, lineHeight: 1.45, textAlign: "right" }}>{r}</div>
        </div>
      ))}
    </div>
  );
}