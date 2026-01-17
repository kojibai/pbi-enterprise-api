// pages/trust.tsx
import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { apiJson } from "../lib/api";

const API_DOCS = "https://api.kojib.com/docs";
const DEMO_URL = "https://demo.kojib.com";
const TOOL_URL = "https://tool.kojib.com";
const SITE_URL = "https://pbi.kojib.com";

type AuthState = "unknown" | "logged_out" | "logged_in";

export default function TrustCenterPage() {
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

  const pageUrl = useMemo(() => `${SITE_URL}/trust`, []);
  const ogImage = `${SITE_URL}/pbi_1.png`;

  // Contacts (customizable via env)
  const SECURITY_EMAIL = (process.env.NEXT_PUBLIC_PBI_SECURITY_EMAIL ?? "security@kojib.com").trim();
  const PRIVACY_EMAIL = (process.env.NEXT_PUBLIC_PBI_PRIVACY_EMAIL ?? "privacy@kojib.com").trim();
  const SUPPORT_EMAIL = (process.env.NEXT_PUBLIC_PBI_SUPPORT_EMAIL ?? "support@kojib.com").trim();

  return (
    <>
      <Head>
        <title>Trust Center · PBI · Presence-Bound Identity</title>
        <meta
          name="description"
          content="PBI Trust Center: strict guarantees, data minimization, security posture, disclosure policy, and enterprise review materials."
        />
        <link rel="canonical" href={pageUrl} />
        <meta name="robots" content="index,follow" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" href="/kojib.png" />
        <link rel="apple-touch-icon" href="/kojib.png" />
        <meta name="theme-color" content="#05070e" />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Kojib" />
        <meta property="og:title" content="Trust Center · PBI" />
        <meta
          property="og:description"
          content="Trust Center for PBI: guarantees, data handling, security posture, disclosure policy, and enterprise review packet."
        />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={ogImage} />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Trust Center · PBI" />
        <meta
          name="twitter:description"
          content="Trust Center: guarantees, data handling, security posture, disclosure policy, and enterprise review packet."
        />
        <meta name="twitter:image" content={ogImage} />
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
                    Trust Center · enterprise-ready posture
                  </div>

                  <h1 className="pbi-h1">
                    Trust is earned with <span>strict guarantees</span> and minimized data.
                  </h1>

                  <p className="pbi-lead">
                    This page is written for security reviewers, compliance teams, and platform engineering. We state guarantees precisely and avoid
                    unverifiable claims. PBI is a presence proof primitive for irreversible actions: action-bound WebAuthn (UP+UV) with signed receipts.
                  </p>

                  <div className="pbi-ctaRow">
                    <a className="pbi-btnPrimary" href="/enterprise">
                      Enterprise onboarding <span aria-hidden>→</span>
                    </a>
                    <a className="pbi-btnGhost" href="/security">
                      Security overview
                    </a>
                    <a className="pbi-btnGhost" href={API_DOCS} target="_blank" rel="noreferrer">
                      API docs
                    </a>
                    <a className="pbi-btnGhost" href="/status">
                      Status
                    </a>
                  </div>

                  <div className="pbi-valueGrid" style={{ marginTop: 14 }}>
                    <ValueLine title="Strict claims" body="We define exactly what is proven (UP+UV for an action hash, single-use, within expiry)." />
                    <ValueLine title="Data minimization" body="No biometric data stored. No password database required for presence proof." />
                    <ValueLine title="Evidence receipts" body="Receipts provide durable, verifiable references for audit and disputes." />
                    <ValueLine title="Enterprise packet" body="Threat model, data flow, trust policy, evidence formats, and deployment notes." />
                  </div>
                </div>

                <aside className="pbi-side">
                  <div className="pbi-sideTop">
                    <div>
                      <div className="pbi-proofLabel">Reviewer fast facts</div>
                      <div className="pbi-sideTitle">What PBI guarantees (in one line)</div>
                    </div>
                    <div className="pbi-sideTag">testable</div>
                  </div>

                  <div className="pbi-sideList">
                    <Bullet>
                      A user completed a WebAuthn <b>UP+UV</b> ceremony for a <b>single-use</b> challenge bound to an <b>actionHash</b> within expiry, and
                      the verifier minted a <b>signed receipt</b>.
                    </Bullet>
                    <Bullet>
                      PBI does <b>not</b> do KYC, identity resolution, or biometric storage.
                    </Bullet>
                  </div>

                  <pre className="pbi-code">{`Core invariant:
execute(action) only if verify(actionHash).decision == PBI_VERIFIED

Everything else is deny.`}</pre>
                </aside>
              </div>
            </section>

            <section className="pbi-section">
              <SectionHead
                kicker="Guarantees"
                title="Guarantees vs non-goals"
                body="Clear boundaries reduce procurement friction and prevent mismatched expectations."
              />

              <div className="pbi-sectionGrid3">
                <InfoCard
                  title="PBI guarantees"
                  body="UP+UV presence ceremony occurred for a single-use, time-bounded challenge bound to this action hash, and a receipt was emitted."
                />
                <InfoCard
                  title="PBI does not guarantee"
                  body="Real-world identity (KYC), role correctness, coercion resistance, or that an authorized human did not make a mistake."
                />
                <InfoCard
                  title="Your responsibility"
                  body="Enforce: irreversible operations must only execute after PBI_VERIFIED; all other decisions must halt."
                />
              </div>
            </section>

            <section className="pbi-section">
              <SectionHead
                kicker="Data handling"
                title="What we store vs do not store"
                body="PBI is designed to minimize sensitive data while maximizing audit usefulness."
              />

              <div className="pbi-sectionGrid3">
                <MiniCard
                  title="Stored (typical)"
                  body="Receipts (hash references), verification decisions, timestamps, and minimal challenge metadata necessary for single-use + expiry enforcement."
                />
                <MiniCard
                  title="Not stored"
                  body="Biometric templates, FaceID/TouchID data, passwords, or a user identity database required for presence proof."
                />
                <MiniCard
                  title="Optional exports"
                  body="Portable proof bundles for offline verification and chain-of-custody under a trust policy (rotation/revocation/expiry)."
                />
              </div>

              <div className="pbi-card" style={{ marginTop: 14 }}>
                <div className="pbi-cardTitle">WebAuthn biometrics never leave the device</div>
                <div className="pbi-cardBody" style={{ marginTop: 6 }}>
                  Authenticators perform user verification locally. The server verifies an assertion and issues a receipt; it does not receive biometric
                  material.
                </div>
              </div>
            </section>

            <section className="pbi-section">
              <SectionHead
                kicker="Security posture"
                title="Controls that matter for this primitive"
                body="These are the controls enterprise teams map to their internal requirements."
              />

              <div style={{ display: "grid", gap: 10 }}>
                <ProofRow k="Replay resistance" v="Single-use challenges + expiry windows + action binding prevent reuse and repurposing." />
                <ProofRow k="Evidence-first audit" v="Receipts are evidence references; logs are not treated as primary proof artifacts." />
                <ProofRow k="Principle of minimization" v="Minimize stored sensitive data; store only what supports verification and audit mapping." />
                <ProofRow k="Environment separation" v="Recommended dev/stage/prod API keys and allowlisting patterns for hardened rollouts." />
                <ProofRow k="Rotation & revocation" v="Trust policy supports key rotation/revocation/expiry for offline verification governance." />
              </div>

              <div className="pbi-card" style={{ marginTop: 14 }}>
                <div className="pbi-cardTitle">Enterprise security packet</div>
                <div className="pbi-cardBody" style={{ marginTop: 6 }}>
                  Available through the Enterprise onboarding path: threat model, data flow diagram, trust policy guidance, evidence formats, and deployment
                  notes. Start here: <a href="/enterprise">/enterprise</a>.
                </div>
              </div>
            </section>

            <section className="pbi-section">
              <SectionHead
                kicker="Disclosure"
                title="Responsible disclosure"
                body="We treat security reports seriously. Use the channel below to report vulnerabilities."
              />

              <div className="pbi-sectionGrid3">
                <InfoCard
                  title="Security reports"
                  body={`Email ${SECURITY_EMAIL}. Include reproduction steps, impact assessment, and affected endpoints or artifacts.`}
                />
                <InfoCard
                  title="Privacy requests"
                  body={`Email ${PRIVACY_EMAIL} for privacy and data handling requests.`}
                />
                <InfoCard
                  title="Support"
                  body={`Email ${SUPPORT_EMAIL} for integration and customer support requests.`}
                />
              </div>

              <div className="pbi-card" style={{ marginTop: 14 }}>
                <div className="pbi-cardTitle">Operational links</div>
                <div className="pbi-cardBody" style={{ marginTop: 6 }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <a className="pbi-btnGhost" href="/security">
                      Security overview
                    </a>
                    <a className="pbi-btnGhost" href="/status">
                      Status
                    </a>
                    <a className="pbi-btnGhost" href="/changelog">
                      Changelog
                    </a>
                    <a className="pbi-btnGhost" href={API_DOCS} target="_blank" rel="noreferrer">
                      API docs
                    </a>
                    <a className="pbi-btnGhost" href={DEMO_URL} target="_blank" rel="noreferrer">
                      Demo
                    </a>
                  </div>
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

function ProofRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="pbi-card" style={{ padding: 12, borderRadius: 18 }}>
      <div className="pbi-proofLabel">{k}</div>
      <div style={{ marginTop: 6, color: "rgba(255,255,255,.82)", fontSize: 13, lineHeight: 1.45, textAlign: "right" }}>{v}</div>
    </div>
  );
}
