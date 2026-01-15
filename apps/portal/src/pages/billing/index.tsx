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

const API_BASE = "https://api.kojib.com";

export default function BillingIndex() {
  const [me, setMe] = useState<MeResp["customer"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<PlanKey | null>(null);
  const [err, setErr] = useState<string>("");

  // TODO: replace with your real Stripe Price IDs
  const PRICE_IDS: Record<PlanKey, string | null> = useMemo(
    () => ({
      starter: null, // usually free (no checkout)
      pro: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? null,
      enterprise: process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE ?? null
    }),
    []
  );

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/v1/portal/me`, {
          credentials: "include"
        });
        if (!r.ok) {
          // not logged in
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
        setErr("Missing Stripe Price ID for this plan.");
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

  const currentPlan = me?.plan ?? "starter";

  return (
    <div style={pageStyle}>
      <div style={wrapStyle}>
        <header style={headerStyle}>
          <div style={brandRowStyle}>
            <span style={dotStyle} />
            <div>
              <div style={brandTitleStyle}>PBI Client Portal</div>
              <div style={brandSubStyle}>Billing</div>
            </div>
          </div>

          <nav style={navStyle}>
            <Link href="/" style={navLinkStyle}>Dashboard</Link>
            <Link href="/api-keys" style={navLinkStyle}>API Keys</Link>
            <Link href="/terms" style={navLinkStyle}>Terms</Link>
          </nav>
        </header>

        <main style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h1 style={h1Style}>Plans</h1>
              <p style={pStyle}>
                Choose a plan and quota. Your API keys inherit your plan limits automatically.
              </p>
            </div>

            <div style={pillStyle}>
              <span style={{ opacity: 0.75 }}>Current</span>
              <span style={{ fontWeight: 900 }}>{currentPlan.toUpperCase()}</span>
              {me?.quotaPerMonth ? (
                <span style={{ opacity: 0.75 }}>{me.quotaPerMonth}/mo</span>
              ) : null}
            </div>
          </div>

          {err ? <div style={errorStyle}>{err}</div> : null}

          {!loading && !me ? (
            <div style={noticeStyle}>
              <div style={{ fontWeight: 900 }}>You’re not signed in.</div>
              <div style={{ opacity: 0.8, marginTop: 6 }}>
                Sign in to manage billing and plans.
              </div>
              <div style={{ marginTop: 12 }}>
                <Link href="/login" style={btnPrimaryStyle}>Go to Login</Link>
              </div>
            </div>
          ) : null}

          <div style={gridStyle}>
            <PlanCard
              title="Starter"
              subtitle="Get started with presence verification."
              highlights={[
                "Core challenge + verify",
                "Starter quota included",
                "Usage visibility in portal"
              ]}
              price="$0"
              ctaLabel={currentPlan === "starter" ? "Current plan" : "Included"}
              disabled={true}
              accent="mint"
              note="Free tier. Upgrade anytime."
            />

            <PlanCard
              title="Pro"
              subtitle="Higher throughput for production apps."
              highlights={[
                "Everything in Starter",
                "Higher verification quota",
                "Priority reliability tuning"
              ]}
              price="$"
              ctaLabel={currentPlan === "pro" ? "Current plan" : "Upgrade to Pro"}
              disabled={!me || !PRICE_IDS.pro || busy !== null}
              accent="violet"
              onClick={() => startCheckout("pro")}
              note={!PRICE_IDS.pro ? "Set NEXT_PUBLIC_STRIPE_PRICE_PRO" : "Best for real apps."}
            />

            <PlanCard
              title="Enterprise"
              subtitle="Authoritative human-presence verification at scale."
              highlights={[
                "Everything in Pro",
                "Highest verification quota",
                "Designed for high-risk actions"
              ]}
              price="Custom"
              ctaLabel={currentPlan === "enterprise" ? "Current plan" : "Upgrade to Enterprise"}
              disabled={!me || !PRICE_IDS.enterprise || busy !== null}
              accent="gold"
              onClick={() => startCheckout("enterprise")}
              note={!PRICE_IDS.enterprise ? "Set NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE" : "For critical systems."}
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
    <div style={planCardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ ...planDotStyle, background: dotColor, boxShadow: `0 0 0 3px ${dotColor.replace(".92", ".14")}, 0 0 18px ${dotColor.replace(".92", ".22")}` }} />
        <div>
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

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "14px 6px"
};

const brandRowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12 };

const dotStyle: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999,
  background: "rgba(120,255,231,.92)",
  boxShadow: "0 0 0 3px rgba(120,255,231,.14), 0 0 18px rgba(120,255,231,.22)"
};

const brandTitleStyle: React.CSSProperties = { fontWeight: 900, letterSpacing: 0.2, fontSize: 13 };
const brandSubStyle: React.CSSProperties = { opacity: 0.7, fontSize: 12, marginTop: 2 };

const navStyle: React.CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap" };

const navLinkStyle: React.CSSProperties = {
  textDecoration: "none",
  color: "rgba(255,255,255,.9)",
  border: "1px solid rgba(255,255,255,.14)",
  background: "rgba(255,255,255,.06)",
  padding: "8px 10px",
  borderRadius: 12
};

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

const pillStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: "10px 12px",
  border: "1px solid rgba(255,255,255,.14)",
  background: "rgba(0,0,0,.22)",
  display: "inline-flex",
  gap: 10,
  alignItems: "center",
  whiteSpace: "nowrap"
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  marginTop: 16
};

const planCardStyle: React.CSSProperties = {
  borderRadius: 18,
  padding: 16,
  background: "rgba(255,255,255,.05)",
  border: "1px solid rgba(255,255,255,.12)",
  boxShadow: "0 10px 28px rgba(0,0,0,.35)"
};

const planDotStyle: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999
};

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