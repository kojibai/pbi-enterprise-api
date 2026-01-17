// pages/about.tsx
import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { apiJson } from "../lib/api";

const API_DOCS = "https://api.kojib.com/docs";
const DEMO_URL = "https://demo.kojib.com";
const TOOL_URL = "https://tool.kojib.com";
const SITE_URL = "https://pbi.kojib.com";

type AuthState = "unknown" | "logged_out" | "logged_in";

export default function AboutPage() {
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

  const ogImage = `${SITE_URL}/pbi_1.png`;
  const pageUrl = useMemo(() => `${SITE_URL}/about`, []);

  return (
    <>
      <Head>
        <title>About PBI · Presence-Bound Identity</title>
        <meta
          name="description"
          content="About PBI: a narrow, strict presence primitive for irreversible actions. Bind WebAuthn UP+UV to an action hash and mint signed, non-replayable receipts — with optional portable proof bundles for offline verification and audit."
        />
        <link rel="canonical" href={pageUrl} />
        <meta name="robots" content="index,follow" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" href="/kojib.png" />
        <link rel="apple-touch-icon" href="/kojib.png" />
        <meta name="theme-color" content="#05070e" />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Kojib" />
        <meta property="og:title" content="About PBI · Presence-Bound Identity" />
        <meta
          property="og:description"
          content="PBI is a strict presence layer for irreversible actions: action-bound WebAuthn UP+UV with signed, non-replayable receipts and optional portable proofs."
        />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="PBI Presence-Bound Identity — action-bound receipts and portable proofs" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="About PBI · Presence-Bound Identity" />
        <meta
          name="twitter:description"
          content="PBI is a strict presence layer for irreversible actions: action-bound WebAuthn UP+UV with signed receipts and optional portable proofs."
        />
        <meta name="twitter:image" content={ogImage} />
        <meta name="twitter:image:alt" content="PBI Presence-Bound Identity — action-bound receipts and portable proofs" />
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
                  Console
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
                    About · what PBI is (and isn’t)
                  </div>

                  <h1 className="pbi-h1">
                    A strict presence primitive for <span>irreversible actions.</span>
                  </h1>

                  <p className="pbi-lead">
                    PBI is intentionally narrow: it proves a human was present for a specific operation. You hash the action, issue a single-use challenge
                    bound to that hash, require a live WebAuthn <b>UP+UV ceremony</b>, then mint a <b>signed, non-replayable receipt</b>. Optional proof
                    bundles can be exported for offline verification and audit workflows.
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
                      Enterprise onboarding
                    </a>
                  </div>

                  <div className="pbi-valueGrid" style={{ marginTop: 14 }}>
                    <ValueLine
                      title="Proof of presence"
                      body="UP+UV ceremony occurred for a single-use challenge bound to an action hash, within expiry."
                    />
                    <ValueLine title="Evidence, not vibes" body="Receipts are verifiable by hash long after the event—useful for disputes and forensics." />
                    <ValueLine title="No biometric storage" body="Biometrics stay on the device; PBI verifies the WebAuthn assertion and stores receipts." />
                    <ValueLine title="Drop-in hardening" body="Keep SSO/OAuth/JWT. Add PBI only where the blast radius is highest." />
                  </div>
                </div>

                <aside className="pbi-side">
                  <div className="pbi-sideTop">
                    <div>
                      <div className="pbi-proofLabel">In one sentence</div>
                      <div className="pbi-sideTitle">Presence-bound approvals with receipts you can prove later.</div>
                    </div>
                    <div className="pbi-sideTag">narrow · strict</div>
                  </div>

                  <div className="pbi-sideList">
                    <Bullet>
                      <b>Inputs:</b> actionHash, expiry, policy
                    </Bullet>
                    <Bullet>
                      <b>Ceremony:</b> WebAuthn UP+UV (FaceID / TouchID)
                    </Bullet>
                    <Bullet>
                      <b>Output:</b> receiptHash (+ optional pack/proof)
                    </Bullet>
                    <Bullet>
                      <b>Rule:</b> proceed only on <b>PBI_VERIFIED</b>
                    </Bullet>
                  </div>

                  <pre className="pbi-code">{`actionHash = SHA-256(canonical_action)

POST /v1/pbi/challenge { actionHash }
WebAuthn UP+UV
POST /v1/pbi/verify { assertion }

→ decision: PBI_VERIFIED | DENIED
→ receiptHash: evidence reference
→ optional: portable proofs (offline)`}</pre>

                  <div className="pbi-section">
                    <FlowRow a="hash intent" b="challenge" />
                    <FlowRow a="UP+UV" b="verify" />
                    <FlowRow a="receiptHash" b="prove later" />
                  </div>
                </aside>
              </div>
            </section>

            {/* WHAT IT IS / ISN'T */}
            <section className="pbi-section">
              <SectionHead
                kicker="Positioning"
                title="What PBI is (and what it isn’t)"
                body="Enterprise teams move faster when the primitive is defined precisely. PBI is evidence of presence for an action — not identity resolution."
              />

              <div className="pbi-sectionGrid3">
                <InfoCard
                  title="PBI is"
                  body="A presence gate for irreversible actions: single-use, time-bounded challenge + UP+UV ceremony + receipt as cryptographic evidence."
                />
                <InfoCard
                  title="PBI is not"
                  body="KYC, identity verification, or biometrics storage. It does not tell you who a person is—only that a live presence ceremony occurred."
                />
                <InfoCard
                  title="PBI integrates with"
                  body="Your existing auth stack (SSO/OAuth/JWT), your audit systems, and your billing model via action-level verification events."
                />
              </div>

              <div className="pbi-card" style={{ marginTop: 14 }}>
                <div className="pbi-cardTitle">Why “presence” is the missing layer</div>
                <div className="pbi-cardBody" style={{ marginTop: 6 }}>
                  Most breaches don’t start with “no authentication”—they start with “authentication happened earlier, then the approval was silently
                  delegated.” PBI forces the approval to happen at execution time, bound to the exact action hash.
                </div>
              </div>
            </section>

            {/* TERMS */}
            <section className="pbi-section">
              <SectionHead
                kicker="Vocabulary"
                title="Core terms (so everyone speaks precisely)"
                body="These definitions are procurement-friendly and security-review-friendly: strict, testable, and non-magical."
              />

              <div style={{ display: "grid", gap: 10 }}>
                <DefRow term="Action" def="The irreversible operation you are about to execute (transfer, rotate keys, deploy, grant admin)." />
                <DefRow term="Canonical action" def="A normalized serialization of that operation (stable fields, deterministic formatting)." />
                <DefRow term="actionHash" def="SHA-256 of the canonical action. This is what the challenge is bound to." />
                <DefRow term="Challenge" def="A single-use server-issued token bound to actionHash and expiry; rejects replay." />
                <DefRow term="UP+UV" def="User Presence + User Verification: authenticator requires a live biometric ceremony." />
                <DefRow term="Receipt" def="Signed evidence that verification occurred for a bound actionHash within constraints." />
                <DefRow term="Portable proof" def="Optional export format for offline verification under a trust policy (rotate/revoke/expire)." />
              </div>
            </section>

            {/* WHERE IT FITS */}
            <section className="pbi-section">
              <SectionHead
                kicker="Integration"
                title="Where PBI fits in a real system"
                body="PBI sits at the enforcement point. You keep normal auth for most endpoints, and apply PBI only where you need proof."
              />

              <div className="pbi-figGrid">
                <FigureCard img="/pbi_7.png" alt="Where PBI fits in your architecture" />
                <FigureCard img="/pbi_2.png" alt="PBI Integration into a Sensitive Endpoint" />
                <FigureCard img="/pbi_4.png" alt="From Account Trust to Human Presence Proof" />
              </div>

              <div className="pbi-card" style={{ marginTop: 14 }}>
                <div className="pbi-cardTitle">Rollout pattern (works in enterprise)</div>
                <div className="pbi-cardBody" style={{ marginTop: 6 }}>
                  Pick 1 endpoint with the highest blast radius. Add a presence gate. Measure fraud reduction and dispute clarity. Expand to other
                  irreversible operations after you prove velocity and reliability.
                </div>

                <div className="pbi-sectionGrid3" style={{ marginTop: 12 }}>
                  <MiniCard title="Start: treasury / money out" body="Make payout approval provable. Disputes become receipts, not arguments." />
                  <MiniCard title="Then: admin control plane" body="Grant/revoke roles and rotate keys only under UP+UV." />
                  <MiniCard title="Then: deploy / production changes" body="Require presence proof for release and config actions." />
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <a className="pbi-btnGhost" href={API_DOCS} target="_blank" rel="noreferrer">
                    Review endpoints →
                  </a>
                  <a className="pbi-btnGhost" href={TOOL_URL} target="_blank" rel="noreferrer">
                    Open tool →
                  </a>
                  <a className="pbi-btnGhost" href={DEMO_URL} target="_blank" rel="noreferrer">
                    Run demo →
                  </a>
                  <a className="pbi-btnPrimary" href="/pricing">
                    View pricing →
                  </a>
                </div>
              </div>
            </section>

            {/* MINI FAQ */}
            <section className="pbi-section">
              <SectionHead
                kicker="FAQ"
                title="Quick answers"
                body="Short, enterprise-friendly answers that keep implementation and review aligned."
              />

              <div style={{ display: "grid", gap: 10 }}>
                <FaqItem
                  q="Do users need an account with PBI?"
                  a="Not for the proof itself. Your app decides how identity maps to a user. PBI proves presence for a specific action via WebAuthn."
                />
                <FaqItem
                  q="Is this compatible with passkeys?"
                  a="Yes. PBI uses standard WebAuthn. Passkeys are a great fit because they’re biometric-backed and phishing-resistant."
                />
                <FaqItem
                  q="What if verification fails?"
                  a="You do not proceed. Treat any non-VERIFIED decision as a hard deny for irreversible actions."
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

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="pbi-bullet">
      <span className="pbi-bulletDot">•</span>
      <span>{children}</span>
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

function DefRow({ term, def }: { term: string; def: string }) {
  return (
    <div className="pbi-card" style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <div className="pbi-cardTitle" style={{ fontSize: 16 }}>
          {term}
        </div>
        <div className="pbi-proofLabel">Definition</div>
      </div>
      <div className="pbi-cardBody" style={{ marginTop: 8 }}>
        {def}
      </div>
    </div>
  );
}