// pages/api/probe.ts
import type { NextApiRequest, NextApiResponse } from "next";

type ProbeKey = "api" | "docs" | "portal" | "demo" | "tool";

type ProbeResult =
  | { ok: true; url: string; checkedAtISO: string; ms: number; code: number; probeVersion: "v2" }
  | { ok: false; url: string; checkedAtISO: string; ms: number; code?: number; error: string; probeVersion: "v2" };

function nowISO(): string {
  return new Date().toISOString();
}

function pickKey(q: string | string[] | undefined): string {
  if (!q) return "";
  return Array.isArray(q) ? (q[0] ?? "") : q;
}

function normalizeBase(u: string): string {
  return u.replace(/\/+$/, "");
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p = path.replace(/^\/+/, "");
  return `${b}/${p}`;
}

function forceHttpsBase(base: string): string {
  const b = normalizeBase(base);
  if (b.startsWith("https://")) return b;
  if (b.startsWith("http://")) return `https://${b.slice("http://".length)}`;
  return b;
}

async function getWithTimeout(url: string, timeoutMs: number): Promise<{ ok: boolean; code?: number; ms: number; err?: string }> {
  const start = Date.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const r = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: ctrl.signal,
      headers: {
        "user-agent": "PBI-StatusProbe/2.0",
        accept: "*/*"
      }
    });

    return { ok: r.ok, code: r.status, ms: Date.now() - start };
  } catch (e) {
    return { ok: false, ms: Date.now() - start, err: e instanceof Error ? e.message : "fetch failed" };
  } finally {
    clearTimeout(t);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ProbeResult>) {
  res.setHeader("cache-control", "no-store, max-age=0");

  const checkedAtISO = nowISO();
  const keyRaw = pickKey(req.query.key);

  const allowed: ProbeKey[] = ["api", "docs", "portal", "demo", "tool"];
  if (!keyRaw || !allowed.includes(keyRaw as ProbeKey)) {
    res.status(200).json({
      ok: false,
      url: "",
      checkedAtISO,
      ms: 0,
      code: 400,
      error: `invalid key (got "${keyRaw || ""}")`,
      probeVersion: "v2"
    });
    return;
  }

  const apiBase = forceHttpsBase(process.env.NEXT_PUBLIC_PBI_API_BASE ?? "https://api.kojib.com");

  const targets: Record<ProbeKey, string> = {
    // ✅ Health is always /health (GET). No HEAD. No //.
    api: joinUrl(apiBase, "/health"),
    docs: "https://api.kojib.com/docs",
    portal: "https://pbi.kojib.com/",
    demo: "https://demo.kojib.com",
    tool: "https://tool.kojib.com"
  };

  const url = targets[keyRaw as ProbeKey];

  if (!url.startsWith("https://")) {
    res.status(200).json({
      ok: false,
      url,
      checkedAtISO,
      ms: 0,
      code: 400,
      error: "invalid target url (must be https)",
      probeVersion: "v2"
    });
    return;
  }

  const p = await getWithTimeout(url, 4500);

  if (p.ok && typeof p.code === "number") {
    res.status(200).json({ ok: true, url, checkedAtISO, ms: p.ms, code: p.code, probeVersion: "v2" });
    return;
  }

  res.status(200).json({
    ok: false,
    url,
    checkedAtISO,
    ms: p.ms,
    code: p.code,
    error: p.err ?? "unavailable",
    probeVersion: "v2"
  });
}
