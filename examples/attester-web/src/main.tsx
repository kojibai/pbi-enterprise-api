import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { apiChallenge, apiVerify, challengeToBytes, type PbiVerifyResp } from "./api";
import { attestWithPasskey, clearStoredCredential, loadStoredCredential, registerPasskey } from "./webauthn";
import "./styles.css";

/**
 * PBI Attester
 * - DEMO mode (public): safe, no API keys in browser. Calls demo proxy endpoints.
 * - TOOL mode (private): power-user harness (custom API base + BYOK), with safety gates.
 *
 * Mode selection order:
 *  1) VITE_PBI_MODE = "demo" | "tool"
 *  2) hostname starts with "demo." => demo
 *  3) default => tool
 */
const ENV: Record<string, string | undefined> = (import.meta as any)?.env ?? {};
const MODE =
  (ENV.VITE_PBI_MODE ?? (typeof window !== "undefined" && window.location.hostname.startsWith("demo.") ? "demo" : "tool")).toLowerCase();
const IS_DEMO = MODE === "demo";

// In DEMO mode we recommend proxy endpoints on same origin (demo.kojib.com)
const DEFAULT_DEMO_BASE = ENV.VITE_PBI_DEMO_BASE ?? "https://api.kojib.com";

// In TOOL mode default to your real API
const DEFAULT_TOOL_BASE = ENV.VITE_PBI_API_BASE ?? "https://api.kojib.com";

// Demo proxy paths (configurable via env)
const DEMO_CHALLENGE_PATH = ENV.VITE_PBI_DEMO_CHALLENGE_PATH ?? "/demo/pbi/challenge";
const DEMO_VERIFY_PATH = ENV.VITE_PBI_DEMO_VERIFY_PATH ?? "/demo/pbi/verify";

// Tool behavior
const TOOL_PERSIST_API_BASE_KEY = "pbi_attester:apiBase";

// IMPORTANT: must match your apiChallenge() type union
type ActionKind = "ACTION_COMMIT" | "ARTIFACT_AUTHORSHIP" | "EVIDENCE_SUBMIT" | "ADMIN_DANGEROUS_OP";
const ACTION_KIND_OPTIONS: { value: ActionKind; label: string; desc: string }[] = [
  { value: "ACTION_COMMIT", label: "ACTION_COMMIT", desc: "Generic action approval bound to an action hash" },
  { value: "ARTIFACT_AUTHORSHIP", label: "ARTIFACT_AUTHORSHIP", desc: "Attest authorship/presence for an artifact hash" },
  { value: "EVIDENCE_SUBMIT", label: "EVIDENCE_SUBMIT", desc: "Presence-gate evidence submission/claims" },
  { value: "ADMIN_DANGEROUS_OP", label: "ADMIN_DANGEROUS_OP", desc: "Step-up for privileged or destructive admin operations" }
];

// ---- helpers ----

function isWebAuthnSupported(): boolean {
  return typeof window !== "undefined" && typeof PublicKeyCredential !== "undefined" && !!navigator?.credentials;
}

function stableStringify(v: any): string {
  // Minimal stable JSON for action hash computation
  if (v === null || v === undefined) return "null";
  if (typeof v === "number" || typeof v === "boolean") return JSON.stringify(v);
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map((x) => stableStringify(x)).join(",")}]`;
  if (typeof v === "object") {
    const keys = Object.keys(v).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(",")}}`;
  }
  return JSON.stringify(String(v));
}
function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === undefined) continue; // satisfies TS under noUncheckedIndexedAccess
    out += b.toString(16).padStart(2, "0");
  }
  return out;
}

async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

function randHex(nBytes = 16): string {
  const b = new Uint8Array(nBytes);
  crypto.getRandomValues(b);
  return bytesToHex(b);
}

function safeClipboard(text: string) {
  try {
    void navigator.clipboard.writeText(text);
  } catch {
    // ignore
  }
}

type ChallengeResp = { id: string; challengeB64Url: string; expiresAt?: string; kind?: string; actionHashHex?: string };

// DEMO proxy calls: no API keys in browser.
async function demoChallenge(apiBase: string, kind: ActionKind, actionHashHex: string): Promise<ChallengeResp> {
  const url = `${apiBase.replace(/\/+$/, "")}${DEMO_CHALLENGE_PATH}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, actionHashHex })
  });
  if (!r.ok) throw new Error(`demo_challenge_failed:${r.status}`);
  return (await r.json()) as ChallengeResp;
}

async function demoVerify(apiBase: string, body: { challengeId: string; assertion: any }): Promise<PbiVerifyResp> {
  const url = `${apiBase.replace(/\/+$/, "")}${DEMO_VERIFY_PATH}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`demo_verify_failed:${r.status}`);
  return (await r.json()) as PbiVerifyResp;
}

