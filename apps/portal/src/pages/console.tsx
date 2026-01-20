// pages/console.tsx
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { apiJson } from "../lib/api";

type Me = { customer: { id: string; email: string; plan: string; quotaPerMonth: string } };

type ApiKeyRow = {
  id: string;
  label: string;
  plan: string;
  quota_per_month: string;
  is_active: boolean;
  created_at: string;
  scopes: string[] | null;
  last_used_at: string | null;
  last_used_ip: string | null;
};

type UsageRow = { month_key: string; kind: string; total: string };

type WebhookRow = {
  id: string;
  apiKeyId: string;
  url: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type PlanKey = "starter" | "pro" | "enterprise";

const PLAN_PRICE: Record<PlanKey, string> = {
  starter: "$99",
  pro: "$499",
  enterprise: "$1,999"
};

function normalizePlan(raw: unknown): { planKey: PlanKey; uiLabel: string; isPending: boolean } {
  const s = String(raw ?? "").toLowerCase().trim();
  if (s === "starter") return { planKey: "starter", uiLabel: "Starter", isPending: false };
  if (s === "pro") return { planKey: "pro", uiLabel: "Pro", isPending: false };
  if (s === "enterprise") return { planKey: "enterprise", uiLabel: "Scale", isPending: false };
  if (s === "pending") return { planKey: "starter", uiLabel: "Pending", isPending: true };
  return { planKey: "starter", uiLabel: s ? s.toUpperCase() : "Starter", isPending: false };
}

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return d;
  }
}

function fmtInt(n: number) {
  return n.toLocaleString();
}

