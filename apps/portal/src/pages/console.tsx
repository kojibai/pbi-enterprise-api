import { useEffect, useMemo, useState } from "react";
import { apiJson } from "../lib/api";

type Me = { customer: { id: string; email: string; plan: string; quotaPerMonth: string } };
type ApiKeyRow = { id: string; label: string; plan: string; quota_per_month: string; is_active: boolean; created_at: string };
type UsageRow = { month_key: string; kind: string; total: string };

type PlanKey = "starter" | "pro" | "enterprise";

const PLAN_PRICE: Record<PlanKey, string> = {
  starter: "$99",
  pro: "$499",
  enterprise: "$1,999"
};

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return d;
  }
}

function toNum(s: string) {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export default function Home() {
  const [me, setMe] = useState<Me | null>(null);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [rawKey, setRawKey] = useState<string>("");

  const [busy, setBusy] = useState<string>("");
  const [err, setErr] = useState<string>("");

  const priceIds = useMemo(
    () => ({
      starter: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER ?? "",
      pro: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? "",
      enterprise: process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE ?? ""
    }),
    []
  );

  async function load() {
    const m = await apiJson<Me>("/v1/portal/me");
    setMe(m);

    const k = await apiJson<{ apiKeys: ApiKeyRow[] }>("/v1/portal/api-keys");
    setKeys(k.apiKeys);

    const u = await apiJson<{ rows: UsageRow[] }>("/v1/portal/usage");
    setUsage(u.rows);
  }

  useEffect(() => {
    load().catch(() => {
      window.location.href = "/login";
    });
  }, []);

  async function createKey() {
    setErr("");
    setRawKey("");
    setBusy("create");
    try {
      const r = await apiJson<{ ok: true; rawApiKey: string }>("/v1/portal/api-keys", {
        method: "POST",
        body: JSON.stringify({ label: "Portal Key" })
      });
      setRawKey(r.rawApiKey);
      await load();
    } catch {
      setErr("Could not create key. Try again.");
    } finally {
      setBusy("");
    }
  }

  async function revokeKey(id: string) {
    setErr("");
    setBusy(`revoke:${id}`);
    try {
      await apiJson<{ ok: true }>(`/v1/portal/api-keys/${id}`, { method: "DELETE" });
      await load();
    } catch {
      setErr("Could not revoke key. Try again.");
    } finally {
      setBusy("");
    }
  }

  async function checkout(plan: PlanKey) {
    setErr("");
    const priceId = priceIds[plan];
    if (!priceId) {
      setErr(`Missing Stripe Price ID for ${plan.toUpperCase()}.`);
      return;
    }

    setBusy(`checkout:${plan}`);
    try {
      const r = await apiJson<{ url: string }>("/v1/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ priceId })
      });
      window.location.href = r.url;
    } catch {
      setErr("Checkout failed. Try again.");
      setBusy("");
    }
  }

  const planUpper = (me?.customer.plan ?? "starter").toUpperCase();
  const quota = me?.customer.quotaPerMonth ?? "—";

  const usageTotal = useMemo(() => usage.reduce((s, r) => s + toNum(r.total), 0), [usage]);
  const usageByKind = useMemo(() => {
    const out: Record<string, number> = {};
    for (const r of usage) out[r.kind] = (out[r.kind] ?? 0) + toNum(r.total);
    return out;
  }, [usage]);

  const activeKeys = useMemo(() => keys.filter((k) => k.is_active), [keys]);

  // normalized key so we can safely index PLAN_PRICE
  const currentPlanKey = (me?.customer.plan ?? "starter").toLowerCase() as PlanKey;

  function copy(text: string) {
    try {
      void navigator.clipboard.writeText(text);
    } catch {}
  }

  if (!me) return null;

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
              <div className="brandSub">Control Panel</div>
            </div>
          </div>

          <nav className="nav">
            <a className="navLink" href="/api-keys">
              API Keys
            </a>
            <a className="navLink" href="/billing">
              Billing
            </a>
            <a className="navLink" href="/terms">
              Terms
            </a>
            <a className="navLink" href="/privacy">
              Privacy
            </a>
          </nav>
        </header>

        <div className="main">
          {/* HERO */}
          <section className="hero">
            <div className="heroGrid">
              <div className="leftCol">
                <div className="pill">
                  <span className="pillDot" />
                  PBI Client Control Panel
                </div>

                <h1 className="h1 email">{me.customer.email}</h1>
                <p className="lead">Keys mint access. Usage is metered. Invoices are auditable.</p>

                <div className="kpiRow">
                  <KPI label="Plan" value={planUpper} />
                  <KPI label="Quota" value={`${quota}/mo`} />
                  <KPI label="Usage total" value={usageTotal.toLocaleString()} />
                  <KPI label="Active keys" value={activeKeys.length.toString()} />
                </div>

                {err ? <div className="error">{err}</div> : null}

                <div className="ctaRow">
                  <button className="btnPrimary" onClick={createKey} disabled={!!busy}>
                    {busy === "create" ? "Creating…" : "Create API key"}
                  </button>
                  <button className="btnGhost" onClick={() => load()} disabled={!!busy}>
                    Refresh
                  </button>
                </div>

                {rawKey ? (
                  <div className="secretBox" role="status" aria-live="polite">
                    <div className="secretTop">
                      <div>
                        <div className="secretTitle">New API key (shown once)</div>
                        <div className="secretSub">Copy it now. You won’t be able to view it again.</div>
                      </div>
                      <button className="btnGhost" onClick={() => copy(rawKey)}>
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

                {/* MOBILE: one-screen “app” dashboard actions */}
                <div className="mobileQuick">
                  <div className="mobileCard">
                    <div className="kicker">API Keys</div>
                    <div className="mobileTitle">Manage keys</div>
                    <div className="hint">Create, revoke, and view all keys.</div>
                    <a className="linkBtn" href="/api-keys">
                      Open API Keys →
                    </a>
                  </div>

                  <div className="mobileCard">
                    <div className="kicker">Usage</div>
                    <div className="mobileTitle">View metering</div>
                    <div className="hint">Monthly challenge + verify totals.</div>
                    <a className="linkBtn" href="/api-keys#usage">
                      Open Usage →
                    </a>
                  </div>

                  <div className="mobileCard mobileCardWide">
                    <div className="kicker">Billing</div>
                    <div className="mobileTitle">Upgrade plan</div>
                    <div className="hint">
                      Current: {currentPlanKey.toUpperCase()} · {PLAN_PRICE[currentPlanKey]}/mo
                    </div>
                    <a className="linkBtnPrimary" href="/billing">
                      Open Billing →
                    </a>

                    <div className="inlinePlans">
                      <button
                        className="miniBtn"
                        disabled={!!busy || !priceIds.starter}
                        onClick={() => checkout("starter")}
                        type="button"
                      >
                        Starter
                      </button>
                      <button
                        className="miniBtn"
                        disabled={!!busy || !priceIds.pro}
                        onClick={() => checkout("pro")}
                        type="button"
                      >
                        Pro
                      </button>
                      <button
                        className="miniBtnPrimary"
                        disabled={!!busy || !priceIds.enterprise}
                        onClick={() => checkout("enterprise")}
                        type="button"
                      >
                        Enterprise
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Desktop-only: Billing / Upgrade */}
              <aside className="side">
                <div className="sideTop">
                  <div>
                    <div className="kicker">Billing</div>
                    <div className="sideTitle">Upgrade plan</div>
                  </div>
                  <div className="tag">{currentPlanKey.toUpperCase()}</div>
                </div>

                <div className="sideBody">
                  <div className="miniRow">
                    <div className="miniK">Monthly quota</div>
                    <div className="miniV">{quota}</div>
                  </div>
                  <div className="miniRow">
                    <div className="miniK">Metering</div>
                    <div className="miniV">challenge + verify</div>
                  </div>

                  <div className="divider" />

                  <div className="priceTitle">Plans</div>

                  <div className="planBtns">
                    <button className="btnGhost" disabled={!!busy || !priceIds.starter} onClick={() => checkout("starter")} type="button">
                      Starter {PLAN_PRICE.starter}/mo
                    </button>
                    <button className="btnGhost" disabled={!!busy || !priceIds.pro} onClick={() => checkout("pro")} type="button">
                      Pro {PLAN_PRICE.pro}/mo
                    </button>
                    <button
                      className="btnPrimary"
                      disabled={!!busy || !priceIds.enterprise}
                      onClick={() => checkout("enterprise")}
                      type="button"
                    >
                      Enterprise {PLAN_PRICE.enterprise}/mo
                    </button>
                  </div>

                  <div className="hint">Stripe checkout opens in the same tab. Plan limits apply automatically to all API keys.</div>
                </div>
              </aside>
            </div>
          </section>

          {/* DESKTOP: tables */}
          <section className="grid">
            {/* API Keys */}
            <div className="panel">
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

                {keys.length === 0 ? (
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
                      </div>
                      <div className="cell">{fmtDate(k.created_at)}</div>
                      <div className="cell">
                        {k.is_active ? <span className="status ok">ACTIVE</span> : <span className="status off">REVOKED</span>}
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
            </div>

            {/* Usage */}
            <div className="panel">
              <div className="panelHead">
                <div>
                  <div className="kicker">Metering</div>
                  <div className="panelTitle">Usage</div>
                </div>
                <div className="panelMeta">{usageTotal.toLocaleString()} total</div>
              </div>

              <div className="usageKpis">
                {Object.keys(usageByKind).length === 0 ? (
                  <div className="muted">No usage yet.</div>
                ) : (
                  Object.entries(usageByKind).map(([kind, total]) => (
                    <div key={kind} className="usageChip">
                      <div className="usageKind">{kind}</div>
                      <div className="usageTotal">{total.toLocaleString()}</div>
                    </div>
                  ))
                )}
              </div>

              <div className="table" style={{ marginTop: 12 }}>
                <div className="trow head" style={{ gridTemplateColumns: "1fr 1fr .6fr" }}>
                  <div className="cell">Month</div>
                  <div className="cell">Kind</div>
                  <div className="cell right">Total</div>
                </div>

                {usage.length === 0 ? (
                  <div className="trow" style={{ gridTemplateColumns: "1fr 1fr .6fr" }}>
                    <div className="cell muted">No usage rows.</div>
                    <div className="cell" />
                    <div className="cell" />
                  </div>
                ) : (
                  usage.map((u, idx) => (
                    <div
                      className="trow"
                      style={{ gridTemplateColumns: "1fr 1fr .6fr" }}
                      key={`${u.month_key}:${u.kind}:${idx}`}
                    >
                      <div className="cell">{u.month_key}</div>
                      <div className="cell">
                        <code className="inlineCode">{u.kind}</code>
                      </div>
                      <div className="cell right">{toNum(u.total).toLocaleString()}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
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
}
.navLink:hover{ transform: translateY(-1px); background: rgba(255,255,255,.09); border-color: rgba(255,255,255,.22); }

/* Mobile nav: single-row scroll */
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

/* Pill + headings */
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
.h1.email{
  overflow-wrap:anywhere;
  word-break: break-word;
}

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
@media (max-width: 420px){
  .h1{ font-size: 26px; }
  .kpiRow{ gap: 8px; }
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

/* Errors + CTAs */
.error{
  margin-top: 10px;
  padding: 10px;
  border-radius: 14px;
  border: 1px solid rgba(255,138,160,.35);
  background: rgba(255,138,160,.10);
  font-size: 13px;
}
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
  max-width:100%;
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
  max-width:100%;
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

/* Secret key box */
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

/* Desktop aside */
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
  max-width:100%;
}
.sideBody{ margin-top: 10px; display:grid; gap: 10px; }
.miniRow{ display:flex; justify-content:space-between; gap:10px; min-width:0; }
.miniK{ font-size: 12px; color: rgba(255,255,255,.62); }
.miniV{ font-weight: 900; overflow-wrap:anywhere; text-align:right; min-width:0; }
.divider{ height: 1px; background: rgba(255,255,255,.10); margin: 4px 0; }
.priceTitle{ font-weight: 950; }
.planBtns{ display:grid; gap: 8px; }
.planBtns button{ width: 100%; }

/* Mobile “one screen dashboard” */
.mobileQuick{ display:none; }
.inlinePlans{ display:none; }

@media (max-width: 980px){
  .side{ display:none; }
  .grid{ display:none; }
  .footer{ display:none; }

  .mobileQuick{
    display:grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 12px;
  }
  .mobileCardWide{ grid-column: 1 / -1; }

  @media (max-width: 380px){
    .mobileQuick{ grid-template-columns: 1fr; }
  }

  .mobileCard{
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,.12);
    background: rgba(0,0,0,.20);
    padding: 12px;
    box-shadow: var(--shadow3);
    min-width:0;
  }
  .mobileTitle{ margin-top: 4px; font-weight: 950; }
  .hint{
    font-size: 12px;
    opacity: .75;
    line-height: 1.5;
    margin-top: 6px;
  }

  .linkBtn, .linkBtnPrimary{
    margin-top: 10px;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    width: 100%;
    border-radius: 16px;
    padding: 11px 14px;
    font-weight: 950;
    text-decoration:none;
  }
  .linkBtn{
    border: 1px solid rgba(255,255,255,.14);
    background: rgba(255,255,255,.06);
    color: rgba(255,255,255,.92);
  }
  .linkBtnPrimary{
    border: 1px solid rgba(120,255,231,.55);
    background: rgba(120,255,231,.95);
    color: #05070e;
  }

  .inlinePlans{
    display:grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
    margin-top: 10px;
  }
  .miniBtn, .miniBtnPrimary{
    border-radius: 14px;
    padding: 10px 10px;
    font-weight: 950;
    font-size: 12px;
    width: 100%;
    border: 1px solid rgba(255,255,255,.14);
    background: rgba(255,255,255,.06);
    color: rgba(255,255,255,.92);
  }
  .miniBtnPrimary{
    border: 1px solid rgba(120,255,231,.55);
    background: rgba(120,255,231,.95);
    color: #05070e;
  }
}

/* Desktop tables */
.grid{ display:grid; grid-template-columns: 1fr; gap: 14px; }

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

.usageKpis{
  margin-top: 10px;
  display:flex;
  gap: 10px;
  flex-wrap: wrap;
}
.usageChip{
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(0,0,0,.20);
  padding: 10px 12px;
  min-width: 0;
  max-width:100%;
}
.usageKind{ font-size: 12px; opacity:.75; }
.usageTotal{ margin-top: 6px; font-weight: 950; }

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

/* Mobile table fallback if ever shown */
@media (max-width: 820px){
  .trow{ grid-template-columns: 1fr; }
  .right{ text-align:left; }
}
`;