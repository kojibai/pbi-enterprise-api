// pages/index.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { apiJson } from "../lib/api";

// Prefer linking directly to docs (Interactive / Reference) vs root.
// If your docs live elsewhere, update this constant.
const API_DOCS = "https://api.kojib.com/docs";
const DEFAULT_CALENDLY = "https://calendly.com/kojibchat/one-on-one";

// Public tools
const DEMO_URL = "https://demo.kojib.com";
const TOOL_URL = "https://tool.kojib.com";

// SEO / OG base
const SITE_URL = "https://pbi.kojib.com";

declare global {
  interface Window {
    Calendly?: {
      initInlineWidget?: (opts: { url: string; parentElement: HTMLElement }) => void;
    };
  }
}

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
    const em = email.trim().toLowerCase();
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

  // Used to force Calendly to remount every time modal opens
  const [calendlyKey, setCalendlyKey] = useState<number>(0);

  const salesPanelRef = useRef<HTMLDivElement | null>(null);
  const calendlyHostRef = useRef<HTMLDivElement | null>(null);

  function openSales() {
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

  // Re-initialize Calendly widget on open (and every remount) — single init path (no double-mount)
  useEffect(() => {
    if (!salesOpen) return;

    let cancelled = false;

    function mountCalendly() {
      if (cancelled) return;

      const host = calendlyHostRef.current;
      if (!host) return;

      host.innerHTML = "";

      // Preferred: initInlineWidget when available
      const init = window.Calendly?.initInlineWidget;
      if (typeof init === "function") {
        try {
          init({ url: calendlyEmbedUrl, parentElement: host });
          return;
        } catch {
          // fall through to attribute-based embed
        }
      }

      // Fallback: attribute-based embed (Calendly script will hydrate it when ready)
      const widget = document.createElement("div");
      widget.className = "calendly-inline-widget";
      widget.setAttribute("data-url", calendlyEmbedUrl);
      widget.style.minWidth = "320px";
      widget.style.height = "700px";
      host.appendChild(widget);
    }

    mountCalendly();

    // Re-try a few times in case script loads slightly later
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

  // ✅ EDIT THESE to match your server-enforced quotas
  const PLAN_QUOTA = {
    starter: 10_000,
    pro: 100_000,
    scale: 1_000_000
  } as const;

  function fmtInt(n: number) {
    return n.toLocaleString();
  }

  const ogImage = `${SITE_URL}/pbi_1.png`;

  const [calendlyHeight, setCalendlyHeight] = useState<number>(720);

  useEffect(() => {
    if (!salesOpen) return;

    const vv = window.visualViewport;

    const compute = () => {
      // visualViewport is best on iOS because it tracks the Safari UI bars
      const vh = Math.floor(vv?.height ?? window.innerHeight);

      // Reserve space for: modal header + copy + padding + email button
      const reserved = 320;
      const h = Math.max(520, vh - reserved);

      setCalendlyHeight(h);
    };

    compute();

    vv?.addEventListener("resize", compute);
    window.addEventListener("resize", compute);

    return () => {
      vv?.removeEventListener("resize", compute);
      window.removeEventListener("resize", compute);
    };
  }, [salesOpen, securityOpen]);

  return (
    <>
      <Head>
        {/* Primary */}
        <title>PBI · Presence-Bound Identity · Kojib</title>
        <meta
          name="description"
          content="Presence verification for irreversible actions. Bind WebAuthn (UP+UV) to an action hash and receive a signed, non-replayable receipt — plus optional portable proof bundles for offline verification, audit, and chain-of-custody."
        />

        {/* Canonical */}
        <link rel="canonical" href={`${SITE_URL}/`} />

        {/* Robots */}
        <meta name="robots" content="index,follow" />

        {/* Favicons (must exist in THIS Next.js app /public) */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" href="/kojib.png" />
        <link rel="apple-touch-icon" href="/kojib.png" />
        <meta name="theme-color" content="#05070e" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Kojib" />
        <meta property="og:title" content="PBI · Presence-Bound Identity" />
        <meta
          property="og:description"
          content="Presence verification for irreversible actions. Action-bound WebAuthn proofs with signed receipts and optional portable proof bundles for offline verification and audit."
        />
        <meta property="og:url" content={`${SITE_URL}/`} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="PBI Presence-Bound Identity — action-bound proof bundles" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="PBI · Presence-Bound Identity" />
        <meta
          name="twitter:description"
          content="Presence verification for irreversible actions. Action-bound WebAuthn proofs with signed receipts and portable proof bundles for offline verification and audit."
        />
        <meta name="twitter:image" content={ogImage} />
        <meta name="twitter:image:alt" content="PBI Presence-Bound Identity — action-bound proof bundles" />
      </Head>

      <div className="pbi-landing">
        <div className="pbi-bg" aria-hidden />

        <div className="pbi-shell">
          {/* TOP BAR */}
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
              {/* One-page anchors (keep) */}
              <a href="#how">How it works</a>
              <a href="#tools">Demo</a>
              <a href="#pricing">Pricing</a>

              {/* Premium site pages */}
              <a href="/developers">Developers</a>
              <a href="/customers">Customers</a>
              <a href="/trust">Trust</a>
              <a href="/status">Status</a>
              <a href="/changelog">Changelog</a>

              {/* External reference */}
              <a href={API_DOCS} rel="noreferrer" target="_blank">
                API
              </a>

              {/* Strong CTA */}
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
                    Presence verification for irreversible actions · exportable evidence
                  </div>

                  <h1 className="pbi-h1">
                    If it can’t be undone, <span>it must be presence-verified.</span>
                  </h1>

                  <p className="pbi-lead">
                    PBI is a drop-in presence layer for high-risk systems. Bind a WebAuthn challenge to an <b>action hash</b>, require a live{" "}
                    <b>UP+UV ceremony</b> (FaceID / TouchID), and receive a <b>signed, non-replayable receipt</b> — plus optional{" "}
                    <b>portable proof bundles</b> for offline verification, audit, and chain-of-custody.
                  </p>

                  {/* HERO VIDEO */}
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
                    <ValueLine title="Portable evidence" body="Export PBI Packs/Proofs for offline verification, audits, and disputes." />
                    <ValueLine title="No identity database" body="Verify presence without storing users, passwords, or biometrics." />
                  </div>

                  <div className="pbi-ctaRow">
                    <a className="pbi-btnPrimary" href="#access">
                      Get access <span aria-hidden>→</span>
                    </a>

                    <a className="pbi-btnGhost" href={API_DOCS} rel="noreferrer" target="_blank">
                      Read API docs
                    </a>

                    <a className="pbi-btnGhost" href={DEMO_URL} target="_blank" rel="noreferrer">
                      Run live demo
                    </a>

                    <a className="pbi-btnGhost" href="/enterprise">
                      Enterprise
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

                  {/* Trust strip */}
                  <div className="pbi-card" style={{ marginTop: 14, background: "rgba(0,0,0,.18)" }}>
                    <div className="pbi-proofLabel">Trust & operations</div>
                    <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <a className="pbi-btnGhost" href="/trust">
                        Trust Center →
                      </a>
                      <a className="pbi-btnGhost" href="/status">
                        Status →
                      </a>
                      <a className="pbi-btnGhost" href="/changelog">
                        Changelog →
                      </a>
                      <a className="pbi-btnGhost" href="/developers">
                        Developer Hub →
                      </a>
                    </div>
                  </div>
                </div>

                {/* PROOF PANEL */}
                <aside className="pbi-side">
                  <div className="pbi-sideTop">
                    <div>
                      <div className="pbi-proofLabel">What you get back</div>
                      <div className="pbi-sideTitle">A proof bundle that shows:</div>
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
                      <span>single-use, within expiry (non-replayable)</span>
                    </div>
                    <div className="pbi-bullet">
                      <span className="pbi-bulletDot">•</span>
                      <span>verifiable later by receipt hash</span>
                    </div>
                    <div className="pbi-bullet">
                      <span className="pbi-bulletDot">•</span>
                      <span>
                        optional offline verification with <b>trust policy</b> (rotate/revoke/expire)
                      </span>
                    </div>
                  </div>

                  <pre className="pbi-code">{`POST /v1/pbi/challenge  { actionHash }
POST /v1/pbi/verify     { assertion }
→ receiptHash
→ packId + merkleRoot
→ proofs/<id>.proof.json (portable)`}</pre>

                  <div className="pbi-section">
                    <FlowRow a="actionHash" b="challenge" />
                    <FlowRow a="UP+UV" b="verify" />
                    <FlowRow a="receiptHash" b="audit" />
                    <FlowRow a="packId" b="custody" />
                  </div>

                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    <a className="pbi-btnGhost" href="/security" style={{ width: "100%", justifyContent: "center" }}>
                      Security overview →
                    </a>
                    <a className="pbi-btnGhost" href="/enterprise" style={{ width: "100%", justifyContent: "center" }}>
                      Enterprise onboarding →
                    </a>
                  </div>
                </aside>
              </div>
            </section>

            {/* TOOLS */}
            <section className="pbi-section" id="tools">
              <SectionHead
                kicker="Proof in under a minute"
                title="Run the live presence ceremony"
                body="The demo shows the full ceremony end-to-end. The tool is an integration harness (BYOK) for real API keys, real action hashes, and receipt/proof debugging."
              />

              <div className="pbi-sectionGrid3">
                <PlanCard
                  name="Live Demo"
                  price="Free"
                  period=""
                  tagline="Public-safe demo. No API keys. Runs the full ceremony."
                  bestFor="Best for: buyers, security reviewers, engineers validating the flow."
                  bullets={["No keys required", "Register passkey → attest → verify", "Receipt minted + decision shown", "Safe to share in public"]}
                  featured
                  ctaLabel="Open demo"
                  ctaHref={DEMO_URL}
                />

                <PlanCard
                  name="Attester Tool"
                  price="BYOK"
                  period=""
                  tagline="Integration harness for real keys and real API bases."
                  bestFor="Best for: customers integrating PBI into production endpoints."
                  bullets={["Use your real API key", "Custom action payload + actionHash", "Receipt hashes + portable proofs", "Requires portal account"]}
                  ctaLabel="Open tool"
                  ctaHref={TOOL_URL}
                />

                <PlanCard
                  name="Developer Hub"
                  price="Start"
                  period=""
                  tagline="Quickstart, patterns, canonicalization and enforcement guidance."
                  bestFor="Best for: teams integrating PBI into real endpoints."
                  bullets={["5-minute quickstart", "Action hashing guidance", "Enforcement patterns", "Links to reference docs"]}
                  ctaLabel="Open developers"
                  ctaHref="/developers"
                />

                <PlanCard
                  name="API Docs"
                  price="Read"
                  period=""
                  tagline="Exact endpoints, payloads, and response semantics."
                  bestFor="Best for: implementation + security review."
                  bullets={[
                    "/v1/pbi/challenge",
                    "/v1/pbi/verify",
                    "/v1/pbi/receipts?createdAfter&order&cursor",
                    "/v1/pbi/receipts/{receiptId}",
                    "/v1/pbi/receipts/export",
                    "/v1/portal/webhooks",
                    "Auth: Bearer API key",
                    "Receipt + pack/proof model"
                  ]}
                  ctaLabel="Open docs"
                  ctaHref={API_DOCS}
                />
              </div>
            </section>

            {/* WHY / WHAT IT REPLACES */}
            <section className="pbi-section" id="how">
              <SectionHead
                kicker="Why PBI exists"
                title="From account trust → human presence proof"
                body="Passwords, sessions, and tokens prove only that something authenticated. PBI proves a human was physically present and authorized the exact action you care about — then exports a proof you can verify later."
              />

              <FigureCard
                img="/pbi_4.png"
                alt="From Account Trust to Human Presence Proof — Legacy Authentication vs PBI"
                caption="Legacy auth answers “who has access?” PBI answers “was a human present for this exact irreversible action?”"
              />
            </section>

            {/* CORE IMAGES */}
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

              <div className="pbi-card" style={{ marginTop: 14 }}>
                <div className="pbi-cardTitle">Offline verification (optional)</div>
                <div className="pbi-cardBody">
                  For audits and custody chains, PBI can export a signed pack/proof that verifies offline under a trust policy (rotation/revocation/expiry).
                </div>

                <pre className="pbi-code" style={{ marginTop: 10 }}>{`pbi-pack-verify ../pbi-pack --trust ./trust.json
pbi-pack-verify --proof proofs/0001.proof.json --trust ./trust.json`}</pre>
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
                  <a className="pbi-btnGhost" href={API_DOCS} rel="noreferrer" target="_blank">
                    View endpoints →
                  </a>
                  <a className="pbi-btnGhost" href={DEMO_URL} target="_blank" rel="noreferrer">
                    Run demo →
                  </a>
                  <a className="pbi-btnGhost" href="/customers">
                    Customer use cases →
                  </a>
                  <a className="pbi-btnGhost" href="/enterprise">
                    Enterprise onboarding →
                  </a>
                  <a className="pbi-btnGhost" href="#access">
                    Get access →
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
                <div className="pbi-cardBody">
                  Choose your verification capacity. Usage is metered automatically.{" "}
                  <span style={{ opacity: 0.8 }}>A “verification” is one successful </span>
                  <span
                    style={{
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                      fontSize: 12
                    }}
                  >
                    /v1/pbi/verify
                  </span>
                  <span style={{ opacity: 0.8 }}> returning PBI_VERIFIED.</span>
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
                      `Includes ${fmtInt(PLAN_QUOTA.starter)} verifications/mo`,
                      "Receipt hash + audit trail",
                      "Overage billed per verification (shown in portal)"
                    ]}
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
                      "Overage billed per verification (shown in portal)"
                    ]}
                    featured
                  />

                  <PlanCard
                    name="Scale"
                    price="$1,999"
                    period="/month"
                    tagline="Authoritative human presence at scale."
                    bestFor="Best for: financial infrastructure, governance, mission-critical control."
                    featured
                    bullets={[
                      "Everything in Pro",
                      `Includes ${fmtInt(PLAN_QUOTA.scale)} verifications/mo`,
                      "Enterprise throughput + reliability",
                      "Portable proofs for audit workflows",
                      "Overage billed per verification (shown in portal)"
                    ]}
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
                      "Audit export & evidence bundling"
                    ]}
                    ctaLabel="Schedule a call"
                    ctaOnClick={openSales}
                    featured
                  />
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <a className="pbi-btnPrimary" href="#access">
                    Get Access →
                  </a>
                  <a className="pbi-btnGhost" href="/pricing">
                    Full pricing →
                  </a>
                  <a className="pbi-btnGhost" href={DEMO_URL} target="_blank" rel="noreferrer">
                    Run demo
                  </a>
                  <a className="pbi-btnGhost" href={API_DOCS} rel="noreferrer" target="_blank">
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
                  <div className="pbi-cardBody">You’ll land in the client portal to activate billing, create API keys, and track usage. No passwords.</div>

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
                    PBI produces cryptographic proof of live human presence for a specific action. It does not attempt to identify who the user is, nor
                    does it store biometric data.
                  </div>

                  <div className="pbi-section" style={{ display: "grid", gap: 10 }}>
                    <ProofLine k="Guarantee" v="UP+UV ceremony occurred for this action hash, single-use, within expiry." />
                    <ProofLine k="Does not do" v="Identity resolution, KYC, biometric storage, or user databases." />
                    <ProofLine k="Portable evidence" v="Optional PBI Packs/Proofs allow offline verification with rotation/revocation/expiry." />
                    <ProofLine k="Operational model" v="challenge → verify → receipt; enforce only on PBI_VERIFIED." />
                  </div>

                  <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <a className="pbi-btnGhost" href="/trust">
                      Trust Center →
                    </a>
                    <a className="pbi-btnGhost" href="/security">
                      Security →
                    </a>
                    <a className="pbi-btnGhost" href="/status">
                      Status →
                    </a>
                    <a className="pbi-btnGhost" href="/changelog">
                      Changelog →
                    </a>
                  </div>
                </div>
              </div>

              {/* FOOTER (new) */}
              <footer className="pbi-footer">
                <div className="pbi-footerLeft">© {new Date().getFullYear()} Kojib · PBI</div>

                <div className="pbi-footerGrid">
                  <div className="pbi-footerCol">
                    <div className="pbi-footerH">Product</div>
                    <a href="/why">Why</a>
                    <a href="/pricing">Pricing</a>
                    <a href="/enterprise">Enterprise</a>
                    <a href="/customers">Customers</a>
                  </div>

                  <div className="pbi-footerCol">
                    <div className="pbi-footerH">Developers</div>
                    <a href="/developers">Developer Hub</a>
                    <a href={API_DOCS} target="_blank" rel="noreferrer">
                      API Docs
                    </a>
                    <a href={TOOL_URL} target="_blank" rel="noreferrer">
                      Tool
                    </a>
                    <a href={DEMO_URL} target="_blank" rel="noreferrer">
                      Demo
                    </a>
                  </div>

                  <div className="pbi-footerCol">
                    <div className="pbi-footerH">Trust</div>
                    <a href="/trust">Trust Center</a>
                    <a href="/security">Security</a>
                    <a href="/status">Status</a>
                    <a href="/changelog">Changelog</a>
                  </div>

                  <div className="pbi-footerCol">
                    <div className="pbi-footerH">Legal</div>
                    <a href="/terms">Terms</a>
                    <a href="/privacy">Privacy</a>
                  </div>
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
                  <div className="pbi-card" style={{ background: "rgba(255,255,255,.06)" }}>
                    <div className="pbi-proofLabel">Scheduling</div>
                    <div className="pbi-cardTitle" style={{ marginTop: 6 }}>
                      Pick a time
                    </div>
                    <div className="pbi-cardBody" style={{ marginTop: 8 }}>
                      Use the inline scheduler below. Your intake form captures the details we need.
                    </div>

                    <div className="pbi-calendlyWrap" style={{ marginTop: 12, height: calendlyHeight }}>
                      <div ref={calendlyHostRef} className="pbi-calendlyHost" key={calendlyKey} />
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <button className="pbi-btnGhost" type="button" onClick={emailSalesNow} style={{ width: "100%", justifyContent: "center" }}>
                        Email sales
                      </button>
                    </div>
                  </div>

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
                            <div className="pbi-secK">Threat model</div>
                            <div className="pbi-secV">Replay resistance, ceremony guarantees, and expected failure modes.</div>
                          </div>
                          <div className="pbi-secItem">
                            <div className="pbi-secK">Data flow diagram</div>
                            <div className="pbi-secV">What is sent, what is stored (receipts/metadata), and what is explicitly not stored.</div>
                          </div>
                          <div className="pbi-secItem">
                            <div className="pbi-secK">Trust policy</div>
                            <div className="pbi-secV">Rotation + revocation + expiry windows for offline verification governance.</div>
                          </div>
                          <div className="pbi-secItem">
                            <div className="pbi-secK">Evidence bundling</div>
                            <div className="pbi-secV">PBI Pack + PBI Proof exports for compliance, legal, and air-gapped review.</div>
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
                      <a className="pbi-btnGhost" href={API_DOCS} rel="noreferrer" target="_blank">
                        Review API docs
                      </a>
                      <a className="pbi-btnGhost" href={DEMO_URL} target="_blank" rel="noreferrer">
                        Demo
                      </a>
                      <a className="pbi-btnGhost" href="/trust">
                        Trust Center
                      </a>
                      <a className="pbi-btnGhost" href="/status">
                        Status
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
            target={ctaHref.startsWith("http") ? "_blank" : undefined}
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