function toNum(s: string) {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function latestMonthKey(rows: UsageRow[]): string | null {
  const ks = rows.map((r) => (r.month_key ?? "").trim()).filter(Boolean);
  if (!ks.length) return null;
  ks.sort(); // YYYY-MM sorts naturally
  return ks[ks.length - 1] ?? null;
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

export default function Home() {
  const [me, setMe] = useState<Me | null>(null);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [rawKey, setRawKey] = useState<string>("");

  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [webhookUrl, setWebhookUrl] = useState<string>("");
  const [webhookSecretOnce, setWebhookSecretOnce] = useState<string>("");
  const [webhookRotatedSecretOnce, setWebhookRotatedSecretOnce] = useState<string>("");

  const [exportBusy, setExportBusy] = useState<boolean>(false);
  const [exportErr, setExportErr] = useState<string>("");

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

  async function load(): Promise<void> {
    const m = await apiJson<Me>("/v1/portal/me");
    setMe(m);

    const k = await apiJson<{ apiKeys: ApiKeyRow[] }>("/v1/portal/api-keys");
    setKeys(k.apiKeys);

    const u = await apiJson<{ rows: UsageRow[] }>("/v1/portal/usage");
    setUsage(u.rows);

    // Webhooks are optional for some deployments; do not break console if unavailable.
    try {
      const w = await apiJson<{ webhooks: WebhookRow[] }>("/v1/portal/webhooks");
      setWebhooks(w.webhooks);
    } catch {
      setWebhooks([]);
    }
  }

  useEffect(() => {
    load().catch(() => {
      window.location.href = "/login";
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function copy(text: string) {
    try {
      void navigator.clipboard.writeText(text);
    } catch {}
  }

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

  async function createWebhook() {
    setErr("");
    setWebhookSecretOnce("");
    setWebhookRotatedSecretOnce("");

    const url = webhookUrl.trim();
    if (!url) return;

    setBusy("wh:create");
    try {
      const r = await apiJson<{ ok: true; webhook: WebhookRow; secret: string }>("/v1/portal/webhooks", {
        method: "POST",
        body: JSON.stringify({ url, events: ["receipt.created"], enabled: true })
      });
      setWebhookSecretOnce(r.secret);
      setWebhookUrl("");
      await load();
    } catch {
      setErr("Could not create webhook. Check the URL and try again.");
    } finally {
      setBusy("");
    }
  }

  async function rotateWebhookSecret(id: string) {
    setErr("");
    setWebhookRotatedSecretOnce("");
    setBusy(`wh:rot:${id}`);
    try {
      const r = await apiJson<{ ok: true; secret: string }>(`/v1/portal/webhooks/${id}/rotate-secret`, {
        method: "POST"
      });
      setWebhookRotatedSecretOnce(r.secret);
      await load();
    } catch {
      setErr("Could not rotate webhook secret. Try again.");
    } finally {
      setBusy("");
    }
  }

  async function deleteWebhook(id: string) {
    setErr("");
    setBusy(`wh:del:${id}`);
    try {
      await apiJson<{ ok: true }>(`/v1/portal/webhooks/${id}`, { method: "DELETE" });
      await load();
    } catch {
      setErr("Could not delete webhook. Try again.");
    } finally {
      setBusy("");
    }
  }

  async function downloadExportLast24h() {
    setExportErr("");
    setExportBusy(true);

    try {
      const now = new Date();
      const createdBefore = now.toISOString();
      const createdAfter = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      const qs = new URLSearchParams({
        limit: "500",
        order: "desc",
        createdAfter,
        createdBefore
      });

      const resp = await fetch(`/v1/portal/receipts/export?${qs.toString()}`, {
        method: "GET",
        credentials: "include"
      });

      if (!resp.ok) {
        setExportErr(`Export failed (${resp.status}).`);
        return;
      }

      const blob = await resp.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = "pbi-receipts-export.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch {
      setExportErr("Export failed. Try again.");
    } finally {
      setExportBusy(false);
    }
  }

  const { planKey: currentPlanKey, uiLabel: planLabel, isPending } = normalizePlan(me?.customer.plan);
  const planUpper = planLabel.toUpperCase();

  const quotaPerMonthNum = useMemo(() => {
    const raw = (me?.customer.quotaPerMonth ?? "").replace(/,/g, "").trim();
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [me?.customer.quotaPerMonth]);

  const quotaDisplay = quotaPerMonthNum ? `${fmtInt(quotaPerMonthNum)}/mo` : "—";
  const thisMonthKey = useMemo(() => latestMonthKey(usage), [usage]);

  const usageThisMonth = useMemo(() => {
    if (!thisMonthKey) return 0;
    return usage
      .filter((r) => (r.month_key ?? "").trim() === thisMonthKey)
      .reduce((s, r) => s + toNum(r.total), 0);
  }, [usage, thisMonthKey]);

  const quotaRemaining = useMemo(() => {
    if (!quotaPerMonthNum) return null;
    const left = quotaPerMonthNum - usageThisMonth;
    return left >= 0 ? left : 0;
  }, [quotaPerMonthNum, usageThisMonth]);

  const quotaOver = useMemo(() => {
    if (!quotaPerMonthNum) return null;
    const over = usageThisMonth - quotaPerMonthNum;
    return over > 0 ? over : 0;
  }, [quotaPerMonthNum, usageThisMonth]);

  const activeKeys = useMemo(() => keys.filter((k) => k.is_active), [keys]);

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
            <a className="navLink" href="/usage">
              Usage
            </a>
            <a className="navLink" href="/billing">
              Billing
            </a>

            <a className="navLink" href="https://demo.kojib.com" target="_blank" rel="noreferrer">
              Demo
            </a>

            {!isPending ? (
              <a className="navLink" href="https://tool.kojib.com" target="_blank" rel="noreferrer">
                Attester Tool
              </a>
            ) : null}

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

                <div className="emailRow">
                  <div className="emailPill" title={me.customer.email}>
                    <span className="emailPillDot" aria-hidden />
                    <span className="emailPillText">
                      <EmailText email={me.customer.email} />
                    </span>
                  </div>
                </div>

                <p className="lead">Keys mint access. Usage is metered. Evidence exports are verifiable.</p>

                <div className="kpiRow kpiRow5">
                  <KPI label="Plan" value={planUpper} />
                  <KPI label="Quota" value={quotaDisplay} />
                  <KPI label="This month" value={fmtInt(usageThisMonth)} />
                  <KPI
                    label="Remaining"
                    value={quotaRemaining == null ? "—" : fmtInt(quotaRemaining)}
                    tone={quotaOver != null && quotaOver > 0 ? "danger" : "ok"}
                  />
                  <KPI label="Active keys" value={activeKeys.length.toString()} />
                </div>

                {isPending ? (
                  <div className="pendingCallout" role="status">
                    <div className="pendingTitle">Pending billing activation</div>
                    <div className="pendingBody">
                      Your account is in <b>pending</b> state. Activate billing to enable plan enforcement and unlock enterprise controls.
                    </div>
                    <div className="pendingBtns">
                      <a className="btnPrimary" href="/billing">
                        Activate billing →
                      </a>
                      <a className="btnGhost" href="/api-keys">
                        Manage keys →
                      </a>
                      <a className="btnGhost" href="https://demo.kojib.com" target="_blank" rel="noreferrer">
                        Run demo →
                      </a>
                    </div>
                  </div>
                ) : null}

                {err ? <div className="error">{err}</div> : null}

                <div className="ctaRow">
                  <button className="btnPrimary" onClick={createKey} disabled={!!busy}>
                    {busy === "create" ? "Creating…" : "Create API key"}
                  </button>
                  <button className="btnGhost" onClick={() => load()} disabled={!!busy}>
                    Refresh
                  </button>

                  {!isPending ? (
                    <a className="btnGhost" href="https://tool.kojib.com" target="_blank" rel="noreferrer">
                      Attester →
                    </a>
                  ) : (
                    <a className="btnGhost" href="https://demo.kojib.com" target="_blank" rel="noreferrer">
                      Demo →
                    </a>
                  )}
                </div>

                {rawKey ? (
                  <div className="secretBox" role="status" aria-live="polite">
                    <div className="secretTop">
                      <div>
                        <div className="secretTitle">New API key (shown once)</div>
                        <div className="secretSub">Copy it now. You won’t be able to view it again.</div>
                      </div>
                      <button className="btnGhost" onClick={() => copy(rawKey)} type="button">
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
                      API Keys →
                    </a>
                  </div>

                  <div className="mobileCard">
                    <div className="kicker">Usage</div>
                    <div className="mobileTitle">View metering</div>
                    <div className="hint">Monthly challenge + verify totals.</div>
                    <a className="linkBtn" href="/usage">
                      Usage →
                    </a>
                  </div>

                  <div className="mobileCard mobileCardWide">
                    <div className="kicker">Enterprise</div>
                    <div className="mobileTitle">Webhooks</div>
                    <div className="hint">Push receipt.created to your systems with signed delivery.</div>
                    <a className="linkBtnPrimary" href="#webhooks">
                      Configure →
                    </a>
                  </div>

                  <div className="mobileCard mobileCardWide">
                    <div className="kicker">Compliance</div>
                    <div className="mobileTitle">Export evidence</div>
                    <div className="hint">Offline-verifiable ZIP (manifest + hashes + signature).</div>
                    <button className="linkBtnPrimary" disabled={exportBusy} onClick={downloadExportLast24h} type="button">
                      {exportBusy ? "Preparing…" : "Download (24h) →"}
                    </button>
                    {exportErr ? <div className="hint" style={{ color: "rgba(255,138,160,.95)" }}>{exportErr}</div> : null}
                  </div>

                  <div className="mobileCard mobileCardWide">
                    <div className="kicker">Tools</div>
                    <div className="mobileTitle">{isPending ? "Run demo" : "PBI Attester"}</div>
                    <div className="hint">
                      {isPending
                        ? "Public demo (no keys). Run the presence ceremony end-to-end."
                        : "Run the live presence ceremony end-to-end and mint a receipt."}
                    </div>

                    <a
                      className="linkBtnPrimary"
                      href={isPending ? "https://demo.kojib.com" : "https://tool.kojib.com"}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {isPending ? "Demo →" : "Attester →"}
                    </a>
                  </div>

                  <div className="mobileCard mobileCardWide">
                    <div className="kicker">Billing</div>
                    <div className="mobileTitle">Upgrade plan</div>
                    <div className="hint">
                      Current: {planUpper} · {PLAN_PRICE[currentPlanKey]}/mo
                    </div>
                    <a className="linkBtnPrimary" href="/billing">
                      Billing →
                    </a>

                    <div className="inlinePlans">
                      <button className="miniBtn" disabled={!!busy || !priceIds.starter} onClick={() => checkout("starter")} type="button">
                        Starter
                      </button>
                      <button className="miniBtn" disabled={!!busy || !priceIds.pro} onClick={() => checkout("pro")} type="button">
                        Pro
                      </button>
                      <button
                        className="miniBtnPrimary"
                        disabled={!!busy || !priceIds.enterprise}
                        onClick={() => checkout("enterprise")}
                        type="button"
                      >
                        Scale
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
                  <div className="tag">{planUpper}</div>
                </div>

                <div className="sideBody">
                  <div className="miniRow">
                    <div className="miniK">Monthly quota</div>
                    <div className="miniV">{quotaDisplay}</div>
                  </div>

                  <div className="miniRow">
                    <div className="miniK">This month</div>
                    <div className="miniV">{fmtInt(usageThisMonth)}</div>
                  </div>

                  <div className="miniRow">
                    <div className="miniK">Remaining</div>
                    <div className="miniV">{quotaRemaining == null ? "—" : fmtInt(quotaRemaining)}</div>
                  </div>

                  {quotaOver != null && quotaOver > 0 ? (
                    <div className="miniRow">
                      <div className="miniK">Overage</div>
                      <div className="miniV">{fmtInt(quotaOver)}</div>
                    </div>
                  ) : null}

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
                    <button className="btnPrimary" disabled={!!busy || !priceIds.enterprise} onClick={() => checkout("enterprise")} type="button">
                      Scale {PLAN_PRICE.enterprise}/mo
                    </button>
                  </div>

                  <div className="divider" />

                  <div className="priceTitle">Tools</div>

                  <div className="planBtns">
                    <a className="btnGhost" href="https://demo.kojib.com" target="_blank" rel="noreferrer">
                      Demo →
                    </a>
                    {!isPending ? (
                      <a className="btnPrimary" href="https://tool.kojib.com" target="_blank" rel="noreferrer">
                        Attester →
                      </a>
                    ) : (
                      <a className="btnGhost" href="/billing">
                        Activate billing →
                      </a>
                    )}
                  </div>

                  <div className="hint" style={{ marginTop: 10 }}>
                    Demo is public-safe. Attester Tool is for integration testing (BYOK).
                  </div>
                </div>
              </aside>
            </div>
          </section>

          {/* DESKTOP: ENTERPRISE CONTROLS */}
          <div className="grid">
            <section className="panel" id="webhooks">
              <div className="panelHead">
                <div>
                  <div className="kicker">Enterprise Controls</div>
                  <div className="panelTitle">Webhooks</div>
                </div>
                <div className="panelMeta">{webhooks.length} configured</div>
              </div>

              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                <div className="panelMeta">
                  Push <span style={{ color: "rgba(120,255,231,.92)", fontWeight: 900 }}>receipt.created</span> events to your systems with
                  signed delivery headers. Rotate secrets on schedule and after any incident.
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <input
                    value={webhookUrl}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setWebhookUrl(e.target.value)}
                    placeholder="https://your-app.com/pbi/webhook"
                    className="textInput"
                  />
                  <button className="btnPrimary" disabled={!webhookUrl.trim() || !!busy || isPending} onClick={createWebhook} type="button">
                    {busy === "wh:create" ? "Creating…" : "Create webhook"}
                  </button>
                </div>

                {isPending ? (
                  <div className="pendingCallout" role="status">
                    <div className="pendingTitle">Enterprise controls locked</div>
                    <div className="pendingBody">
                      Activate billing to enable webhook configuration and export access.
                    </div>
                    <div className="pendingBtns">
                      <a className="btnPrimary" href="/billing">
                        Activate billing →
                      </a>
                    </div>
                  </div>
                ) : null}

                {webhookSecretOnce ? (
                  <div className="secretBox" role="status" aria-live="polite">
                    <div className="secretTop">
                      <div>
                        <div className="secretTitle">Webhook secret (shown once)</div>
                        <div className="secretSub">Store this in your webhook verifier. You won’t be able to view it again.</div>
                      </div>
                      <button className="btnGhost" onClick={() => copy(webhookSecretOnce)} type="button">
                        Copy
                      </button>
                    </div>
                    <pre className="secretCode">{webhookSecretOnce}</pre>
                  </div>
                ) : null}

                {webhookRotatedSecretOnce ? (
                  <div className="secretBox" role="status" aria-live="polite">
                    <div className="secretTop">
                      <div>
                        <div className="secretTitle">Rotated webhook secret (shown once)</div>
                        <div className="secretSub">Update your verifier immediately.</div>
                      </div>
                      <button className="btnGhost" onClick={() => copy(webhookRotatedSecretOnce)} type="button">
                        Copy
                      </button>
                    </div>
                    <pre className="secretCode">{webhookRotatedSecretOnce}</pre>
                  </div>
                ) : null}

                <div className="table">
                  <div className="trow head" style={{ gridTemplateColumns: "1.6fr .8fr .6fr .8fr" }}>
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
                      <div key={w.id} className="trow" style={{ gridTemplateColumns: "1.6fr .8fr .6fr .8fr" }}>
                        <div className="cell">
                          <div className="strong">{w.url}</div>
                          <div className="mutedSmall">
                            Created: {fmtDate(w.createdAt)} · Updated: {fmtDate(w.updatedAt)}
                          </div>
                        </div>
                        <div className="cell right">{w.events.join(", ")}</div>
                        <div className="cell right">{w.enabled ? "Yes" : "No"}</div>
                        <div className="cell right" style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                          <button
                            className="btnGhost"
                            disabled={!!busy || isPending}
                            onClick={() => rotateWebhookSecret(w.id)}
                            type="button"
                          >
                            {busy === `wh:rot:${w.id}` ? "Rotating…" : "Rotate"}
                          </button>
                          <button className="btnDanger" disabled={!!busy || isPending} onClick={() => deleteWebhook(w.id)} type="button">
                            {busy === `wh:del:${w.id}` ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="panel" id="export">
              <div className="panelHead">
                <div>
                  <div className="kicker">Compliance</div>
                  <div className="panelTitle">Export evidence pack</div>
                </div>
                <div className="panelMeta">Offline-verifiable ZIP</div>
              </div>

              {exportErr ? <div className="error">{exportErr}</div> : null}

              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                <div className="panelMeta">
                  Exports include <span className="strong">receipts.ndjson</span>, policy snapshot, manifest hashes, and Ed25519 signature for offline
                  verification. Generated using your portal session (no API key exposure in browser).
                </div>

                <button className="btnPrimary" disabled={exportBusy || isPending} onClick={downloadExportLast24h} type="button">
                  {exportBusy ? "Preparing export…" : "Download last 24h export"}
                </button>

                <div className="panelMeta">
                  For large exports, specify an explicit time window (createdAfter/createdBefore). Export limits may enforce time windows for safety.
                </div>
              </div>
            </section>
          </div>

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

function KPI({ label, value, tone }: { label: string; value: string; tone?: "ok" | "danger" }) {
  return (
    <div className={`kpi ${tone === "danger" ? "kpiDanger" : ""}`}>
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
.kpiRow5{ grid-template-columns: repeat(5, minmax(0,1fr)); }

@media (max-width: 980px){
  .kpiRow{ grid-template-columns: 1fr 1fr; }
  .kpiRow5{ grid-template-columns: 1fr 1fr; }
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
.kpiDanger{ border-color: rgba(255,138,160,.35); background: rgba(255,138,160,.08); }

/* Pending callout */
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
  max-width:100%;
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

/* Inputs */
.textInput{
  flex: 1 1 360px;
  min-width: 240px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(0,0,0,.22);
  color: rgba(255,255,255,.92);
  padding: 10px 12px;
  outline: none;
}
.textInput::placeholder{ color: rgba(255,255,255,.45); }
.textInput:focus{
  border-color: rgba(120,255,231,.40);
  box-shadow: 0 0 0 4px rgba(120,255,231,.10);
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
    border: 1px solid rgba(255,255,255,.14);
    background: rgba(255,255,255,.06);
    color: rgba(255,255,255,.92);
    cursor: pointer;
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

/* Desktop panels */
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
`;
