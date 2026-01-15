import React, { useMemo, useState } from "react";

const API_DOCS = "https://api.kojib.com/redoc";

export default function HomePage() {
  const [email, setEmail] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [err, setErr] = useState<string>("");

  const apiBase = useMemo(() => {
    return (process.env.NEXT_PUBLIC_PBI_API_BASE ?? "https://api.kojib.com").replace(/\/+$/, "");
  }, []);

  async function onSendLink(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!email.trim()) return;

    setStatus("sending");
    try {
      const r = await fetch(`${apiBase}/v1/portal/auth/start`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim() })
      });

      if (!r.ok) {
        setStatus("error");
        setErr("Could not send link. Try again.");
        return;
      }

      setStatus("sent");
    } catch {
      setStatus("error");
      setErr("Network error. Try again.");
    }
  }

  return (
    <div className="pbi-landing">
      <div className="pbi-bg" aria-hidden />

      <div className="pbi-shell">
        {/* TOP BAR */}
        <header className="pbi-topbar">
          <div className="pbi-brand">
            <div className="pbi-mark" aria-hidden>
              <span className="pbi-markDot" />
            </div>
            <div>
              <div className="pbi-brandTitle">PBI</div>
              <div className="pbi-brandSub">Presence-Bound Identity</div>
            </div>
          </div>

          <nav className="pbi-nav">
            <a href={API_DOCS}>Docs</a>
            <a href="#access">Get access</a>
            <a href="#pricing">Pricing</a>
          </nav>
        </header>

        <main>
          {/* HERO */}
          <section className="pbi-hero">
            <div className="pbi-heroGrid">
              <div>
                <div className="pbi-pill">
                  <span className="pbi-pillDot" />
                  Presence Gate for High-Risk Systems
                </div>

                <h1 className="pbi-h1">
                  Make “a human was present” <span>a verifiable system primitive.</span>
                </h1>

                <p className="pbi-lead">
                  PBI turns real-world presence into an API call. Bind a challenge to an action hash, require a live WebAuthn
                  ceremony (UP+UV), and receive a non-replayable receipt suitable for audit and dispute resolution.
                </p>

                <div className="pbi-valueGrid">
                  <ValueLine title="Accountless verification" body="No identity database. No passwords. No “trust me.”" />
                  <ValueLine title="Non-repudiable receipts" body="Receipt hash binds presence to the exact action." />
                  <ValueLine title="Drop-in enforcement" body="Wrap your most dangerous endpoints in minutes." />
                  <ValueLine title="Metering + billing built-in" body="Usage, invoices, and plan quotas are automatic." />
                </div>

                <div className="pbi-ctaRow">
                  <a className="pbi-btnPrimary" href="#access">
                    Get access <span aria-hidden>→</span>
                  </a>
                  <a className="pbi-btnGhost" href={API_DOCS}>
                    Read the docs
                  </a>
                  <a className="pbi-btnGhost" href="#pricing">
                    Pricing
                  </a>
                </div>

                <div className="pbi-proofStrip">
                  <div className="pbi-proofLabel">Designed for teams who can’t afford “maybe”</div>
                  <div className="pbi-proofPills">
                    <span className="pbi-proofPill">Financial infrastructure</span>
                    <span className="pbi-proofPill">Admin control planes</span>
                    <span className="pbi-proofPill">Governance systems</span>
                    <span className="pbi-proofPill">High-value authorship</span>
                    <span className="pbi-proofPill">Irreversible actions</span>
                  </div>
                </div>
              </div>

              {/* PROOF PANEL */}
              <aside className="pbi-side">
                <div className="pbi-sideTop">
                  <div>
                    <div className="pbi-proofLabel">What you get back</div>
                    <div className="pbi-sideTitle">A receipt that proves:</div>
                  </div>
                  <div className="pbi-sideTag">cryptographic · auditable</div>
                </div>

                <div className="pbi-sideList">
                  <div className="pbi-bullet">
                    <span className="pbi-bulletDot">•</span>
                    <span>a human was present (UP+UV)</span>
                  </div>
                  <div className="pbi-bullet">
                    <span className="pbi-bulletDot">•</span>
                    <span>for this exact challenge + action hash</span>
                  </div>
                  <div className="pbi-bullet">
                    <span className="pbi-bulletDot">•</span>
                    <span>within expiry</span>
                  </div>
                  <div className="pbi-bullet">
                    <span className="pbi-bulletDot">•</span>
                    <span>single-use (non-replayable)</span>
                  </div>
                  <div className="pbi-bullet">
                    <span className="pbi-bulletDot">•</span>
                    <span>auditable by receipt hash</span>
                  </div>
                </div>

                <pre className="pbi-code">{`POST /v1/pbi/challenge
POST /v1/pbi/verify
→ receiptId + receiptHashHex`}</pre>

                <div className="pbi-section">
                  <FlowRow a="actionHash" b="challenge" />
                  <FlowRow a="UP+UV" b="verify" />
                  <FlowRow a="receiptHash" b="audit" />
                </div>
              </aside>
            </div>
          </section>

          {/* HOW IT WORKS */}
          <section className="pbi-section">
            <div className="pbi-sectionGrid3">
              <InfoCard title="1) Bind" body="Hash the action you’re about to perform. Ask PBI for a challenge bound to that hash." />
              <InfoCard title="2) Prove presence" body="User completes FaceID/TouchID WebAuthn ceremony (UP+UV). No accounts required." />
              <InfoCard title="3) Enforce" body="Proceed only if verify returns PBI_VERIFIED. Store the receipt so you can prove it later." />
            </div>
          </section>

          {/* USE CASES */}
          <section className="pbi-section">
            <div className="pbi-card">
              <div className="pbi-cardTitle">Wrap your most sensitive endpoints.</div>
              <div className="pbi-cardBody">
                Place PBI in front of “can’t be undone” operations: money, control, authorship, irreversible changes.
              </div>

              <div className="pbi-sectionGrid3" style={{ marginTop: 12 }}>
                <MiniCard title="Treasury & transfers" body="Presence-gate wires, payouts, escrow release." />
                <MiniCard title="Admin & access control" body="Gate role changes, key rotations, deploy approvals." />
                <MiniCard title="Governance actions" body="Gate votes, proposals, multisig flows." />
                <MiniCard title="Authorship confirmation" body="Presence-stamp contracts and publications." />
                <MiniCard title="Critical config changes" body="Gate flags, production settings, incident actions." />
                <MiniCard title="High-risk user actions" body="Gate recovery, withdraw, device enrollment." />
              </div>

              <div style={{ marginTop: 12 }}>
                <a className="pbi-btnGhost" href={API_DOCS}>
                  See endpoints →
                </a>
              </div>
            </div>
          </section>

          {/* PRICING */}
          <section className="pbi-section" id="pricing">
            <div className="pbi-card">
              <div className="pbi-cardTitle">Pricing</div>
              <div className="pbi-cardBody">
                Choose your verification capacity. Upgrade anytime — quotas apply automatically via webhook.
              </div>

              <div className="pbi-sectionGrid3" style={{ marginTop: 12 }}>
                <PlanCard
                  name="Starter"
                  price="$99"
                  period="/month"
                  tagline="Ship presence gates fast."
                  bestFor="Best for: teams shipping their first high-risk presence gates."
                  bullets={[
                    "Presence verification core",
                    "Starter verification quota",
                    "Audit-ready receipt hashes",
                    "Client portal + billing"
                  ]}
                />

                <PlanCard
                  name="Pro"
                  price="$499"
                  period="/month"
                  tagline="Higher throughput + more automation."
                  bestFor="Best for: products scaling usage and enforcement coverage."
                  bullets={[
                    "Everything in Starter",
                    "Higher verification quota",
                    "Priority processing",
                    "Designed for scaling teams"
                  ]}
                />

                <PlanCard
                  name="Enterprise"
                  price="$1,999"
                  period="/month"
                  tagline="Authoritative human presence at scale."
                  bestFor="Best for: financial infrastructure, governance, mission-critical control."
                  featured
                  bullets={[
                    "Everything in Pro",
                    "Highest verification quota",
                    "Enterprise reliability + throughput",
                    "Built for high-risk operations",
                    "Dispute & compliance ready"
                  ]}
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <a className="pbi-btnPrimary" href="#access">
                  Start with a magic link →
                </a>
              </div>
            </div>
          </section>

          {/* ACCESS */}
          <section className="pbi-section" id="access">
            <div className="pbi-accessGrid">
              <div className="pbi-card">
                <div className="pbi-proofLabel">Get access</div>
                <div className="pbi-cardTitle" style={{ marginTop: 6 }}>
                  Sign in with a magic link.
                </div>
                <div className="pbi-cardBody">
                  You’ll land in the client portal to activate billing, create API keys, and track usage. No passwords.
                </div>

                <form className="pbi-formRow" onSubmit={onSendLink}>
                  <input
                    className="pbi-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder="you@company.com"
                  />
                  <button className="pbi-btnSend" type="submit" disabled={status === "sending"}>
                    {status === "sending" ? "Sending…" : status === "sent" ? "Sent" : "Send link"}
                  </button>
                </form>

                {status === "sent" ? <div className="pbi-msgOk">Check your inbox. Link expires in 15 minutes.</div> : null}
                {status === "error" ? <div className="pbi-msgErr">{err || "Error"}</div> : null}

                <div className="pbi-proofLabel" style={{ marginTop: 12 }}>
                  By continuing, you agree to the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
                </div>
              </div>

              <div className="pbi-card" style={{ background: "rgba(0,0,0,.22)" }}>
                <div className="pbi-proofLabel">Why this works</div>
                <div className="pbi-cardTitle" style={{ marginTop: 6 }}>
                  Presence, not accounts.
                </div>
                <div className="pbi-cardBody">
                  PBI does not store identities. It verifies a live presence ceremony and returns a receipt bound to the action you
                  chose to sign.
                </div>

                <div className="pbi-section" style={{ display: "grid", gap: 10 }}>
                  <ProofLine k="Accountless" v="No usernames, passwords, or identity databases." />
                  <ProofLine k="Non-repudiable" v="UP+UV assertion + receipt hash = audit trail." />
                  <ProofLine k="Composable" v="Wrap /transfer/commit, /admin/approve, /deploy/release…" />
                  <ProofLine k="Fast to ship" v="Drop-in wrapper: challenge → verify → receipt." />
                </div>
              </div>
            </div>

            <footer className="pbi-footer">
              <div>© {new Date().getFullYear()} Kojib · PBI</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <a href="/terms">Terms</a>
                <a href="/privacy">Privacy</a>
                <a href={API_DOCS}>Docs</a>
              </div>
            </footer>
          </section>
        </main>
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

function ProofLine({ k, v }: { k: string; v: string }) {
  return (
    <div className="pbi-card" style={{ padding: 12, borderRadius: 18 }}>
      <div className="pbi-proofLabel">{k}</div>
      <div style={{ marginTop: 6, color: "rgba(255,255,255,.82)", fontSize: 13, lineHeight: 1.45, textAlign: "right" }}>
        {v}
      </div>
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
        fontSize: 12
      }}
    >
      <span
        style={{
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
          fontSize: 11
        }}
      >
        {a}
      </span>
      <span style={{ opacity: 0.55 }}>→</span>
      <span
        style={{
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
          fontSize: 11
        }}
      >
        {b}
      </span>
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
  featured
}: {
  name: string;
  price: string;
  period: string;
  tagline: string;
  bestFor: string;
  bullets: string[];
  featured?: boolean;
}) {
  return (
    <div
      className="pbi-card"
      style={{
        background: featured ? "rgba(120,255,231,.08)" : "rgba(255,255,255,.06)",
        borderColor: featured ? "rgba(120,255,231,.32)" : "rgba(255,255,255,.12)"
      }}
    >
      {featured ? <div className="pbi-sideTag" style={{ float: "right" }}>Recommended</div> : null}

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
        <a
          className={featured ? "pbi-btnPrimary" : "pbi-btnGhost"}
          href="#access"
          style={{ width: "100%", justifyContent: "center" }}
        >
          Start now
        </a>
      </div>
    </div>
  );
}