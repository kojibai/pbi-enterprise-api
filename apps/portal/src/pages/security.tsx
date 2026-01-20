// pages/security.tsx
import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { apiJson } from "../lib/api";

const API_DOCS = "https://api.kojib.com/docs";
const DEMO_URL = "https://demo.kojib.com";
const TOOL_URL = "https://tool.kojib.com";
const SITE_URL = "https://pbi.kojib.com";

type AuthState = "unknown" | "logged_out" | "logged_in";

export default function SecurityPage() {
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

  const pageUrl = useMemo(() => `${SITE_URL}/security`, []);
  const ogImage = `${SITE_URL}/pbi_1.png`;

  return (
    <>
      <Head>
        <title>Security · PBI · Presence-Bound Identity</title>
        <meta
          name="description"
          content="Security overview for PBI: strict guarantees, threat model, replay resistance, data minimization, and offline verification trust policy (rotation/revocation/expiry)."
        />
        <link rel="canonical" href={pageUrl} />
        <meta name="robots" content="index,follow" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" href="/kojib.png" />
        <link rel="apple-touch-icon" href="/kojib.png" />
        <meta name="theme-color" content="#05070e" />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Kojib" />
        <meta property="og:title" content="Security · PBI" />
        <meta
          property="og:description"
          content="Security overview: action-bound WebAuthn UP+UV, single-use challenges, signed receipts, and optional offline verification under a trust policy."
        />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="PBI Security — guarantees, threat model, and trust policy" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Security · PBI" />
        <meta
          name="twitter:description"
          content="Security overview: action-bound WebAuthn UP+UV, single-use challenges, signed receipts, and offline verification trust policy."
        />
        <meta name="twitter:image" content={ogImage} />
        <meta name="twitter:image:alt" content="PBI Security — guarantees, threat model, and trust policy" />
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
                    Security overview · strict, testable claims
                  </div>

                  <h1 className="pbi-h1">
                    Proof of presence, <span>minimized data</span>, replay-resistant by design.
                  </h1>

                  <p className="pbi-lead">
                    PBI is an enforcement primitive: it binds a single-use challenge to an <b>action hash</b>, requires a WebAuthn <b>UP+UV ceremony</b>,
                    and emits a <b>signed receipt</b>. This page explains exactly what is guaranteed, what is stored, and what threats are addressed.
                  </p>

                  <div className="pbi-ctaRow">
                    <a className="pbi-btnPrimary" href={API_DOCS} target="_blank" rel="noreferrer">
                      Read API docs <span aria-hidden>→</span>
                    </a>
                    <a className="pbi-btnGhost" href={DEMO_URL} target="_blank" rel="noreferrer">
                      Run demo
                    </a>
                    <a className="pbi-btnGhost" href={TOOL_URL} target="_blank" rel="noreferrer">
                      Open tool
                    </a>
                    <a className="pbi-btnGhost" href="/enterprise">
                      Enterprise onboarding
                    </a>
                  </div>

                  <div className="pbi-valueGrid" style={{ marginTop: 14 }}>
                    <ValueLine title="Strict guarantees" body="UP+UV occurred for a single-use challenge bound to an actionHash within expiry." />
                    <ValueLine title="Replay resistance" body="Single-use challenges + expiry windows prevent reuse and delayed approvals." />
                    <ValueLine title="Evidence receipts" body="Signed receipt hashes provide durable proof references for audit and disputes." />
                    <ValueLine title="Data minimization" body="No biometric storage. No password database. Receipts + metadata only." />
                  </div>
                </div>

                <aside className="pbi-side">
                  <div className="pbi-sideTop">
                    <div>
                      <div className="pbi-proofLabel">Security rule</div>
                      <div className="pbi-sideTitle">If verify isn’t PBI_VERIFIED, you do not proceed.</div>
                    </div>
                    <div className="pbi-sideTag">enforced</div>
                  </div>

                  <div className="pbi-sideList">
                    <Bullet>
                      <b>Threats addressed:</b> replay, stolen sessions, automated approvals, mutable logs.
                    </Bullet>
                    <Bullet>
                      <b>Non-goals:</b> KYC, identity resolution, biometric storage.
                    </Bullet>
                    <Bullet>
                      <b>Outputs:</b> receiptHash (+ optional portable proof bundles).
                    </Bullet>
                  </div>

                  <pre className="pbi-code">{`Security posture:
- challenge: single-use + expiry
- verify: WebAuthn UP+UV required
- receipt: signed decision + hash reference
- optional: offline verification via trust policy`}</pre>
                </aside>
              </div>
            </section>

            {/* GUARANTEES / NON-GOALS */}
            <section className="pbi-section">
              <SectionHead
                kicker="Claims"
                title="Guarantees vs non-goals"
                body="These statements are intentionally narrow and testable. We avoid unverifiable promises."
              />

              <div className="pbi-sectionGrid3">
                <InfoCard
                  title="PBI guarantees"
                  body="A WebAuthn UP+UV ceremony occurred for a single-use, time-bounded challenge bound to this actionHash, and the server verified it and emitted a receipt."
                />
                <InfoCard
                  title="PBI does not guarantee"
                  body="Real-world identity (KYC), role correctness, or that an authorized human wasn’t coerced. PBI proves presence and approval ceremony only."
                />
                <InfoCard
                  title="Your enforcement duty"
                  body="The primitive is only as strong as your gate: irreversible actions must be executed only after PBI_VERIFIED."
                />
              </div>

              <div className="pbi-card" style={{ marginTop: 14 }}>
                <div className="pbi-cardTitle">Why this matters for security review</div>
                <div className="pbi-cardBody" style={{ marginTop: 6 }}>
                  Enterprise teams need guarantees stated precisely so they can map them to controls and audits. “We log things” is not a guarantee.
                  “We minted a receipt for a UP+UV ceremony bound to an action hash within expiry” is a guarantee.
                </div>
              </div>
            </section>

            {/* DATA MINIMIZATION */}
            <section className="pbi-section">
              <SectionHead
                kicker="Data"
                title="What is stored vs not stored"
                body="PBI is built to minimize sensitive data. Biometric data stays on the device."
              />

              <div className="pbi-sectionGrid3">
                <MiniCard
                  title="Stored (typical)"
                  body="Receipt hashes, decisions, timestamps, challenge metadata (expiry/used), and actionHash references for audit mapping."
                />
                <MiniCard
                  title="Not stored"
                  body="Biometric templates, FaceID/TouchID data, passwords, or a user identity database (unless you choose to map credentials yourself)."
                />
                <MiniCard
                  title="Optional exports"
                  body="Portable proof bundles (pack/proof) for offline verification under a trust policy (rotation/revocation/expiry)."
                />
              </div>

              <div className="pbi-card" style={{ marginTop: 14 }}>
                <div className="pbi-cardTitle">WebAuthn biometrics never leave the device</div>
                <div className="pbi-cardBody" style={{ marginTop: 6 }}>
                  WebAuthn authenticators perform user verification locally. The server receives an assertion to verify, not biometric material.
                </div>
              </div>
            </section>

            {/* THREAT MODEL SUMMARY */}
            <section className="pbi-section">
              <SectionHead
                kicker="Threat model"
                title="Threats PBI is designed to reduce"
                body="These are the common failure modes in session-based systems where “approved” is inferred, not proven."
              />

              <div className="pbi-sectionGrid3">
                <InfoCard
                  title="Session token theft"
                  body="PBI moves approval from “session exists” to “presence ceremony occurred now for this action.” Stolen tokens alone are insufficient for gated actions."
                />
                <InfoCard
                  title="Replay & delayed approvals"
                  body="Single-use challenges and expiry windows prevent replays and delayed submission of old approvals."
                />
                <InfoCard
                  title="Automated or delegated approvals"
                  body="UP+UV requires a live ceremony. Scripts cannot silently approve irreversible actions without human presence."
                />
                <InfoCard
                  title="Mutable audit trails"
                  body="Receipts provide cryptographic evidence references (receiptHash) rather than editable log rows as the primary proof artifact."
                />
                <InfoCard
                  title="Dispute ambiguity"
                  body="Receipts bind actionHash + timing + decision. Disputes become verifications, not arguments."
                />
                <InfoCard
                  title="Over-broad permissions"
                  body="PBI can narrow approvals to specific actions even when broad roles exist, reducing blast radius of role misuse."
                />
              </div>
            </section>

            {/* REPLAY RESISTANCE */}
            <section className="pbi-section">
              <SectionHead
                kicker="Replay resistance"
                title="How replay is prevented"
                body="Replay is the silent killer of “approval” systems. PBI is structured to make replay fail by construction."
              />

              <div style={{ display: "grid", gap: 10 }}>
                <ProofRow k="Single-use challenges" v="Challenge tokens are one-time. After use, they’re marked used and cannot be replayed." />
                <ProofRow k="Expiry windows" v="Challenges expire. Late approvals are rejected even if the assertion is otherwise valid." />
                <ProofRow k="Action binding" v="The challenge is bound to actionHash. Approvals cannot be repurposed for a different operation." />
                <ProofRow k="Decision enforcement" v="Applications must only proceed when verify returns PBI_VERIFIED. Any other decision is a hard stop." />
              </div>

              <div className="pbi-card" style={{ marginTop: 14 }}>
                <div className="pbi-cardTitle">Operational guidance</div>
                <div className="pbi-cardBody" style={{ marginTop: 6 }}>
                  Treat verification as part of execution, not a pre-check. Generate the actionHash from the exact operation you are about to perform.
                </div>
              </div>
            </section>

            {/* OFFLINE VERIFICATION / TRUST POLICY */}
            <section className="pbi-section">
              <SectionHead
                kicker="Offline verification"
                title="Trust policy: rotation, revocation, expiry"
                body="For air-gapped review, compliance exports, and chain-of-custody, PBI supports optional portable proofs that verify offline under a trust policy."
              />

              <div className="pbi-sectionGrid3">
                <MiniCard title="Rotation" body="Publish new attestor keys while keeping old ones valid for a defined overlap window." />
                <MiniCard title="Revocation" body="Revoke compromised keys and invalidate proofs minted under those keys after the revoke point." />
                <MiniCard title="Expiry" body="Define validity windows for proofs to match policy and reduce long-tail risk." />
              </div>

              <div className="pbi-card" style={{ marginTop: 14 }}>
                <div className="pbi-cardTitle">Offline verification workflow (example)</div>
                <div className="pbi-cardBody" style={{ marginTop: 6 }}>
                  Portable proofs can be verified without calling the API, using a pinned trust policy bundle.
                </div>

                <pre className="pbi-code" style={{ marginTop: 10 }}>{`pbi-pack-verify ./pbi-pack --trust ./trust.json
pbi-pack-verify --proof ./proofs/0001.proof.json --trust ./trust.json`}</pre>

                <div className="pbi-proofLabel" style={{ marginTop: 10 }}>
                  Exact filenames and CLI interfaces depend on your deployed tooling; the security model remains the same.
                </div>
              </div>
            </section>

            {/* HARDENING CHECKLIST */}
            <section className="pbi-section">
              <SectionHead
                kicker="Checklist"
                title="Minimum hardening checklist (recommended)"
                body="This is the short list security teams ask for when reviewing enforcement primitives."
              />

              <div style={{ display: "grid", gap: 10 }}>
                <ChecklistRow item="Canonicalize the action deterministically before hashing (stable serialization)." />
                <ChecklistRow item="Bind the challenge to actionHash and enforce single-use + expiry." />
                <ChecklistRow item="Require UP+UV on verify and reject anything else." />
                <ChecklistRow item="Proceed only on PBI_VERIFIED; treat all other decisions as deny." />
                <ChecklistRow item="Store receiptHash + decision + action context for audit mapping." />
                <ChecklistRow item="Define incident response for compromised keys (rotation/revocation policy)." />
              </div>

              <div className="pbi-card" style={{ marginTop: 14, background: "rgba(120,255,231,.08)", borderColor: "rgba(120,255,231,.26)" }}>
                <div className="pbi-proofLabel">Enterprise path</div>
                <div className="pbi-cardTitle" style={{ marginTop: 6 }}>
                  Want a security packet + guided rollout?
                </div>
                <div className="pbi-cardBody" style={{ marginTop: 6 }}>
                  Use the enterprise onboarding flow. We scope one irreversible endpoint, harden it, and produce a rollout plan.
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <a className="pbi-btnPrimary" href="/enterprise">
                    Enterprise →
                  </a>
                  <a className="pbi-btnGhost" href="/pricing">
                    Pricing →
                  </a>
                  <a className="pbi-btnGhost" href={API_DOCS} target="_blank" rel="noreferrer">
                    API Docs →
                  </a>
                </div>
              </div>
            </section>

            <footer className="pbi-footer" style={{ marginTop: 6 }}>
              <div>© {new Date().getFullYear()} Kojib · PBI</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <a href="/terms">Terms</a>
                <a href="/privacy">Privacy</a>
                <a href="/enterprise">Enterprise</a>
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

function ChecklistRow({ item }: { item: string }) {
  return (
    <div className="pbi-card" style={{ padding: 12, borderRadius: 18 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div className="pbi-sideTag" style={{ minWidth: 98, textAlign: "center" }}>
          Required
        </div>
        <div style={{ color: "rgba(255,255,255,.84)", fontSize: 13, lineHeight: 1.5 }}>{item}</div>
      </div>
    </div>
  );
}