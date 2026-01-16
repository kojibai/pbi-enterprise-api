import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiJson } from "../lib/api";

type PlanKey = "starter" | "pro" | "enterprise";

// NOTE: backend may return "pending" before billing is activated
type Me = { customer: { id: string; email: string; plan: string; quotaPerMonth: string } };
type UsageRow = { month_key: string; kind: string; total: string };

function normalizePlan(raw: unknown): { planKey: PlanKey; uiLabel: string; isPending: boolean } {
  const s = String(raw ?? "").toLowerCase().trim();

  if (s === "starter") return { planKey: "starter", uiLabel: "Starter", isPending: false };
  if (s === "pro") return { planKey: "pro", uiLabel: "Pro", isPending: false };
  if (s === "enterprise") return { planKey: "enterprise", uiLabel: "Scale", isPending: false };

  if (s === "pending") return { planKey: "starter", uiLabel: "Pending", isPending: true };

  // fallback: never crash
  return { planKey: "starter", uiLabel: s ? s.toUpperCase() : "Starter", isPending: false };
}

function toNum(s: string) {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function fmtInt(n: number) {
  return n.toLocaleString();
}

function fmtPctSmart(n: number) {
  const pct = n * 100;
  if (!Number.isFinite(pct) || pct <= 0) return "0%";
  if (pct < 1) return `${pct.toFixed(2)}%`;
  if (pct < 10) return `${pct.toFixed(1)}%`;
  return `${Math.round(pct)}%`;
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function fmtDateTime(d: Date) {
  try {
    return d.toLocaleString();
  } catch {
    return String(d);
  }
}

function monthKeyToDate(monthKey: string): Date | null {
  // monthKey: YYYY-MM
  const m = (monthKey ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(m)) return null;
  const d = new Date(`${m}-01T00:00:00.000Z`);
  return Number.isFinite(d.getTime()) ? d : null;
}

function fmtMonthKey(monthKey: string) {
  const d = monthKeyToDate(monthKey);
  if (!d) return monthKey;
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(d);
  } catch {
    return monthKey;
  }
}

function fmtRangeLabel(startMonthKey: string | null, endMonthKey: string | null) {
  if (!startMonthKey || !endMonthKey) return "—";
  if (startMonthKey === endMonthKey) return fmtMonthKey(startMonthKey);
  return `${fmtMonthKey(startMonthKey)} → ${fmtMonthKey(endMonthKey)}`;
}

export default function UsagePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [rangeMonths, setRangeMonths] = useState<6 | 12 | 24>(12);
  const [selectedKind, setSelectedKind] = useState<string>("__TOTAL__");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  async function load() {
    setErr("");
    setBusy(true);
    try {
      const m = await apiJson<Me>("/v1/portal/me");
      setMe(m);

      const u = await apiJson<{ rows: UsageRow[] }>("/v1/portal/usage");
      setRows(u.rows ?? []);
      setRefreshedAt(new Date());
    } catch {
      window.location.href = "/login";
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const t = window.setInterval(() => {
      void load();
    }, 30_000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh]);

  const { uiLabel: planUiLabel, isPending } = normalizePlan(me?.customer.plan);
  const planLabel = planUiLabel.toUpperCase();

  const quotaPerMonthNum = useMemo(() => {
    const raw = (me?.customer.quotaPerMonth ?? "").replace(/,/g, "").trim();
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [me?.customer.quotaPerMonth]);

  // Normalize usage into month buckets
  const normalized = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    const kindSet = new Set<string>();

    for (const r of rows) {
      const month = (r.month_key ?? "").trim();
      if (!month) continue;
      const kind = (r.kind ?? "").trim() || "unknown";
      const total = toNum(r.total ?? "0");

      kindSet.add(kind);

      const cur = map.get(month) ?? {};
      cur[kind] = (cur[kind] ?? 0) + total;
      map.set(month, cur);
    }

    const monthsAll = Array.from(map.keys()).sort(); // YYYY-MM sorts naturally
    const months = monthsAll.slice(Math.max(0, monthsAll.length - rangeMonths));

    const kinds = Array.from(kindSet).sort();

    const series = months.map((m) => {
      const byKind = map.get(m) ?? {};
      const total = Object.values(byKind).reduce((s, v) => s + v, 0);
      return { month: m, byKind, total };
    });

    return { months, kinds, series };
  }, [rows, rangeMonths]);

  const totalAll = useMemo(() => normalized.series.reduce((s, x) => s + x.total, 0), [normalized.series]);

  const totalByKind = useMemo(() => {
    const out: Record<string, number> = {};
    for (const s of normalized.series) {
      for (const k of Object.keys(s.byKind)) out[k] = (out[k] ?? 0) + (s.byKind[k] ?? 0);
    }
    return out;
  }, [normalized.series]);

  // Current month usage (best-effort: last month in series)
  const currentMonth = normalized.series.length ? normalized.series[normalized.series.length - 1] : null;
  const currentMonthTotal = currentMonth?.total ?? 0;

  const quotaFill = quotaPerMonthNum > 0 ? clamp01(currentMonthTotal / quotaPerMonthNum) : 0;

  const kindOptions = useMemo(() => ["__TOTAL__", ...normalized.kinds], [normalized.kinds]);

  // Selected series values
  const selectedValues = useMemo(() => {
    return normalized.series.map((s) => {
      const v = selectedKind === "__TOTAL__" ? s.total : (s.byKind[selectedKind] ?? 0);
      return { month: s.month, value: v };
    });
  }, [normalized.series, selectedKind]);

  function exportCsv() {
    const header = ["month_key", "kind", "total"];
    const lines = [header.join(",")];
    for (const r of rows) {
      const m = (r.month_key ?? "").replace(/"/g, '""');
      const k = (r.kind ?? "").replace(/"/g, '""');
      const t = String(r.total ?? "0").replace(/"/g, '""');
      lines.push(`"${m}","${k}","${t}"`);
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pbi-usage-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!me) return null;

  const seriesStart = normalized.series.length ? normalized.series[0].month : null;
  const seriesEnd = normalized.series.length ? normalized.series[normalized.series.length - 1].month : null;

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
              <div className="brandSub">Usage</div>
            </div>
          </div>

          <nav className="nav" aria-label="Portal navigation">
            <Link className="navLink" href="/console">
              Dashboard
            </Link>
            <Link className="navLink" href="/api-keys">
              API Keys
            </Link>
            <Link className="navLink" href="/billing">
              Billing
            </Link>
            <Link className="navLink navLinkActive" href="/usage">
              Usage
            </Link>
            <Link className="navLink" href="/terms">
              Terms
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
                  Live metering · audit-ready totals
                </div>

                <h1 className="h1 email">
                  <EmailText email={me.customer.email} />
                </h1>

                <p className="lead">
                  Usage is metered automatically (challenge + verify). Use this view for capacity planning, auditing, and rollout coverage.
                </p>

                <div className="kpiRow">
                  <KPI label="Plan" value={planLabel} />
                  <KPI label="Quota (month)" value={quotaPerMonthNum ? fmtInt(quotaPerMonthNum) : "—"} />
                  <KPI label="This month" value={fmtInt(currentMonthTotal)} />
                  <KPI label="All shown" value={fmtInt(totalAll)} />
                </div>

                {isPending ? (
                  <div className="pendingCallout" role="status">
                    <div className="pendingTitle">Pending billing activation</div>
                    <div className="pendingBody">
                      Your account is in <b>pending</b> state. Activate billing to start quota enforcement and metering at your selected plan.
                    </div>
                    <div className="pendingBtns">
                      <Link className="btnPrimaryLink" href="/billing">
                        Activate billing →
                      </Link>
                      <Link className="btnGhostLink" href="/api-keys">
                        Manage keys →
                      </Link>
                    </div>
                  </div>
                ) : null}

                {err ? <div className="error">{err}</div> : null}

                <div className="ctlRow">
                  <Segment
                    label="Range"
                    value={String(rangeMonths)}
                    options={[
                      { label: "6 mo", value: "6" },
                      { label: "12 mo", value: "12" },
                      { label: "24 mo", value: "24" }
                    ]}
                    onChange={(v) => setRangeMonths(Number(v) as 6 | 12 | 24)}
                  />

                  <Segment
                    label="Metric"
                    value={selectedKind}
                    options={kindOptions.map((k) => ({
                      label: k === "__TOTAL__" ? "Total" : k,
                      value: k
                    }))}
                    onChange={(v) => setSelectedKind(v)}
                    wide
                  />

                  <div className="ctlBtns">
                    <Toggle
                      label="Live"
                      checked={autoRefresh}
                      hint="30s"
                      onChange={() => setAutoRefresh((x) => !x)}
                    />
                    <button className="btnGhost" onClick={() => load()} disabled={busy} type="button">
                      {busy ? "Refreshing…" : "Refresh"}
                    </button>
                    <button className="btnPrimary" onClick={exportCsv} type="button">
                      Export CSV
                    </button>
                  </div>
                </div>

                <div className="subline">
                  <span className="dotLive" aria-hidden />
                  <span>
                    Last updated: <b>{refreshedAt ? fmtDateTime(refreshedAt) : "—"}</b>
                  </span>
                </div>
              </div>

              {/* Right rail: quota gauge */}
              <aside className="side">
                <div className="sideTop">
                  <div>
                    <div className="kicker">Capacity</div>
                    <div className="sideTitle">Monthly quota usage</div>
                  </div>
                  <div className="tag">{quotaPerMonthNum ? fmtPctSmart(quotaFill) : "—"}</div>
                </div>

                <div className="sideBody">
                  <QuotaGauge
                    fill={quotaFill}
                    pctLabel={quotaPerMonthNum ? fmtPctSmart(quotaFill) : "—"}
                    label={`${fmtInt(currentMonthTotal)} / ${quotaPerMonthNum ? fmtInt(quotaPerMonthNum) : "—"}`}
                    subLabel={
                      quotaPerMonthNum
                        ? `~${fmtPctSmart(quotaFill)} of quota · ${fmtRangeLabel(seriesStart, seriesEnd)}`
                        : `No quota detected · ${fmtRangeLabel(seriesStart, seriesEnd)}`
                    }
                  />

                  <div className="divider" />

                  <div className="hint">Tip: gate irreversible endpoints first. Expand coverage after you validate UX and failure modes.</div>
                </div>
              </aside>
            </div>
          </section>

          {/* CHARTS */}
          <section className="grid2">
            <div className="panel">
              <div className="panelHead">
                <div>
                  <div className="kicker">Trend</div>
                  <div className="panelTitle">{selectedKind === "__TOTAL__" ? "Total usage" : selectedKind}</div>
                </div>
                <div className="panelMeta">{fmtRangeLabel(seriesStart, seriesEnd)}</div>
              </div>

              <LineChart
                points={selectedValues}
                height={220}
                footer={
                  selectedKind === "__TOTAL__"
                    ? "Sum of all metered kinds across months."
                    : `Only the "${selectedKind}" kind across months.`
                }
              />
            </div>

            <div className="panel">
              <div className="panelHead">
                <div>
                  <div className="kicker">Breakdown</div>
                  <div className="panelTitle">By kind</div>
                </div>
                <div className="panelMeta">{Object.keys(totalByKind).length} kinds</div>
              </div>

              <BarBreakdown
                series={normalized.series}
                kinds={normalized.kinds}
                height={220}
                footer="Tap a bar to pin the per-month totals. This chart stays correct even if you add new meter kinds later."
              />
            </div>
          </section>

          {/* RAW TABLE */}
          <section className="panel">
            <div className="panelHead">
              <div>
                <div className="kicker">Rows</div>
                <div className="panelTitle">Metering ledger</div>
              </div>
              <div className="panelMeta">{rows.length.toLocaleString()} rows</div>
            </div>

            <div className="table">
              <div className="trow head" style={{ gridTemplateColumns: "1fr 1fr .6fr" }}>
                <div className="cell">Month</div>
                <div className="cell">Kind</div>
                <div className="cell right">Total</div>
              </div>

              {rows.length === 0 ? (
                <div className="trow" style={{ gridTemplateColumns: "1fr 1fr .6fr" }}>
                  <div className="cell muted">No usage rows yet.</div>
                  <div className="cell" />
                  <div className="cell" />
                </div>
              ) : (
                rows
                  .slice()
                  .sort((a, b) => (a.month_key < b.month_key ? 1 : a.month_key > b.month_key ? -1 : a.kind.localeCompare(b.kind)))
                  .map((u, idx) => (
                    <div className="trow" style={{ gridTemplateColumns: "1fr 1fr .6fr" }} key={`${u.month_key}:${u.kind}:${idx}`}>
                      <div className="cell">{u.month_key}</div>
                      <div className="cell">
                        <code className="inlineCode">{u.kind}</code>
                      </div>
                      <div className="cell right">{fmtInt(toNum(u.total))}</div>
                    </div>
                  ))
              )}
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

function EmailText({ email }: { email: string }) {
  // Allows natural wrapping ONLY at separators, preventing mid-token breaks like ".co" + "m"
  const parts = email.split(/([@.])/);
  return (
    <span className="emailInline" aria-label={email}>
      {parts.map((p, i) =>
        p === "@" || p === "." ? (
          <React.Fragment key={String(i)}>
            {p}
            <wbr />
          </React.Fragment>
        ) : (
          <React.Fragment key={String(i)}>{p}</React.Fragment>
        )
      )}
    </span>
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

function Segment({
  label,
  value,
  options,
  onChange,
  wide
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
  wide?: boolean;
}) {
  return (
    <div className={`seg ${wide ? "segWide" : ""}`}>
      <div className="segLabel">{label}</div>
      <div className="segBtns" role="tablist" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            className={`segBtn ${o.value === value ? "segBtnActive" : ""}`}
            type="button"
            onClick={() => onChange(o.value)}
            role="tab"
            aria-selected={o.value === value}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  hint,
  onChange
}: {
  label: string;
  checked: boolean;
  hint?: string;
  onChange: () => void;
}) {
  return (
    <button className="toggle" type="button" onClick={onChange} role="switch" aria-checked={checked}>
      <span className="toggleLeft">
        <span className="toggleLabel">{label}</span>
        {hint ? <span className="toggleHint">{hint}</span> : null}
      </span>
      <span className={`toggleTrack ${checked ? "toggleTrackOn" : ""}`} aria-hidden>
        <span className={`toggleKnob ${checked ? "toggleKnobOn" : ""}`} />
      </span>
    </button>
  );
}

/* ---------- Charts (no deps, pure SVG) ---------- */

function LineChart({
  points,
  height,
  footer
}: {
  points: { month: string; value: number }[];
  height: number;
  footer: string;
}) {
  const width = 920;
  const padX = 28;
  const padY = 18;

  const values = points.map((p) => p.value);
  const max = Math.max(1, ...values);
  const min = 0;

  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const coords = points.map((p, i) => {
    const x = padX + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const t = (p.value - min) / (max - min);
    const y = padY + (1 - t) * innerH;
    return { x, y, v: p.value, m: p.month };
  });

  const path = coords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`)
    .join(" ");

  const areaPath = `${path} L ${(padX + innerW).toFixed(2)} ${(padY + innerH).toFixed(2)} L ${padX.toFixed(2)} ${(padY + innerH).toFixed(
    2
  )} Z`;

  const last = coords.length ? coords[coords.length - 1] : null;

  return (
    <div>
      <div className="chartWrap">
        <svg viewBox={`0 0 ${width} ${height}`} className="chartSvg" aria-label="Usage trend chart" role="img">
          {Array.from({ length: 5 }).map((_, i) => {
            const y = padY + (i / 4) * innerH;
            return <line key={String(i)} x1={padX} y1={y} x2={padX + innerW} y2={y} className="chartGrid" />;
          })}
          <path d={areaPath} className="chartArea" />
          <path d={path} className="chartLine" />
          {coords.map((c) => (
            <circle key={c.m} cx={c.x} cy={c.y} r={4.2} className="chartDot" />
          ))}
          {last ? (
            <g>
              <circle cx={last.x} cy={last.y} r={6.2} className="chartDotHot" />
              <text x={last.x + 10} y={Math.max(14, last.y - 10)} className="chartText">
                {fmtInt(last.v)}
              </text>
            </g>
          ) : null}
        </svg>
      </div>
      <div className="chartFoot">{footer}</div>
    </div>
  );
}

function BarBreakdown({
  series,
  kinds,
  height,
  footer
}: {
  series: { month: string; byKind: Record<string, number>; total: number }[];
  kinds: string[];
  height: number;
  footer: string;
}) {
  const width = 920;
  const padX = 28;
  const padY = 18;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const max = Math.max(1, ...series.map((s) => s.total));
  const barW = series.length ? innerW / series.length : innerW;

  const kindClass = (_k: string, i: number) => `barSeg barSeg${(i % 4) + 1}`;

  const [activeIdx, setActiveIdx] = useState<number>(() => (series.length ? Math.max(0, series.length - 1) : 0));

  useEffect(() => {
    if (!series.length) return;
    setActiveIdx((prev) => {
      const next = Math.max(0, Math.min(prev, series.length - 1));
      return next;
    });
  }, [series.length]);

  const active = series.length ? series[Math.max(0, Math.min(activeIdx, series.length - 1))] : null;
  const activeKinds = kinds.length ? kinds : Object.keys(active?.byKind ?? {});
  const activeBreakdown = active
    ? activeKinds
        .map((k) => ({ kind: k, total: active.byKind[k] ?? 0 }))
        .filter((x) => x.total > 0)
    : [];

  return (
    <div>
      <div className="chartWrap">
        <svg viewBox={`0 0 ${width} ${height}`} className="chartSvg" aria-label="Usage breakdown chart" role="img">
          {Array.from({ length: 5 }).map((_, i) => {
            const y = padY + (i / 4) * innerH;
            return <line key={String(i)} x1={padX} y1={y} x2={padX + innerW} y2={y} className="chartGrid" />;
          })}

          {series.map((s, idx) => {
            const x0 = padX + idx * barW + 6;
            const w = Math.max(2, barW - 12);

            let acc = 0;
            const segs = (kinds.length ? kinds : Object.keys(s.byKind)).map((k, i) => {
              const v = s.byKind[k] ?? 0;
              if (v <= 0) return null;

              const h = (v / max) * innerH;
              const y = padY + innerH - ((acc + v) / max) * innerH;
              acc += v;

              return (
                <rect
                  key={`${s.month}:${k}`}
                  x={x0}
                  y={y}
                  width={w}
                  height={h}
                  rx={10}
                  className={kindClass(k, i)}
                />
              );
            });

            const tooltip =
              `${fmtMonthKey(s.month)}\n` +
              Object.entries(s.byKind)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => `${k}: ${fmtInt(v)}`)
                .join("\n") +
              `\nTotal: ${fmtInt(s.total)}\n\n(Tap to pin)`;

            const isActive = active?.month === s.month;

            return (
              <g
                key={s.month}
                onClick={() => setActiveIdx(idx)}
                className={isActive ? "barGroup barGroupActive" : "barGroup"}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActiveIdx(idx);
                  }
                }}
              >
                <title>{tooltip}</title>
                {segs}
              </g>
            );
          })}
        </svg>
      </div>

<div className="legend">
  {(kinds.length ? kinds : Object.keys(series[0]?.byKind ?? {})).slice(0, 8).map((k, i) => (
    <div className="legendItem" key={k}>
      <span className={`legendSwatch barSeg barSeg${(i % 4) + 1}`} />
      <span className="legendText">{k}</span>
    </div>
  ))}
</div>
      <div className="pin">
        <div className="pinHead">
          <div className="pinTitle">Pinned month</div>
          <div className="pinMeta">{active ? fmtMonthKey(active.month) : "—"}</div>
        </div>

        {active ? (
          <div className="pinBody">
            <div className="pinTotals">
              <div className="pinTotal">
                <div className="pinK">Total</div>
                <div className="pinV">{fmtInt(active.total)}</div>
              </div>
              {activeBreakdown.slice(0, 6).map((x, i) => (
                <div className="pinTotal" key={`${x.kind}:${String(i)}`}>
                  <div className="pinK">{x.kind}</div>
                  <div className="pinV">{fmtInt(x.total)}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="pinEmpty">No data yet.</div>
        )}
      </div>

      <div className="chartFoot">{footer}</div>
    </div>
  );
}

function QuotaGauge({
  fill,
  pctLabel,
  label,
  subLabel
}: {
  fill: number;
  pctLabel: string;
  label: string;
  subLabel: string;
}) {
  const pct = clamp01(fill);
  const deg = Math.round(pct * 270);
type CSSVars = React.CSSProperties & { ["--deg"]?: string };
const style: CSSVars = { ["--deg"]: `${deg}deg` };


  return (
    <div className="gauge">
      <div className="gaugeRing" style={style} aria-hidden />
      <div className="gaugeCore">
        <div className="gaugePct">{pctLabel}</div>
        <div className="gaugeLabel">{label}</div>
        <div className="gaugeSub">{subLabel}</div>
      </div>
    </div>
  );
}

/* ---------- CSS ---------- */

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
a{ color: inherit; }
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
.navLinkActive{ border-color: rgba(120,255,231,.28); background: rgba(120,255,231,.08); }

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

/* Email: only break at @ and . via <wbr/> */
.h1.email{ word-break: normal; overflow-wrap: normal; }
.emailInline{ display:inline; }

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
@media (max-width: 980px){ .kpiRow{ grid-template-columns: 1fr 1fr; } }
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

/* Pending */
.pendingCallout{
  margin-top: 12px;
  padding: 12px;
  border-radius: 18px;
  border: 1px solid rgba(255,190,120,.28);
  background: rgba(255,190,120,.10);
}
.pendingTitle{ font-weight: 950; }
.pendingBody{ margin-top: 6px; font-size: 13px; opacity: .92; line-height: 1.5; }
.pendingBtns{ margin-top: 10px; display:flex; gap: 10px; flex-wrap: wrap; }
.btnPrimaryLink{
  border-radius: 16px;
  padding: 11px 14px;
  font-weight: 950;
  border: 1px solid rgba(120,255,231,.55);
  background: rgba(120,255,231,.95);
  color: #05070e;
  text-decoration:none;
  display:inline-flex;
  align-items:center;
  justify-content:center;
}
.btnGhostLink{
  border-radius: 16px;
  padding: 11px 14px;
  font-weight: 950;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.92);
  text-decoration:none;
  display:inline-flex;
  align-items:center;
  justify-content:center;
}

/* Controls */
.ctlRow{
  margin-top: 12px;
  display:grid;
  grid-template-columns: 1fr 2fr auto;
  gap: 10px;
  align-items:end;
}
@media (max-width: 980px){
  .ctlRow{ grid-template-columns: 1fr; align-items: stretch; }
}
.ctlBtns{ display:flex; gap: 10px; flex-wrap: wrap; justify-content:flex-end; }
@media (max-width: 980px){ .ctlBtns{ justify-content:flex-start; } }

.subline{
  margin-top: 10px;
  display:flex;
  align-items:center;
  gap: 10px;
  font-size: 12px;
  color: rgba(255,255,255,.70);
}
.dotLive{
  width: 8px; height: 8px; border-radius:999px;
  background: rgba(120,255,231,.95);
  box-shadow: 0 0 0 6px rgba(120,255,231,.10), 0 0 28px rgba(120,255,231,.22);
}

/* Segment */
.seg{ border: 1px solid rgba(255,255,255,.12); background: rgba(0,0,0,.22); border-radius: 18px; padding: 10px; box-shadow: var(--shadow3); }
.segLabel{ font-size: 11px; color: rgba(255,255,255,.60); }
.segBtns{ margin-top: 10px; display:flex; gap: 8px; flex-wrap: wrap; }
.segBtn{
  border-radius: 14px;
  padding: 10px 12px;
  font-weight: 950;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.92);
  cursor:pointer;
  transition: transform .12s ease, background .12s ease, border-color .12s ease;
  font-size: 12px;
  line-height: 1;
}
.segBtn:hover{ transform: translateY(-1px); background: rgba(255,255,255,.09); border-color: rgba(255,255,255,.22); }
.segBtnActive{ border-color: rgba(120,255,231,.28); background: rgba(120,255,231,.10); }

/* Buttons */
.error{
  margin-top: 10px;
  padding: 10px;
  border-radius: 14px;
  border: 1px solid rgba(255,138,160,.35);
  background: rgba(255,138,160,.10);
  font-size: 13px;
}
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
.btnGhost{
  border-radius: 16px;
  padding: 11px 14px;
  font-weight: 950;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.92);
  cursor: pointer;
  transition: transform .12s ease, background .12s ease, border-color .12s ease;
}
.btnGhost:hover{ transform: translateY(-1px); background: rgba(255,255,255,.09); border-color: rgba(255,255,255,.22); }

/* Toggle switch */
.toggle{
  border-radius: 16px;
  padding: 11px 12px;
  font-weight: 950;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.92);
  cursor: pointer;
  transition: transform .12s ease, background .12s ease, border-color .12s ease;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 10px;
  min-width: 150px;
}
.toggle:hover{ transform: translateY(-1px); background: rgba(255,255,255,.09); border-color: rgba(255,255,255,.22); }
.toggleLeft{ display:flex; align-items:baseline; gap: 8px; }
.toggleLabel{ font-size: 13px; }
.toggleHint{ font-size: 11px; opacity:.72; }
.toggleTrack{
  width: 44px;
  height: 24px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.16);
  background: rgba(0,0,0,.25);
  position: relative;
  flex: 0 0 auto;
}
.toggleTrackOn{
  border-color: rgba(120,255,231,.35);
  background: rgba(120,255,231,.20);
}
.toggleKnob{
  position:absolute;
  left: 3px; top: 50%;
  transform: translateY(-50%);
  width: 18px; height: 18px;
  border-radius:999px;
  background: rgba(255,255,255,.85);
  box-shadow: 0 10px 24px rgba(0,0,0,.35);
  transition: left .14s ease, background .14s ease;
}
.toggleKnobOn{ left: 23px; background: rgba(120,255,231,.98); }

/* Side rail */
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
.sideBody{ margin-top: 12px; display:grid; gap: 12px; }
.divider{ height: 1px; background: rgba(255,255,255,.10); margin: 2px 0; }
.hint{ font-size: 12px; opacity:.75; line-height:1.55; }

/* Gauge */
.gauge{
  position: relative;
  height: 220px;
  border-radius: 22px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.06);
  box-shadow: var(--shadow3);
  overflow:hidden;
}
.gaugeRing{
  position:absolute; inset:-40px;
  background:
    conic-gradient(from 225deg,
      rgba(120,255,231,.95) 0 var(--deg),
      rgba(255,255,255,.10) var(--deg) 270deg,
      transparent 270deg 360deg);
  opacity: .95;
}
.gaugeCore{
  position:absolute; inset: 18px;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(0,0,0,.22);
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  text-align:center;
  padding: 12px;
}
.gaugePct{ font-weight: 950; font-size: 30px; letter-spacing: -0.02em; }
.gaugeLabel{ margin-top: 8px; font-size: 12px; color: rgba(255,255,255,.72); line-height:1.4; }
.gaugeSub{ margin-top: 6px; font-size: 11px; color: rgba(255,255,255,.58); line-height:1.45; }

/* Panels */
.grid2{ display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 980px){ .grid2{ grid-template-columns: 1fr; } }

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

/* Charts */
.chartWrap{
  margin-top: 12px;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(0,0,0,.20);
  overflow:hidden;
}
.chartSvg{ width: 100%; height: auto; display:block; }
.chartGrid{ stroke: rgba(255,255,255,.10); stroke-width: 1; }
.chartLine{ fill: none; stroke: rgba(120,255,231,.92); stroke-width: 3; filter: drop-shadow(0 10px 22px rgba(0,0,0,.35)); }
.chartArea{ fill: rgba(120,255,231,.10); }
.chartDot{ fill: rgba(255,255,255,.30); stroke: rgba(255,255,255,.25); stroke-width: 1; }
.chartDotHot{ fill: rgba(120,255,231,.95); stroke: rgba(255,255,255,.18); stroke-width: 1; }
.chartText{ fill: rgba(255,255,255,.86); font-size: 14px; font-weight: 900; }
.chartFoot{ margin-top: 10px; font-size: 12px; opacity: .72; line-height: 1.5; }

.barSeg{ opacity: .95; }
.barSeg1{ fill: rgba(120,255,231,.78); }
.barSeg2{ fill: rgba(154,170,255,.62); }
.barSeg3{ fill: rgba(255,190,120,.52); }
.barSeg4{ fill: rgba(255,138,160,.46); }

.barGroup{ cursor: pointer; }
.barGroupActive{ filter: drop-shadow(0 10px 18px rgba(0,0,0,.30)); }

/* Legend */
.legend{ margin-top: 10px; display:flex; flex-wrap: wrap; gap: 10px; }
.legendItem{ display:flex; align-items:center; gap: 8px; }
.legendSwatch{
  width: 12px; height: 12px; border-radius: 4px;
  border: 1px solid rgba(255,255,255,.18);
}
.legendText{ font-size: 12px; opacity: .80; }

/* Pinned month panel */
.pin{
  margin-top: 12px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(0,0,0,.20);
  padding: 12px;
}
.pinHead{ display:flex; align-items:center; justify-content:space-between; gap: 10px; }
.pinTitle{ font-size: 12px; opacity:.72; }
.pinMeta{ font-size: 12px; font-weight: 950; }
.pinBody{ margin-top: 10px; }
.pinTotals{
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
@media (max-width: 520px){
  .pinTotals{ grid-template-columns: 1fr; }
}
.pinTotal{
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.04);
  padding: 10px;
}
.pinK{ font-size: 11px; opacity:.65; }
.pinV{ margin-top: 6px; font-weight: 950; }
.pinEmpty{ margin-top: 10px; font-size: 12px; opacity:.72; }

/* Table */
.table{
  margin-top: 12px;
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
  position: sticky;
  top: 0;
  z-index: 1;
}
.cell{ min-width:0; overflow-wrap:anywhere; }
.right{ text-align:right; }
.muted{ opacity:.75; }

.inlineCode{
  font-family: var(--mono);
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
}

/* Footer */
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

@media (max-width: 980px){ .side{ display:none; } }
@media (max-width: 820px){ .right{ text-align:left; } }
`;