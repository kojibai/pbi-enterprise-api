import type { ReactElement } from "react";
import Link from "next/link";

export default function Custom404(): ReactElement {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ maxWidth: 720, width: "100%" }}>
        <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: -1 }}>404</div>
        <div style={{ marginTop: 8, fontSize: 18, opacity: 0.85 }}>
          This page doesn’t exist.
        </div>
        <div style={{ marginTop: 16 }}>
          <Link href="/" style={{ textDecoration: "underline" }}>
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}