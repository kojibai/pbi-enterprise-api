import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { apiJson } from "../lib/api";

export default function Callback() {
  const router = useRouter();
  const [msg, setMsg] = useState("Signing you in…");

  useEffect(() => {
    const token = typeof router.query.token === "string" ? router.query.token : "";
    if (!token) return;

    (async () => {
      try {
        await apiJson<{ ok: true }>("/v1/portal/auth/consume", {
          method: "POST",
          body: JSON.stringify({ token })
        });
        setMsg("✅ Signed in. Redirecting…");
        await router.replace("/console");
      } catch {
        setMsg("❌ Link expired or invalid.");
      }
    })();
  }, [router]);

  return (
    <div className="wrap">
      <div className="card">
        <div className="pill"><span className="dot" /> Portal</div>
        <h1 className="h1" style={{ marginTop: 12 }}>{msg}</h1>
      </div>
    </div>
  );
}