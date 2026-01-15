import type { ReactElement } from "react";
import Link from "next/link";

export default function Custom500(): ReactElement {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ maxWidth: 760, width: "100%" }}>
        <div style={{ fontSize: 12, opacity: 0.75, letterSpacing: 1.2, textTransform: "uppercase" }}>
          PBI Client Portal
        </div>

        <div style={{ marginTop: 10, fontSize: 44, fontWeight: 900, letterSpacing: -1 }}>
          500
        </div>

        <div style={{ marginTop: 10, fontSize: 18, opacity: 0.85, lineHeight: 1.4 }}>
          Something went wrong on our side. Your session is safe—please refresh and try again.
        </div>

        <div style={{ marginTop: 18, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,.12)",
              background: "rgba(0,0,0,.04)",
              cursor: "pointer"
            }}
          >
            Reload
          </button>

          <Link
            href="/"
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,.12)",
              background: "white",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center"
            }}
          >
            Go home →
          </Link>

          <Link
            href="/login"
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,.12)",
              background: "white",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center"
            }}
          >
            Sign in
          </Link>
        </div>

        <div style={{ marginTop: 18, fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>
          If this keeps happening, contact{" "}
          <a href="mailto:support@kojib.com" style={{ textDecoration: "underline" }}>
            support@kojib.com
          </a>
          .
        </div>
      </div>
    </div>
  );
}