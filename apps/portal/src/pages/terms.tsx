import Link from "next/link";

export default function Terms() {
  return (
    <div style={pageStyle}>
      <div style={wrapStyle}>
        <header style={headerStyle}>
          <div style={brandRowStyle}>
            <span style={dotStyle} />
            <div>
              <div style={brandTitleStyle}>PBI Client Portal</div>
              <div style={brandSubStyle}>Terms of Service</div>
            </div>
          </div>

          <nav style={navStyle}>
            <Link href="/" style={navLinkStyle}>Dashboard</Link>
            <Link href="/privacy" style={navLinkStyle}>Privacy</Link>
          </nav>
        </header>

        <main style={cardStyle}>
          <h1 style={h1Style}>Terms of Service</h1>
          <p style={mutedStyle}>Last updated: {new Date().toISOString().slice(0, 10)}</p>

          <div style={hrStyle} />

          <h2 style={h2Style}>1. Agreement</h2>
          <p style={pStyle}>
            These Terms govern your access to and use of the PBI Client Portal and PBI Enterprise API (the “Services”)
            provided by Kojib (“we”, “us”, “our”). By using the Services, you agree to these Terms.
          </p>

          <h2 style={h2Style}>2. Accounts and access</h2>
          <p style={pStyle}>
            Portal access is provided via magic link authentication. You are responsible for maintaining control
            of your email account and for safeguarding any API keys you create.
          </p>

          <h2 style={h2Style}>3. API keys</h2>
          <ul style={ulStyle}>
            <li style={liStyle}>API keys are credentials that grant access to the Services.</li>
            <li style={liStyle}>Raw API keys are shown once. We store only hashed representations.</li>
            <li style={liStyle}>If a key is exposed, revoke it and create a new one immediately.</li>
          </ul>

          <h2 style={h2Style}>4. Usage, quotas, and metering</h2>
          <p style={pStyle}>
            Your plan includes a monthly quota. Requests that exceed quota may be rejected. Usage is metered per API key
            and may be aggregated for billing and audit purposes.
          </p>

          <h2 style={h2Style}>5. Billing</h2>
          <p style={pStyle}>
            Paid plans are billed via Stripe. Fees are non-refundable except where required by law. We may change pricing
            or plan limits with notice.
          </p>

          <h2 style={h2Style}>6. Acceptable use</h2>
          <ul style={ulStyle}>
            <li style={liStyle}>Do not attempt to bypass quota enforcement or rate limits.</li>
            <li style={liStyle}>Do not interfere with the security or integrity of the Services.</li>
            <li style={liStyle}>Do not use the Services for unlawful activity.</li>
          </ul>

          <h2 style={h2Style}>7. Service availability</h2>
          <p style={pStyle}>
            We aim for reliable operation but do not guarantee uninterrupted availability. Maintenance, outages, or
            third-party failures may occur.
          </p>

          <h2 style={h2Style}>8. Disclaimers</h2>
          <p style={pStyle}>
            The Services are provided “as is” without warranties of any kind, express or implied, including merchantability,
            fitness for a particular purpose, and non-infringement.
          </p>

          <h2 style={h2Style}>9. Limitation of liability</h2>
          <p style={pStyle}>
            To the maximum extent permitted by law, Kojib will not be liable for indirect, incidental, special,
            consequential, or punitive damages, or any loss of profits, revenue, data, or goodwill.
          </p>

          <h2 style={h2Style}>10. Termination</h2>
          <p style={pStyle}>
            We may suspend or terminate access if you violate these Terms or if needed to protect the Services.
            You may stop using the Services at any time.
          </p>

          <h2 style={h2Style}>11. Contact</h2>
          <p style={pStyle}>
            For questions about these Terms, contact: <b>legal@kojib.com</b>
          </p>

          <div style={footerRowStyle}>
            <Link href="/" style={btnGhostStyle}>Back</Link>
            <Link href="/privacy" style={btnPrimaryStyle}>View Privacy</Link>
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