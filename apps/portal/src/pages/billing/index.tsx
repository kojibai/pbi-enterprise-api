import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type PlanKey = "starter" | "pro" | "enterprise";

type MeResp = {
  customer: {
    id: string;
    email: string;
    plan: PlanKey;
    quotaPerMonth: string;
  };
};

type CheckoutResp = { url: string };

const API_BASE = (process.env.NEXT_PUBLIC_PBI_API_BASE ?? "https://api.kojib.com").replace(/\/+$/, "");

const SALES_EMAIL = (process.env.NEXT_PUBLIC_PBI_SALES_EMAIL ?? "sales@kojib.com").trim();
const SALES_CALENDLY_BASE =
  (process.env.NEXT_PUBLIC_PBI_SALES_CALENDLY_URL ?? "https://calendly.com/kojibchat/one-on-one").trim();

const calendlyEmbedUrl = (() => {
  const base = SALES_CALENDLY_BASE.replace(/\/+$/, "");
  const hasQ = base.includes("?");
  return `${base}${hasQ ? "&" : "?"}hide_event_type_details=1&hide_gdpr_banner=1`;
})();

// Production pricing (matches your landing page)
const PLAN_PRICE: Record<PlanKey, string> = {
  starter: "$99",
  pro: "$499",
  enterprise: "$1,999"
};

