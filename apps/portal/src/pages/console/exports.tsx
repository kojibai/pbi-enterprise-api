// pages/console/exports.tsx
import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { apiJson } from "../../lib/api";

type Me = { customer: { id: string; email: string; plan: string; quotaPerMonth: string } };
type AuthState = "unknown" | "logged_out" | "logged_in";

const SITE_URL = "https://pbi.kojib.com";
const API_DOCS = "https://api.kojib.com/docs";
const DEMO_URL = "https://demo.kojib.com";
const TOOL_URL = "https://tool.kojib.com";

const ROLLOUT_URL = "/enterprise/rollout";
const WEBHOOKS_URL = "/console/webhooks";
const EXPORTS_URL = "/console/exports";

type ExportOrder = "asc" | "desc";
type ExportDecision = "" | "PBI_VERIFIED" | "FAILED" | "EXPIRED" | "REPLAYED";
type ExportPurpose = "" | "ACTION_COMMIT" | "ARTIFACT_AUTHORSHIP" | "EVIDENCE_SUBMIT" | "ADMIN_DANGEROUS_OP";

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

function isoNow(): string {
  return new Date().toISOString();
}

function isoMinusHours(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function pickFilenameFromContentDisposition(cd: string | null): string | null {
  if (!cd) return null;
  const m = cd.match(/filename="?([^"]+)"?/i);
  return m?.[1] ? String(m[1]) : null;
}

