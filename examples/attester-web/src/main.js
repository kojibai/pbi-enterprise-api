import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { apiChallenge, apiVerify, challengeToBytes } from "./api";
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
const ENV = import.meta?.env ?? {};
const MODE = (ENV.VITE_PBI_MODE ?? (typeof window !== "undefined" && window.location.hostname.startsWith("demo.") ? "demo" : "tool")).toLowerCase();
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
const ACTION_KIND_OPTIONS = [
    { value: "ACTION_COMMIT", label: "ACTION_COMMIT", desc: "Generic action approval bound to an action hash" },
    { value: "ARTIFACT_AUTHORSHIP", label: "ARTIFACT_AUTHORSHIP", desc: "Attest authorship/presence for an artifact hash" },
    { value: "EVIDENCE_SUBMIT", label: "EVIDENCE_SUBMIT", desc: "Presence-gate evidence submission/claims" },
    { value: "ADMIN_DANGEROUS_OP", label: "ADMIN_DANGEROUS_OP", desc: "Step-up for privileged or destructive admin operations" }
];
// ---- helpers ----
function isWebAuthnSupported() {
    return typeof window !== "undefined" && typeof PublicKeyCredential !== "undefined" && !!navigator?.credentials;
}
function stableStringify(v) {
    // Minimal stable JSON for action hash computation
    if (v === null || v === undefined)
        return "null";
    if (typeof v === "number" || typeof v === "boolean")
        return JSON.stringify(v);
    if (typeof v === "string")
        return JSON.stringify(v);
    if (Array.isArray(v))
        return `[${v.map((x) => stableStringify(x)).join(",")}]`;
    if (typeof v === "object") {
        const keys = Object.keys(v).sort();
        return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(",")}}`;
    }
    return JSON.stringify(String(v));
}
function bytesToHex(bytes) {
    let out = "";
    for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i];
        if (b === undefined)
            continue; // satisfies TS under noUncheckedIndexedAccess
        out += b.toString(16).padStart(2, "0");
    }
    return out;
}
async function sha256Hex(text) {
    const enc = new TextEncoder();
    const data = enc.encode(text);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return bytesToHex(new Uint8Array(digest));
}
function randHex(nBytes = 16) {
    const b = new Uint8Array(nBytes);
    crypto.getRandomValues(b);
    return bytesToHex(b);
}
function safeClipboard(text) {
    try {
        void navigator.clipboard.writeText(text);
    }
    catch {
        // ignore
    }
}
// DEMO proxy calls: no API keys in browser.
async function demoChallenge(apiBase, kind, actionHashHex) {
    const url = `${apiBase.replace(/\/+$/, "")}${DEMO_CHALLENGE_PATH}`;
    const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, actionHashHex })
    });
    if (!r.ok)
        throw new Error(`demo_challenge_failed:${r.status}`);
    return (await r.json());
}
async function demoVerify(apiBase, body) {
    const url = `${apiBase.replace(/\/+$/, "")}${DEMO_VERIFY_PATH}`;
    const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
    });
    if (!r.ok)
        throw new Error(`demo_verify_failed:${r.status}`);
    return (await r.json());
}
function App() {
    // Base defaults per mode
    const initialBase = useMemo(() => {
        if (IS_DEMO)
            return DEFAULT_DEMO_BASE;
        // tool: persist base (but never persist keys)
        try {
            const saved = localStorage.getItem(TOOL_PERSIST_API_BASE_KEY);
            if (saved && saved.trim())
                return saved.trim();
        }
        catch { }
        return DEFAULT_TOOL_BASE;
    }, []);
    const [apiBase, setApiBase] = useState(initialBase);
    const [apiKey, setApiKey] = useState("");
    const [status, setStatus] = useState("");
    const [log, setLog] = useState("");
    const [showDebug, setShowDebug] = useState(!IS_DEMO);
    // Tool safety gate: user must explicitly acknowledge before enabling BYOK verify
    const [toolAck, setToolAck] = useState(IS_DEMO ? true : false);
    // Action payload (meaningful; demo shows what “action-bound” means)
    const [actionKind, setActionKind] = useState("ACTION_COMMIT");
    const [actionType, setActionType] = useState("PAYOUT_RELEASE");
    const [amount, setAmount] = useState("100.00");
    const [currency, setCurrency] = useState("USD");
    const [target, setTarget] = useState("beneficiary:demo");
    const [nonce, setNonce] = useState(() => randHex(12));
    const [actionHashHex, setActionHashHex] = useState("");
    const [actionJson, setActionJson] = useState("");
    // Result snapshot
    const [lastReceiptHash, setLastReceiptHash] = useState("");
    const [lastDecision, setLastDecision] = useState("");
    const storedTick = useRef(0);
    const [storedRefresh, setStoredRefresh] = useState(0);
    const stored = useMemo(() => loadStoredCredential(), [storedRefresh]);
    // Persist apiBase in TOOL mode only
    useEffect(() => {
        if (IS_DEMO)
            return;
        try {
            localStorage.setItem(TOOL_PERSIST_API_BASE_KEY, apiBase.trim());
        }
        catch { }
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
            }
            catch {
                setActionHashHex("");
            }
        })();
    }, [actionKind, actionType, amount, currency, target, nonce]);
    function append(obj) {
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
        }
        catch (e) {
            setStatus(`❌ register_failed: ${String(e?.message ?? e)}`);
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
            const ch = IS_DEMO
                ? await demoChallenge(base, actionKind, actionHash)
                : await apiChallenge(base, apiKey.trim(), actionKind, actionHash);
            append({ challenge: ch });
            // 2) Attest
            setStatus("Performing presence ceremony (FaceID/TouchID)…");
            const assertion = await attestWithPasskey(s, challengeToBytes(ch.challengeB64Url));
            append({ assertionPreview: { ...assertion, pubKeyPem: "[redacted]" } });
            // 3) Verify
            setStatus("Verifying on server…");
            const resp = IS_DEMO
                ? await demoVerify(base, { challengeId: ch.id, assertion })
                : await apiVerify(base, apiKey.trim(), { challengeId: ch.id, assertion });
            append({ verifyResponse: resp });
            const decision = resp?.decision ?? resp?.status ?? "UNKNOWN";
            setLastDecision(String(decision));
            const receiptHash = resp?.receiptHashHex ??
                resp?.receiptHash ??
                resp?.receipt_hash_hex ??
                resp?.receipt_hash ??
                "";
            if (receiptHash)
                setLastReceiptHash(String(receiptHash));
            if (resp?.ok && resp?.decision === "PBI_VERIFIED") {
                setStatus("✅ VERIFIED (receipt minted)");
            }
            else {
                const reason = resp?.reason ? ` (${String(resp.reason)})` : "";
                setStatus(`❌ verify_failed: ${String(decision)}${reason}`);
            }
        }
        catch (e) {
            setStatus(`❌ error: ${String(e?.message ?? e)}`);
        }
    }
    const canAttest = Boolean(stored) && (IS_DEMO ? true : Boolean(apiKey.trim()) && toolAck);
    const kindDesc = ACTION_KIND_OPTIONS.find((x) => x.value === actionKind)?.desc ?? "";
    return (_jsxs("div", { className: "krystal-wrap", children: [_jsx("div", { className: "header", children: _jsxs("div", { className: "header-inner", children: [_jsxs("div", { children: [_jsx("h1", { className: "title", children: IS_DEMO ? "PBI Attester Demo" : "PBI Attester Tool" }), _jsxs("p", { className: "subtitle", children: ["Presence ceremony: register a passkey, bind a challenge to an ", _jsx("b", { children: "action hash" }), ", attest, verify, mint a receipt."] })] }), _jsxs("div", { className: "badge", title: IS_DEMO ? "Public demo (no API keys in browser)" : "Developer harness (BYOK)", "data-mode": IS_DEMO ? "demo" : "tool", children: [_jsx("span", { className: "dot" }), _jsx("span", { children: IS_DEMO ? "DEMO · Safe" : "TOOL · BYOK" })] })] }) }), _jsxs("div", { className: "grid", children: [_jsx("div", { className: "card", children: _jsxs("div", { className: "card-inner", children: [_jsx("div", { className: "label", children: "API Base" }), _jsx("input", { className: "input", value: apiBase, onChange: (e) => setApiBase(e.target.value), placeholder: IS_DEMO ? DEFAULT_DEMO_BASE : DEFAULT_TOOL_BASE, disabled: IS_DEMO, autoCapitalize: "none", autoCorrect: "off", spellCheck: false }), _jsxs("div", { className: "small", style: { marginTop: 10, opacity: 0.85 }, children: ["Origin: ", _jsx("span", { className: "pill", children: typeof window !== "undefined" ? window.location.origin : "—" }), " ", IS_DEMO ? (_jsxs(_Fragment, { children: ["\u00B7 Demo proxy: ", _jsx("span", { className: "pill", children: DEMO_CHALLENGE_PATH }), ", ", _jsx("span", { className: "pill", children: DEMO_VERIFY_PATH })] })) : (_jsxs(_Fragment, { children: ["\u00B7 Your server validates ", _jsx("span", { className: "pill", children: "clientDataJSON.origin" }), "."] }))] })] }) }), _jsx("div", { className: "card", children: _jsxs("div", { className: "card-inner", children: [_jsx("div", { className: "label", children: IS_DEMO ? "Mode" : "PBI API Key (BYOK)" }), IS_DEMO ? (_jsx("div", { className: "small", style: { opacity: 0.9, lineHeight: 1.55 }, children: "This demo never asks for customer secrets. It uses a demo proxy with strict limits and a server-held key." })) : (_jsxs(_Fragment, { children: [_jsx("input", { className: "input", value: apiKey, onChange: (e) => setApiKey(e.target.value), placeholder: "pbi_live_\u2026", autoCapitalize: "none", autoCorrect: "off", spellCheck: false }), _jsx("div", { className: "small", style: { marginTop: 10, opacity: 0.85 }, children: "This key lives only in memory (not stored). Treat it like a password." }), _jsxs("label", { className: "ackRow", style: { marginTop: 10 }, children: [_jsx("input", { type: "checkbox", checked: toolAck, onChange: (e) => setToolAck(e.target.checked) }), _jsx("span", { children: "I understand: do not paste production keys in shared devices, streams, screenshots, or public demos." })] })] }))] }) })] }), _jsx("div", { className: "card", style: { marginTop: 12 }, children: _jsxs("div", { className: "card-inner", children: [_jsxs("div", { className: "section-title", children: [_jsx("div", { className: "label", style: { margin: 0 }, children: "Action payload (what you are proving)" }), _jsx("span", { className: "pill", children: actionHashHex ? "hash-ready" : "hash…" })] }), _jsx("div", { className: "kline" }), _jsxs("div", { className: "actionGrid", style: { marginTop: 12 }, children: [_jsxs("div", { className: "field", children: [_jsx("div", { className: "label", children: "Kind" }), _jsx("select", { className: "input", value: actionKind, onChange: (e) => setActionKind(e.target.value), disabled: IS_DEMO, children: ACTION_KIND_OPTIONS.map((o) => (_jsx("option", { value: o.value, children: o.label }, o.value))) }), _jsx("div", { className: "small", style: { marginTop: 8, opacity: 0.85 }, children: kindDesc })] }), _jsxs("div", { className: "field", children: [_jsx("div", { className: "label", children: "Action" }), _jsx("input", { className: "input", value: actionType, onChange: (e) => setActionType(e.target.value), disabled: IS_DEMO })] }), _jsxs("div", { className: "field", children: [_jsx("div", { className: "label", children: "Amount" }), _jsx("input", { className: "input", value: amount, onChange: (e) => setAmount(e.target.value), disabled: IS_DEMO })] }), _jsxs("div", { className: "field", children: [_jsx("div", { className: "label", children: "Currency" }), _jsx("input", { className: "input", value: currency, onChange: (e) => setCurrency(e.target.value), disabled: IS_DEMO })] }), _jsxs("div", { className: "field", style: { gridColumn: "1 / -1" }, children: [_jsx("div", { className: "label", children: "Target" }), _jsx("input", { className: "input", value: target, onChange: (e) => setTarget(e.target.value), disabled: IS_DEMO })] }), _jsxs("div", { className: "field", style: { gridColumn: "1 / -1" }, children: [_jsx("div", { className: "label", children: "Nonce" }), _jsxs("div", { className: "row", children: [_jsx("input", { className: "input", value: nonce, onChange: (e) => setNonce(e.target.value), disabled: IS_DEMO, autoCapitalize: "none" }), _jsx("button", { className: "btn btn-ghost", onClick: onNewNonce, type: "button", disabled: IS_DEMO, children: "New nonce" })] }), _jsx("div", { className: "small", style: { marginTop: 8, opacity: 0.85 }, children: "Nonce ensures uniqueness so receipts can\u2019t be \u201Creused\u201D across identical payloads." })] })] }), _jsxs("div", { className: "hashRow", style: { marginTop: 12 }, children: [_jsx("div", { className: "small", style: { opacity: 0.9 }, children: "actionHashHex:" }), _jsx("code", { className: "pill mono", style: { flex: 1, overflow: "auto" }, children: actionHashHex || "—" }), _jsx("button", { className: "btn btn-ghost", type: "button", onClick: () => safeClipboard(actionHashHex), disabled: !actionHashHex, children: "Copy" })] }), _jsxs("details", { className: "details", style: { marginTop: 10 }, children: [_jsx("summary", { className: "small", children: "View payload JSON" }), _jsx("pre", { className: "pre", style: { marginTop: 10 }, children: actionJson || "—" })] })] }) }), _jsxs("div", { className: "actions", style: { marginTop: 12 }, children: [_jsxs("button", { onClick: onRegister, className: "btn btn-primary", disabled: !isWebAuthnSupported(), children: [_jsx("span", { className: "icon" }), "1) Register passkey"] }), _jsxs("button", { onClick: onAttestAndVerify, className: "btn", disabled: !canAttest, children: [_jsx("span", { className: "icon" }), "2) Attest + Verify"] }), _jsx("button", { onClick: onClear, className: "btn btn-ghost", type: "button", children: "Clear stored credential" }), _jsx("button", { onClick: () => setShowDebug((v) => !v), className: "btn btn-ghost", type: "button", children: showDebug ? "Hide debug" : "Show debug" })] }), _jsxs("div", { className: "status", children: [_jsx("div", { className: "status-title", children: "Status" }), _jsx("div", { className: "status-text", children: status || "—" }), lastDecision ? (_jsxs("div", { className: "small", style: { marginTop: 8, opacity: 0.9 }, children: ["Decision: ", _jsx("span", { className: "pill", children: lastDecision })] })) : null, lastReceiptHash ? (_jsxs("div", { className: "hashRow", style: { marginTop: 10 }, children: [_jsx("div", { className: "small", style: { opacity: 0.9 }, children: "receiptHash:" }), _jsx("code", { className: "pill mono", style: { flex: 1, overflow: "auto" }, children: lastReceiptHash }), _jsx("button", { className: "btn btn-ghost", type: "button", onClick: () => safeClipboard(lastReceiptHash), children: "Copy" })] })) : null] }), _jsxs("div", { className: "split", children: [_jsx("div", { className: "card", children: _jsxs("div", { className: "card-inner", children: [_jsxs("div", { className: "section-title", children: [_jsx("div", { className: "label", style: { margin: 0 }, children: "Stored Credential" }), _jsx("span", { className: "pill", children: stored ? "present" : "none" })] }), _jsx("div", { className: "kline" }), _jsx("div", { style: { marginTop: 12 }, children: _jsx("pre", { className: "pre", children: stored ? JSON.stringify({ ...stored, pubKeyPem: "[stored]" }, null, 2) : "None (register first)" }) })] }) }), _jsx("div", { className: "card", children: _jsxs("div", { className: "card-inner", children: [_jsxs("div", { className: "section-title", children: [_jsx("div", { className: "label", style: { margin: 0 }, children: "Krystal Log" }), _jsx("span", { className: "pill", children: showDebug ? "debug" : "hidden" })] }), _jsx("div", { className: "kline" }), _jsx("div", { style: { marginTop: 12 }, children: showDebug ? _jsx("pre", { className: "pre", children: log || "—" }) : _jsx("div", { className: "small", style: { opacity: 0.85 }, children: "Debug hidden." }) })] }) })] }), _jsx("div", { className: "small", style: { marginTop: 16, opacity: 0.75 }, children: IS_DEMO ? (_jsx(_Fragment, { children: "Public demo. No API keys are collected. For integrations, use the client portal to create keys and the API docs for endpoints." })) : (_jsx(_Fragment, { children: "Developer tool. Use staging keys/bases whenever possible. Avoid sharing production secrets in screenshots or recordings." })) })] }));
}
ReactDOM.createRoot(document.getElementById("root")).render(_jsx(App, {}));
