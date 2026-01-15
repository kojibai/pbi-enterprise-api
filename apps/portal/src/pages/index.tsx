import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { apiJson } from "../lib/api";

const API_DOCS = "https://api.kojib.com/";
const DEFAULT_CALENDLY = "https://calendly.com/kojibchat/one-on-one";

export default function HomePage() {
  const router = useRouter();

  const [email, setEmail] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [err, setErr] = useState<string>("");

  // If already logged in, NEVER show landing. Go to /console.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await apiJson("/v1/portal/me");
        if (!cancelled) await router.replace("/console");
      } catch {
        // not logged in → stay on landing
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const apiBase = useMemo(() => {
    return (process.env.NEXT_PUBLIC_PBI_API_BASE ?? "https://api.kojib.com").replace(/\/+$/, "");
  }, []);

  async function onSendLink(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const em = email.trim();
    if (!em) return;

    setStatus("sending");
    try {
      const r = await fetch(`${apiBase}/v1/portal/auth/start`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: em })
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

  // ---------- SALES / PBI ASSURED MODAL (INLINE CALENDLY) ----------
  const SALES_EMAIL = (process.env.NEXT_PUBLIC_PBI_SALES_EMAIL ?? "sales@kojib.com").trim();
  const SALES_CALENDLY = (process.env.NEXT_PUBLIC_PBI_SALES_CALENDLY_URL ?? DEFAULT_CALENDLY).trim();

  const calendlyEmbedUrl = useMemo(() => {
    const base = SALES_CALENDLY.replace(/\/+$/, "");
    const hasQ = base.includes("?");
    return `${base}${hasQ ? "&" : "?"}hide_event_type_details=1&hide_gdpr_banner=1`;
  }, [SALES_CALENDLY]);

  const [salesOpen, setSalesOpen] = useState<boolean>(false);
  const [securityOpen, setSecurityOpen] = useState<boolean>(false);

  // IMPORTANT: used to force Calendly to remount every time modal opens
  const [calendlyKey, setCalendlyKey] = useState<number>(0);

  const salesPanelRef = useRef<HTMLDivElement | null>(null);
  const calendlyHostRef = useRef<HTMLDivElement | null>(null);

  function openSales() {
    // force a clean remount on every open
    setCalendlyKey((k) => k + 1);
    setSalesOpen(true);
  }

  function closeSales() {
    setSalesOpen(false);
    setSecurityOpen(false);
  }

  function emailSalesNow() {
    window.location.href = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent("PBI Assured — Schedule a call")}`;
  }

  // Load Calendly widget script once (safe in Next.js)
  useEffect(() => {
    if (!salesOpen) return;

    const SCRIPT_ID = "calendly-widget-js";
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) return;

    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = "https://assets.calendly.com/assets/external/widget.js";
    s.async = true;
    document.body.appendChild(s);
  }, [salesOpen]);

  // ALWAYS re-initialize Calendly widget on open (and on every remount)
  useEffect(() => {
    if (!salesOpen) return;

    let cancelled = false;

    function mountCalendly() {
      if (cancelled) return;

      const host = calendlyHostRef.current;
      if (!host) return;

      // Hard reset host every time
      host.innerHTML = "";

      const widget = document.createElement("div");
      widget.className = "calendly-inline-widget";
      widget.setAttribute("data-url", calendlyEmbedUrl);
      widget.style.minWidth = "320px";
      widget.style.height = "700px";
      host.appendChild(widget);

      // If Calendly global is available, explicitly init
      const w = window as any;
      if (w.Calendly && typeof w.Calendly.initInlineWidget === "function") {
        try {
          w.Calendly.initInlineWidget({
            url: calendlyEmbedUrl,
            parentElement: widget
          });
        } catch {
          // no-op: widget.js may auto-init via DOM scan
        }
      }
    }

    // Try immediately + retry (script may still be loading)
    mountCalendly();
    const timers: number[] = [];
    timers.push(window.setTimeout(mountCalendly, 120));
    timers.push(window.setTimeout(mountCalendly, 350));
    timers.push(window.setTimeout(mountCalendly, 800));
    timers.push(window.setTimeout(mountCalendly, 1400));

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [salesOpen, calendlyKey, calendlyEmbedUrl]);

  // Modal behaviors: ESC closes, click-outside closes, lock scroll.
  useEffect(() => {
    if (!salesOpen) return;

    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key === "Escape") closeSales();
    }

    function onMouseDown(ev: MouseEvent) {
      const panel = salesPanelRef.current;
      if (!panel) return;
      const target = ev.target as Node;
      if (panel.contains(target)) return;
      closeSales();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);

    return () => {
      document.documentElement.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [salesOpen]);

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
            <a href="#how" rel="noreferrer">
              How it works
            </a>
            <a href={API_DOCS} rel="noreferrer">
              API
            </a>
            <a href="#pricing">Pricing</a>
            <a className="pbi-navCta" href="#access">
              Get access
            </a>
          </nav>
        </header>

        <main>
          {/* HERO */}
          <section className="pbi-hero">
            <div className="pbi-heroGrid">
              <div>
                <div className="pbi-pill">
                  <span className="pbi-pillDot" />
                  Presence verification for irreversible actions
                </div>

                <h1 className="pbi-h1">
                  If it can’t be undone, <span>it must be presence-verified.</span>
                </h1>

                <p className="pbi-lead">
                  PBI is a drop-in presence layer for high-risk systems. Bind a WebAuthn challenge to an <b>action hash</b>, require a live{" "}
                  <b>UP+UV ceremony</b> (FaceID / TouchID), and receive a <b>signed, non-replayable receipt</b> you can audit forever.
                </p>

                {/* HERO VIDEO (YouTube embed) */}
                <div className="pbi-heroVideo">
                  <div className="pbi-heroVideoFrame">
                    <div className="pbi-heroVideoAspect">
                      <iframe
                        className="pbi-heroVideoIframe"
                        src="https://www.youtube-nocookie.com/embed/73HYFF1Jlco?autoplay=0&mute=0&loop=1&playlist=73HYFF1Jlco&controls=1&modestbranding=1&rel=0&playsinline=1"
                        title="PBI Intro"
                        allow="autoplay; encrypted-media; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>

                  <div className="pbi-heroVideoCaption">Presence-bound verification in under a minute.</div>
                </div>

                <div className="pbi-valueGrid">
                  <ValueLine title="Action-bound proof" body="Receipts bind presence to the exact operation you intended to perform." />
                  <ValueLine title="Non-replayable by design" body="Single-use challenges stop replays, scripts, and delegated approvals." />
                  <ValueLine title="No identity database" body="PBI verifies presence without storing users, passwords, or biometrics." />
                  <ValueLine title="Audit & dispute ready" body="Cryptographic receipts are verifiable long after logs are gone." />
                </div>

                <div className="pbi-ctaRow">
                  <a className="pbi-btnPrimary" href="#access">
                    Get access <span aria-hidden>→</span>
                  </a>
                  <a className="pbi-btnGhost" href={API_DOCS} rel="noreferrer">
                    Read API docs
                  </a>
                  <button className="pbi-btnGhost" type="button" onClick={openSales}>
                    Talk to sales
                  </button>
                </div>

                <div className="pbi-proofStrip">
                  <div className="pbi-proofLabel">Built for teams who can’t afford “maybe” approvals</div>
                  <div className="pbi-proofPills">
                    <span className="pbi-proofPill">Treasury & payouts</span>
                    <span className="pbi-proofPill">Admin control planes</span>
                    <span className="pbi-proofPill">Governance & multisig</span>
                    <span className="pbi-proofPill">Deploy & production changes</span>
                    <span className="pbi-proofPill">Legal / ownership actions</span>
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
                    <span>
                      a human was present <b>(UP+UV)</b>
                    </span>
                  </div>
                  <div className="pbi-bullet">
                    <span className="pbi-bulletDot">•</span>
                    <span>for this exact action hash</span>
                  </div>
                  <div className="pbi-bullet">
                    <span className="pbi-bulletDot">•</span>
                    <span>within expiry, single-use (non-replayable)</span>
                  </div>
                  <div className="pbi-bullet">
                    <span className="pbi-bulletDot">•</span>
                    <span>verifiable later by receipt hash</span>
                  </div>
                  <div className="pbi-bullet">
                    <span className="pbi-bulletDot">•</span>
                    <span>
                      no biometric data stored, <b>no identity database</b>
                    </span>
                  </div>
                </div>

                <pre className="pbi-code">{`POST /v1/pbi/challenge  { actionHash }
POST /v1/pbi/verify     { assertion }
→ receiptId + receiptHashHex`}</pre>

                <div className="pbi-section">
                  <FlowRow a="actionHash" b="challenge" />
                  <FlowRow a="UP+UV" b="verify" />
                  <FlowRow a="receiptHash" b="audit" />
                </div>
              </aside>
            </div>
          </section>

          {/* WHY / WHAT IT REPLACES */}
          <section className="pbi-section" id="how">
            <SectionHead
              kicker="Why PBI exists"
              title="From account trust → human presence proof"
              body="Passwords, sessions, and tokens prove only that something authenticated. PBI proves a human was physically present and authorized the exact action you care about."
            />

            <FigureCard
              img="/pbi_4.png"
              alt="From Account Trust to Human Presence Proof — Legacy Authentication vs PBI"
              caption="Legacy auth answers “who has access?” PBI answers “was a human present for this exact irreversible action?”"
            />
          </section>

          {/* CORE IMAGES: WORKFLOW + INTEGRATION + FLOW */}
          <section className="pbi-section">
            <SectionHead
              kicker="Mechanism"
              title="Presence verification is a simple, strict flow"
              body="Hash the action, issue a challenge bound to that hash, require UP+UV, then store the receipt. If verify doesn’t return PBI_VERIFIED, you do not proceed."
            />

            <div className="pbi-figGrid">
              <FigureCard img="/pbi_1.png" alt="PBI Workflow: Proof of Human Presence" />
              <FigureCard img="/pbi_2.png" alt="PBI Integration into a Sensitive Endpoint" />
              <FigureCard img="/pbi_3.png" alt="WebAuthn Challenge-Verify Flow for Presence-Bound Identity" />
            </div>

            <div className="pbi-sectionGrid3" style={{ marginTop: 14 }}>
              <InfoCard title="1) Bind the action" body="Hash what you’re about to do (transfer, rotate keys, deploy). Challenge is bound to that hash." />
              <InfoCard title="2) Prove presence (UP+UV)" body="User completes a live WebAuthn ceremony. No accounts required for the proof." />
              <InfoCard title="3) Enforce + store receipt" body="Proceed only on PBI_VERIFIED. Store receipt hash for audit, forensics, disputes." />
            </div>
          </section>

          {/* USE CASES */}
          <section className="pbi-section">
            <SectionHead
              kicker="Where it belongs"
              title="If it can’t be undone, it must be presence-verified"
              body="PBI is for operations where “approved” must mean “a human was physically present and knowingly authorized it.”"
            />

            <FigureCard img="/pbi_5.png" alt="Irreversible actions use-case grid for PBI" />

            <div className="pbi-card" style={{ marginTop: 14 }}>
              <div className="pbi-cardTitle">Common enforcement points</div>
              <div className="pbi-cardBody">Wrap the endpoints that move money, change control, or create irreversible commitments.</div>

              <div className="pbi-sectionGrid3" style={{ marginTop: 12 }}>
                <MiniCard title="Treasury & transfers" body="Presence-gate wires, payouts, escrow release." />
                <MiniCard title="Admin & access control" body="Gate role changes, key rotations, deploy approvals." />
                <MiniCard title="Governance actions" body="Gate votes, proposals, multisig flows." />
                <MiniCard title="Authorship confirmation" body="Presence-stamp contracts, releases, publications." />
                <MiniCard title="Critical config changes" body="Gate flags, production settings, incident actions." />
                <MiniCard title="High-risk user actions" body="Gate recovery, withdraw, device enrollment." />
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <a className="pbi-btnGhost" href={API_DOCS} rel="noreferrer">
                  View endpoints →
                </a>
                <a className="pbi-btnGhost" href="#access">
                  Start with a magic link →
                </a>
                <button className="pbi-btnGhost" type="button" onClick={openSales}>
                  Talk to sales →
                </button>
              </div>
            </div>
          </section>

          {/* RECEIPT ANATOMY */}
          <section className="pbi-section">
            <SectionHead
              kicker="Evidence layer"
              title="The PBI receipt: proof, not logs"
              body="Logs are mutable, incomplete, and rarely dispute-ready. A receipt is cryptographic evidence: action-bound, timestamped, single-use, and verifiable long after the event."
            />

            <FigureCard img="/pbi_6.png" alt="PBI Receipt Anatomy: Proof, Not Logs" caption="No biometric data stored. No identity stored. Receipts remain verifiable." />
          </section>

          {/* ARCHITECTURE PLACEMENT */}
          <section className="pbi-section">
            <SectionHead
              kicker="Integration"
              title="PBI does not replace identity — it hardens actions"
              body="Keep your existing auth (SSO/OAuth/JWT). Add PBI only where you need cryptographic proof of human presence for irreversible operations."
            />

            <FigureCard img="/pbi_7.png" alt="Where PBI fits in your architecture" />
          </section>

          {/* PRICING */}
          <section className="pbi-section" id="pricing">
            <div className="pbi-card">
              <div className="pbi-cardTitle">Pricing</div>
              <div className="pbi-cardBody">Choose your verification capacity. Usage is metered automatically; receipts are always audit-ready.</div>

              <div className="pbi-sectionGrid3" style={{ marginTop: 12 }}>
                <PlanCard
                  name="Starter"
                  price="$99"
                  period="/month"
                  tagline="Ship presence gates fast."
                  bestFor="Best for: teams shipping their first high-risk presence gates."
                  bullets={["Presence verification core", "Starter verification quota", "Receipt hash + audit trail", "Client portal + billing"]}
                />

                <PlanCard
                  name="Pro"
                  price="$499"
                  period="/month"
                  tagline="Higher throughput + more automation."
                  bestFor="Best for: products scaling enforcement coverage."
                  bullets={["Everything in Starter", "Higher verification quota", "Priority processing", "Built for scaling teams"]}
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
                    "Designed for irreversible operations",
                    "Dispute & compliance ready"
                  ]}
                />

                <PlanCard
                  name="PBI Assured"
                  price="Talk to Sales"
                  period=""
                  tagline="Procurement-ready. Higher limits, governance support, and enterprise guarantees."
                  bestFor="Best for: banks, governments, platforms, custodians, and mission-critical control planes."
                  bullets={[
                    "Custom verification capacity + burst",
                    "SLA / priority support options",
                    "Security review packet on request",
                    "Receipts + retention strategy for audits",
                    "Roadmap alignment for regulated environments"
                  ]}
                  ctaLabel="Schedule a call"
                  ctaOnClick={openSales}
                  featured
                />
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <a className="pbi-btnPrimary" href="#access">
                  Start with a magic link →
                </a>
                <a className="pbi-btnGhost" href={API_DOCS} rel="noreferrer">
                  Read API docs
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
                    autoComplete="email"
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
                <div className="pbi-proofLabel">For security reviewers</div>
                <div className="pbi-cardTitle" style={{ marginTop: 6 }}>
                  What PBI guarantees (and what it doesn’t)
                </div>
                <div className="pbi-cardBody">
                  PBI produces cryptographic proof of live human presence for a specific action. It does not attempt to identify who the user is,
                  nor does it store biometric data.
                </div>

                <div className="pbi-section" style={{ display: "grid", gap: 10 }}>
                  <ProofLine k="Guarantee" v="UP+UV ceremony occurred for this action hash, single-use, within expiry." />
                  <ProofLine k="Does not do" v="Identity resolution, KYC, biometric storage, or user databases." />
                  <ProofLine k="Composable with" v="SSO/OAuth/JWT, RBAC/ABAC, SIEM, policy engines, existing audit tooling." />
                  <ProofLine k="Operational model" v="challenge → verify → receipt; enforce only on PBI_VERIFIED." />
                </div>
              </div>
            </div>

            <footer className="pbi-footer">
              <div>© {new Date().getFullYear()} Kojib · PBI</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <a href="/terms">Terms</a>
                <a href="/privacy">Privacy</a>
                <a href={API_DOCS} rel="noreferrer">
                  API Docs
                </a>
              </div>
            </footer>
          </section>
        </main>
      </div>

      {/* ---------- SALES POPOVER MODAL (INLINE CALENDLY EMBED) ---------- */}
      {salesOpen ? (
        <div className="pbi-modal" role="dialog" aria-modal="true" aria-label="PBI Assured — Schedule a call">
          <div className="pbi-modalBackdrop" aria-hidden />

          <div className="pbi-modalShell">
            <div className="pbi-modalPanel" ref={salesPanelRef}>
              <div className="pbi-modalTop">
                <div>
                  <div className="pbi-proofLabel">PBI Assured</div>
                  <div className="pbi-cardTitle" style={{ marginTop: 6 }}>
                    Schedule a call
                  </div>
                  <div className="pbi-cardBody" style={{ marginTop: 8 }}>
                    For regulated and mission-critical environments where approvals must be <b>provable</b> — not just logged.
                  </div>
                </div>

                <button className="pbi-modalClose" type="button" onClick={closeSales} aria-label="Close">
                  ✕
                </button>
              </div>

              <div className="pbi-modalGrid">
                {/* LEFT: Calendly host (we mount Calendly into this div every time) */}
                <div className="pbi-card" style={{ background: "rgba(255,255,255,.06)" }}>
                  <div className="pbi-proofLabel">Scheduling</div>
                  <div className="pbi-cardTitle" style={{ marginTop: 6 }}>
                    Pick a time
                  </div>
                  <div className="pbi-cardBody" style={{ marginTop: 8 }}>
                    Use the inline scheduler below. Your intake form captures the details we need.
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div ref={calendlyHostRef} />
                  </div>

                </div>

                {/* RIGHT: procurement-safe info + security packet */}
                <div className="pbi-card" style={{ background: "rgba(0,0,0,.18)" }}>
                  <div className="pbi-proofLabel">Security review</div>

                  <div className="pbi-secPack" style={{ marginTop: 10 }}>
                    <button
                      className="pbi-secPackBtn"
                      type="button"
                      onClick={() => setSecurityOpen((v) => !v)}
                      aria-expanded={securityOpen}
                    >
                      <span>Security packet includes</span>
                      <span className="pbi-secPackChevron" aria-hidden>
                        {securityOpen ? "▾" : "▸"}
                      </span>
                    </button>

                    {securityOpen ? (
                      <div className="pbi-secPackBody">
                        <div className="pbi-secItem">
                          <div className="pbi-secK">Controls posture</div>
                          <div className="pbi-secV">Control mappings and what evidence we can provide today (and what we do not claim).</div>
                        </div>
                        <div className="pbi-secItem">
                          <div className="pbi-secK">Data flow diagram</div>
                          <div className="pbi-secV">What is sent, what is stored (receipts/metadata), and what is explicitly not stored.</div>
                        </div>
                        <div className="pbi-secItem">
                          <div className="pbi-secK">Receipt retention</div>
                          <div className="pbi-secV">Retention options, export strategy, and guidance for regulated audit windows.</div>
                        </div>
                        <div className="pbi-secItem">
                          <div className="pbi-secK">Threat model</div>
                          <div className="pbi-secV">Replay resistance, ceremony guarantees, and expected failure modes.</div>
                        </div>
                        <div className="pbi-secItem">
                          <div className="pbi-secK">Deployment notes</div>
                          <div className="pbi-secV">Environment separation guidance, allowlisting, and integration patterns.</div>
                        </div>

                        <div className="pbi-proofLabel" style={{ marginTop: 10 }}>
                          We state guarantees precisely and avoid unverifiable claims.
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    <ProofLine k="Enforcement points" v="Which actions must be presence-gated (money, admin, governance, deploy)." />
                    <ProofLine k="Capacity & rollout" v="Monthly volume, burst patterns, environments, rollout sequencing." />
                    <ProofLine k="Commercials" v="Procurement-friendly onboarding and support options." />
                  </div>

                  <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <a className="pbi-btnGhost" href={API_DOCS} rel="noreferrer">
                      Review API docs
                    </a>
                  </div>
                </div>
              </div>

              <div className="pbi-modalFoot">
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="pbi-btnGhost" type="button" onClick={closeSales}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
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
  featured,
  ctaLabel,
  ctaHref,
  ctaOnClick
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
  ctaOnClick?: () => void;
}) {
  const hasClick = typeof ctaOnClick === "function";
  const hasHref = typeof ctaHref === "string" && ctaHref.length > 0;

  return (
    <div
      className="pbi-card"
      style={{
        background: featured ? "rgba(120,255,231,.08)" : "rgba(255,255,255,.06)",
        borderColor: featured ? "rgba(120,255,231,.32)" : "rgba(255,255,255,.12)"
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
        {hasClick ? (
          <button
            className={featured ? "pbi-btnPrimary" : "pbi-btnGhost"}
            type="button"
            onClick={ctaOnClick}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {ctaLabel || "Contact"}
          </button>
        ) : hasHref ? (
          <a
            className={featured ? "pbi-btnPrimary" : "pbi-btnGhost"}
            href={ctaHref}
            rel="noreferrer"
            style={{ width: "100%", justifyContent: "center" }}
          >
            {ctaLabel || "Schedule a call"}
          </a>
        ) : (
          <a className={featured ? "pbi-btnPrimary" : "pbi-btnGhost"} href="#access" style={{ width: "100%", justifyContent: "center" }}>
            {ctaLabel || "Start now"}
          </a>
        )}
      </div>
    </div>
  );
}