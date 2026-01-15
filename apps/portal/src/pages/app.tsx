import { useEffect, useMemo, useState } from "react";
import { apiJson } from "../lib/api";
import type { ApiError } from "../lib/api";

type Me = { customer: { id: string; email: string; plan: string; quotaPerMonth: string } };
type ApiKeyRow = { id: string; label: string; plan: string; quota_per_month: string; is_active: boolean; created_at: string };
type UsageRow = { month_key: string; kind: string; total: string };

function fmtInt(x: string): string {
  const n = Number(x);
  if (!Number.isFinite(n)) return x;
  return new Intl.NumberFormat().format(n);
}

function monthLabel(mk: string): string {
  const [y, m] = mk.split("-");
  if (!y || !m) return mk;
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString(undefined, { month: "short", year: "numeric" });
}

export default function Home() {
  const [me, setMe] = useState<Me | null>(null);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [rawKey, setRawKey] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<null | "createKey" | "checkout">(null);
  const [toast, setToast] = useState<string>("");
  const [fatal, setFatal] = useState<string>("");

  async function load(): Promise<void> {
    const m = await apiJson<Me>("/v1/portal/me");
    setMe(m);

    const k = await apiJson<{ apiKeys: ApiKeyRow[] }>("/v1/portal/api-keys");
    setKeys(k.apiKeys);

    const u = await apiJson<{ rows: UsageRow[] }>("/v1/portal/usage");
    setUsage(u.rows);
  }

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (e: unknown) {
        const err = e as ApiError;
        if (err.status === 401 || err.status === 403) {
          window.location.href = "/login";
          return;
        }
        setFatal(err.message || "API temporarily unavailable.");
        // eslint-disable-next-line no-console
        console.error("portal load failed", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function createKey(): Promise<void> {
    setBusy("createKey");
    setRawKey("");
    try {
      const r = await apiJson<{ ok: true; rawApiKey: string }>("/v1/portal/api-keys", {
        method: "POST",
        body: JSON.stringify({ label: "Portal Key" })
      });
      setRawKey(r.rawApiKey);
      setToast("API key created (shown once).");
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function revokeKey(id: string): Promise<void> {
    await apiJson<{ ok: true }>(`/v1/portal/api-keys/${id}`, { method: "DELETE" });
    setToast("Key revoked.");
    await load();
  }

  async function checkout(priceId: string): Promise<void> {
    const pid = priceId.trim();
    if (!pid) {
      setToast("Missing Stripe price id. Set NEXT_PUBLIC_STRIPE_PRICE_* env.");
      return;
    }
    setBusy("checkout");
    try {
      const r = await apiJson<{ url: string }>("/v1/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ priceId: pid })
      });
      window.location.href = r.url;
    } finally {
      setBusy(null);
    }
  }

  const plan = me?.customer.plan ?? "unknown";
  const quota = me?.customer.quotaPerMonth ?? "0";

  const usageByMonth = useMemo(() => {
    const map = new Map<string, { challenge: string; verify: string }>();
    for (const r of usage) {
      const prev = map.get(r.month_key) ?? { challenge: "0", verify: "0" };
      if (r.kind === "challenge") prev.challenge = r.total;
      if (r.kind === "verify") prev.verify = r.total;
      map.set(r.month_key, prev);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] > b[0] ? -1 : 1)).slice(0, 6);
  }, [usage]);

  const curMonth = usageByMonth[0]?.[0] ?? "";
  const curUsage = usageByMonth[0]?.[1] ?? { challenge: "0", verify: "0" };

  async function copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setToast("Copied.");
    } catch {
      setToast("Copy failed (browser permissions).");
    }
  }

  if (loading) return null;

  // If API is down, show a clean page (no redirect loop)
  if (fatal) {
    return (
      <div className="pbi">
        <div className="bg" aria-hidden />
        <div className="shell">
          <div className="card">
            <div className="cardTitle">Client Portal temporarily unavailable</div>
            <div className="cardSub" style={{ marginTop: 8 }}>
              {fatal}
            </div>
            <div className="divider" />
            <button className="btnPrimary" onClick={() => window.location.reload()}>
              Refresh
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!me) return null;

  return (
    <div className="pbi">
      <div className="bg" aria-hidden />

      <div className="shell">
        <header className="top">
          <div className="brand">
            <div className="mark" aria-hidden>
              <span className="markGlow" />
              <span className="markDot" />
            </div>
            <div className="brandText">
              <div className="brandTitle">PBI Client Control Panel</div>
              <div className="brandSub">Keys • Metering • Receipts • Billing</div>
            </div>
          </div>

          <div className="topRight">
            <div className="badge">
              <span className={`planDot planDot_${plan}`} />
              <span className="badgeText">{plan.toUpperCase()}</span>
              <span className="badgeSep" />
              <span className="badgeText">Quota {fmtInt(quota)}/mo</span>
            </div>

            <a className="ghostBtn" href="/billing" style={{ textDecoration: "none" }}>
              Billing <span className="chev">→</span>
            </a>
          </div>
        </header>

        <section className="hero">
          <div className="heroCard">
            <div className="heroRow">
              <div className="heroLeft">
                <div className="pill">
                  <span className="pillDot" />
                  <span>Authenticated</span>
                </div>
                <h1 className="h1">{me.customer.email}</h1>
                <p className="p">
                  Presence is enforced at the edge. Keys mint access. Usage is metered. Receipts are audit-ready.
                </p>

                <div className="kpiRow">
                  <div className="kpi">
                    <div className="kpiLabel">This month</div>
                    <div className="kpiValue">{curMonth ? monthLabel(curMonth) : "—"}</div>
                  </div>
                  <div className="kpi">
                    <div className="kpiLabel">Challenges</div>
                    <div className="kpiValue">{fmtInt(curUsage.challenge)}</div>
                  </div>
                  <div className="kpi">
                    <div className="kpiLabel">Verifications</div>
                    <div className="kpiValue">{fmtInt(curUsage.verify)}</div>
                  </div>
                </div>
              </div>

              <div className="heroRight">
                <div className="callout">
                  <div className="calloutTitle">Production-grade presence gates</div>
                  <div className="calloutBody">
                    Wrap any high-risk endpoint with a single ceremony:
                    <span className="monoInline">challenge → WebAuthn → verify → receipt</span>.
                  </div>
                  <div className="calloutFoot">No accounts. No passwords. Just cryptographic presence.</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid">
          <div className="card">
            <div className="cardTop">
              <div>
                <div className="cardTitle">API Keys</div>
                <div className="cardSub">Create a key (shown once). Revoke instantly.</div>
              </div>
              <button className="btnPrimary" onClick={createKey} disabled={busy !== null}>
                {busy === "createKey" ? "Creating…" : "Create key"}
              </button>
            </div>

            {rawKey ? (
              <div className="keyReveal">
                <div className="keyRevealTop">
                  <div className="pill pillSmall">RAW KEY (show once)</div>
                  <button className="btn" onClick={() => copy(rawKey)}>Copy</button>
                </div>
                <pre className="mono">{rawKey}</pre>
                <div className="hint">Store this securely. If lost, revoke + mint a new key.</div>
              </div>
            ) : null}

            <div className="list">
              {keys.length === 0 ? (
                <div className="empty">
                  <div className="emptyTitle">No keys yet</div>
                  <div className="emptySub">Create your first key to start integrating PBI.</div>
                </div>
              ) : (
                keys.map((k) => (
                  <div key={k.id} className="rowItem">
                    <div className="rowLeft">
                      <div className="rowTitle">
                        {k.label}
                        {!k.is_active ? <span className="tag">revoked</span> : null}
                      </div>
                      <div className="rowMeta">
                        <span className="monoInline">id</span> {k.id.slice(0, 8)}… · {new Date(k.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="rowRight">
                      <button className="btn" onClick={() => copy(k.id)}>Copy ID</button>
                      <button className="btnDanger" onClick={() => revokeKey(k.id)}>Revoke</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <div className="cardTop">
              <div>
                <div className="cardTitle">Usage</div>
                <div className="cardSub">Metered by unit: challenge + verify.</div>
              </div>
              <a className="btn" href="/billing" style={{ textDecoration: "none" }}>View billing</a>
            </div>

            <div className="usageTable">
              <div className="usageHead">
                <div>Month</div>
                <div style={{ textAlign: "right" }}>Challenges</div>
                <div style={{ textAlign: "right" }}>Verifies</div>
              </div>
              {usageByMonth.length === 0 ? (
                <div className="usageEmpty">No usage yet.</div>
              ) : (
                usageByMonth.map(([mk, v]) => (
                  <div className="usageRow" key={mk}>
                    <div className="usageMonth">{monthLabel(mk)}</div>
                    <div className="usageNum">{fmtInt(v.challenge)}</div>
                    <div className="usageNum">{fmtInt(v.verify)}</div>
                  </div>
                ))
              )}
            </div>

            <div className="divider" />

            <div className="upgrade">
              <div className="upgradeTitle">Upgrade plan</div>
              <div className="upgradeSub">Instant checkout. Quotas apply automatically via webhook.</div>

              <div className="plans">
                <button className="planBtn" onClick={() => checkout(process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER ?? "")} disabled={busy !== null}>
                  <div className="planName">Starter</div>
                  <div className="planDesc">Ship presence gates fast.</div>
                </button>
                <button className="planBtn" onClick={() => checkout(process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? "")} disabled={busy !== null}>
                  <div className="planName">Pro</div>
                  <div className="planDesc">Higher throughput + more automation.</div>
                </button>
                <button className="planBtn planBtnPrimary" onClick={() => checkout(process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE ?? "")} disabled={busy !== null}>
                  <div className="planName">Enterprise</div>
                  <div className="planDesc">Non-repudiable presence at scale.</div>
                </button>
              </div>

              <div className="hint">
                Need custom pricing or annual invoicing? <span className="monoInline">support@kojib.com</span>
              </div>
            </div>
          </div>
        </section>

        <footer className="foot">
          <div className="footLeft">
            <span className="monoInline">PBI</span> · Presence-Bound Identity · receipts are cryptographically auditable.
          </div>
          <div className="footRight">
            <a className="footLink" href="/privacy">Privacy</a>
            <a className="footLink" href="/terms">Terms</a>
          </div>
        </footer>
      </div>

      {toast ? (
        <div className="toast" role="status" onAnimationEnd={() => setToast("")}>
          {toast}
        </div>
      ) : null}
    </div>
  );
}