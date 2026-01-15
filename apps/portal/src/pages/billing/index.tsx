import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
            <Link href="/" className="portalNavLink">Dashboard</Link>
            <Link href="/api-keys" className="portalNavLink">API Keys</Link>
            <Link href="/terms" className="portalNavLink">Terms</Link>
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
                <Link href="/login" style={btnPrimaryStyle}>Go to Login</Link>
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
              highlights={[
                "Everything in Starter",
                "Higher monthly verification quota",
                "Priority processing"
              ]}
              price={`${PLAN_PRICE.pro}/mo`}
              ctaLabel={currentPlan === "pro" ? "Current plan" : busy === "pro" ? "Redirecting…" : "Upgrade to Pro"}
              disabled={!me || currentPlan === "pro" || !canCheckout("pro")}
              accent="violet"
              note={!PRICE_IDS.pro ? "Set NEXT_PUBLIC_STRIPE_PRICE_PRO" : "Best for real apps at scale."}
              onClick={() => startCheckout("pro")}
            />

            <PlanCard
              current={currentPlan === "enterprise"}
              title="Enterprise"
              subtitle="Authoritative human presence at scale."
              highlights={[
                "Everything in Pro",
                "Highest monthly verification quota",
                "Built for irreversible operations"
              ]}
              price={`${PLAN_PRICE.enterprise}/mo`}
              ctaLabel={currentPlan === "enterprise" ? "Current plan" : busy === "enterprise" ? "Redirecting…" : "Upgrade to Enterprise"}
              disabled={!me || currentPlan === "enterprise" || !canCheckout("enterprise")}
              accent="gold"
              note={!PRICE_IDS.enterprise ? "Set NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE" : "For critical infrastructure."}
              onClick={() => startCheckout("enterprise")}
            />
          </div>

          <div style={hrStyle} />

          <div style={footerRowStyle}>
            <Link href="/" style={btnGhostStyle}>Back</Link>
            <Link href="/privacy" style={btnGhostStyle}>Privacy</Link>
          </div>
        </main>
      </div>
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
          <li key={h} style={liStyle}>{h}</li>
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

/* CSS helpers for mobile-perfect layout */
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 16px;
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

  .planGrid{
    grid-template-columns: 1fr;
  }
}
`;