export default function BillingIndex() {
  const [me, setMe] = useState<MeResp["customer"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<PlanKey | null>(null);
  const [err, setErr] = useState<string>("");

  // Stripe Price IDs must be set for paid plans
  const PRICE_IDS: Record<PlanKey, string | null> = useMemo(
    () => ({
      starter: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER ?? null,
      pro: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? null,
      enterprise: process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE ?? null
    }),
    []
  );

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/v1/portal/me`, { credentials: "include" });
        if (!r.ok) {
          setMe(null);
          return;
        }
        const j = (await r.json()) as MeResp;
        setMe(j.customer);
      } catch {
        setMe(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function startCheckout(plan: PlanKey) {
    setErr("");
    setBusy(plan);

    try {
      const priceId = PRICE_IDS[plan];
      if (!priceId) {
        setErr(`Missing Stripe Price ID for ${plan.toUpperCase()} (set env var).`);
        return;
      }

      const r = await fetch(`${API_BASE}/v1/stripe/checkout`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ priceId })
      });

      if (!r.ok) {
        setErr("Checkout failed. Please try again.");
        return;
      }

      const j = (await r.json()) as CheckoutResp;
      if (!j.url) {
        setErr("Checkout URL missing.");
        return;
      }

      window.location.href = j.url;
    } catch {
      setErr("Checkout failed. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const currentPlan: PlanKey = me?.plan ?? "starter";

  const canCheckout = (plan: PlanKey) => {
    if (!me) return false;
    if (busy !== null) return false;
    return !!PRICE_IDS[plan];
  };

  // ---------- PBI ASSURED MODAL (INLINE CALENDLY, ALWAYS RELOADS) ----------
  const [assuredOpen, setAssuredOpen] = useState(false);
  const [calendlyKey, setCalendlyKey] = useState(0);

  const assuredPanelRef = useRef<HTMLDivElement | null>(null);
  const calendlyHostRef = useRef<HTMLDivElement | null>(null);

  function openAssured() {
    // Force a clean Calendly remount every open
    setCalendlyKey((k) => k + 1);
    setAssuredOpen(true);
  }
  function closeAssured() {
    setAssuredOpen(false);
  }
  function emailSalesNow() {
    window.location.href = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent("PBI Assured — Schedule a call")}`;
  }

  // Load Calendly widget script once when modal opens
  useEffect(() => {
    if (!assuredOpen) return;

    const SCRIPT_ID = "calendly-widget-js";
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) return;

    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = "https://assets.calendly.com/assets/external/widget.js";
    s.async = true;
    document.body.appendChild(s);
  }, [assuredOpen]);

  // ALWAYS re-initialize Calendly on open (and on every calendlyKey bump)
  useEffect(() => {
    if (!assuredOpen) return;

    let cancelled = false;

    function mountCalendly() {
      if (cancelled) return;

      const host = calendlyHostRef.current;
      if (!host) return;

      // Hard reset the host each time
      host.innerHTML = "";

      // Fresh widget container each open
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
          // no-op: widget.js may auto-init
        }
      }
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
  }, [assuredOpen, calendlyKey]);

  // Modal behaviors: ESC closes, click-outside closes, lock scroll
  useEffect(() => {
    if (!assuredOpen) return;

    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key === "Escape") closeAssured();
    }
    function onMouseDown(ev: MouseEvent) {
      const panel = assuredPanelRef.current;
      if (!panel) return;
      const target = ev.target as Node;
      if (panel.contains(target)) return;
      closeAssured();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);

    return () => {
      document.documentElement.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [assuredOpen]);

  return (
    <div style={pageStyle}>
      <style>{css}</style>

      <div style={wrapStyle}>
        <header className="portalTopbar">
          <div className="portalBrand">
            <span className="portalDot" />
            <div className="portalBrandText">
              <div className="portalTitle">PBI Client Portal</div>
              <div className="portalSub">Billing</div>
            </div>
          </div>

          <nav className="portalNav" aria-label="Portal navigation">
            <Link href="/console" className="portalNavLink">
              Dashboard
            </Link>
            <Link href="/api-keys" className="portalNavLink">
              API Keys
            </Link>
            <Link href="/terms" className="portalNavLink">
              Terms
            </Link>
          </nav>
        </header>

        <main style={cardStyle}>
          <div className="topRow">
            <div>
              <h1 style={h1Style}>Plans</h1>
              <p style={pStyle}>Choose a plan and quota. Your API keys inherit your plan limits automatically.</p>
            </div>

            <div className="currentPill" aria-label="Current plan">
              <span style={{ opacity: 0.75 }}>Current</span>
              <span style={{ fontWeight: 950, letterSpacing: 0.3 }}>{currentPlan.toUpperCase()}</span>
              {me?.quotaPerMonth ? <span style={{ opacity: 0.75 }}>{me.quotaPerMonth}/mo</span> : null}
            </div>
          </div>

          {err ? <div style={errorStyle}>{err}</div> : null}

          {!loading && !me ? (
            <div style={noticeStyle}>
              <div style={{ fontWeight: 950 }}>You’re not signed in.</div>
              <div style={{ opacity: 0.8, marginTop: 6 }}>Sign in to manage billing and plans.</div>
              <div style={{ marginTop: 12 }}>
                <Link href="/login" style={btnPrimaryStyle}>
                  Go to Login
                </Link>
              </div>
            </div>
          ) : null}

          <div className="planGrid">
            <PlanCard
              current={currentPlan === "starter"}
              title="Starter"
              subtitle="Ship presence verification fast."
              highlights={[
                "Presence verification core (UP+UV)",
                "Monthly verification quota (enforced automatically)",
                "Audit-ready receipts (receiptId + receiptHash)"
              ]}
              price={`${PLAN_PRICE.starter}/mo`}
              ctaLabel={currentPlan === "starter" ? "Current plan" : "Switch to Starter"}
              disabled={!me || currentPlan === "starter" || !canCheckout("starter")}
              accent="mint"
              note={!PRICE_IDS.starter ? "Set NEXT_PUBLIC_STRIPE_PRICE_STARTER" : "Best for first production gates."}
              onClick={() => startCheckout("starter")}
            />

            <PlanCard
              current={currentPlan === "pro"}
              title="Pro"
              subtitle="Higher throughput + wider coverage."
              highlights={["Everything in Starter", "Higher monthly verification quota", "Priority processing"]}
              price={`${PLAN_PRICE.pro}/mo`}
              ctaLabel={currentPlan === "pro" ? "Current plan" : busy === "pro" ? "Redirecting…" : "Upgrade to Pro"}
              disabled={!me || currentPlan === "pro" || !canCheckout("pro")}
              accent="violet"
              note={!PRICE_IDS.pro ? "Set NEXT_PUBLIC_STRIPE_PRICE_PRO" : "Best for real apps at scale."}
              onClick={() => startCheckout("pro")}
            />

            <PlanCard
              current={currentPlan === "enterprise"}
              title="Scale"
              subtitle="Authoritative human presence at scale."
              highlights={["Everything in Pro", "Highest monthly verification quota", "Built for irreversible operations"]}
              price={`${PLAN_PRICE.enterprise}/mo`}
              ctaLabel={currentPlan === "enterprise" ? "Current plan" : busy === "enterprise" ? "Redirecting…" : "Upgrade to Enterprise"}
              disabled={!me || currentPlan === "enterprise" || !canCheckout("enterprise")}
              accent="gold"
              note={!PRICE_IDS.enterprise ? "Set NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE" : "For critical infrastructure."}
              onClick={() => startCheckout("enterprise")}
            />

            {/* PBI Assured (inline calendly modal) */}
            <div className="planCard planCardAssured">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    ...planDotStyle,
                    background: "rgba(120,255,231,.92)",
                    boxShadow: "0 0 0 3px rgba(120,255,231,.14), 0 0 18px rgba(120,255,231,.22)"
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 950, letterSpacing: 0.2 }}>Enterprise (PBI Assured)</div>
                  <div style={{ opacity: 0.72, fontSize: 12, marginTop: 2 }}>
                    Procurement-ready for regulated and mission-critical systems.
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 14, fontSize: 26, fontWeight: 950 }}>Talk to Sales</div>

              <ul style={ulStyle}>
                {[
                "Paid pilot available (1 endpoint, 2 weeks)",
                  "Custom verification capacity + burst",
                  "SLA / priority support options",
                  "Security review packet on request",
                  "Receipts + retention strategy for audits",
                  "Roadmap alignment for regulated environments"
                ].map((h) => (
                  <li key={h} style={liStyle}>
                    {h}
                  </li>
                ))}
              </ul>

              <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
                Best for banks, governments, custodians, and high-assurance control planes.
              </div>

              <button
                type="button"
                className="planBtn planBtnPrimary"
                onClick={openAssured}
                style={{
                  ...btnStyle,
                  width: "100%",
                  cursor: "pointer",
                  background: "rgba(120,255,231,.92)",
                  color: "#05070e",
                  borderColor: "rgba(120,255,231,.55)"
                }}
              >
                Schedule a call →
              </button>
            </div>
          </div>

          <div style={hrStyle} />

          <div style={footerRowStyle}>
            <Link href="/" style={btnGhostStyle}>
              Back
            </Link>
            <Link href="/privacy" style={btnGhostStyle}>
              Privacy
            </Link>
          </div>
        </main>
      </div>

      {/* ---------- ASSURED MODAL (INLINE CALENDLY EMBED, ALWAYS RELOADS) ---------- */}
      {assuredOpen ? (
        <div className="portalModal" role="dialog" aria-modal="true" aria-label="PBI Assured — Schedule a call">
          <div className="portalModalBackdrop" aria-hidden />
          <div className="portalModalShell">
            <div className="portalModalPanel" ref={assuredPanelRef}>
              <div className="portalModalTop">
                <div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>PBI Assured</div>
                  <div style={{ fontSize: 16, fontWeight: 950, marginTop: 6 }}>Schedule a call</div>
                  <div style={{ fontSize: 13, opacity: 0.82, marginTop: 8, lineHeight: 1.5 }}>
                    For regulated and mission-critical environments where approvals must be <b>provable</b> — not just logged.
                  </div>
                </div>

                <button className="portalModalClose" type="button" onClick={closeAssured} aria-label="Close">
                  ✕
                </button>
              </div>

              <div className="portalModalBody">
                <div className="portalModalCols">
                  <div className="portalModalCard">
                    <div style={{ fontSize: 11, opacity: 0.7 }}>Scheduling</div>
                    <div style={{ fontSize: 14, fontWeight: 950, marginTop: 6 }}>Pick a time</div>
                    <div style={{ fontSize: 13, opacity: 0.82, marginTop: 8, lineHeight: 1.5 }}>
                      Use the inline scheduler below. Your intake form captures the details we need.
                    </div>

                    <div style={{ marginTop: 12 }}>
                      {/* We mount Calendly into this host every time the modal opens */}
                      <div ref={calendlyHostRef} />
                    </div>
                  </div>

                  <div className="portalModalCard" style={{ background: "rgba(0,0,0,.18)" }}>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>Notes</div>
                    <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                      <MiniLine k="Enforcement points" v="Which actions must be presence-gated (money, admin, governance, deploy)." />
                      <MiniLine k="Capacity & rollout" v="Monthly volume, burst patterns, environments, rollout sequencing." />
                      <MiniLine k="Commercials" v="Procurement-friendly onboarding and support options." />
                    </div>

                    <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <a className="portalBtnGhost" href={API_BASE + "/redoc"} rel="noreferrer">
                        API docs
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <div className="portalModalFoot">
                <button className="portalBtnGhost" type="button" onClick={closeAssured}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PlanCard(props: {
  current: boolean;
  title: string;
  subtitle: string;
  highlights: string[];
  price: string;
  ctaLabel: string;
  disabled: boolean;
  accent: "mint" | "violet" | "gold";
  onClick?: () => void;
  note: string;
}) {
  const accent = props.accent;

  const dotColor =
    accent === "mint"
      ? "rgba(120,255,231,.92)"
      : accent === "violet"
      ? "rgba(154,170,255,.92)"
      : "rgba(255,211,138,.92)";

  return (
    <div className={`planCard ${props.current ? "planCardCurrent" : ""}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            ...planDotStyle,
            background: dotColor,
            boxShadow: `0 0 0 3px ${dotColor.replace(".92", ".14")}, 0 0 18px ${dotColor.replace(".92", ".22")}`
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 950, letterSpacing: 0.2 }}>{props.title}</div>
          <div style={{ opacity: 0.72, fontSize: 12, marginTop: 2 }}>{props.subtitle}</div>
        </div>
      </div>

      <div style={{ marginTop: 14, fontSize: 26, fontWeight: 950 }}>{props.price}</div>

      <ul style={ulStyle}>
        {props.highlights.map((h) => (
          <li key={h} style={liStyle}>
            {h}
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>{props.note}</div>

      <button
        type="button"
        onClick={props.onClick}
        disabled={props.disabled}
        className="planBtn"
        style={{
          ...btnStyle,
          opacity: props.disabled ? 0.6 : 1,
          cursor: props.disabled ? "not-allowed" : "pointer"
        }}
      >
        {props.ctaLabel}
      </button>
    </div>
  );
}

function MiniLine({ k, v }: { k: string; v: string }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,.10)",
        background: "rgba(255,255,255,.05)"
      }}
    >
      <div style={{ fontSize: 11, opacity: 0.7 }}>{k}</div>
      <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85, lineHeight: 1.45 }}>{v}</div>
    </div>
  );
}

/* -------------------- styles -------------------- */

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(1200px 800px at 20% 10%, rgba(120,255,231,.10), transparent 55%)," +
    "radial-gradient(900px 700px at 80% 20%, rgba(140,155,255,.08), transparent 60%)," +
    "linear-gradient(180deg,#05070e,#070b18)",
  color: "white",
  fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
  padding: 16
};

const wrapStyle: React.CSSProperties = { maxWidth: 1040, margin: "0 auto" };

const cardStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 22,
  padding: 22,
  background: "rgba(255,255,255,.06)",
  border: "1px solid rgba(255,255,255,.14)",
  boxShadow: "0 18px 50px rgba(0,0,0,.55)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)"
};

const h1Style: React.CSSProperties = { margin: 0, fontSize: 22, letterSpacing: 0.2 };
const pStyle: React.CSSProperties = { marginTop: 10, lineHeight: 1.55, fontSize: 13, color: "rgba(255,255,255,.82)" };

const planDotStyle: React.CSSProperties = { width: 10, height: 10, borderRadius: 999 };

const ulStyle: React.CSSProperties = { marginTop: 10, paddingLeft: 18 };
const liStyle: React.CSSProperties = { marginTop: 8, fontSize: 13, color: "rgba(255,255,255,.84)" };

const hrStyle: React.CSSProperties = {
  height: 1,
  background: "linear-gradient(90deg, transparent, rgba(120,255,231,.30), rgba(150,170,255,.20), transparent)",
  opacity: 0.9,
  margin: "16px 0"
};

const errorStyle: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 14,
  border: "1px solid rgba(255,138,160,.35)",
  background: "rgba(255,138,160,.10)",
  color: "rgba(255,255,255,.92)",
  fontSize: 13
};

const noticeStyle: React.CSSProperties = {
  marginTop: 12,
  padding: 14,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,.14)",
  background: "rgba(0,0,0,.22)"
};

const footerRowStyle: React.CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 };

const btnBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,.16)",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 800
};

const btnPrimaryStyle: React.CSSProperties = {
  ...btnBase,
  background: "#78ffe7",
  color: "#05070e",
  borderColor: "rgba(120,255,231,.55)"
};

const btnGhostStyle: React.CSSProperties = {
  ...btnBase,
  background: "rgba(255,255,255,.06)",
  color: "rgba(255,255,255,.92)"
};

const btnStyle: React.CSSProperties = {
  marginTop: 14,
  width: "100%",
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,.16)",
  background: "rgba(255,255,255,.06)",
  color: "rgba(255,255,255,.92)",
  fontSize: 13,
  fontWeight: 900
};

/* CSS helpers + modal */
const css = `
.portalTopbar{
  display:grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items:center;
  padding: 14px 6px;
}
.portalBrand{
  display:flex;
  align-items:center;
  gap: 12px;
  min-width: 0;
}
.portalDot{
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: rgba(120,255,231,.92);
  box-shadow: 0 0 0 3px rgba(120,255,231,.14), 0 0 18px rgba(120,255,231,.22);
  flex: 0 0 auto;
}
.portalBrandText{ min-width:0; }
.portalTitle{
  font-weight: 900;
  letter-spacing: .2px;
  font-size: 13px;
  white-space: nowrap;
}
.portalSub{
  opacity: .7;
  font-size: 12px;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 54vw;
}

.portalNav{
  display:flex;
  gap: 10px;
  white-space: nowrap;
  flex-wrap: nowrap;
  align-items:center;
  justify-content:flex-end;
}
.portalNavLink{
  text-decoration:none;
  color: rgba(255,255,255,.9);
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  padding: 8px 10px;
  border-radius: 12px;
  flex: 0 0 auto;
}
.portalNavLink:hover{ background: rgba(255,255,255,.09); }

.topRow{
  display:flex;
  justify-content:space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.currentPill{
  border-radius: 999px;
  padding: 10px 12px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.22);
  display:inline-flex;
  gap: 10px;
  align-items:center;
  white-space: nowrap;
}

.planGrid{
  display:grid;
  gap: 12px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 16px;
}
@media (max-width: 980px){
  .planGrid{ grid-template-columns: 1fr; }
}

.planCard{
  border-radius: 18px;
  padding: 16px;
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.12);
  box-shadow: 0 10px 28px rgba(0,0,0,.35);
}
.planCardCurrent{
  border-color: rgba(120,255,231,.35);
  background: rgba(120,255,231,.06);
}

.planCardAssured{
  border-color: rgba(120,255,231,.28);
  background: rgba(120,255,231,.06);
}

.planBtn{
  transition: transform .12s ease, background .12s ease, border-color .12s ease;
}
.planBtn:hover{
  transform: translateY(-1px);
  background: rgba(255,255,255,.09);
  border-color: rgba(255,255,255,.22);
}

/* Mobile: stack header, scroll nav, stack grid */
@media (max-width: 820px){
  .portalTopbar{
    grid-template-columns: 1fr;
    align-items:start;
    gap: 10px;
  }
  .portalNav{
    justify-content:flex-start;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    padding-bottom: 2px;
  }
  .portalNav::-webkit-scrollbar{ display:none; }
}

/* -------- Modal -------- */
.portalModal{
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 18px;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}
.portalModalBackdrop{
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.62);
  backdrop-filter: blur(10px);
}
.portalModalShell{
  position: relative;
  width: min(980px, 100%);
  margin: auto;
  max-height: calc(100vh - 36px);
  display: flex;
}
.portalModalPanel{
  width: 100%;
  border-radius: 22px;
  border: 1px solid rgba(255,255,255,.12);
  background: linear-gradient(180deg, rgba(18,18,22,.92), rgba(10,10,14,.88));
  box-shadow: 0 30px 120px rgba(0,0,0,.55);
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 36px);
  overflow: hidden;
}
.portalModalTop{
  flex: 0 0 auto;
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 16px 12px 16px;
  border-bottom: 1px solid rgba(255,255,255,.08);
}
.portalModalClose{
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.85);
  border-radius: 14px;
  width: 38px;
  height: 38px;
  cursor: pointer;
}
.portalModalBody{
  flex: 1 1 auto;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  padding: 12px 16px 16px 16px;
}
.portalModalCols{
  display: grid;
  gap: 12px;
}
@media (min-width: 980px){
  .portalModalCols{
    grid-template-columns: 1.15fr 0.85fr;
    align-items: start;
  }
}
.portalModalCard{
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.06);
  padding: 14px;
}
.portalModalFoot{
  flex: 0 0 auto;
  display:flex;
  justify-content: flex-end;
  align-items:center;
  gap: 12px;
  padding: 12px 16px 16px 16px;
  border-top: 1px solid rgba(255,255,255,.08);
}

.portalBtnGhost{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  padding: 10px 14px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.16);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.92);
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
  text-decoration:none;
}
.portalBtnGhost:hover{
  background: rgba(255,255,255,.09);
  border-color: rgba(255,255,255,.22);
}

.portalMailLink{
  border: 0;
  background: transparent;
  color: rgba(120,255,231,.92);
  cursor: pointer;
  padding: 0;
  font: inherit;
  text-decoration: underline;
  text-underline-offset: 3px;
}
`;