// pages/api/probe.ts
import type { NextApiRequest, NextApiResponse } from "next";

type ProbeKey = "api" | "docs" | "portal" | "demo" | "tool";

type ProbeResult =
  | { ok: true; url: string; checkedAtISO: string; ms?: number; code?: number }
  | { ok: false; url: string; checkedAtISO: string; ms?: number; code?: number; error: string };

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

function forceHttps(url: string): string {
  try {
    const u = new URL(url);
    const host = u.host.toLowerCase();

    const forceHosts = new Set(["api.kojib.com", "pbi.kojib.com", "demo.kojib.com", "tool.kojib.com"]);
    if (forceHosts.has(host)) u.protocol = "https:";
    return u.toString();
  } catch {
    return url;
  }
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  method: "GET" | "HEAD"
): Promise<{ ok: boolean; code?: number; ms?: number; err?: string }> {
  const start = Date.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const r = await fetch(url, {
      method,
      redirect: "follow",
      cache: "no-store",
      signal: ctrl.signal,
      headers: { "user-agent": "PBI-StatusProbe/1.0", accept: "*/*" }
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
  const key = keyRaw as ProbeKey;

  const apiBase = forceHttps(normalizeBase(process.env.NEXT_PUBLIC_PBI_API_BASE ?? "https://api.kojib.com"));

  const targets: Record<ProbeKey, string> = {
    api: joinUrl(apiBase, "/health"),
    docs: "https://api.kojib.com/docs",
    portal: "https://pbi.kojib.com/",
    demo: "https://demo.kojib.com",
    tool: "https://tool.kojib.com"
  };

  if (!keyRaw || !(keyRaw in targets)) {
    res.status(200).json({
      ok: false,
      url: "",
      checkedAtISO,
      error: `invalid key (got "${keyRaw || ""}")`
    });
    return;
  }

  const url = targets[key];

  if (!url.startsWith("https://")) {
    res.status(200).json({
      ok: false,
      url,
      checkedAtISO,
      error: "invalid target url (must be https)"
    });
    return;
  }

  // ✅ Critical fix:
  // - API health should always be checked with GET (many stacks 404 on HEAD).
  // - HTML pages can use HEAD for speed, but fallback to GET if HEAD isn't OK.
  if (key === "api") {
    const p = await fetchWithTimeout(url, 4500, "GET");
    if (p.ok) {
      res.status(200).json({ ok: true, url, checkedAtISO, ms: p.ms, code: p.code });
      return;
    }
    res.status(200).json({ ok: false, url, checkedAtISO, ms: p.ms, code: p.code, error: p.err ?? "unavailable" });
    return;
  }

  // For non-api pages: HEAD first, then GET fallback (including 404/405)
  const head = await fetchWithTimeout(url, 4500, "HEAD");
  if (head.ok) {
    res.status(200).json({ ok: true, url, checkedAtISO, ms: head.ms, code: head.code });
    return;
  }

  // If HEAD fails (very common), do GET.
  const get = await fetchWithTimeout(url, 4500, "GET");
  if (get.ok) {
    res.status(200).json({ ok: true, url, checkedAtISO, ms: get.ms, code: get.code });
    return;
  }

  res.status(200).json({
    ok: false,
    url,
    checkedAtISO,
    ms: get.ms ?? head.ms,
    code: get.code ?? head.code,
    error: get.err ?? head.err ?? "unavailable"
  });
}
