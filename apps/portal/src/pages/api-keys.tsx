import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiJson } from "../lib/api";

type PlanKey = "starter" | "pro" | "enterprise";

type Me = { customer: { id: string; email: string; plan: PlanKey; quotaPerMonth: string } };

// Console-style key rows (tolerant: may include extra fields)
type ApiKeyRow = {
  id: string;
  label: string;
  plan?: PlanKey;
  quota_per_month?: string;
  is_active: boolean;
  created_at: string;

  // optional if your backend ever includes them
  prefix?: string;
  last_used_at?: string | null;
  revoked_at?: string | null;
};

type KeysResp = { apiKeys?: ApiKeyRow[]; keys?: ApiKeyRow[] };

const PLAN_LABEL: Record<PlanKey, string> = {
  starter: "Starter",
  pro: "Pro",
  enterprise: "Scale"
};

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return d;
  }
}

export default function ApiKeysPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [label, setLabel] = useState("");
  const [rawKey, setRawKey] = useState("");
  const [busy, setBusy] = useState<string>("");
  const [err, setErr] = useState<string>("");

  const authed = !!me;

  const currentPlanKey: PlanKey = (me?.customer.plan ?? "starter") as PlanKey;
  const planLabel = PLAN_LABEL[currentPlanKey].toUpperCase();
  const quota = me?.customer.quotaPerMonth ?? "—";

  const activeKeys = useMemo(() => keys.filter((k) => k.is_active), [keys]);
  const revokedKeys = useMemo(() => keys.filter((k) => !k.is_active), [keys]);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const m = await apiJson<Me>("/v1/portal/me");
      setMe(m);

      const k = await apiJson<KeysResp>("/v1/portal/api-keys");
      const list = (k.apiKeys ?? k.keys ?? []) as ApiKeyRow[];
      setKeys(Array.isArray(list) ? list : []);

      setRawKey("");
    } catch {
      // Not signed in → bounce to login to match console behavior
      window.location.href = "/login";
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createKey(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!authed) return;

    setErr("");
    setRawKey("");

    const nm = label.trim();
    if (!nm) {
      setErr("Please enter a label for this key.");
      return;
    }

    setBusy("create");
    try {
      // Console expects { label }
      const r = await apiJson<any>("/v1/portal/api-keys", {
        method: "POST",
        body: JSON.stringify({ label: nm })
      });

      // Primary: rawApiKey (console)
      const secret: string | undefined = r?.rawApiKey ?? r?.apiKey ?? r?.key ?? r?.token ?? r?.secret;
      if (secret) {
        setRawKey(secret);
      } else {
        setErr("API key created, but secret was not returned.");
      }

      setLabel("");
      await load();
    } catch {
      setErr("Could not create key. Try again.");
    } finally {
      setBusy("");
    }
  }

  async function revokeKey(id: string) {
    if (!authed) return;

    setErr("");
    setBusy(`revoke:${id}`);
    try {
      await apiJson<{ ok: true }>(`/v1/portal/api-keys/${encodeURIComponent(id)}`, { method: "DELETE" });
      await load();
    } catch {
      setErr("Could not revoke key. Try again.");
    } finally {
      setBusy("");
    }
  }

  function copy(text: string) {
    try {
      void navigator.clipboard.writeText(text);
    } catch {}
  }

  return (
    <div className="console">
      <style>{css}</style>
      <div className="bg" aria-hidden />

      <div className="shell">
        {/* TOP BAR */}
        <header className="topbar">
          <div className="brand">
            <div className="mark" aria-hidden>
              <span className="markDot" />
            </div>
            <div className="brandText">
              <div className="brandTitle">PBI Client Portal</div>
              <div className="brandSub">API Keys</div>
            </div>
          </div>

          <nav className="nav" aria-label="Portal navigation">
            <Link className="navLink" href="/console">
              Dashboard
            </Link>
            <Link className="navLink" href="/billing">
              Billing
            </Link>
            <Link className="navLink" href="/terms">
              Terms
            </Link>
            <Link className="navLink" href="/privacy">
              Privacy
            </Link>
          </nav>
        </header>

        <div className="main">
          {/* HERO */}
          <section className="hero">
            <div className="heroGrid">
              <div className="leftCol">
                <div className="pill">
                  <span className="pillDot" />
                  Keys mint access · receipts prove presence
                </div>

                <h1 className="h1 email">{me?.customer.email ?? "—"}</h1>
                <p className="lead">
                  Create keys for server-side calls to PBI. Treat secrets like passwords—store them once, securely. Plan limits apply automatically.
                </p>

                <div className="kpiRow">
                  <KPI label="Plan" value={planLabel} />
                  <KPI label="Quota" value={`${quota}/mo`} />
                  <KPI label="Active keys" value={activeKeys.length.toString()} />
                  <KPI label="Total keys" value={keys.length.toString()} />
                </div>

                {err ? <div className="error">{err}</div> : null}

                {/* Create */}
                <div className="createRow">
                  <form className="formRow" onSubmit={createKey} aria-label="Create API key">
                    <input
                      className="input"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder='Key label (e.g., "payments-prod")'
                      autoComplete="off"
                      spellCheck={false}
                      disabled={!authed || !!busy}
                    />
                    <button className="btnPrimary" type="submit" disabled={!authed || !!busy}>
                      {busy === "create" ? "Creating…" : "Create key"}
                    </button>
                    <button className="btnGhost" type="button" onClick={() => load()} disabled={!!busy}>
                      {loading ? "Refreshing…" : "Refresh"}
                    </button>
                  </form>
                </div>

                {rawKey ? (
                  <div className="secretBox" role="status" aria-live="polite">
                    <div className="secretTop">
                      <div>
                        <div className="secretTitle">New API key (shown once)</div>
                        <div className="secretSub">Copy it now. You won’t be able to view it again.</div>
                      </div>
                      <button className="btnGhost" type="button" onClick={() => copy(rawKey)}>
                        Copy
                      </button>
                    </div>

                    <pre className="secretCode">{rawKey}</pre>

                    <div className="secretFoot">
                      Store as <code className="inlineCode">PBI_API_KEY</code> and send{" "}
                      <code className="inlineCode">Authorization: Bearer &lt;key&gt;</code>.
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Side panel */}
              <aside className="side">
                <div className="sideTop">
                  <div>
                    <div className="kicker">Plan</div>
                    <div className="sideTitle">{PLAN_LABEL[currentPlanKey]}</div>
                  </div>
                  <div className="tag">{planLabel}</div>
                </div>

                <div className="sideBody">
                  <div className="miniRow">
                    <div className="miniK">Quota</div>
                    <div className="miniV">{quota}/mo</div>
                  </div>
                  <div className="miniRow">
                    <div className="miniK">Metering</div>
                    <div className="miniV">challenge + verify</div>
                  </div>

                  <div className="divider" />

                  <div className="hint">
                    Need procurement / SLA / burst capacity? Use <b>Enterprise (PBI Assured)</b> in Billing.
                  </div>

                  <div className="planBtns" style={{ marginTop: 10 }}>
                    <Link className="btnGhostLink" href="/billing">
                      Open Billing →
                    </Link>
                  </div>
                </div>
              </aside>
            </div>
          </section>

          {/* Keys table */}
          <section className="panel">
            <div className="panelHead">
              <div>
                <div className="kicker">Keys</div>
                <div className="panelTitle">API Keys</div>
              </div>
              <div className="panelMeta">{keys.length} total</div>
            </div>

            <div className="table">
              <div className="trow head">
                <div className="cell">Label</div>
                <div className="cell">Created</div>
                <div className="cell">Status</div>
                <div className="cell right">Action</div>
              </div>

              {loading ? (
                <div className="trow">
                  <div className="cell muted">Loading…</div>
                  <div className="cell" />
                  <div className="cell" />
                  <div className="cell" />
                </div>
              ) : keys.length === 0 ? (
                <div className="trow">
                  <div className="cell muted">No keys yet.</div>
                  <div className="cell" />
                  <div className="cell" />
                  <div className="cell" />
                </div>
              ) : (
                keys.map((k) => (
                  <div className="trow" key={k.id}>
                    <div className="cell">
                      <div className="strong">{k.label}</div>
                      <div className="mutedSmall">{k.id}</div>
                      {k.prefix ? (
                        <div className="mutedSmall" style={{ marginTop: 6 }}>
                          <code className="inlineCode">{k.prefix}</code>
                        </div>
                      ) : null}
                    </div>
                    <div className="cell">{fmtDate(k.created_at)}</div>
                    <div className="cell">
                      {k.is_active ? <span className="status ok">ACTIVE</span> : <span className="status off">REVOKED</span>}
                      {k.last_used_at ? <div className="mutedSmall" style={{ marginTop: 6 }}>Last used: {fmtDate(k.last_used_at)}</div> : null}
                    </div>
                    <div className="cell right">
                      {k.is_active ? (
                        <button className="btnDanger" disabled={!!busy} onClick={() => revokeKey(k.id)} type="button">
                          {busy === `revoke:${k.id}` ? "Revoking…" : "Revoke"}
                        </button>
                      ) : (
                        <span className="mutedSmall">—</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Optional: separate revoked list if you want it visually distinct */}
            {!loading && revokedKeys.length > 0 ? (
              <div style={{ marginTop: 14 }}>
                <div className="kicker">History</div>
                <div className="panelTitle" style={{ marginTop: 4 }}>
                  Revoked
                </div>
                <div className="hint">Revoked keys can’t be used again.</div>
              </div>
            ) : null}
          </section>

          <footer className="footer">
            <div>© {new Date().getFullYear()} Kojib · PBI</div>
            <div className="footerLinks">
              <a href="/terms">Terms</a>
              <a href="/privacy">Privacy</a>
              <a href="/billing">Billing</a>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi">
      <div className="kpiLabel">{label}</div>
      <div className="kpiValue">{value}</div>
    </div>
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
  grid-template-columns: 1fr auto;
  align-items:center;
  gap: 10px;
}
.brand{ display:flex; align-items:center; gap: 12px; min-width:0; }
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

/* Mobile nav scroll */
@media (max-width: 820px){
  .topbar{ grid-template-columns: 1fr; gap: 10px; }
  .nav{
    width: 100%;
    overflow-x:auto; overflow-y:hidden; -webkit-overflow-scrolling: touch;
    scrollbar-width:none;
    padding-bottom: 2px;
    justify-content:flex-start;
  }
  .nav::-webkit-scrollbar{ display:none; }
  .navLink{ min-height: 36px; padding: 9px 11px; }
}

/* Hero */
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
.heroGrid > *{ min-width:0; }
.leftCol{ min-width:0; }
@media (max-width: 980px){
  .heroGrid{ grid-template-columns: 1fr; }
}

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

.h1{
  margin-top: 10px;
  margin-bottom: 0;
  font-weight: 950;
  letter-spacing: -0.02em;
  line-height: 1.05;
  font-size: 30px;
}
.h1.email{ overflow-wrap:anywhere; word-break: break-word; }
.lead{
  margin-top: 8px;
  color: rgba(255,255,255,.76);
  font-size: 13px;
  line-height: 1.6;
}

/* KPIs */
.kpiRow{
  margin-top: 10px;
  display:grid;
  grid-template-columns: repeat(4, minmax(0,1fr));
  gap: 10px;
}
@media (max-width: 980px){
  .kpiRow{ grid-template-columns: 1fr 1fr; }
}
.kpi{
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(0,0,0,.22);
  padding: 10px;
  box-shadow: var(--shadow3);
  min-width:0;
}
.kpiLabel{ font-size: 11px; color: rgba(255,255,255,.56); }
.kpiValue{ margin-top: 6px; font-weight: 950; letter-spacing: .2px; }

.error{
  margin-top: 10px;
  padding: 10px;
  border-radius: 14px;
  border: 1px solid rgba(255,138,160,.35);
  background: rgba(255,138,160,.10);
  font-size: 13px;
}

.createRow{ margin-top: 10px; }
.formRow{
  display:flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items:center;
}
.input{
  flex: 1 1 260px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.22);
  padding: 11px 12px;
  color: rgba(255,255,255,.92);
  outline: none;
}
.input::placeholder{ color: rgba(255,255,255,.45); }
.input:focus{ border-color: rgba(120,255,231,.35); }

.btnPrimary{
  border-radius: 16px;
  padding: 11px 14px;
  font-weight: 950;
  border: 1px solid rgba(120,255,231,.55);
  background: rgba(120,255,231,.95);
  color: #05070e;
  cursor: pointer;
  transition: transform .12s ease, filter .12s ease;
}
.btnPrimary:hover{ transform: translateY(-1px); filter: brightness(.99); }
.btnPrimary:disabled{ opacity:.65; cursor:not-allowed; }

.btnGhost, .btnGhostLink{
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
.btnGhost:hover, .btnGhostLink:hover{ transform: translateY(-1px); background: rgba(255,255,255,.09); border-color: rgba(255,255,255,.22); }

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

/* Secret box */
.secretBox{
  margin-top: 12px;
  border-radius: 18px;
  border: 1px solid rgba(120,255,231,.28);
  background: rgba(120,255,231,.08);
  padding: 12px;
  min-width:0;
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
  max-width: 100%;
}
.secretFoot{ margin-top: 10px; font-size: 12px; opacity: .85; }
.inlineCode{
  font-family: var(--mono);
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
}

/* Side */
.side{
  border-radius: 22px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(0,0,0,.26);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  padding: 14px;
  box-shadow: var(--shadow2);
  min-width:0;
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
.miniV{ font-weight: 900; text-align:right; overflow-wrap:anywhere; }
.divider{ height: 1px; background: rgba(255,255,255,.10); margin: 4px 0; }
.hint{ font-size: 12px; opacity:.75; line-height:1.5; }
.planBtns{ display:grid; gap: 8px; }

/* Panel + table */
.panel{
  border-radius: 22px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.06);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: var(--shadow2);
  padding: 16px;
  min-width:0;
}
.panelHead{ display:flex; align-items:flex-start; justify-content:space-between; gap: 12px; flex-wrap: wrap; }
.panelTitle{ margin-top: 4px; font-weight: 950; }
.panelMeta{ font-size: 12px; opacity: .72; }

.table{
  margin-top: 12px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.12);
  overflow:hidden;
}
.trow{
  display:grid;
  grid-template-columns: 1.4fr 1fr .8fr .8fr;
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
.strong{ font-weight: 950; }
.muted{ opacity:.75; }
.mutedSmall{ font-size: 11px; opacity: .6; margin-top: 4px; overflow-wrap:anywhere; }

.status{
  display:inline-flex; align-items:center;
  font-size: 11px; font-weight: 950; letter-spacing: .35px;
  padding: 6px 10px; border-radius: 999px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.20);
}
.status.ok{ border-color: rgba(120,255,231,.28); background: rgba(120,255,231,.08); }
.status.off{ border-color: rgba(255,255,255,.16); opacity: .75; }

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
.footer a{ color: rgba(120,255,231,.9); }
.footer a:hover{ text-decoration: underline; }

@media (max-width: 980px){
  .side{ display:none; }
}
@media (max-width: 820px){
  .trow{ grid-template-columns: 1fr; }
  .right{ text-align:left; }
}
`;