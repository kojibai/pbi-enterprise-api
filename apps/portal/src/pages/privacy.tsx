import Link from "next/link";

export default function Privacy() {
  return (
    <div style={pageStyle}>
      <div style={wrapStyle}>
        <header style={headerStyle}>
          <div style={brandRowStyle}>
            <span style={dotStyle} />
            <div>
              <div style={brandTitleStyle}>PBI Client Portal</div>
              <div style={brandSubStyle}>Privacy Policy</div>
            </div>
          </div>

          <nav style={navStyle}>
            <Link href="/" style={navLinkStyle}>Dashboard</Link>
            <Link href="/terms" style={navLinkStyle}>Terms</Link>
          </nav>
        </header>

        <main style={cardStyle}>
          <h1 style={h1Style}>Privacy Policy</h1>
          <p style={mutedStyle}>Last updated: {new Date().toISOString().slice(0, 10)}</p>

          <div style={hrStyle} />

          <h2 style={h2Style}>1. Overview</h2>
          <p style={pStyle}>
            This Privacy Policy explains how Kojib (“we”, “us”, “our”) collects, uses, and protects information
            when you use the PBI Client Portal and PBI Enterprise API (the “Services”).
          </p>

          <h2 style={h2Style}>2. What we collect</h2>
          <ul style={ulStyle}>
            <li style={liStyle}>
              <b>Account identifier:</b> your email address (used to deliver magic links and identify your customer record).
            </li>
            <li style={liStyle}>
              <b>Billing metadata:</b> plan tier, Stripe customer/subscription identifiers, and invoice/usage totals.
            </li>
            <li style={liStyle}>
              <b>API access data:</b> API key identifiers (we store only hashes of raw keys), metering events (challenge/verify counts),
              and request metadata necessary for abuse prevention and operations.
            </li>
          </ul>

          <h2 style={h2Style}>3. What we do not collect</h2>
          <ul style={ulStyle}>
            <li style={liStyle}>
              <b>No biometric data:</b> the Services do not store FaceID/TouchID biometrics. WebAuthn verification occurs on-device.
            </li>
            <li style={liStyle}>
              <b>No raw API keys after creation:</b> raw keys are shown once. We store only salted hashes.
            </li>
            <li style={liStyle}>
              <b>No “identity database”:</b> PBI is designed to verify presence without requiring persistent personal identity records.
            </li>
          </ul>

          <h2 style={h2Style}>4. How we use information</h2>
          <ul style={ulStyle}>
            <li style={liStyle}>To authenticate you via magic links and maintain a portal session.</li>
            <li style={liStyle}>To provision, manage, and revoke API keys.</li>
            <li style={liStyle}>To meter usage, enforce quotas, generate invoices, and provide billing history.</li>
            <li style={liStyle}>To detect abuse, prevent fraud, and maintain service reliability.</li>
          </ul>

          <h2 style={h2Style}>5. Cookies</h2>
          <p style={pStyle}>
            We use a single session cookie (<code style={codeStyle}>pbi_portal_session</code>) to keep you signed in.
            It is HTTP-only and intended to be sent only to the API domain with requests from the portal.
          </p>

          <h2 style={h2Style}>6. Sharing</h2>
          <p style={pStyle}>
            We share information only with service providers needed to operate the Services (for example,
            payment processing via Stripe and email delivery via Resend). We do not sell personal information.
          </p>

          <h2 style={h2Style}>7. Data retention</h2>
          <p style={pStyle}>
            We retain portal and billing records as needed to operate the Services and provide auditability.
            We retain usage and receipt-related records in accordance with your plan and operational requirements.
          </p>

          <h2 style={h2Style}>8. Security</h2>
          <p style={pStyle}>
            We protect data using industry standard controls. API keys are hashed and cannot be recovered after creation.
            Transport security is enforced via HTTPS.
          </p>

          <h2 style={h2Style}>9. Contact</h2>
          <p style={pStyle}>
            For privacy questions, contact: <b>privacy@kojib.com</b>
          </p>

          <div style={footerRowStyle}>
            <Link href="/" style={btnGhostStyle}>Back</Link>
            <Link href="/terms" style={btnPrimaryStyle}>View Terms</Link>
          </div>
        </main>
      </div>
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

const wrapStyle: React.CSSProperties = { maxWidth: 980, margin: "0 auto" };

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
const h2Style: React.CSSProperties = { marginTop: 18, fontSize: 15, letterSpacing: 0.2 };
const pStyle: React.CSSProperties = { marginTop: 10, lineHeight: 1.55, fontSize: 13, color: "rgba(255,255,255,.84)" };
const mutedStyle: React.CSSProperties = { marginTop: 8, fontSize: 12, color: "rgba(255,255,255,.62)" };

const ulStyle: React.CSSProperties = { marginTop: 10, paddingLeft: 18 };
const liStyle: React.CSSProperties = { marginTop: 8, lineHeight: 1.5, fontSize: 13, color: "rgba(255,255,255,.84)" };

const hrStyle: React.CSSProperties = {
  height: 1,
  background: "linear-gradient(90deg, transparent, rgba(120,255,231,.30), rgba(150,170,255,.20), transparent)",
  opacity: 0.9,
  margin: "14px 0"
};

const codeStyle: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace",
  background: "rgba(0,0,0,.28)",
  border: "1px solid rgba(255,255,255,.10)",
  padding: "2px 6px",
  borderRadius: 10
};

const footerRowStyle: React.CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 };

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