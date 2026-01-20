// pages/console/webhooks.tsx
import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { apiJson } from "../../lib/api";

type Me = { customer: { id: string; email: string; plan: string; quotaPerMonth: string } };
type AuthState = "unknown" | "logged_out" | "logged_in";

type WebhookRow = {
  id: string;
  apiKeyId: string;
  url: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

const SITE_URL = "https://pbi.kojib.com";
const API_DOCS = "https://api.kojib.com/docs";
const DEMO_URL = "https://demo.kojib.com";
const TOOL_URL = "https://tool.kojib.com";

const ROLLOUT_URL = "/enterprise/rollout";
const WEBHOOKS_URL = "/console/webhooks";
const EXPORTS_URL = "/console/exports";

type WebhookEvent = "receipt.created";
const EVENT_OPTIONS: WebhookEvent[] = ["receipt.created"];

function normalizePlan(raw: unknown): { uiLabel: string; isPending: boolean } {
  const s = String(raw ?? "").toLowerCase().trim();
  if (s === "pending") return { uiLabel: "Pending", isPending: true };
  if (s === "starter") return { uiLabel: "Starter", isPending: false };
  if (s === "pro") return { uiLabel: "Pro", isPending: false };
  if (s === "enterprise") return { uiLabel: "Scale", isPending: false };
  return { uiLabel: s ? s.toUpperCase() : "Starter", isPending: false };
}

function EmailText({ email }: { email: string }) {
  const parts = email.split(/([@.])/);
  return (
    <span className="emailInline" aria-label={email}>
      {parts.map((p, i) =>
        p === "@" || p === "." ? (
          <span key={String(i)}>
            {p}
            <wbr />
          </span>
        ) : (
          <span key={String(i)}>{p}</span>
        )
      )}
    </span>
  );
}

function isValidUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export default function WebhooksPage() {
  const router = useRouter();

  const [auth, setAuth] = useState<AuthState>("unknown");
  const [me, setMe] = useState<Me | null>(null);

  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [busy, setBusy] = useState<string>("");
  const [err, setErr] = useState<string>("");

  // create form
  const [url, setUrl] = useState<string>("");
  const [enabled, setEnabled] = useState<boolean>(true);

  // secrets shown-once
  const [createdSecretOnce, setCreatedSecretOnce] = useState<string>("");
  const [rotatedSecretOnce, setRotatedSecretOnce] = useState<string>("");

  // copy UX
  const [copied, setCopied] = useState<string>("");

  const pageUrl = useMemo(() => `${SITE_URL}/console/webhooks`, []);
  const ogImage = `${SITE_URL}/pbi_1.png`;

  async function load(): Promise<void> {
    const m = await apiJson<Me>("/v1/portal/me");
    setMe(m);
    setAuth("logged_in");

    try {
      const r = await apiJson<{ webhooks: WebhookRow[] }>("/v1/portal/webhooks");
      setWebhooks(Array.isArray(r.webhooks) ? r.webhooks : []);
    } catch {
      setWebhooks([]);
    }
  }

  useEffect(() => {
    let cancelled = false;
    load().catch(() => {
      if (cancelled) return;
      setAuth("logged_out");
      window.location.href = "/login";
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const planInfo = normalizePlan(me?.customer.plan);
  const isPending = planInfo.isPending;

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(""), 1200);
    } catch {
      // ignore
    }
  }

  async function createWebhook() {
    setErr("");
    setCreatedSecretOnce("");
    setRotatedSecretOnce("");

    const u = url.trim();
    if (!u) {
      setErr("Webhook URL is required.");
      return;
    }
    if (!isValidUrl(u)) {
      setErr("Webhook URL must be a valid http(s) URL.");
      return;
    }

    setBusy("create");
    try {
      const r = await apiJson<{ ok: true; webhook: WebhookRow; secret: string }>("/v1/portal/webhooks", {
        method: "POST",
        body: JSON.stringify({
          url: u,
          events: ["receipt.created"],
          enabled
        })
      });

      setCreatedSecretOnce(r.secret ?? "");
      setUrl("");
      await load();
    } catch {
      setErr("Could not create webhook. Check the URL and try again.");
    } finally {
      setBusy("");
    }
  }

  async function rotateSecret(id: string) {
    setErr("");
    setRotatedSecretOnce("");
    setBusy(`rotate:${id}`);
    try {
      const r = await apiJson<{ ok: true; secret: string }>(`/v1/portal/webhooks/${id}/rotate-secret`, {
        method: "POST"
      });
      setRotatedSecretOnce(r.secret ?? "");
      await load();
    } catch {
      setErr("Could not rotate webhook secret. Try again.");
    } finally {
      setBusy("");
    }
  }

  async function removeWebhook(id: string) {
    setErr("");
    setBusy(`delete:${id}`);
    try {
      await apiJson<{ ok: true }>(`/v1/portal/webhooks/${id}`, { method: "DELETE" });
      await load();
    } catch {
      setErr("Could not delete webhook. Try again.");
    } finally {
      setBusy("");
    }
  }

  const signatureBaseString = "<timestamp>.<deliveryId>.<rawBody>";

  return (
    <div className="console">
      <Head>
        <title>Webhooks · PBI Console</title>
        <meta
          name="description"
          content="Configure receipt.created webhooks with signed delivery, retries, and secret rotation."
        />
        <link rel="canonical" href={pageUrl} />
        <meta name="robots" content="index,follow" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#05070e" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Kojib" />
        <meta property="og:title" content="Webhooks · PBI Console" />
        <meta property="og:description" content="Signed receipt.created deliveries with secret rotation and retries." />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={ogImage} />
      </Head>

      <style>{css}</style>
      <div className="bg" aria-hidden />
      <div className="shell">
        <TopBar auth={auth} onHome={() => router.push("/console")} active="webhooks" pending={isPending} />

        <div className="main">
          <section className="hero">
            <div className="heroGrid">
              <div className="leftCol">
                <div className="pill">
                  <span className="pillDot" />
                  Integrations · Webhooks
                </div>

                {me ? (
                  <div className="emailRow">
                    <div className="emailPill" title={me.customer.email}>
                      <span className="emailPillDot" aria-hidden />
                      <span className="emailPillText">
                        <EmailText email={me.customer.email} />
                      </span>
                    </div>
                  </div>
                ) : null}

                <p className="lead">
                  Push <span className="strong">receipt.created</span> into your systems with signed delivery + retries.{" "}
                  <a className="rolloutLink" href={ROLLOUT_URL}>
                    Rollout guide →
                  </a>
                </p>

                <div className="ctaRow">
                  <a className="btnGhost" href="/console">
                    Console →
                  </a>
                  <a className="btnGhost" href={EXPORTS_URL}>
                    Exports →
                  </a>
                  <a className="btnGhost" href={API_DOCS} target="_blank" rel="noreferrer">
                    API docs →
                  </a>
                </div>

                {isPending ? (
                  <div className="pendingCallout" role="status">
                    <div className="pendingTitle">Webhooks locked</div>
                    <div className="pendingBody">
                      Your account is in <b>pending</b> state. Activate billing to configure webhooks.
                    </div>
                    <div className="pendingBtns">
                      <a className="btnPrimary" href="/billing">
                        Activate billing →
                      </a>
                      <a className="btnGhost" href={ROLLOUT_URL}>
                        Rollout guide →
                      </a>
                    </div>
                  </div>
                ) : null}

                {err ? <div className="error">{err}</div> : null}
              </div>

              <aside className="side">
                <div className="sideTop">
                  <div>
                    <div className="kicker">Delivery</div>
                    <div className="sideTitle">Signed + retried</div>
                  </div>
                  <div className="tag">HMAC</div>
                </div>

                <div className="sideBody">
                  <div className="miniRow">
                    <div className="miniK">Event</div>
                    <div className="miniV">receipt.created</div>
                  </div>
                  <div className="miniRow">
                    <div className="miniK">Headers</div>
                    <div className="miniV">X-PBI-*</div>
                  </div>
                  <div className="miniRow">
                    <div className="miniK">Retries</div>
                    <div className="miniV">exp backoff</div>
                  </div>

                  <div className="divider" />

                  <div className="hint">
                    Secrets are shown once on create/rotate. Store them in your secrets manager and rotate on schedule.
                  </div>
                </div>
              </aside>
            </div>
          </section>

          <section className="panel">
            <div className="panelHead">
              <div>
                <div className="kicker">Create</div>
                <div className="panelTitle">New webhook endpoint</div>
              </div>
              <div className="panelMeta">receipt.created</div>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <div className="formGrid">
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <div className="label">Destination URL</div>
                  <input
                    className="textInput"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://your-app.com/pbi/webhook"
                    disabled={busy !== "" || isPending}
                  />
                  <div className="help">
                    Must be a publicly reachable HTTPS endpoint. Store <span className="strong">deliveryId</span> for idempotency.
                  </div>
                </div>

                <div className="field">
                  <div className="label">Event</div>
                  <select className="selectInput" value={EVENT_OPTIONS[0]} disabled>
                    <option value="receipt.created">receipt.created</option>
                  </select>
                  <div className="help">Currently supported: receipt.created</div>
                </div>

                <div className="field">
                  <div className="label">Enabled</div>
                  <select
                    className="selectInput"
                    value={enabled ? "true" : "false"}
                    onChange={(e) => setEnabled(e.target.value === "true")}
                    disabled={busy !== "" || isPending}
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                  <div className="help">You can disable by deleting/recreating for now.</div>
                </div>
              </div>

              <div className="ctaRow">
                <button className="btnPrimary" disabled={busy !== "" || isPending} onClick={() => void createWebhook()} type="button">
                  {busy === "create" ? "Creating…" : "Create webhook"}
                </button>
                <a className="btnGhost" href={ROLLOUT_URL}>
                  Rollout guide →
                </a>
              </div>

              {createdSecretOnce ? (
                <div className="secretBox" role="status" aria-live="polite">
                  <div className="secretTop">
                    <div>
                      <div className="secretTitle">Webhook secret (shown once)</div>
                      <div className="secretSub">Store this in your webhook verifier immediately.</div>
                    </div>
                    <button className="btnGhost" onClick={() => void copy(createdSecretOnce, "createdSecret")} type="button">
                      {copied === "createdSecret" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <pre className="secretCode">{createdSecretOnce}</pre>
                </div>
              ) : null}

              {rotatedSecretOnce ? (
                <div className="secretBox" role="status" aria-live="polite">
                  <div className="secretTop">
                    <div>
                      <div className="secretTitle">Rotated webhook secret (shown once)</div>
                      <div className="secretSub">Update your verifier immediately.</div>
                    </div>
                    <button className="btnGhost" onClick={() => void copy(rotatedSecretOnce, "rotatedSecret")} type="button">
                      {copied === "rotatedSecret" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <pre className="secretCode">{rotatedSecretOnce}</pre>
                </div>
              ) : null}
            </div>
          </section>

          <section className="panel">
            <div className="panelHead">
              <div>
                <div className="kicker">Configured</div>
                <div className="panelTitle">Webhook endpoints</div>
              </div>
              <div className="panelMeta">{webhooks.length} total</div>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <div className="table">
                <div className="trow head" style={{ gridTemplateColumns: "1.6fr .7fr .7fr .9fr" }}>
                  <div className="cell">Endpoint</div>
                  <div className="cell right">Event</div>
                  <div className="cell right">Enabled</div>
                  <div className="cell right">Actions</div>
                </div>

                {webhooks.length === 0 ? (
                  <div className="trow" style={{ gridTemplateColumns: "1fr" }}>
                    <div className="cell muted">No webhooks configured.</div>
                  </div>
                ) : (
                  webhooks.map((w) => (
                    <div key={w.id} className="trow" style={{ gridTemplateColumns: "1.6fr .7fr .7fr .9fr" }}>
                      <div className="cell">
                        <div className="strong">{w.url}</div>
                        <div className="mutedSmall">
                          Created: {new Date(w.createdAt).toLocaleString()} · Updated: {new Date(w.updatedAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="cell right">{w.events.join(", ")}</div>
                      <div className="cell right">{w.enabled ? "Yes" : "No"}</div>
                      <div className="cell right" style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                        <button
                          className="btnGhost"
                          disabled={busy !== "" || isPending}
                          onClick={() => void rotateSecret(w.id)}
                          type="button"
                        >
                          {busy === `rotate:${w.id}` ? "Rotating…" : "Rotate secret"}
                        </button>
                        <button className="btnDanger" disabled={busy !== "" || isPending} onClick={() => void removeWebhook(w.id)} type="button">
                          {busy === `delete:${w.id}` ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="panelMeta">
                Rotation returns a new secret once. Deleting an endpoint stops delivery immediately.
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panelHead">
              <div>
                <div className="kicker">Verification</div>
                <div className="panelTitle">How to validate deliveries</div>
              </div>
              <div className="panelMeta">Server-side</div>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <div className="panelMeta">
                Deliveries are signed using HMAC-SHA256. Compute a signature over the base string and compare with <span className="strong">X-PBI-Signature</span>.
              </div>

              <div className="copyRow">
                <pre className="pbiCode">{signatureBaseString}</pre>
                <button className="btnGhost" onClick={() => void copy(signatureBaseString, "sigbase")} type="button">
                  {copied === "sigbase" ? "Copied" : "Copy"}
                </button>
              </div>

              <pre className="pbiCode">{`Headers:
- X-PBI-Event
- X-PBI-Delivery-Id
- X-PBI-Timestamp
- X-PBI-Signature: v1=<hex>

Base string:
<timestamp>.<deliveryId>.<rawBody>

HMAC:
HMAC_SHA256(secret, baseString)

Notes:
- Store deliveryId for idempotency (exactly-once handling)
- Enforce a timestamp tolerance window (e.g., 5 minutes)
- Return 2xx to acknowledge; non-2xx triggers retries`}</pre>
            </div>
          </section>

          <footer className="footer">
            <div>© {new Date().getFullYear()} Kojib · PBI</div>
            <div className="footerLinks">
              <a href="/console">Console</a>
              <a href={WEBHOOKS_URL}>Webhooks</a>
              <a href={EXPORTS_URL}>Exports</a>
              <a href={ROLLOUT_URL}>Rollout guide</a>
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

function TopBar({
  auth,
  onHome,
  active,
  pending
}: {
  auth: AuthState;
  onHome: () => void;
  active: "console" | "webhooks" | "exports";
  pending: boolean;
}) {
  return (
    <header className="topbar">
      <div className="brand" role="button" tabIndex={0} onClick={onHome} onKeyDown={(e) => (e.key === "Enter" ? onHome() : null)}>
        <div className="mark" aria-hidden>
          <span className="markDot" />
        </div>
        <div className="brandText">
          <div className="brandTitle">PBI Client Portal</div>
          <div className="brandSub">Control Panel</div>
        </div>
      </div>

      <nav className="nav" aria-label="Primary">
        <a className={`navLink ${active === "console" ? "navLinkActive" : ""}`} href="/console">
          Console
        </a>
        <a className={`navLink ${active === "webhooks" ? "navLinkActive" : ""}`} href={WEBHOOKS_URL}>
          Webhooks
        </a>
        <a className={`navLink ${active === "exports" ? "navLinkActive" : ""}`} href={EXPORTS_URL}>
          Exports
        </a>
        <a className="navLink" href={ROLLOUT_URL}>
          Rollout
        </a>
        <a className="navLink" href={API_DOCS} target="_blank" rel="noreferrer">
          API
        </a>
        <a className="navLink" href="/status">
          Status
        </a>
        {pending ? (
          <a className="navLink" href="/billing">
            Activate
          </a>
        ) : (
          <a className="navLink" href={TOOL_URL} target="_blank" rel="noreferrer">
            Attester
          </a>
        )}
      </nav>

      <div className="topbarRight">
        <a className="navLink" href={DEMO_URL} target="_blank" rel="noreferrer">
          Demo
        </a>
        <a className="navLink" href="/privacy">
          Privacy
        </a>
      </div>

      <span style={{ display: "none" }}>{auth}</span>
    </header>
  );
}

const css = `
:root{
  --bg0:#05070e;
  --bg1:#070b18;
  --ink:rgba(255,255,255,.92);
  --muted:rgba(255,255,255,.72);
  --muted2:rgba(255,255,255,.56);
  --line:rgba(255,255,255,.12);
  --line2:rgba(255,255,255,.18);
  --mint: rgba(120,255,231,.95);
  --mintSoft: rgba(120,255,231,.14);
  --shadow: 0 26px 90px rgba(0,0,0,.66);
  --shadow2: 0 18px 55px rgba(0,0,0,.45);
  --shadow3: 0 10px 28px rgba(0,0,0,.35);
  --sans: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
  --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace;
}

*{ box-sizing:border-box; }
html,body{ height:100%; }
body{ margin:0; overflow-x:hidden; }

.console{ min-height:100svh; color:var(--ink); font-family:var(--sans); overflow-x:hidden; }
.bg{ position:fixed; inset:0; z-index:-1; background: var(--bg0); }
.bg::before{
  content:""; position:absolute; inset:0;
  background:
    radial-gradient(1200px 800px at 18% 10%, rgba(120,255,231,.12), transparent 55%),
    radial-gradient(900px 700px at 82% 18%, rgba(140,155,255,.10), transparent 60%),
    radial-gradient(1100px 900px at 60% 92%, rgba(255,190,120,.08), transparent 55%),
    linear-gradient(180deg,var(--bg0),var(--bg1));
}
.bg::after{
  content:""; position:absolute; inset:0; opacity:.10;
  background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,.35) 1px, transparent 0);
  background-size: 28px 28px;
  mask-image: radial-gradient(ellipse at center, black 40%, transparent 75%);
}

.shell{
  width: min(1120px, 100%);
  margin: 0 auto;
  padding: calc(14px + env(safe-area-inset-top)) calc(14px + env(safe-area-inset-right)) calc(18px + env(safe-area-inset-bottom)) calc(14px + env(safe-area-inset-left));
  display:flex;
  flex-direction:column;
  gap: 10px;
}

.main{
  flex: 1 1 auto;
  min-height: 0;
  display:flex;
  flex-direction:column;
  gap: 12px;
}

/* Topbar */
.topbar{
  display:grid;
  grid-template-columns: 1fr auto auto;
  align-items:center;
  gap: 10px;
}
.brand{ display:flex; align-items:center; gap: 12px; min-width:0; cursor:pointer; }
.mark{
  width: 42px; height: 42px; border-radius: 16px;
  border: 1px solid var(--line2);
  background: rgba(255,255,255,.06);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 20px 60px rgba(0,0,0,.55);
  position: relative;
  overflow:hidden;
  flex: 0 0 auto;
}
.mark::before{
  content:""; position:absolute; inset:-44px;
  background:
    radial-gradient(150px 120px at 30% 30%, rgba(120,255,231,.28), transparent 62%),
    radial-gradient(150px 120px at 72% 42%, rgba(154,170,255,.20), transparent 62%),
    radial-gradient(150px 120px at 60% 90%, rgba(255,190,120,.14), transparent 65%);
  filter: blur(16px);
  opacity: .95;
}
.markDot{
  position:absolute; left:50%; top:50%;
  width: 10px; height: 10px; border-radius:999px;
  transform: translate(-50%,-50%);
  background: var(--mint);
  box-shadow: 0 0 0 6px rgba(120,255,231,.10), 0 0 26px rgba(120,255,231,.22);
}
.brandText{ min-width:0; }
.brandTitle{ font-weight: 950; letter-spacing: .24px; font-size: 13px; white-space: nowrap; }
.brandSub{ margin-top: 3px; font-size: 11px; color: var(--muted2); white-space: nowrap; overflow:hidden; text-overflow: ellipsis; max-width: 52vw; }

.nav{ display:flex; gap: 8px; align-items:center; flex-wrap: nowrap; white-space: nowrap; }
.topbarRight{ display:flex; gap: 8px; align-items:center; flex-wrap: nowrap; white-space: nowrap; }

.navLink{
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.16);
  background: rgba(255,255,255,.06);
  padding: 10px 12px;
  color: rgba(255,255,255,.88);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  transition: transform .12s ease, background .12s ease, border-color .12s ease;
  font-size: 13px;
  line-height: 1;
  min-height: 40px;
  display:inline-flex;
  align-items:center;
  text-decoration:none;
}
.navLink:hover{ transform: translateY(-1px); background: rgba(255,255,255,.09); border-color: rgba(255,255,255,.22); }
.navLinkActive{ border-color: rgba(120,255,231,.38); background: rgba(120,255,231,.10); }

@media (max-width: 980px){
  .topbar{ grid-template-columns: 1fr; }
  .nav{ overflow-x:auto; scrollbar-width:none; -webkit-overflow-scrolling: touch; }
  .nav::-webkit-scrollbar{ display:none; }
  .topbarRight{ display:none; }
}

/* Hero + cards */
.hero{
  border-radius: 28px;
  border: 1px solid var(--line);
  background: linear-gradient(180deg, rgba(255,255,255,.095), rgba(255,255,255,.05));
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  box-shadow: var(--shadow);
  padding: 16px;
  position: relative;
  overflow:hidden;
}
.hero::before{
  content:""; position:absolute; inset:-2px;
  background:
    radial-gradient(760px 280px at 18% 0%, rgba(120,255,231,.20), transparent 60%),
    radial-gradient(650px 280px at 88% 18%, rgba(154,170,255,.16), transparent 62%),
    radial-gradient(800px 560px at 55% 120%, rgba(255,190,120,.12), transparent 65%);
  filter: blur(18px);
  opacity: .92;
  pointer-events:none;
}
.heroGrid{
  position:relative;
  display:grid;
  grid-template-columns: 1.15fr .85fr;
  gap: 14px;
  align-items:start;
}
@media (max-width: 980px){ .heroGrid{ grid-template-columns: 1fr; } }

.pill{
  display:inline-flex; align-items:center; gap:10px;
  padding: 8px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.22);
  font-size: 12px;
  color: rgba(255,255,255,.86);
}
.pillDot{ width: 9px; height: 9px; border-radius:999px; background: var(--mint); box-shadow: 0 0 0 5px rgba(120,255,231,.10); }
.lead{
  margin-top: 8px;
  color: rgba(255,255,255,.76);
  font-size: 13px;
  line-height: 1.6;
}
.rolloutLink{
  color: rgba(120,255,231,.92);
  font-weight: 900;
  text-decoration: none;
}
.rolloutLink:hover{ text-decoration: underline; }

.strong{ font-weight: 950; }

.ctaRow{ margin-top: 10px; display:flex; gap: 10px; flex-wrap: wrap; }

.btnPrimary{
  border-radius: 16px;
  padding: 11px 14px;
  font-weight: 950;
  border: 1px solid rgba(120,255,231,.55);
  background: rgba(120,255,231,.95);
  color: #05070e;
  cursor: pointer;
  transition: transform .12s ease, filter .12s ease;
  text-decoration:none;
  display:inline-flex;
  align-items:center;
  justify-content:center;
}
.btnPrimary:hover{ transform: translateY(-1px); filter: brightness(.99); }
.btnPrimary:disabled{ opacity:.65; cursor:not-allowed; }

.btnGhost{
  border-radius: 16px;
  padding: 11px 14px;
  font-weight: 950;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.92);
  cursor: pointer;
  transition: transform .12s ease, background .12s ease, border-color .12s ease;
  text-decoration:none;
  display:inline-flex;
  align-items:center;
  justify-content:center;
}
.btnGhost:hover{ transform: translateY(-1px); background: rgba(255,255,255,.09); border-color: rgba(255,255,255,.22); }

.btnDanger{
  border-radius: 14px;
  padding: 9px 12px;
  font-weight: 950;
  border: 1px solid rgba(255,138,160,.40);
  background: rgba(255,138,160,.10);
  color: rgba(255,255,255,.92);
  cursor: pointer;
}
.btnDanger:disabled{ opacity:.65; cursor:not-allowed; }

.error{
  margin-top: 10px;
  padding: 10px;
  border-radius: 14px;
  border: 1px solid rgba(255,138,160,.35);
  background: rgba(255,138,160,.10);
  font-size: 13px;
}

.pendingCallout{
  margin-top: 12px;
  border-radius: 18px;
  border: 1px solid rgba(255,190,120,.28);
  background: rgba(255,190,120,.10);
  padding: 12px;
}
.pendingTitle{ font-weight: 950; }
.pendingBody{ margin-top: 6px; font-size: 13px; color: rgba(255,255,255,.86); line-height: 1.5; }
.pendingBtns{ margin-top: 10px; display:flex; gap: 10px; flex-wrap: wrap; }

.side{
  border-radius: 22px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(0,0,0,.26);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  padding: 14px;
  box-shadow: var(--shadow2);
}
.sideTop{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
.kicker{ font-size: 11px; color: rgba(255,255,255,.56); }
.sideTitle{ margin-top: 6px; font-weight: 950; }
.tag{
  font-size: 11px;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.76);
}
.sideBody{ margin-top: 10px; display:grid; gap: 10px; }
.miniRow{ display:flex; justify-content:space-between; gap:10px; }
.miniK{ font-size: 12px; color: rgba(255,255,255,.62); }
.miniV{ font-weight: 900; text-align:right; }
.divider{ height: 1px; background: rgba(255,255,255,.10); margin: 4px 0; }
.hint{
  font-size: 12px;
  opacity: .75;
  line-height: 1.5;
  margin-top: 6px;
}

.panel{
  border-radius: 22px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.06);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: var(--shadow2);
  padding: 16px;
}
.panelHead{ display:flex; align-items:flex-start; justify-content:space-between; gap: 12px; flex-wrap: wrap; }
.panelTitle{ margin-top: 4px; font-weight: 950; }
.panelMeta{ font-size: 12px; opacity: .72; }

.formGrid{
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
@media (max-width: 820px){ .formGrid{ grid-template-columns: 1fr; } }

.field .label{ font-size: 12px; color: rgba(255,255,255,.72); font-weight: 900; }
.field .help{ margin-top: 6px; font-size: 12px; color: rgba(255,255,255,.58); line-height: 1.45; }

.textInput, .selectInput{
  width: 100%;
  margin-top: 8px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.22);
  color: rgba(255,255,255,.92);
  padding: 10px 12px;
  outline: none;
}
.textInput::placeholder{ color: rgba(255,255,255,.45); }
.textInput:focus, .selectInput:focus{
  border-color: rgba(120,255,231,.40);
  box-shadow: 0 0 0 4px rgba(120,255,231,.10);
}

.secretBox{
  margin-top: 12px;
  border-radius: 18px;
  border: 1px solid rgba(120,255,231,.28);
  background: rgba(120,255,231,.08);
  padding: 12px;
}
.secretTop{ display:flex; justify-content:space-between; align-items:flex-start; gap: 12px; flex-wrap: wrap; }
.secretTitle{ font-weight: 950; }
.secretSub{ font-size: 12px; opacity: .75; margin-top: 4px; }
.secretCode{
  margin-top: 10px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.25);
  padding: 10px;
  overflow:auto;
  font-family: var(--mono);
  font-size: 12px;
  color: rgba(255,255,255,.92);
}
.pbiCode{
  font-family: var(--mono);
  font-size: 12px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(0,0,0,.22);
  padding: 12px;
  overflow:auto;
  color: rgba(255,255,255,.90);
}

.copyRow{
  display:flex;
  gap: 10px;
  align-items: flex-start;
  flex-wrap: wrap;
}
.copyRow .pbiCode{ flex: 1 1 520px; margin: 0; }

.table{
  margin-top: 0;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.12);
  overflow:hidden;
}
.trow{
  display:grid;
  gap: 10px;
  padding: 12px;
  border-top: 1px solid rgba(255,255,255,.08);
  align-items:center;
}
.trow.head{
  border-top: 0;
  background: rgba(255,255,255,.04);
  font-size: 12px;
  opacity: .85;
}
.cell{ min-width:0; overflow-wrap:anywhere; }
.right{ text-align:right; }
.muted{ opacity:.75; }
.mutedSmall{ font-size: 11px; opacity: .6; margin-top: 4px; overflow-wrap:anywhere; }

.emailRow{ margin-top: 10px; }
.emailPill{
  display:inline-flex; align-items:center; gap:10px;
  padding: 8px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.22);
  color: rgba(255,255,255,.86);
}
.emailPillDot{
  width: 9px; height: 9px; border-radius:999px;
  background: var(--mint);
  box-shadow: 0 0 0 5px rgba(120,255,231,.10);
}
.emailPillText{ font-size: 12px; }

.footer{
  margin-top: 12px;
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap: 12px;
  flex-wrap: wrap;
  color: rgba(255,255,255,.55);
  font-size: 12px;
}
.footerLinks{ display:flex; gap: 12px; flex-wrap: wrap; }
.footer a{ color: rgba(120,255,231,.9); text-decoration:none; }
.footer a:hover{ text-decoration: underline; }
`;
