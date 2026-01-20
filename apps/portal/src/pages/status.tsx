// pages/status.tsx
import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { apiJson } from "../lib/api";

const API_DOCS = "https://api.kojib.com/docs";
const DEMO_URL = "https://demo.kojib.com";
const TOOL_URL = "https://tool.kojib.com";
const SITE_URL = "https://pbi.kojib.com";

type AuthState = "unknown" | "logged_out" | "logged_in";
type ComponentKey = "api" | "docs" | "portal" | "demo" | "tool";

type ComponentStatus = {
  key: ComponentKey;
  name: string;
  url?: string; // open target
  status: "operational" | "degraded" | "down" | "unknown";
  detail: string;
  checkedAtISO?: string;
};

type ProbeResponse = {
  ok: boolean;
  code?: number;
  ms?: number;
  url: string;
  checkedAtISO: string;
};

function nowISO(): string {
  return new Date().toISOString();
}

function fmtLocal(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

async function probeKey(key: ComponentKey): Promise<ProbeResponse> {
  const r = await fetch(`/api/probe?key=${encodeURIComponent(key)}`, { method: "GET", cache: "no-store" });
  if (!r.ok) {
    // If the probe endpoint fails, treat as down but keep details meaningful.
    return { ok: false, code: r.status, url: "", checkedAtISO: nowISO() };
  }
  const j = (await r.json()) as ProbeResponse & { error?: string };
  return j;
}

export default function StatusPage() {
  const router = useRouter();
  const [auth, setAuth] = useState<AuthState>("unknown");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await apiJson("/v1/portal/me");
        if (!cancelled) setAuth("logged_in");
      } catch {
        if (!cancelled) setAuth("logged_out");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pageUrl = useMemo(() => `${SITE_URL}/status`, []);
  const ogImage = `${SITE_URL}/pbi_1.png`;

  const apiBase = useMemo(() => {
    return (process.env.NEXT_PUBLIC_PBI_API_BASE ?? "https://api.kojib.com").replace(/\/+$/, "");
  }, []);

  const [loading, setLoading] = useState<boolean>(true);
  const [items, setItems] = useState<ComponentStatus[]>([
    { key: "api", name: "API", status: "unknown", detail: "Pending" },
    { key: "docs", name: "Documentation", status: "unknown", detail: "Pending" },
    { key: "portal", name: "Dashboard", status: "unknown", detail: "Pending" },
    { key: "demo", name: "Demo", status: "unknown", detail: "Pending" },
    { key: "tool", name: "Tooling", status: "unknown", detail: "Pending" }
  ]);

  const [lastRefreshISO, setLastRefreshISO] = useState<string>("");

  async function refresh() {
    setLoading(true);

    // These URLs are used for the "Open →" buttons (not for probing).
    const openTargets: Array<{ key: ComponentKey; name: string; openUrl: string }> = [
      { key: "api", name: "API", openUrl: `${apiBase}/health` },
      { key: "docs", name: "Documentation", openUrl: API_DOCS },
      { key: "portal", name: "Dashboard", openUrl: `${SITE_URL}/` },
      { key: "demo", name: "Demo", openUrl: DEMO_URL },
      { key: "tool", name: "Tooling", openUrl: TOOL_URL }
    ];

    const results: ComponentStatus[] = [];

    // Probe in parallel (faster + “big tech” feel)
    const probes = await Promise.all(
      openTargets.map(async (t) => {
        try {
          const p = await probeKey(t.key);
          return { t, p };
        } catch {
          return { t, p: { ok: false, url: "", checkedAtISO: nowISO() } as ProbeResponse };
        }
      })
    );

    for (const { t, p } of probes) {
      const status: ComponentStatus["status"] = p.ok ? "operational" : "down";

      const detail = p.ok
        ? `Available${typeof p.ms === "number" ? ` · ${p.ms}ms` : ""}`
        : `Unavailable${typeof p.code === "number" ? ` · ${p.code}` : ""}${(p as { error?: string }).error ? ` · ${(p as { error?: string }).error}` : ""}`;

      results.push({
        key: t.key,
        name: t.name,
        url: t.openUrl,
        status,
        detail,
        checkedAtISO: p.checkedAtISO
      });
    }

    // Overall rollup
    const anyDown = results.some((r) => r.status === "down");
    const overallStatus: ComponentStatus["status"] = anyDown ? "degraded" : "operational";

    // Customer-facing rollup: Console is degraded if any upstream dependency is down
    setItems(
      results.map((r) => {
        if (r.key === "portal" && overallStatus !== "operational") {
          return { ...r, status: "degraded", detail: "Degraded · impacted by upstream service availability" };
        }
        return r;
      })
    );

    // Use the newest checkedAt if available, otherwise now
    const newestISO =
      results
        .map((r) => r.checkedAtISO)
        .filter((x): x is string => typeof x === "string" && x.length > 0)
        .sort()
        .slice(-1)[0] ?? nowISO();

    setLastRefreshISO(newestISO);
    setLoading(false);
  }

  useEffect(() => {
    refresh().catch(() => {
      setLastRefreshISO(nowISO());
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  const overall = useMemo(() => {
    const anyDown = items.some((i) => i.status === "down");
    const anyUnknown = items.some((i) => i.status === "unknown");
    if (anyDown) return { label: "Degraded", status: "degraded" as const };
    if (anyUnknown) return { label: "Checking", status: "unknown" as const };
    return { label: "Operational", status: "operational" as const };
  }, [items]);

  return (
    <>
      <Head>
        <title>Status · PBI</title>
        <meta
          name="description"
          content="Live service health for PBI, including API, Console, Documentation, Demo, and Tooling."
        />
        <link rel="canonical" href={pageUrl} />
        <meta name="robots" content="index,follow" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#05070e" />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Kojib" />
        <meta property="og:title" content="Status · PBI" />
        <meta
          property="og:description"
          content="Real-time service availability for PBI: API, Console, Documentation, Demo, and Tooling."
        />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:image" content={ogImage} />
      </Head>

      <div className="pbi-landing">
        <div className="pbi-bg" aria-hidden />
        <div className="pbi-shell">
          <TopBar auth={auth} onHome={() => router.push("/")} />

          <main>
            <section className="pbi-hero" style={{ paddingBottom: 10 }}>
              <div className="pbi-heroGrid">
                <div>
                  <div className="pbi-pill">
                    <span className="pbi-pillDot" />
                    Service Status
                  </div>

                  <h1 className="pbi-h1">
                    Current status: <span>{overall.label}</span>
                  </h1>

                  <p className="pbi-lead">
                    This page provides current availability and performance signals across PBI services. Status reflects real service
                    reachability and is updated through continuous health checks.
                  </p>

                  <div className="pbi-ctaRow">
                    <button className="pbi-btnPrimary" type="button" onClick={refresh} disabled={loading}>
                      {loading ? "Checking…" : "Run a check"} <span aria-hidden>→</span>
                    </button>
                    <a className="pbi-btnGhost" href="/trust">
                      Trust Center
                    </a>
                    <a className="pbi-btnGhost" href="/security">
                      Security
                    </a>
                    <a className="pbi-btnGhost" href={API_DOCS} target="_blank" rel="noreferrer">
                      Documentation
                    </a>
                  </div>

                  <div className="pbi-card" style={{ marginTop: 14 }}>
                    <div className="pbi-proofLabel">Last updated</div>
                    <div className="pbi-cardBody" style={{ marginTop: 6 }}>
                      {fmtLocal(lastRefreshISO)}
                    </div>
                  </div>
                </div>

                <aside className="pbi-side">
                  <div className="pbi-sideTop">
                    <div>
                      <div className="pbi-proofLabel">Services</div>
                      <div className="pbi-sideTitle">Coverage</div>
                    </div>
                    <div className="pbi-sideTag">{overall.label}</div>
                  </div>

                  <div className="pbi-sideList">
                    <Bullet>Public API</Bullet>
                    <Bullet>Documentation</Bullet>
                    <Bullet>Dashboard</Bullet>
                    <Bullet>Demo environment</Bullet>
                    <Bullet>Tooling</Bullet>
                  </div>

                  <div className="pbi-proofLabel" style={{ marginTop: 10 }}>
                    Note: Console status may reflect upstream service impact during incidents.
                  </div>
                </aside>
              </div>
            </section>

            <section className="pbi-section">
              <SectionHead
                kicker="Service health"
                title="Availability by service"
                body="Current availability and response time signals are shown per service."
              />

              <div style={{ display: "grid", gap: 10 }}>
                {items.map((it) => (
                  <StatusRow key={it.key} item={it} />
                ))}
              </div>

              <div className="pbi-card" style={{ marginTop: 14 }}>
                <div className="pbi-cardTitle">Incident response</div>
                <div className="pbi-cardBody" style={{ marginTop: 6 }}>
                  For incident response expectations, escalation paths, and environment guidance, visit Enterprise support at{" "}
                  <a href="/enterprise">/enterprise</a>.
                </div>
              </div>
            </section>

            <Footer />
          </main>
        </div>
      </div>
    </>
  );
}

function StatusRow({ item }: { item: ComponentStatus }) {
  const badge = useMemo(() => {
    const label =
      item.status === "operational"
        ? "Operational"
        : item.status === "degraded"
        ? "Degraded"
        : item.status === "down"
        ? "Down"
        : "Checking";

    const style =
      item.status === "operational"
        ? { background: "rgba(120,255,231,.14)", borderColor: "rgba(120,255,231,.28)" }
        : item.status === "degraded"
        ? { background: "rgba(255,211,138,.12)", borderColor: "rgba(255,211,138,.26)" }
        : item.status === "down"
        ? { background: "rgba(255,138,160,.12)", borderColor: "rgba(255,138,160,.26)" }
        : { background: "rgba(255,255,255,.06)", borderColor: "rgba(255,255,255,.14)" };

    return { label, style };
  }, [item.status]);

  return (
    <div className="pbi-card" style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div className="pbi-cardTitle" style={{ fontSize: 16 }}>
            {item.name}
          </div>
          <div className="pbi-cardBody" style={{ marginTop: 6 }}>
            {item.detail}
          </div>
          <div className="pbi-proofLabel" style={{ marginTop: 8 }}>
            Last updated: {fmtLocal(item.checkedAtISO)}
          </div>
        </div>

        <div style={{ display: "grid", gap: 10, justifyItems: "end" }}>
          <div className="pbi-sideTag" style={{ ...badge.style }}>
            {badge.label}
          </div>
          {item.url ? (
            <a className="pbi-btnGhost" href={item.url} target={item.url.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
              Open →
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TopBar({ auth, onHome }: { auth: AuthState; onHome: () => void }) {
  return (
    <header className="pbi-topbar">
      <div className="pbi-brand" role="button" tabIndex={0} onClick={onHome} onKeyDown={(e) => (e.key === "Enter" ? onHome() : null)}>
        <div className="pbi-mark" aria-hidden>
          <span className="pbi-markDot" />
        </div>
        <div>
          <div className="pbi-brandTitle">PBI</div>
          <div className="pbi-brandSub">Presence-Bound Identity</div>
        </div>
      </div>

      <nav className="pbi-nav" aria-label="Primary">
        <a href="/why">Why</a>
        <a href="/developers">Developers</a>
        <a href="/customers">Customers</a>
        <a href="/pricing">Pricing</a>
        <a href="/enterprise">Enterprise</a>
        <a href="/trust">Trust</a>
        <a href={API_DOCS} target="_blank" rel="noreferrer">
          API
        </a>
        <a href="/status">Status</a>
        {auth === "logged_in" ? (
          <a className="pbi-navCta" href="/console">
            Dashboard
          </a>
        ) : (
          <a className="pbi-navCta" href="/#access">
            Get access
          </a>
        )}
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="pbi-footer" style={{ marginTop: 6 }}>
      <div>© {new Date().getFullYear()} Kojib · PBI</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a href="/trust">Trust</a>
        <a href="/security">Security</a>
        <a href="/status">Status</a>
        <a href="/changelog">Changelog</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
      </div>
    </footer>
  );
}

function SectionHead({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="pbi-proofLabel">{kicker}</div>
      <div className="pbi-cardTitle" style={{ marginTop: 6 }}>
        {title}
      </div>
      <div className="pbi-cardBody" style={{ marginTop: 6, maxWidth: 920 }}>
        {body}
      </div>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="pbi-bullet">
      <span className="pbi-bulletDot">•</span>
      <span>{children}</span>
    </div>
  );
}
