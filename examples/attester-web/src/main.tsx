import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import { apiChallenge, apiVerify, challengeToBytes, type PbiVerifyResp } from "./api";
import { attestWithPasskey, clearStoredCredential, loadStoredCredential, registerPasskey } from "./webauthn";
import "./styles.css";

function App() {
  const [apiBase, setApiBase] = useState<string>("http://localhost:8080");
  const [apiKey, setApiKey] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [log, setLog] = useState<string>("");

  const stored = useMemo(() => loadStoredCredential(), [status]);

  function append(obj: unknown) {
    setLog((p) => p + "\n" + JSON.stringify(obj, null, 2));
  }

  async function onRegister() {
    setStatus("Registering passkey…");
    setLog("");
    try {
      const s = await registerPasskey();
      setStatus("✅ Registered passkey");
      append({ storedCredential: s });
    } catch (e: unknown) {
      setStatus(`❌ register_failed: ${String((e as Error)?.message ?? e)}`);
    }
  }

  async function onClear() {
    clearStoredCredential();
    setStatus("Cleared stored credential");
    setLog("");
  }

  async function onAttestAndVerify() {
    setStatus("Requesting challenge…");
    setLog("");

    const s = loadStoredCredential();
    if (!s) {
      setStatus("❌ No stored credential. Click Register first.");
      return;
    }
    if (!apiKey.trim()) {
      setStatus("❌ Missing API key");
      return;
    }

    try {
      const actionHashHex = "0".repeat(64);

      const ch = await apiChallenge(apiBase, apiKey.trim(), "ACTION_COMMIT", actionHashHex);
      append({ challenge: ch });

      setStatus("Performing presence attestation (FaceID/TouchID)…");
      const assertion = await attestWithPasskey(s, challengeToBytes(ch.challengeB64Url));
      append({ assertionPreview: { ...assertion, pubKeyPem: "[redacted]" } });

      setStatus("Verifying on server…");
      const resp: PbiVerifyResp = await apiVerify(apiBase, apiKey.trim(), {
        challengeId: ch.id,
        assertion
      });

      append({ verifyResponse: resp });

      if (resp.ok && resp.decision === "PBI_VERIFIED") {
        setStatus("✅ VERIFIED (receipt minted)");
      } else {
        setStatus(`❌ verify_failed: ${resp.decision}${"reason" in resp && resp.reason ? ` (${resp.reason})` : ""}`);
      }
    } catch (e: unknown) {
      setStatus(`❌ error: ${String((e as Error)?.message ?? e)}`);
    }
  }

  const canAttest = Boolean(apiKey.trim()) && Boolean(stored);

  return (
    <div className="krystal-wrap">
      <div className="header">
        <div className="header-inner">
          <div>
            <h1 className="title">PBI Attester</h1>
            <p className="subtitle">
              Atlantean-grade presence ceremony: register a passkey, request a challenge, attest, verify, mint a receipt.
            </p>
          </div>

          <div className="badge" title="Live API + metering enabled">
            <span className="dot" />
            <span>Krystal Gate · Online</span>
          </div>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <div className="card-inner">
            <div className="label">PBI API Base</div>
            <input
              className="input"
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              placeholder="http://localhost:8080"
            />
            <div className="small" style={{ marginTop: 10, opacity: 0.85 }}>
              Must match allowed origins on the API (your server validates <span className="pill">clientDataJSON.origin</span>).
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-inner">
            <div className="label">PBI API Key</div>
            <input
              className="input"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="pbi_live_…"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <div className="small" style={{ marginTop: 10, opacity: 0.85 }}>
              Keys are enterprise-held. End users are not accounts.
            </div>
          </div>
        </div>
      </div>

      <div className="actions">
        <button onClick={onRegister} className="btn btn-primary">
          <span className="icon" />
          1) Register passkey
        </button>

        <button onClick={onAttestAndVerify} className="btn" disabled={!canAttest}>
          <span className="icon" />
          2) Attest + Verify
        </button>

        <button onClick={onClear} className="btn btn-ghost">
          Clear stored credential
        </button>
      </div>

      <div className="status">
        <div className="status-title">Status</div>
        <div className="status-text">{status || "—"}</div>
      </div>

      <div className="split">
        <div className="card">
          <div className="card-inner">
            <div className="section-title">
              <div className="label" style={{ margin: 0 }}>Stored Credential</div>
              <span className="pill">{stored ? "present" : "none"}</span>
            </div>
            <div className="kline" />
            <div style={{ marginTop: 12 }}>
              <pre className="pre">
                {stored
                  ? JSON.stringify({ ...stored, pubKeyPem: "[stored]" }, null, 2)
                  : "None (register first)"}
              </pre>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-inner">
            <div className="section-title">
              <div className="label" style={{ margin: 0 }}>Krystal Log</div>
              <span className="pill">debug</span>
            </div>
            <div className="kline" />
            <div style={{ marginTop: 12 }}>
              <pre className="pre">{log || "—"}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);