import { useEffect, useState } from "react";
import { apiJson } from "../lib/api";

type Me = { customer: { id: string; email: string; plan: string; quotaPerMonth: string } };
type ApiKeyRow = { id: string; label: string; plan: string; quota_per_month: string; is_active: boolean; created_at: string };
type UsageRow = { month_key: string; kind: string; total: string };

export default function Home() {
  const [me, setMe] = useState<Me | null>(null);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [rawKey, setRawKey] = useState<string>("");

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
      // not logged in
      window.location.href = "/login";
    });
  }, []);

  async function createKey() {
    const r = await apiJson<{ ok: true; rawApiKey: string }>("/v1/portal/api-keys", {
      method: "POST",
      body: JSON.stringify({ label: "Portal Key" })
    });
    setRawKey(r.rawApiKey);
    await load();
  }

  async function revokeKey(id: string) {
    await apiJson<{ ok: true }>(`/v1/portal/api-keys/${id}`, { method: "DELETE" });
    await load();
  }

  async function checkout(priceId: string) {
    const r = await apiJson<{ url: string }>("/v1/stripe/checkout", {
      method: "POST",
      body: JSON.stringify({ priceId })
    });
    window.location.href = r.url;
  }

  if (!me) return null;

  return (
    <div className="wrap">
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div className="pill"><span className="dot" /> PBI Client Control Panel</div>
          <div className="pill">{me.customer.plan.toUpperCase()} · quota {me.customer.quotaPerMonth}/mo</div>
        </div>

        <h1 className="h1" style={{ marginTop: 12 }}>{me.customer.email}</h1>
        <p className="p">Keys mint access. Usage is metered. Invoices are auditable.</p>

        <div className="grid" style={{ marginTop: 14 }}>
          <div className="card" style={{ padding: 16 }}>
            <h2 className="h1" style={{ fontSize: 16 }}>API Keys</h2>
            <p className="p">Create a key (shown once). Revoke instantly.</p>

            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn btnPrimary" onClick={createKey}>Create key</button>
            </div>

            {rawKey ? (
              <div style={{ marginTop: 12 }}>
                <div className="pill">RAW KEY (show once)</div>
                <pre className="mono">{rawKey}</pre>
              </div>
            ) : null}

            <div style={{ marginTop: 12 }}>
              {keys.map((k) => (
                <div key={k.id} className="row" style={{ justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{k.label}</div>
                    <div className="p" style={{ margin: 0 }}>{new Date(k.created_at).toLocaleString()}</div>
                  </div>
                  <button className="btn" onClick={() => revokeKey(k.id)}>Revoke</button>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <h2 className="h1" style={{ fontSize: 16 }}>Usage</h2>
            <p className="p">challenge + verify units by month.</p>
            <pre className="mono">{JSON.stringify(usage, null, 2)}</pre>

            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn" onClick={() => checkout(process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER ?? "")}>Starter</button>
              <button className="btn" onClick={() => checkout(process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? "")}>Pro</button>
              <button className="btn btnPrimary" onClick={() => checkout(process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE ?? "")}>Enterprise</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}