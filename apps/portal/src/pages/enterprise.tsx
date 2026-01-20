// pages/enterprise.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { apiJson } from "../lib/api";

const API_DOCS = "https://api.kojib.com/docs";
const DEFAULT_CALENDLY = "https://calendly.com/kojibchat/one-on-one";
const DEMO_URL = "https://demo.kojib.com";
const TOOL_URL = "https://tool.kojib.com";
const SITE_URL = "https://pbi.kojib.com";

declare global {
  interface Window {
    Calendly?: {
      initInlineWidget?: (opts: { url: string; parentElement: HTMLElement }) => void;
    };
  }
}

type AuthState = "unknown" | "logged_out" | "logged_in";

export default function EnterprisePage() {
  const router = useRouter();

  // Optional: show Console button if logged in
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

  const pageUrl = useMemo(() => `${SITE_URL}/enterprise`, []);
  const ogImage = `${SITE_URL}/pbi_1.png`;

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

  const [calendlyKey, setCalendlyKey] = useState<number>(0);
  const salesPanelRef = useRef<HTMLDivElement | null>(null);
  const calendlyHostRef = useRef<HTMLDivElement | null>(null);

  const [calendlyHeight, setCalendlyHeight] = useState<number>(720);

  function openSales() {
    setCalendlyKey((k) => k + 1);
    setSalesOpen(true);
  }

  function closeSales() {
    setSalesOpen(false);
    setSecurityOpen(false);
  }

  function emailSalesNow() {
    window.location.href = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent("PBI Enterprise — Schedule a call")}`;
  }

  // Load Calendly script once
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

  // Dynamic Calendly height (mobile-safe)
  useEffect(() => {
    if (!salesOpen) return;

    const vv = window.visualViewport;

    const compute = () => {
      const vh = Math.floor(vv?.height ?? window.innerHeight);
      const reserved = 320; // modal header + copy + padding + email button
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

  // Initialize Calendly when opened
  useEffect(() => {
    if (!salesOpen) return;
    let cancelled = false;

    function mountCalendly() {
      if (cancelled) return;
      const host = calendlyHostRef.current;
      if (!host) return;

      host.innerHTML = "";

      const init = window.Calendly?.initInlineWidget;
      if (typeof init === "function") {
        try {
          init({ url: calendlyEmbedUrl, parentElement: host });
          return;
        } catch {
          // fall through
        }
      }

      const widget = document.createElement("div");
      widget.className = "calendly-inline-widget";
      widget.setAttribute("data-url", calendlyEmbedUrl);
      widget.style.minWidth = "320px";
      widget.style.height = "700px";
      host.appendChild(widget);
    }

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
    <>
      <Head>
        <title>Enterprise · PBI Assured · Presence-Bound Identity</title>
        <meta
          name="description"
          content="Enterprise onboarding for PBI Assured: presence-verified approvals for irreversible actions. Paid pilots, security packet, rollout plan, and procurement-friendly terms."
        />
        <link rel="canonical" href={pageUrl} />
        <meta name="robots" content="index,follow" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" href="/kojib.png" />
        <link rel="apple-touch-icon" href="/kojib.png" />
        <meta name="theme-color" content="#05070e" />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Kojib" />
        <meta property="og:title" content="Enterprise · PBI Assured" />
        <meta
          property="og:description"
          content="Procurement-ready presence verification for irreversible actions: action-bound WebAuthn UP+UV with signed receipts and optional offline evidence bundles."
        />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="PBI Assured — enterprise presence verification" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Enterprise · PBI Assured" />
        <meta
          name="twitter:description"
          content="Procurement-ready presence verification for irreversible actions: action-bound UP+UV with signed receipts and optional offline evidence bundles."
        />
        <meta name="twitter:image" content={ogImage} />
        <meta name="twitter:image:alt" content="PBI Assured — enterprise presence verification" />
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
                    Enterprise · PBI Assured
                  </div>

                  <h1 className="pbi-h1">
                    When approvals must be <span>provable</span>, not just logged.
                  </h1>

                  <p className="pbi-lead">
                    PBI Assured is the enterprise onboarding path for regulated and mission-critical environments. You get a scoped rollout plan,
                    security review packet, and a fast pilot that hardens one irreversible endpoint with action-bound presence verification and receipts.
                  </p>

                  <div className="pbi-ctaRow">
                    <button className="pbi-btnPrimary" type="button" onClick={openSales}>
                      Schedule a call <span aria-hidden>→</span>
                    </button>
                    <a className="pbi-btnGhost" href={API_DOCS} target="_blank" rel="noreferrer">
                      Read API docs
                    </a>
                    <a className="pbi-btnGhost" href={DEMO_URL} target="_blank" rel="noreferrer">
                      Run demo
                    </a>
                    <a className="pbi-btnGhost" href="/security">
                      Security overview
                    </a>
                  </div>

                  <div className="pbi-valueGrid" style={{ marginTop: 14 }}>
                    <ValueLine title="Paid pilot (2 weeks)" body="One endpoint hardened end-to-end with strict enforcement on PBI_VERIFIED." />
                    <ValueLine title="Security packet" body="Threat model, data flow, trust policy, evidence formats, and failure-mode expectations." />
                    <ValueLine title="Rollout sequencing" body="Start where blast radius is highest, then expand coverage across irreversible operations." />
                    <ValueLine title="Procurement-ready" body="Clear guarantees, clear boundaries, and integration patterns that pass review." />
                  </div>
                </div>

                <aside className="pbi-side">
                  <div className="pbi-sideTop">
                    <div>
                      <div className="pbi-proofLabel">Enterprise guarantees</div>
                      <div className="pbi-sideTitle">Strict, testable claims — no unverifiable promises.</div>
                    </div>
                    <div className="pbi-sideTag">reviewable</div>
                  </div>

                  <div className="pbi-sideList">
                    <Bullet>
                      Receipts are evidence: <b>action-bound</b>, <b>single-use</b>, <b>time-bounded</b>.
                    </Bullet>
                    <Bullet>
                      Presence is enforced via WebAuthn <b>UP+UV</b> ceremony.
                    </Bullet>
                    <Bullet>
                      Optional offline verification via <b>portable proof bundles</b> under a trust policy.
                    </Bullet>
                    <Bullet>
                      You keep your identity stack: <b>SSO/OAuth/JWT stays</b>.
                    </Bullet>
                  </div>

                  <pre className="pbi-code">{`Enterprise rollout:
1) pick 1 irreversible endpoint
2) canonicalize + actionHash
3) challenge → UP+UV → verify
4) enforce only if PBI_VERIFIED
5) store receiptHash + metadata
6) expand to more endpoints`}</pre>
                </aside>
              </div>
            </section>

            {/* WHO THIS IS FOR */}
            <section className="pbi-section">
              <SectionHead
                kicker="Fit"
                title="Who uses PBI Assured"
                body="If you operate systems where a wrong approval becomes a reportable incident, PBI is the missing gate."
              />

              <div className="pbi-sectionGrid3">
                <MiniCard title="Banks & fintech" body="Money movement, payout approval, treasury controls, and high-risk account actions." />
                <MiniCard title="Custodians & exchanges" body="Withdrawals, settlement releases, key rotations, and governance controls." />
                <MiniCard title="Control planes" body="Admin role changes, deploy approvals, production config, incident actions." />
                <MiniCard title="Gov / regulated" body="Evidence-heavy operations that require non-repudiation and dispute-ready trails." />
                <MiniCard title="Legal workflows" body="Contract execution, ownership actions, and authorizations that must be provable later." />
                <MiniCard title="AI oversight" body="Human-in-the-loop approvals where presence must be provable for compliance." />
              </div>
            </section>

            {/* PILOT */}
            <section className="pbi-section">
              <SectionHead
                kicker="Pilot"
                title="A fast, scoped pilot that proves ROI"
                body="Enterprises don’t adopt primitives by reading; they adopt by proving reliability and reducing risk on a real enforcement point."
              />

              <div className="pbi-card">
                <div className="pbi-cardTitle">2-week paid pilot (recommended)</div>
                <div className="pbi-cardBody" style={{ marginTop: 6 }}>
                  We harden one irreversible endpoint. You get strict enforcement, receipt logging, optional evidence export, and a rollout plan for expanding
                  coverage.
                </div>

                <div className="pbi-sectionGrid3" style={{ marginTop: 12 }}>
                  <InfoCard title="Week 1: integrate" body="Canonical action → actionHash → challenge → WebAuthn UP+UV → verify → enforce." />
                  <InfoCard title="Week 2: harden" body="Replay/expiry tests, failure-mode drills, audit receipt mapping, and operational runbook." />
                  <InfoCard title="Outcome" body="A production-ready presence gate, plus a playbook to expand to more endpoints." />
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="pbi-btnPrimary" type="button" onClick={openSales}>
                    Schedule pilot call →
                  </button>
                  <a className="pbi-btnGhost" href={TOOL_URL} target="_blank" rel="noreferrer">
                    Open attester tool →
                  </a>
                  <a className="pbi-btnGhost" href={DEMO_URL} target="_blank" rel="noreferrer">
                    Run demo →
                  </a>
                  <a className="pbi-btnGhost" href={API_DOCS} target="_blank" rel="noreferrer">
                    Review endpoints →
                  </a>
                </div>
              </div>
            </section>

            {/* WHAT YOU GET */}
            <section className="pbi-section">
              <SectionHead
                kicker="Deliverables"
                title="What your team receives"
                body="This is designed to reduce review friction and accelerate implementation inside enterprise SDLC."
              />

              <div className="pbi-card">
                <div className="pbi-cardTitle">PBI Assured package</div>
                <div className="pbi-cardBody" style={{ marginTop: 6 }}>
                  Everything you need to pass security review, implement quickly, and roll out safely.
                </div>

                <div className="pbi-sectionGrid3" style={{ marginTop: 12 }}>
                  <MiniCard title="Security packet" body="Threat model, data flow, expected failures, and explicit non-goals." />
                  <MiniCard title="Trust policy guidance" body="Key rotation, revocation, expiry windows for offline verification governance." />
                  <MiniCard title="Evidence mapping" body="What to store: receiptHash + decision + actionHash ref + timestamps + actor context." />
                  <MiniCard title="Rollout plan" body="Sequence endpoints by blast radius; define enforcement and break-glass exceptions." />
                  <MiniCard title="Integration patterns" body="Node/Go/Python examples, webhooks, and stable canonicalization strategy." />
                  <MiniCard title="Ops & runbook" body="Retry rules, idempotency guidance, incident response mapping, and audit retrieval." />
                </div>
              </div>
            </section>

            {/* PROCUREMENT */}
            <section className="pbi-section">
              <SectionHead
                kicker="Procurement"
                title="What enterprise reviewers care about (we address directly)"
                body="This section is written for CISOs, compliance, and platform security teams."
              />

              <div style={{ display: "grid", gap: 10 }}>
                <ProofRow k="Guarantees are strict" v="We define exactly what is proven (UP+UV for an actionHash within expiry) and avoid unverifiable claims." />
                <ProofRow k="Data minimization" v="No biometric data stored. No password database. Receipts and metadata only." />
                <ProofRow k="Failure-mode clarity" v="If verify is not PBI_VERIFIED, you do not proceed. We document expected deny paths." />
                <ProofRow k="Compatibility" v="Keep existing SSO/OAuth/JWT. PBI hardens only irreversible operations." />
                <ProofRow k="Audit readiness" v="Receipt hashes provide durable evidence references; optional portable proofs support offline review workflows." />
              </div>
            </section>

            {/* CTA */}
            <section className="pbi-section">
              <div className="pbi-card" style={{ background: "rgba(120,255,231,.08)", borderColor: "rgba(120,255,231,.28)" }}>
                <div className="pbi-proofLabel">Next step</div>
                <div className="pbi-cardTitle" style={{ marginTop: 6 }}>
                  Pick the one endpoint you can’t afford to get wrong.
                </div>
                <div className="pbi-cardBody" style={{ marginTop: 6 }}>
                  We’ll scope a pilot that hardens it with presence verification and receipts. Once it works there, expanding coverage is straightforward.
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="pbi-btnPrimary" type="button" onClick={openSales}>
                    Schedule a call →
                  </button>
                  <a className="pbi-btnGhost" href="/pricing">
                    Pricing →
                  </a>
                  <a className="pbi-btnGhost" href="/security">
                    Security →
                  </a>
                  <a className="pbi-btnGhost" href={API_DOCS} target="_blank" rel="noreferrer">
                    Docs →
                  </a>
                </div>
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

        {/* ---------- SALES MODAL (CALENDLY) ---------- */}
        {salesOpen ? (
          <div className="pbi-modal" role="dialog" aria-modal="true" aria-label="PBI Enterprise — Schedule a call">
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
                      <button
                        className="pbi-btnGhost"
                        type="button"
                        onClick={emailSalesNow}
                        style={{ width: "100%", justifyContent: "center" }}
                      >
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
                            <div className="pbi-secV">PBI Pack + proof exports for compliance, legal, and air-gapped review.</div>
                          </div>
                          <div className="pbi-secItem">
                            <div className="pbi-secK">Deployment notes</div>
                            <div className="pbi-secV">Environment separation guidance, allowlisting, and integration patterns.</div>
                          </div>

                          <div className="pbi-proofLabel" style={{ marginTop: 10 }}>
                            Guarantees are stated precisely and testably.
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                      <ProofRow k="Enforcement points" v="Which actions must be presence-gated (money, admin, governance, deploy)." />
                      <ProofRow k="Capacity & rollout" v="Monthly volume, burst patterns, environments, rollout sequencing." />
                      <ProofRow k="Commercials" v="Procurement-friendly onboarding and support options." />
                    </div>

                    <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <a className="pbi-btnGhost" href={API_DOCS} target="_blank" rel="noreferrer">
                        Review API docs
                      </a>
                      <a className="pbi-btnGhost" href={DEMO_URL} target="_blank" rel="noreferrer">
                        Demo
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