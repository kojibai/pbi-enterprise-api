import Link from "next/link";
import { useEffect, useState } from "react";

export default function BillingSuccess() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Optional: small delay for a premium “completion” feel
    const t = setTimeout(() => setReady(true), 350);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={badgeRowStyle}>
          <span style={dotStyle} />
          <span style={{ opacity: 0.9 }}>Checkout complete</span>
        </div>

        <h1 style={h1Style}>You’re subscribed.</h1>
        <p style={pStyle}>
          {ready
            ? "Your plan and quota will be applied automatically. You can now mint API keys and start verifying presence."
            : "Finalizing your subscription…"}
        </p>

        <div style={btnRowStyle}>
          <Link href="/api-keys" style={btnPrimaryStyle}>
            Create API Key
          </Link>
          <Link href="/billing" style={btnGhostStyle}>
            View Billing
          </Link>
          <Link href="/console" style={btnGhostStyle}>
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  background:
    "radial-gradient(1200px 800px at 20% 10%, rgba(120,255,231,.12), transparent 55%)," +
    "radial-gradient(900px 700px at 80% 20%, rgba(140,155,255,.08), transparent 60%)," +
    "linear-gradient(180deg,#05070e,#070b18)",
  color: "white",
  fontFamily:
    "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 560,
  borderRadius: 22,
  padding: 22,
  background: "rgba(255,255,255,.06)",
  border: "1px solid rgba(255,255,255,.14)",
  boxShadow: "0 18px 50px rgba(0,0,0,.55)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)"
};

const badgeRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 12,
  fontSize: 13
};

const dotStyle: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999,
  background: "rgba(120,255,231,.92)",
  boxShadow: "0 0 0 3px rgba(120,255,231,.14), 0 0 18px rgba(120,255,231,.22)"
};

const h1Style: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
  letterSpacing: 0.2
};

const pStyle: React.CSSProperties = {
  marginTop: 10,
  marginBottom: 0,
  fontSize: 13,
  lineHeight: 1.45,
  color: "rgba(255,255,255,.78)"
};

const btnRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 16
};

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