export default function ExportsPage() {
  const router = useRouter();

  const [auth, setAuth] = useState<AuthState>("unknown");
  const [me, setMe] = useState<Me | null>(null);

  const [busy, setBusy] = useState<boolean>(false);
  const [err, setErr] = useState<string>("");

  // Advanced filters
  const [limit, setLimit] = useState<string>("500");
  const [order, setOrder] = useState<ExportOrder>("desc");
  const [createdAfter, setCreatedAfter] = useState<string>(isoMinusHours(24));
  const [createdBefore, setCreatedBefore] = useState<string>(isoNow());

  const [actionHashHex, setActionHashHex] = useState<string>("");
  const [challengeId, setChallengeId] = useState<string>("");
  const [purpose, setPurpose] = useState<ExportPurpose>("");
  const [decision, setDecision] = useState<ExportDecision>("");

  const pageUrl = useMemo(() => `${SITE_URL}/console/exports`, []);
  const ogImage = `${SITE_URL}/pbi_1.png`;

  async function load(): Promise<void> {
    const m = await apiJson<Me>("/v1/portal/me");
    setMe(m);
    setAuth("logged_in");
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

  function apiBase(): string {
    return (process.env.NEXT_PUBLIC_PBI_API_BASE ?? "https://api.kojib.com").replace(/\/+$/, "");
  }

  async function download(params: Record<string, string>) {
    setErr("");
    setBusy(true);

    try {
      const qs = new URLSearchParams(params);
      const url = `${apiBase()}/v1/portal/receipts/export?${qs.toString()}`;

      const resp = await fetch(url, { method: "GET", credentials: "include" });

      if (!resp.ok) {
        setErr(`Export failed (${resp.status}).`);
        return;
      }

      const blob = await resp.blob();
      const href = URL.createObjectURL(blob);

      const cd = resp.headers.get("content-disposition");
      const filename = pickFilenameFromContentDisposition(cd) ?? "pbi-receipts-export.zip";

      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch {
      setErr("Export failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function buildParamsFromState(): Record<string, string> {
    const out: Record<string, string> = {};

    const lim = Number(limit);
    if (!Number.isFinite(lim) || lim < 1) throw new Error("Limit must be a positive number.");
    out.limit = String(Math.min(10000, Math.floor(lim)));
    out.order = order;

    if (createdAfter.trim()) out.createdAfter = createdAfter.trim();
    if (createdBefore.trim()) out.createdBefore = createdBefore.trim();

    if (actionHashHex.trim()) out.actionHashHex = actionHashHex.trim().toLowerCase();
    if (challengeId.trim()) out.challengeId = challengeId.trim();
    if (purpose) out.purpose = purpose;
    if (decision) out.decision = decision;

    return out;
  }

  function setPreset(hours: number) {
    setCreatedAfter(isoMinusHours(hours));
    setCreatedBefore(isoNow());
    setLimit("500");
    setOrder("desc");
    setActionHashHex("");
    setChallengeId("");
    setPurpose("");
    setDecision("");
  }

  const planInfo = normalizePlan(me?.customer.plan);
  const isPending = planInfo.isPending;

  return (
    <div className="console">
      <Head>
        <title>Exports · PBI Console</title>
        <meta
          name="description"
          content="Download signed, offline-verifiable evidence export packs for audit, compliance, and incident response."
        />
        <link rel="canonical" href={pageUrl} />
        <meta name="robots" content="index,follow" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#05070e" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Kojib" />
        <meta property="og:title" content="Exports · PBI Console" />
        <meta property="og:description" content="Signed evidence export packs for audit and compliance." />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={ogImage} />
      </Head>

      <style>{css}</style>
      <div className="bg" aria-hidden />
      <div className="shell">
        <TopBar auth={auth} onHome={() => router.push("/console")} active="exports" pending={isPending} />

        <div className="main">
          <section className="hero">
            <div className="heroGrid">
              <div className="leftCol">
                <div className="pill">
                  <span className="pillDot" />
                  Compliance · Exports
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
                  Download signed, offline-verifiable evidence packs (manifest + hashes + Ed25519 signature).{" "}
                  <a className="rolloutLink" href={ROLLOUT_URL}>
                    Rollout guide →
                  </a>
                </p>

                <div className="ctaRow">
                  <a className="btnGhost" href="/console">
                    Console →
                  </a>
                  <a className="btnGhost" href={WEBHOOKS_URL}>
                    Webhooks →
                  </a>
                  <a className="btnGhost" href={API_DOCS} target="_blank" rel="noreferrer">
                    API docs →
                  </a>
                </div>

                {isPending ? (
                  <div className="pendingCallout" role="status">
                    <div className="pendingTitle">Exports locked</div>
                    <div className="pendingBody">
                      Your account is in <b>pending</b> state. Activate billing to generate exports.
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
                    <div className="kicker">Export pack</div>
                    <div className="sideTitle">Offline verification</div>
                  </div>
                  <div className="tag">Ed25519</div>
                </div>

                <div className="sideBody">
                  <div className="miniRow">
                    <div className="miniK">Contains</div>
                    <div className="miniV">receipts.ndjson</div>
                  </div>
                  <div className="miniRow">
                    <div className="miniK">Manifest</div>
                    <div className="miniV">manifest.json</div>
                  </div>
                  <div className="miniRow">
                    <div className="miniK">Signature</div>
                    <div className="miniV">manifest.sig.json</div>
                  </div>
                  <div className="miniRow">
                    <div className="miniK">Verifier</div>
                    <div className="miniV">verification.json</div>
                  </div>

                  <div className="divider" />

                  <div className="hint">
                    Use explicit time windows for large exports. Packs are designed for audit, compliance, and incident response.
                  </div>
                </div>
              </aside>
            </div>
          </section>

          <section className="panel">
            <div className="panelHead">
              <div>
                <div className="kicker">Quick exports</div>
                <div className="panelTitle">Presets</div>
              </div>
              <div className="panelMeta">One click</div>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <div className="ctaRow">
                <button
                  className="btnPrimary"
                  disabled={busy || isPending}
                  onClick={() =>
                    void download({
                      limit: "500",
                      order: "desc",
                      createdAfter: isoMinusHours(24),
                      createdBefore: isoNow()
                    })
                  }
                  type="button"
                >
                  {busy ? "Preparing…" : "Last 24 hours"}
                </button>

                <button
                  className="btnGhost"
                  disabled={busy || isPending}
                  onClick={() =>
                    void download({
                      limit: "500",
                      order: "desc",
                      createdAfter: isoMinusHours(24 * 7),
                      createdBefore: isoNow()
                    })
                  }
                  type="button"
                >
                  Last 7 days
                </button>

                <button className="btnGhost" disabled={busy || isPending} onClick={() => setPreset(24)} type="button">
                  Load 24h into filters →
                </button>
              </div>

              <div className="panelMeta">
                Presets generate signed exports using your portal session (cookie-auth). No API keys are exposed in the browser.
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panelHead">
              <div>
                <div className="kicker">Advanced</div>
                <div className="panelTitle">Filtered export</div>
              </div>
              <div className="panelMeta">Time windows + filters</div>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <div className="formGrid">
                <div className="field">
                  <div className="label">Limit</div>
                  <input
                    className="textInput"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    placeholder="500"
                    disabled={busy || isPending}
                  />
                  <div className="help">Max 10,000. Large exports may require explicit time windows.</div>
                </div>

                <div className="field">
                  <div className="label">Order</div>
                  <select
                    className="selectInput"
                    value={order}
                    onChange={(e) => setOrder(e.target.value as ExportOrder)}
                    disabled={busy || isPending}
                  >
                    <option value="desc">desc (newest first)</option>
                    <option value="asc">asc (oldest first)</option>
                  </select>
                  <div className="help">Stable ordering for audit review.</div>
                </div>

                <div className="field">
                  <div className="label">createdAfter (ISO)</div>
                  <input
                    className="textInput"
                    value={createdAfter}
                    onChange={(e) => setCreatedAfter(e.target.value)}
                    placeholder={isoMinusHours(24)}
                    disabled={busy || isPending}
                  />
                  <div className="help">Inclusive. Use ISO timestamps.</div>
                </div>

                <div className="field">
                  <div className="label">createdBefore (ISO)</div>
                  <input
                    className="textInput"
                    value={createdBefore}
                    onChange={(e) => setCreatedBefore(e.target.value)}
                    placeholder={isoNow()}
                    disabled={busy || isPending}
                  />
                  <div className="help">Exclusive. Use ISO timestamps.</div>
                </div>

                <div className="field">
                  <div className="label">actionHashHex</div>
                  <input
                    className="textInput"
                    value={actionHashHex}
                    onChange={(e) => setActionHashHex(e.target.value)}
                    placeholder="64 hex chars"
                    disabled={busy || isPending}
                  />
                  <div className="help">Optional. Filters to a specific protected action binding.</div>
                </div>

                <div className="field">
                  <div className="label">challengeId</div>
                  <input
                    className="textInput"
                    value={challengeId}
                    onChange={(e) => setChallengeId(e.target.value)}
                    placeholder="uuid"
                    disabled={busy || isPending}
                  />
                  <div className="help">Optional. Useful for investigations.</div>
                </div>

                <div className="field">
                  <div className="label">purpose</div>
                  <select
                    className="selectInput"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value as ExportPurpose)}
                    disabled={busy || isPending}
                  >
                    <option value="">(any)</option>
                    <option value="ACTION_COMMIT">ACTION_COMMIT</option>
                    <option value="ARTIFACT_AUTHORSHIP">ARTIFACT_AUTHORSHIP</option>
                    <option value="EVIDENCE_SUBMIT">EVIDENCE_SUBMIT</option>
                    <option value="ADMIN_DANGEROUS_OP">ADMIN_DANGEROUS_OP</option>
                  </select>
                  <div className="help">Optional. Limits to a purpose category.</div>
                </div>

                <div className="field">
                  <div className="label">decision</div>
                  <select
                    className="selectInput"
                    value={decision}
                    onChange={(e) => setDecision(e.target.value as ExportDecision)}
                    disabled={busy || isPending}
                  >
                    <option value="">(any)</option>
                    <option value="PBI_VERIFIED">PBI_VERIFIED</option>
                    <option value="FAILED">FAILED</option>
                    <option value="EXPIRED">EXPIRED</option>
                    <option value="REPLAYED">REPLAYED</option>
                  </select>
                  <div className="help">Optional. Filter by outcome.</div>
                </div>
              </div>

              <div className="ctaRow">
                <button
                  className="btnPrimary"
                  disabled={busy || isPending}
                  onClick={() => {
                    try {
                      const params = buildParamsFromState();
                      void download(params);
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : "Invalid parameters.");
                    }
                  }}
                  type="button"
                >
                  {busy ? "Preparing…" : "Download export"}
                </button>

                <button className="btnGhost" disabled={busy || isPending} onClick={() => setPreset(24)} type="button">
                  Reset filters →
                </button>

                <a className="btnGhost" href={ROLLOUT_URL}>
                  Rollout guide →
                </a>
              </div>

              <div className="panelMeta">
                Export contents: receipts.ndjson, policy.snapshot.json, manifest.json, manifest.sig.json, verification.json (and optional trust snapshot).
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panelHead">
              <div>
                <div className="kicker">Verification</div>
                <div className="panelTitle">How to validate an export</div>
              </div>
              <div className="panelMeta">Offline</div>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <div className="panelMeta">
                The manifest is signed using Ed25519. File hashes are recorded in manifest.json. Consumers can verify integrity without any external
                dependency.
              </div>

              <pre className="pbiCode">{`Verify steps:
1) Compute SHA-256 for each file in the zip and compare against manifest.json
2) Verify manifest.sig.json signature against the canonical manifest.json bytes
3) Pin signing key out-of-band (keyId/publicKey) per your internal policy`}</pre>

              <div className="panelMeta">
                For regulated environments, archive the ZIP in WORM storage and record the export timestamp and filters used.
              </div>
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
        <a className="navLink" href="/console">
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

      {/* keep auth in type-space; not shown */}
      <span style={{ display: "none" }}>{auth}</span>
    </header>
  );
}

const css = `
/* Minimal shared shell. Prefer your existing console.css/global styles. */
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
