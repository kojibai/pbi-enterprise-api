import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState<"working" | "error">("working");

  useEffect(() => {
    if (!router.isReady) return;

    const token = router.query.token;
    if (typeof token !== "string") {
      setStatus("error");
      return;
    }

    (async () => {
      try {
        const res = await fetch(
          "https://api.kojib.com/v1/portal/auth/consume",
          {
            method: "POST",
            credentials: "include", // IMPORTANT: receive cookie
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token })
          }
        );

        if (!res.ok) throw new Error("consume_failed");

        // Success → go to dashboard
        router.replace("/console");
      } catch {
        setStatus("error");
      }
    })();
  }, [router]);

  if (status === "working") {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <h1>Signing you in…</h1>
          <p>Please wait.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1>Link expired or invalid</h1>
        <p>Please request a new sign-in link.</p>
        <a href="/login">Go back</a>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#05070e",
  color: "white",
  fontFamily:
    "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
};

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,.06)",
  border: "1px solid rgba(255,255,255,.14)",
  borderRadius: 18,
  padding: 24,
  maxWidth: 420,
  width: "100%",
  textAlign: "center"
};