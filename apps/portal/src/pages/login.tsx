import { useState } from "react";
import { apiJson } from "../lib/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string>("");

  async function submit() {
    setStatus("Sending magic link…");
    try {
      await apiJson<{ ok: true }>("/v1/portal/auth/start", {
        method: "POST",
        body: JSON.stringify({ email })
      });
      setStatus("✅ Check your email for the sign-in link.");
    } catch {
      setStatus("❌ Failed to send link.");
    }
  }

  return (
    <div className="wrap">
      <div className="card">
        <div className="pill"><span className="dot" /> PBI Client Portal</div>
        <h1 className="h1" style={{ marginTop: 12 }}>Sign in</h1>
        <p className="p">We’ll email a one-time magic link. No passwords.</p>

        <div style={{ marginTop: 14 }}>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn btnPrimary" onClick={submit}>Send link</button>
          <span className="p" style={{ margin: 0 }}>{status}</span>
        </div>
      </div>
    </div>
  );
}