function App() {
  // Base defaults per mode
  const initialBase = useMemo(() => {
    if (IS_DEMO) return DEFAULT_DEMO_BASE;
    // tool: persist base (but never persist keys)
    try {
      const saved = localStorage.getItem(TOOL_PERSIST_API_BASE_KEY);
      if (saved && saved.trim()) return saved.trim();
    } catch {}
    return DEFAULT_TOOL_BASE;
  }, []);

  const [apiBase, setApiBase] = useState<string>(initialBase);
  const [apiKey, setApiKey] = useState<string>("");

  const [status, setStatus] = useState<string>("");
  const [log, setLog] = useState<string>("");
  const [showDebug, setShowDebug] = useState<boolean>(!IS_DEMO);

  // Tool safety gate: user must explicitly acknowledge before enabling BYOK verify
  const [toolAck, setToolAck] = useState<boolean>(IS_DEMO ? true : false);

  // Action payload (meaningful; demo shows what “action-bound” means)
  const [actionKind, setActionKind] = useState<ActionKind>("ACTION_COMMIT");
  const [actionType, setActionType] = useState<string>("PAYOUT_RELEASE");
  const [amount, setAmount] = useState<string>("100.00");
  const [currency, setCurrency] = useState<string>("USD");
  const [target, setTarget] = useState<string>("beneficiary:demo");
  const [nonce, setNonce] = useState<string>(() => randHex(12));

  const [actionHashHex, setActionHashHex] = useState<string>("");
  const [actionJson, setActionJson] = useState<string>("");

  // Result snapshot
  const [lastReceiptHash, setLastReceiptHash] = useState<string>("");
  const [lastDecision, setLastDecision] = useState<string>("");

  const storedTick = useRef(0);
  const [storedRefresh, setStoredRefresh] = useState(0);
  const stored = useMemo(() => loadStoredCredential(), [storedRefresh]);

  // Persist apiBase in TOOL mode only
  useEffect(() => {
    if (IS_DEMO) return;
    try {
      localStorage.setItem(TOOL_PERSIST_API_BASE_KEY, apiBase.trim());
    } catch {}
  }, [apiBase]);

  // Keep an up-to-date action hash preview
  useEffect(() => {
    (async () => {
      const payload = {
        kind: actionKind,
        action: actionType,
        amount,
        currency,
        target,
        nonce,
        origin: typeof window !== "undefined" ? window.location.origin : "unknown"
      };

      const json = stableStringify(payload);
      setActionJson(JSON.stringify(payload, null, 2));

      try {
        const hex = await sha256Hex(json);
        setActionHashHex(hex);
      } catch {
        setActionHashHex("");
      }
    })();
  }, [actionKind, actionType, amount, currency, target, nonce]);

  function append(obj: unknown) {
    setLog((p) => p + (p ? "\n" : "") + JSON.stringify(obj, null, 2));
  }

  async function onRegister() {
    setStatus("Registering passkey…");
    setLog("");
    setLastReceiptHash("");
    setLastDecision("");

    if (!isWebAuthnSupported()) {
      setStatus("❌ WebAuthn not supported in this browser/environment.");
      return;
    }

    try {
      const s = await registerPasskey();
      setStatus("✅ Registered passkey");
      append({ storedCredential: s });
      storedTick.current++;
      setStoredRefresh(storedTick.current);
    } catch (e: unknown) {
      setStatus(`❌ register_failed: ${String((e as Error)?.message ?? e)}`);
    }
  }

  async function onClear() {
    clearStoredCredential();
    setStatus("Cleared stored credential");
    setLog("");
    setLastReceiptHash("");
    setLastDecision("");
    storedTick.current++;
    setStoredRefresh(storedTick.current);
  }

  async function onNewNonce() {
    setNonce(randHex(12));
    setStatus("Generated a new nonce");
  }

  async function onAttestAndVerify() {
    setStatus("Requesting challenge…");
    setLog("");
    setLastReceiptHash("");
    setLastDecision("");

    const s = loadStoredCredential();
    if (!s) {
      setStatus("❌ No stored credential. Click Register first.");
      return;
    }

    if (!isWebAuthnSupported()) {
      setStatus("❌ WebAuthn not supported in this browser/environment.");
      return;
    }

    const base = apiBase.trim();
    if (!base) {
      setStatus("❌ Missing API base");
      return;
    }

    if (!IS_DEMO) {
      if (!toolAck) {
        setStatus("❌ Acknowledge the safety warning before using BYOK mode.");
        return;
      }
      if (!apiKey.trim()) {
        setStatus("❌ Missing API key");
        return;
      }
    }

    try {
      const payload = {
        kind: actionKind,
        action: actionType,
        amount,
        currency,
        target,
        nonce,
        origin: typeof window !== "undefined" ? window.location.origin : "unknown"
      };

      const payloadStable = stableStringify(payload);
      const actionHash = await sha256Hex(payloadStable);

      append({ actionPayload: payload, actionHashHex: actionHash });

      // 1) Challenge
      const ch: ChallengeResp = IS_DEMO
        ? await demoChallenge(base, actionKind, actionHash)
        : await apiChallenge(base, apiKey.trim(), actionKind, actionHash);

      append({ challenge: ch });

      // 2) Attest
      setStatus("Performing presence ceremony (FaceID/TouchID)…");
      const assertion = await attestWithPasskey(s, challengeToBytes(ch.challengeB64Url));
      append({ assertionPreview: { ...assertion, pubKeyPem: "[redacted]" } });

      // 3) Verify
      setStatus("Verifying on server…");
      const resp: PbiVerifyResp = IS_DEMO
        ? await demoVerify(base, { challengeId: ch.id, assertion })
        : await apiVerify(base, apiKey.trim(), { challengeId: ch.id, assertion });

      append({ verifyResponse: resp });

      const decision = (resp as any)?.decision ?? (resp as any)?.status ?? "UNKNOWN";
      setLastDecision(String(decision));

      const receiptHash =
        (resp as any)?.receiptHashHex ??
        (resp as any)?.receiptHash ??
        (resp as any)?.receipt_hash_hex ??
        (resp as any)?.receipt_hash ??
        "";
      if (receiptHash) setLastReceiptHash(String(receiptHash));

      if ((resp as any)?.ok && (resp as any)?.decision === "PBI_VERIFIED") {
        setStatus("✅ VERIFIED (receipt minted)");
      } else {
        const reason = (resp as any)?.reason ? ` (${String((resp as any).reason)})` : "";
        setStatus(`❌ verify_failed: ${String(decision)}${reason}`);
      }
    } catch (e: unknown) {
      setStatus(`❌ error: ${String((e as Error)?.message ?? e)}`);
    }
  }

  const canAttest = Boolean(stored) && (IS_DEMO ? true : Boolean(apiKey.trim()) && toolAck);
  const kindDesc = ACTION_KIND_OPTIONS.find((x) => x.value === actionKind)?.desc ?? "";

  return (
    <div className="krystal-wrap">
      <div className="header">
        <div className="header-inner">
          <div>
            <h1 className="title">{IS_DEMO ? "PBI Attester Demo" : "PBI Attester Tool"}</h1>
            <p className="subtitle">
              Presence ceremony: register a passkey, bind a challenge to an <b>action hash</b>, attest, verify, mint a receipt.
            </p>
          </div>

          <div
            className="badge"
            title={IS_DEMO ? "Public demo (no API keys in browser)" : "Developer harness (BYOK)"}
            data-mode={IS_DEMO ? "demo" : "tool"}
          >
            <span className="dot" />
            <span>{IS_DEMO ? "DEMO · Safe" : "TOOL · BYOK"}</span>
          </div>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <div className="card-inner">
            <div className="label">API Base</div>
            <input
              className="input"
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              placeholder={IS_DEMO ? DEFAULT_DEMO_BASE : DEFAULT_TOOL_BASE}
              disabled={IS_DEMO}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <div className="small" style={{ marginTop: 10, opacity: 0.85 }}>
              Origin: <span className="pill">{typeof window !== "undefined" ? window.location.origin : "—"}</span>{" "}
              {IS_DEMO ? (
                <>
                  · Demo proxy: <span className="pill">{DEMO_CHALLENGE_PATH}</span>, <span className="pill">{DEMO_VERIFY_PATH}</span>
                </>
              ) : (
                <>
                  · Your server validates <span className="pill">clientDataJSON.origin</span>.
                </>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-inner">
            <div className="label">{IS_DEMO ? "Mode" : "PBI API Key (BYOK)"}</div>

            {IS_DEMO ? (
              <div className="small" style={{ opacity: 0.9, lineHeight: 1.55 }}>
                This demo never asks for customer secrets. It uses a demo proxy with strict limits and a server-held key.
              </div>
            ) : (
              <>
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
                  This key lives only in memory (not stored). Treat it like a password.
                </div>

                <label className="ackRow" style={{ marginTop: 10 }}>
                  <input type="checkbox" checked={toolAck} onChange={(e) => setToolAck(e.target.checked)} />
                  <span>I understand: do not paste production keys in shared devices, streams, screenshots, or public demos.</span>
                </label>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-inner">
          <div className="section-title">
            <div className="label" style={{ margin: 0 }}>
              Action payload (what you are proving)
            </div>
            <span className="pill">{actionHashHex ? "hash-ready" : "hash…"}</span>
          </div>
          <div className="kline" />

          <div className="actionGrid" style={{ marginTop: 12 }}>
            <div className="field">
              <div className="label">Kind</div>
              <select
                className="input"
                value={actionKind}
                onChange={(e) => setActionKind(e.target.value as ActionKind)}
                disabled={IS_DEMO}
              >
                {ACTION_KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <div className="small" style={{ marginTop: 8, opacity: 0.85 }}>
                {kindDesc}
              </div>
            </div>

            <div className="field">
              <div className="label">Action</div>
              <input className="input" value={actionType} onChange={(e) => setActionType(e.target.value)} disabled={IS_DEMO} />
            </div>

            <div className="field">
              <div className="label">Amount</div>
              <input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={IS_DEMO} />
            </div>

            <div className="field">
              <div className="label">Currency</div>
              <input className="input" value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={IS_DEMO} />
            </div>

            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <div className="label">Target</div>
              <input className="input" value={target} onChange={(e) => setTarget(e.target.value)} disabled={IS_DEMO} />
            </div>

            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <div className="label">Nonce</div>
              <div className="row">
                <input className="input" value={nonce} onChange={(e) => setNonce(e.target.value)} disabled={IS_DEMO} autoCapitalize="none" />
                <button className="btn btn-ghost" onClick={onNewNonce} type="button" disabled={IS_DEMO}>
                  New nonce
                </button>
              </div>
              <div className="small" style={{ marginTop: 8, opacity: 0.85 }}>
                Nonce ensures uniqueness so receipts can’t be “reused” across identical payloads.
              </div>
            </div>
          </div>

          <div className="hashRow" style={{ marginTop: 12 }}>
            <div className="small" style={{ opacity: 0.9 }}>
              actionHashHex:
            </div>
<code className="pill mono hashPill">{actionHashHex || "—"}</code>
            <button className="btn btn-ghost" type="button" onClick={() => safeClipboard(actionHashHex)} disabled={!actionHashHex}>
              Copy
            </button>
          </div>

          <details className="details" style={{ marginTop: 10 }}>
            <summary className="small">View payload JSON</summary>
            <pre className="pre" style={{ marginTop: 10 }}>
              {actionJson || "—"}
            </pre>
          </details>
        </div>
      </div>

      <div className="actions" style={{ marginTop: 12 }}>
        <button onClick={onRegister} className="btn btn-primary" disabled={!isWebAuthnSupported()}>
          <span className="icon" />
          1) Register passkey
        </button>

        <button onClick={onAttestAndVerify} className="btn" disabled={!canAttest}>
          <span className="icon" />
          2) Attest + Verify
        </button>

        <button onClick={onClear} className="btn btn-ghost" type="button">
          Clear stored credential
        </button>

        <button onClick={() => setShowDebug((v) => !v)} className="btn btn-ghost" type="button">
          {showDebug ? "Hide debug" : "Show debug"}
        </button>
      </div>

      <div className="status">
        <div className="status-title">Status</div>
        <div className="status-text">{status || "—"}</div>

        {lastDecision ? (
          <div className="small" style={{ marginTop: 8, opacity: 0.9 }}>
            Decision: <span className="pill">{lastDecision}</span>
          </div>
        ) : null}

        {lastReceiptHash ? (
          <div className="hashRow" style={{ marginTop: 10 }}>
            <div className="small" style={{ opacity: 0.9 }}>
              receiptHash:
            </div>
<code className="pill mono hashPill">{lastReceiptHash}</code>
            <button className="btn btn-ghost" type="button" onClick={() => safeClipboard(lastReceiptHash)}>
              Copy
            </button>
          </div>
        ) : null}
      </div>

      <div className="split">
        <div className="card">
          <div className="card-inner">
            <div className="section-title">
              <div className="label" style={{ margin: 0 }}>
                Stored Credential
              </div>
              <span className="pill">{stored ? "present" : "none"}</span>
            </div>
            <div className="kline" />
            <div style={{ marginTop: 12 }}>
              <pre className="pre">{stored ? JSON.stringify({ ...stored, pubKeyPem: "[stored]" }, null, 2) : "None (register first)"}</pre>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-inner">
            <div className="section-title">
              <div className="label" style={{ margin: 0 }}>
                Krystal Log
              </div>
              <span className="pill">{showDebug ? "debug" : "hidden"}</span>
            </div>
            <div className="kline" />
            <div style={{ marginTop: 12 }}>
              {showDebug ? <pre className="pre">{log || "—"}</pre> : <div className="small" style={{ opacity: 0.85 }}>Debug hidden.</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="small" style={{ marginTop: 16, opacity: 0.75 }}>
        {IS_DEMO ? (
          <>Public demo. No API keys are collected. For integrations, use the client portal to create keys and the API docs for endpoints.</>
        ) : (
          <>Developer tool. Use staging keys/bases whenever possible. Avoid sharing production secrets in screenshots or recordings.</>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);